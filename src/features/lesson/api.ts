/**
 * Data-access layer for the lesson runner.
 *
 * The server (RLS + the finalize_attempt SECURITY DEFINER function) is the
 * single authority for grading, XP, progress, completion, streak and medals.
 * The client flow is strictly:
 *   1. insert an `attempts` row (course OR room context),
 *   2. insert one `answers` row per question with the raw `submitted` jsonb
 *      (is_correct / xp_earned are LEFT for the server),
 *   3. call the finalize_attempt RPC and display the totals it returns.
 * Nothing here writes a trusted xp_earned / is_correct value.
 */

import {
  useMutation,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  AnswerRow,
  AttemptRow,
  CompletionRow,
  Json,
  LessonRow,
  ModuleRow,
  QuestionRow,
} from '@/types/db';
import type { AttemptResult, SubmittedAnswer } from '@/types/domain';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const lessonKeys = {
  all: ['lesson'] as const,
  withQuestions: (lessonId: string) =>
    ['lesson', 'questions', lessonId] as const,
  progress: (lessonId: string, userId: string | undefined) =>
    ['lesson', 'progress', lessonId, userId] as const,
};

// ---------------------------------------------------------------------------
// Lesson + questions (ordered) and the owning course context
// ---------------------------------------------------------------------------

export interface LessonWithQuestions {
  lesson: LessonRow;
  /** The module the lesson belongs to. */
  module: ModuleRow;
  /** Questions ordered by position. */
  questions: QuestionRow[];
  /** The owning course id (threaded as the course context for attempts). */
  courseId: string;
  courseTitle: string;
}

/**
 * Fetch a lesson with its ordered questions plus the owning module/course.
 * The course id is used as the default course context when starting attempts.
 */
export function useLessonWithQuestions(
  lessonId: string | undefined,
): UseQueryResult<LessonWithQuestions> {
  return useQuery<LessonWithQuestions>({
    enabled: !!lessonId,
    queryKey: lessonKeys.withQuestions(lessonId ?? ''),
    queryFn: async () => {
      const id = lessonId as string;
      const { data, error } = await supabase
        .from('lessons')
        .select(
          'id, module_id, title, content, position, status, created_at, updated_at, ' +
            'questions(id, lesson_id, type, prompt, position, config, xp_value, created_at, updated_at), ' +
            'module:modules(id, course_id, title, description, position, color, created_at, updated_at, ' +
            'course:courses(id, title))',
        )
        .eq('id', id)
        .single();
      if (error) throw error;

      type Joined = LessonRow & {
        questions: QuestionRow[];
        module:
          (ModuleRow & { course: { id: string; title: string } | null }) | null;
      };
      const row = data as unknown as Joined;
      if (!row.module || !row.module.course) {
        throw new Error('Aula sem curso associado.');
      }

      const { course, ...moduleRow } = row.module;
      const questions = [...(row.questions ?? [])].sort(
        (a, b) => a.position - b.position,
      );

      return {
        lesson: {
          id: row.id,
          module_id: row.module_id,
          title: row.title,
          content: row.content,
          position: row.position,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at,
        },
        module: moduleRow as ModuleRow,
        questions,
        courseId: course.id,
        courseTitle: course.title,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Attempt context (course vs room) — threaded so finalize_attempt behaves right
// ---------------------------------------------------------------------------

/**
 * The context an attempt belongs to. Exactly one of courseId / roomId is set:
 * - course context (roomId undefined) adds to global XP + enrollment progress,
 * - room context (roomId set) stays internal to the room (FEAT-006 reuse).
 * The server derives the behaviour from attempt.room_id being null or not.
 */
export type AttemptContext =
  | { courseId: string; roomId?: undefined }
  | { roomId: string; courseId?: string };

/** One raw submission paired with its question id (no grading on the client). */
export interface SubmittedEntry {
  questionId: string;
  submitted: SubmittedAnswer;
}

/**
 * Create an attempt row for a lesson in the given context. For a room-context
 * attempt we still record course_id when known (the server keys off room_id to
 * decide course vs room behaviour).
 */
export async function startAttempt(
  userId: string,
  lessonId: string,
  context: AttemptContext,
): Promise<AttemptRow> {
  const { data, error } = await supabase
    .from('attempts')
    .insert({
      user_id: userId,
      lesson_id: lessonId,
      course_id: context.courseId ?? null,
      room_id: context.roomId ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Persist all answers for an attempt. Only the raw `submitted` jsonb is written;
 * is_correct / xp_earned are intentionally omitted and overwritten server-side
 * by finalize_attempt.
 */
export async function submitAnswers(
  attemptId: string,
  entries: SubmittedEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const { error } = await supabase.from('answers').insert(
    entries.map((e) => ({
      attempt_id: attemptId,
      question_id: e.questionId,
      submitted: e.submitted as unknown as Json,
    })),
  );
  if (error) throw error;
}

/**
 * Call the server-authoritative finalize_attempt RPC. It grades every answer,
 * sets attempt totals, inserts the completion, updates progress and (for course
 * context) global XP/level, then returns the authoritative totals to display.
 *
 * Anti-regrind: the server may return xpEarned = 0 (or less than the raw
 * question XP) when the user already answered a question correctly in a prior
 * finalized attempt. The client does not recompute XP, so the "+X XP" message
 * naturally reflects whatever the server awarded.
 */
export async function finalizeAttempt(
  attemptId: string,
): Promise<AttemptResult> {
  const { data, error } = await supabase.rpc('finalize_attempt', {
    p_attempt_id: attemptId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Falha ao finalizar a tentativa.');
  return {
    correctCount: row.correct_count,
    totalCount: row.total_count,
    xpEarned: row.xp_earned,
  };
}

/**
 * Run the full finalize flow for a lesson attempt: insert answers, then invoke
 * the RPC. Returns the server totals. Grading/XP are entirely server-side.
 */
export interface FinalizeInput {
  userId: string;
  lessonId: string;
  context: AttemptContext;
  entries: SubmittedEntry[];
}

export function useFinalizeLesson() {
  return useMutation<AttemptResult, Error, FinalizeInput>({
    mutationFn: async ({ userId, lessonId, context, entries }) => {
      const attempt = await startAttempt(userId, lessonId, context);
      await submitAnswers(attempt.id, entries);
      return finalizeAttempt(attempt.id);
    },
  });
}

// ---------------------------------------------------------------------------
// Progress / completion lookup
// ---------------------------------------------------------------------------

export interface LessonProgress {
  /** Whether the current user has at least one completion for this lesson. */
  completed: boolean;
  completion: CompletionRow | null;
  /** The most recent finalized attempt for this lesson, if any. */
  lastAttempt: AttemptRow | null;
}

/**
 * Read the current user's progress for a lesson: whether it has a completion
 * (course context) and the most recent finalized attempt for showing results.
 */
export function useLessonProgress(
  lessonId: string | undefined,
  userId: string | undefined,
): UseQueryResult<LessonProgress> {
  return useQuery<LessonProgress>({
    enabled: !!lessonId && !!userId,
    queryKey: lessonKeys.progress(lessonId ?? '', userId),
    queryFn: async () => {
      const lid = lessonId as string;
      const uid = userId as string;

      const [completionRes, attemptRes] = await Promise.all([
        supabase
          .from('completions')
          .select('*')
          .eq('user_id', uid)
          .eq('lesson_id', lid)
          .eq('context', 'course')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('attempts')
          .select('*')
          .eq('user_id', uid)
          .eq('lesson_id', lid)
          .not('finished_at', 'is', null)
          .order('finished_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (completionRes.error) throw completionRes.error;
      if (attemptRes.error) throw attemptRes.error;

      return {
        completed: !!completionRes.data,
        completion: completionRes.data,
        lastAttempt: attemptRes.data,
      };
    },
  });
}

/** Load every answer of a finalized attempt (to show per-question results). */
export async function getAttemptAnswers(
  attemptId: string,
): Promise<AnswerRow[]> {
  const { data, error } = await supabase
    .from('answers')
    .select('*')
    .eq('attempt_id', attemptId);
  if (error) throw error;
  return data ?? [];
}
