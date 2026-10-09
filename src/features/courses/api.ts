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
import {
  averageRating,
  nextModulePosition,
  type CatalogFilters,
} from './helpers';

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
        const raw = filters.search.trim();
        const term = `%${raw}%`;
        // Search across title/slug/category/description server-side. PostgREST
        // cannot OR across an embedded table (creator:profiles) in a single
        // .or(), so we first resolve creator ids whose display_name/username
        // match the term and fold them into the same .or() via creator_id.in.
        const { data: creatorRows, error: creatorError } = await supabase
          .from('profiles')
          .select('id')
          // Cap the resolved creator ids to bound the IN(...) list we fold
          // into the course .or(); 1000 keeps realistic creator-name searches
          // from being silently truncated.
          .or(`display_name.ilike.${term},username.ilike.${term}`)
          .limit(1000);
        if (creatorError) throw creatorError;
        const creatorIds = (
          (creatorRows ?? []) as unknown as { id: string }[]
        ).map((r) => r.id);

        const orParts = [
          `title.ilike.${term}`,
          `slug.ilike.${term}`,
          `category.ilike.${term}`,
          `description.ilike.${term}`,
        ];
        if (creatorIds.length > 0) {
          orParts.push(`creator_id.in.(${creatorIds.join(',')})`);
        }
        query = query.or(orParts.join(','));
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
          []) as unknown as CourseDetail['recentComments'],
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
 * On a brand-new course it inserts everything. On an existing course it does a
 * replace-children save (delete the current modules, cascading to
 * lessons/questions via FKs, then re-insert from the draft) ONLY while the
 * course is still a DRAFT. This mirrors the server authority in migration 0019:
 * a published course's existing content is immutable, so blindly deleting and
 * re-inserting its modules would be rejected by RLS (and is semantically
 * wrong). Publishing a draft (status 'draft' at save time -> 'published') still
 * runs the replace path, because the destructive step is gated on the EXISTING
 * (pre-save) status, not the target one.
 *
 * UNPUBLISH IS OUT OF SCOPE. The only edit surface today is the create flow,
 * which never unpublishes (published -> draft). If a future flow unpublishes a
 * course the RLS (seeing status now 'draft') would re-permit a full rebuild,
 * but this function, gating on the PRE-save status, would still skip the
 * destructive replace. That asymmetry is deliberate and safe (it never issues
 * writes RLS would reject); it must be revisited when an unpublish/edit entry
 * point is actually built. See FEAT-003 findings.
 *
 * The `status` on the draft controls draft vs published.
 */
export async function saveCourseTree(
  creatorId: string,
  draft: CourseDraft,
): Promise<CourseRow> {
  // 1) Upsert the course row itself.
  let courseId = draft.id;
  // Whether the destructive replace-children path may run. Only a brand-new
  // course or an existing DRAFT course may have its whole module tree rebuilt.
  let allowReplaceChildren = true;
  if (courseId) {
    // Read the EXISTING status before updating so a destructive rebuild is
    // gated on the pre-save status (draft->published still rebuilds; editing an
    // already-published course does not).
    const { data: existing, error: existingError } = await supabase
      .from('courses')
      .select('status')
      .eq('id', courseId)
      .single();
    if (existingError) throw existingError;
    allowReplaceChildren = existing.status === 'draft';

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
  // Skipped for an already-published course, whose existing content is
  // immutable server-side (migration 0019). For such a course only brand-new
  // modules (and their lessons/questions) are inserted below; nothing existing
  // is deleted or altered.
  if (allowReplaceChildren) {
    const { error: delError } = await supabase
      .from('modules')
      .delete()
      .eq('course_id', courseId);
    if (delError) throw delError;
  }

  // Running position for the NEXT inserted module. For a destructive rebuild
  // (new course or draft edit) positions are a dense 0..n sequence. For a
  // published-course append we start AFTER the retained modules' stored
  // positions so new modules never collide with pre-existing ones (there is no
  // unique (course_id, position) constraint, so a collision would silently
  // corrupt trail ordering instead of erroring).
  let nextPosition = 0;
  if (!allowReplaceChildren) {
    const { data: existingModules, error: existingModulesError } =
      await supabase
        .from('modules')
        .select('position')
        .eq('course_id', courseId);
    if (existingModulesError) throw existingModulesError;
    nextPosition = nextModulePosition(
      (existingModules ?? []).map((m) => m.position),
    );
  }

  for (const moduleDraft of draft.modules) {
    // For a published course (no destructive replace) skip modules that already
    // exist; only brand-new modules (without an id) are inserted.
    if (!allowReplaceChildren && moduleDraft.id) continue;

    const { data: moduleRow, error: moduleError } = await supabase
      .from('modules')
      .insert({
        course_id: courseId,
        title: moduleDraft.title,
        description: moduleDraft.description || null,
        position: nextPosition,
        color: moduleDraft.color,
      })
      .select('id')
      .single();
    if (moduleError) throw moduleError;
    nextPosition += 1;

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
