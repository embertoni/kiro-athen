/**
 * Data-access layer for the courses feature.
 *
 * TanStack Query hooks over the typed Supabase client. The server (RLS +
 * domain functions) is authoritative; these hooks only read/write within the
 * policies the backend enforces. Nothing here computes trusted XP or grading.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  CommentRow,
  CourseRow,
  CourseStatus,
  CourseVisibility,
  EnrollmentRow,
  LessonRow,
  ModuleRow,
  ProfileRow,
  QuestionRow,
  QuestionType,
  ReviewRow,
} from '@/types/database';
import type { Json } from '@/types/database';
import { averageRating, type CatalogFilters } from './helpers';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const courseKeys = {
  all: ['courses'] as const,
  catalog: (filters: CatalogFilters) =>
    ['courses', 'catalog', filters] as const,
  detail: (courseId: string) => ['courses', 'detail', courseId] as const,
  myEnrollments: (userId: string | undefined) =>
    ['courses', 'enrollments', userId] as const,
  myCreated: (userId: string | undefined) =>
    ['courses', 'created', userId] as const,
};

// ---------------------------------------------------------------------------
// Catalog listing (filters + offset pagination for "ver mais")
// ---------------------------------------------------------------------------

export const CATALOG_PAGE_SIZE = 9;

export interface CatalogCourse {
  course: CourseRow;
  creatorName: string;
  studentCount: number;
}

export interface CatalogPage {
  items: CatalogCourse[];
  /** True when more rows exist beyond this page (for "Ver mais"). */
  hasMore: boolean;
  /** The offset the next page should start at. */
  nextOffset: number;
}

interface CourseWithJoins extends CourseRow {
  creator: Pick<ProfileRow, 'id' | 'username' | 'display_name'> | null;
  enrollments: { count: number }[];
}

function mapCatalogRow(row: CourseWithJoins): CatalogCourse {
  return {
    course: row,
    creatorName:
      row.creator?.display_name ?? row.creator?.username ?? 'Desconhecido',
    studentCount: row.enrollments?.[0]?.count ?? 0,
  };
}

/**
 * List public + published courses for the catalog with combinable
 * tag/category filters, free-text search, and offset pagination.
 *
 * RLS already hides drafts/private courses from non-creators, so we only
 * explicitly scope status/visibility to keep the result tight.
 */
export function useCatalog(filters: CatalogFilters, offset: number) {
  return useQuery<CatalogPage>({
    queryKey: [...courseKeys.catalog(filters), offset],
    queryFn: async () => {
      let query = supabase
        .from('courses')
        .select(
          'id, creator_id, title, slug, description, category, tags, cover_url, status, visibility, created_at, updated_at, creator:profiles!courses_creator_id_fkey(id, username, display_name), enrollments(count)',
          { count: 'exact' },
        )
        .eq('status', 'published')
        .eq('visibility', 'public');

      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      if (filters.tag) {
        query = query.contains('tags', [filters.tag]);
      }
      if (filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        // Search across title/slug/category/description server-side.
        query = query.or(
          `title.ilike.${term},slug.ilike.${term},category.ilike.${term},description.ilike.${term}`,
        );
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + CATALOG_PAGE_SIZE - 1);

      if (error) throw error;

      const rows = (data ?? []) as unknown as CourseWithJoins[];
      const items = rows.map(mapCatalogRow);
      const total = count ?? offset + items.length;
      return {
        items,
        hasMore: offset + items.length < total,
        nextOffset: offset + items.length,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Course detail (modules + lessons + questions, rating avg, recent comments)
// ---------------------------------------------------------------------------

export interface DetailLesson {
  lesson: LessonRow;
  questions: QuestionRow[];
}

export interface DetailModule {
  module: ModuleRow;
  lessons: DetailLesson[];
}

export interface CourseDetail {
  course: CourseRow;
  creator: Pick<
    ProfileRow,
    'id' | 'username' | 'display_name' | 'avatar_url'
  > | null;
  modules: DetailModule[];
  averageRating: number;
  reviewCount: number;
  recentComments: (CommentRow & {
    author: Pick<ProfileRow, 'username' | 'display_name'> | null;
  })[];
  studentCount: number;
  /** The first lesson (by module/lesson position) to "start" the course. */
  firstLessonId: string | null;
}

export function useCourseDetail(
  courseId: string | null,
): UseQueryResult<CourseDetail> {
  return useQuery<CourseDetail>({
    enabled: !!courseId,
    queryKey: courseKeys.detail(courseId ?? ''),
    queryFn: async () => {
      const id = courseId as string;

      const [courseRes, modulesRes, reviewsRes, commentsRes, enrollRes] =
        await Promise.all([
          supabase
            .from('courses')
            .select(
              'id, creator_id, title, slug, description, category, tags, cover_url, status, visibility, created_at, updated_at, creator:profiles!courses_creator_id_fkey(id, username, display_name, avatar_url)',
            )
            .eq('id', id)
            .single(),
          supabase
            .from('modules')
            .select(
              'id, course_id, title, description, position, color, created_at, updated_at, lessons(id, module_id, title, content, position, status, created_at, updated_at, questions(id, lesson_id, type, prompt, position, config, xp_value, created_at, updated_at))',
            )
            .eq('course_id', id)
            .order('position', { ascending: true }),
          supabase.from('reviews').select('rating').eq('course_id', id),
          supabase
            .from('comments')
            .select(
              'id, author_id, course_id, lesson_id, parent_id, content, status, created_at, updated_at, author:profiles!comments_author_id_fkey(username, display_name)',
            )
            .eq('course_id', id)
            .is('lesson_id', null)
            .order('created_at', { ascending: false })
            .limit(10),
          supabase
            .from('enrollments')
            .select('id', { count: 'exact', head: true })
            .eq('course_id', id),
        ]);

      if (courseRes.error) throw courseRes.error;
      if (modulesRes.error) throw modulesRes.error;
      if (reviewsRes.error) throw reviewsRes.error;
      if (commentsRes.error) throw commentsRes.error;
      if (enrollRes.error) throw enrollRes.error;

      const courseJoined = courseRes.data as unknown as CourseRow & {
        creator: CourseDetail['creator'];
      };

      type ModuleJoined = ModuleRow & {
        lessons: (LessonRow & { questions: QuestionRow[] })[];
      };
      const moduleRows = (modulesRes.data ?? []) as unknown as ModuleJoined[];

      const modules: DetailModule[] = moduleRows.map((m) => ({
        module: m,
        lessons: [...(m.lessons ?? [])]
          .sort((a, b) => a.position - b.position)
          .map((l) => ({
            lesson: l,
            questions: [...(l.questions ?? [])].sort(
              (a, b) => a.position - b.position,
            ),
          })),
      }));

      let firstLessonId: string | null = null;
      outer: for (const m of modules) {
        for (const l of m.lessons) {
          firstLessonId = l.lesson.id;
          break outer;
        }
      }

      const ratings = (reviewsRes.data ?? []).map((r) => r.rating);

      return {
        course: courseJoined,
        creator: courseJoined.creator,
        modules,
        averageRating: averageRating(ratings),
        reviewCount: ratings.length,
        recentComments: (commentsRes.data ??
          []) as CourseDetail['recentComments'],
        studentCount: enrollRes.count ?? 0,
        firstLessonId,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// My enrollments / my created courses
// ---------------------------------------------------------------------------

export interface EnrolledCourse {
  enrollment: EnrollmentRow;
  course: CourseRow;
  creatorName: string;
}

export function useMyEnrollments(userId: string | undefined) {
  return useQuery<EnrolledCourse[]>({
    enabled: !!userId,
    queryKey: courseKeys.myEnrollments(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrollments')
        .select(
          'id, user_id, course_id, status, progress, created_at, updated_at, course:courses(id, creator_id, title, slug, description, category, tags, cover_url, status, visibility, created_at, updated_at, creator:profiles!courses_creator_id_fkey(username, display_name))',
        )
        .eq('user_id', userId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;

      type Row = EnrollmentRow & {
        course:
          | (CourseRow & {
              creator: Pick<ProfileRow, 'username' | 'display_name'> | null;
            })
          | null;
      };
      return ((data ?? []) as unknown as Row[])
        .filter((r) => r.course)
        .map((r) => ({
          enrollment: r,
          course: r.course as CourseRow,
          creatorName:
            r.course?.creator?.display_name ??
            r.course?.creator?.username ??
            'Desconhecido',
        }));
    },
  });
}

export function useMyCreatedCourses(userId: string | undefined) {
  return useQuery<(CourseRow & { studentCount: number })[]>({
    enabled: !!userId,
    queryKey: courseKeys.myCreated(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select(
          'id, creator_id, title, slug, description, category, tags, cover_url, status, visibility, created_at, updated_at, enrollments(count)',
        )
        .eq('creator_id', userId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;

      type Row = CourseRow & { enrollments: { count: number }[] };
      return ((data ?? []) as unknown as Row[]).map((r) => ({
        ...r,
        studentCount: r.enrollments?.[0]?.count ?? 0,
      }));
    },
  });
}

// ---------------------------------------------------------------------------
// Course creation / editing payloads
// ---------------------------------------------------------------------------

export interface QuestionDraft {
  id?: string;
  type: QuestionType;
  prompt: string;
  position: number;
  config: Json;
  xpValue: number;
}

export interface LessonDraft {
  id?: string;
  title: string;
  content: string;
  position: number;
  questions: QuestionDraft[];
}

export interface ModuleDraft {
  id?: string;
  title: string;
  description: string;
  position: number;
  color: string | null;
  lessons: LessonDraft[];
}

export interface CourseDraft {
  id?: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  visibility: CourseVisibility;
  status: CourseStatus;
  modules: ModuleDraft[];
}

/**
 * Persist a full course tree (course + modules + lessons + questions).
 *
 * This performs a replace-children save: on an existing course it deletes the
 * current modules (cascading to lessons/questions via FKs) and re-inserts from
 * the draft, which keeps the client editor simple and the DB consistent. The
 * `status` on the draft controls draft vs published.
 */
export async function saveCourseTree(
  creatorId: string,
  draft: CourseDraft,
): Promise<CourseRow> {
  // 1) Upsert the course row itself.
  let courseId = draft.id;
  if (courseId) {
    const { data, error } = await supabase
      .from('courses')
      .update({
        title: draft.title,
        slug: draft.slug,
        description: draft.description || null,
        category: draft.category || null,
        tags: draft.tags,
        visibility: draft.visibility,
        status: draft.status,
      })
      .eq('id', courseId)
      .select('*')
      .single();
    if (error) throw error;
    courseId = data.id;
  } else {
    const { data, error } = await supabase
      .from('courses')
      .insert({
        creator_id: creatorId,
        title: draft.title,
        slug: draft.slug,
        description: draft.description || null,
        category: draft.category || null,
        tags: draft.tags,
        visibility: draft.visibility,
        status: draft.status,
      })
      .select('*')
      .single();
    if (error) throw error;
    courseId = data.id;
  }

  // 2) Replace children: delete existing modules (cascade), then re-insert.
  const { error: delError } = await supabase
    .from('modules')
    .delete()
    .eq('course_id', courseId);
  if (delError) throw delError;

  for (const [mIndex, moduleDraft] of draft.modules.entries()) {
    const { data: moduleRow, error: moduleError } = await supabase
      .from('modules')
      .insert({
        course_id: courseId,
        title: moduleDraft.title,
        description: moduleDraft.description || null,
        position: mIndex,
        color: moduleDraft.color,
      })
      .select('id')
      .single();
    if (moduleError) throw moduleError;

    for (const [lIndex, lessonDraft] of moduleDraft.lessons.entries()) {
      const { data: lessonRow, error: lessonError } = await supabase
        .from('lessons')
        .insert({
          module_id: moduleRow.id,
          title: lessonDraft.title,
          content: lessonDraft.content || null,
          position: lIndex,
          status: draft.status === 'published' ? 'published' : 'draft',
        })
        .select('id')
        .single();
      if (lessonError) throw lessonError;

      if (lessonDraft.questions.length > 0) {
        const { error: qError } = await supabase.from('questions').insert(
          lessonDraft.questions.map((q, qIndex) => ({
            lesson_id: lessonRow.id,
            type: q.type,
            prompt: q.prompt,
            position: qIndex,
            config: q.config,
            xp_value: q.xpValue,
          })),
        );
        if (qError) throw qError;
      }
    }
  }

  // 3) Return the fresh course row.
  const { data: finalCourse, error: finalError } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single();
  if (finalError) throw finalError;
  return finalCourse;
}

export function useSaveCourse(creatorId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: CourseDraft) => {
      if (!creatorId) throw new Error('Sessão expirada. Faça login novamente.');
      // Editing an existing, published course should notify enrolled students.
      const wasExisting = !!draft.id;
      const course = await saveCourseTree(creatorId, draft);
      if (wasExisting && course.status === 'published') {
        // Best-effort: an atualizacao_curso notification for enrolled students.
        await supabase
          .rpc('notify_course_update', { p_course_id: course.id })
          .then(({ error }) => {
            if (error) console.error('notify_course_update failed', error);
          });
      }
      return course;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Enroll / review / comment
// ---------------------------------------------------------------------------

export function useEnroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; courseId: string }) => {
      const { data, error } = await supabase
        .from('enrollments')
        .insert({ user_id: input.userId, course_id: input.courseId })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: courseKeys.detail(input.courseId) });
      qc.invalidateQueries({
        queryKey: courseKeys.myEnrollments(input.userId),
      });
      qc.invalidateQueries({ queryKey: ['courses', 'catalog'] });
    },
  });
}

export function useUpsertReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      courseId: string;
      rating: number;
      comment?: string;
    }): Promise<ReviewRow> => {
      const { data, error } = await supabase
        .from('reviews')
        .upsert(
          {
            user_id: input.userId,
            course_id: input.courseId,
            rating: input.rating,
            comment: input.comment ?? null,
          },
          { onConflict: 'user_id,course_id' },
        )
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: courseKeys.detail(input.courseId) });
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      authorId: string;
      courseId: string;
      content: string;
    }): Promise<CommentRow> => {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          author_id: input.authorId,
          course_id: input.courseId,
          content: input.content,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: courseKeys.detail(input.courseId) });
    },
  });
}

/** Fetch the current user's enrollment for a given course (if any). */
export function useMyEnrollmentForCourse(
  userId: string | undefined,
  courseId: string | null,
) {
  return useQuery<EnrollmentRow | null>({
    enabled: !!userId && !!courseId,
    queryKey: ['courses', 'enrollment', userId, courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', userId as string)
        .eq('course_id', courseId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
