/**
 * Data-access layer for the dashboard.
 *
 * Reads real enrollment progress, the user's completions, and the last studied
 * lesson (derived from the most recent attempt) so the dashboard reflects
 * server-authoritative state. Nothing here computes trusted XP.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  AttemptRow,
  CourseRow,
  EnrollmentRow,
  LessonRow,
  ModuleRow,
  ProfileRow,
} from '@/types/database';

export const dashboardKeys = {
  overview: (userId: string | undefined) =>
    ['dashboard', 'overview', userId] as const,
  trail: (userId: string | undefined, courseId: string | null) =>
    ['dashboard', 'trail', userId, courseId] as const,
};

export interface DashboardEnrollment {
  enrollment: EnrollmentRow;
  course: CourseRow;
}

export interface LastStudied {
  attempt: AttemptRow;
  lessonId: string;
  lessonTitle: string;
  courseId: string | null;
  courseTitle: string | null;
}

export interface DashboardOverview {
  profile: ProfileRow | null;
  enrollments: DashboardEnrollment[];
  completedLessonIds: string[];
  lastStudied: LastStudied | null;
}

/**
 * Load the dashboard overview: profile (XP/level/streak), course enrollments
 * with real progress, the set of completed lesson ids, and the last studied
 * lesson (most recent attempt) so "Continuar" can resume it.
 */
export function useDashboardOverview(
  userId: string | undefined,
): UseQueryResult<DashboardOverview> {
  return useQuery<DashboardOverview>({
    enabled: !!userId,
    queryKey: dashboardKeys.overview(userId),
    queryFn: async () => {
      const uid = userId as string;

      const [profileRes, enrollRes, completionsRes, lastAttemptRes] =
        await Promise.all([
          supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
          supabase
            .from('enrollments')
            .select(
              'id, user_id, course_id, status, progress, created_at, updated_at, ' +
                'course:courses(id, creator_id, title, slug, description, category, tags, cover_url, status, visibility, created_at, updated_at)',
            )
            .eq('user_id', uid)
            .order('updated_at', { ascending: false }),
          supabase
            .from('completions')
            .select('lesson_id')
            .eq('user_id', uid)
            .eq('context', 'course'),
          supabase
            .from('attempts')
            .select(
              'id, user_id, lesson_id, course_id, room_id, started_at, finished_at, xp_earned, correct_count, total_count, ' +
                'lesson:lessons(id, title), course:courses(id, title)',
            )
            .eq('user_id', uid)
            .is('room_id', null)
            .not('finished_at', 'is', null)
            .order('finished_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      if (profileRes.error) throw profileRes.error;
      if (enrollRes.error) throw enrollRes.error;
      if (completionsRes.error) throw completionsRes.error;
      if (lastAttemptRes.error) throw lastAttemptRes.error;

      type EnrollJoined = EnrollmentRow & { course: CourseRow | null };
      const enrollments: DashboardEnrollment[] = (
        (enrollRes.data ?? []) as unknown as EnrollJoined[]
      )
        .filter((r) => r.course)
        .map((r) => ({ enrollment: r, course: r.course as CourseRow }));

      const completedLessonIds = (completionsRes.data ?? []).map(
        (c) => c.lesson_id,
      );

      let lastStudied: LastStudied | null = null;
      if (lastAttemptRes.data) {
        type AttemptJoined = AttemptRow & {
          lesson: { id: string; title: string } | null;
          course: { id: string; title: string } | null;
        };
        const a = lastAttemptRes.data as unknown as AttemptJoined;
        lastStudied = {
          attempt: a,
          lessonId: a.lesson_id,
          lessonTitle: a.lesson?.title ?? 'Aula',
          courseId: a.course?.id ?? a.course_id,
          courseTitle: a.course?.title ?? null,
        };
      }

      return {
        profile: profileRes.data,
        enrollments,
        completedLessonIds,
        lastStudied,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Course trail (modules -> lessons) with completion + locking
// ---------------------------------------------------------------------------

export interface TrailLesson {
  lesson: LessonRow;
  completed: boolean;
  /** Locked until the previous lesson in the course order is completed. */
  locked: boolean;
}

export interface TrailModule {
  module: ModuleRow;
  lessons: TrailLesson[];
}

export interface CourseTrail {
  courseId: string;
  courseTitle: string;
  modules: TrailModule[];
}

/**
 * Build the module/lesson trail for a course with per-lesson completion and
 * sequential locking: a lesson is unlocked once every preceding lesson (in
 * module/lesson position order) has a completion. The first lesson is always
 * unlocked. This mirrors the spec's "lesson locking per course configuration".
 */
export function useCourseTrail(
  userId: string | undefined,
  courseId: string | null,
): UseQueryResult<CourseTrail> {
  return useQuery<CourseTrail>({
    enabled: !!userId && !!courseId,
    queryKey: dashboardKeys.trail(userId, courseId),
    queryFn: async () => {
      const uid = userId as string;
      const cid = courseId as string;

      const [courseRes, modulesRes, completionsRes] = await Promise.all([
        supabase.from('courses').select('id, title').eq('id', cid).single(),
        supabase
          .from('modules')
          .select(
            'id, course_id, title, description, position, color, created_at, updated_at, ' +
              'lessons(id, module_id, title, content, position, status, created_at, updated_at)',
          )
          .eq('course_id', cid)
          .order('position', { ascending: true }),
        supabase
          .from('completions')
          .select('lesson_id')
          .eq('user_id', uid)
          .eq('context', 'course'),
      ]);

      if (courseRes.error) throw courseRes.error;
      if (modulesRes.error) throw modulesRes.error;
      if (completionsRes.error) throw completionsRes.error;

      const completed = new Set(
        (completionsRes.data ?? []).map((c) => c.lesson_id),
      );

      type ModuleJoined = ModuleRow & { lessons: LessonRow[] };
      const moduleRows = (modulesRes.data ?? []) as unknown as ModuleJoined[];

      // Flatten lessons in course order to compute sequential locking.
      const ordered: LessonRow[] = [];
      const modules: TrailModule[] = moduleRows
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((m) => {
          const lessons = [...(m.lessons ?? [])].sort(
            (a, b) => a.position - b.position,
          );
          ordered.push(...lessons);
          return { module: m, lessons: [] as TrailLesson[] };
        });

      // A lesson is locked until all strictly-earlier lessons are completed.
      const lockedByLessonId = new Map<string, boolean>();
      let allPrevCompleted = true;
      for (const l of ordered) {
        const locked = !allPrevCompleted;
        lockedByLessonId.set(l.id, locked);
        if (!completed.has(l.id)) allPrevCompleted = false;
      }

      // Re-attach lessons to their modules with completion + locked flags.
      let mi = 0;
      for (const m of moduleRows
        .slice()
        .sort((a, b) => a.position - b.position)) {
        const lessons = [...(m.lessons ?? [])].sort(
          (a, b) => a.position - b.position,
        );
        modules[mi].lessons = lessons.map((lesson) => ({
          lesson,
          completed: completed.has(lesson.id),
          locked: lockedByLessonId.get(lesson.id) ?? false,
        }));
        mi += 1;
      }

      return {
        courseId: cid,
        courseTitle: courseRes.data.title,
        modules,
      };
    },
  });
}
