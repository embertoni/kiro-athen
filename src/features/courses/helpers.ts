/**
 * Pure, side-effect-free helpers for the courses feature.
 *
 * These are intentionally dependency-free so they can be unit-tested in
 * isolation (see src/features/courses/__tests__/). The data-access layer and
 * UI components build on top of them.
 */

import type { CourseStatus, CourseVisibility } from '@/types/database';
import type {
  CourseDetail,
  CourseDraft,
  LessonDraft,
  ModuleDraft,
  QuestionDraft,
} from './api';

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------

/**
 * Convert an arbitrary title into a URL-safe slug:
 * - lowercased
 * - accents/diacritics stripped (NFD normalization)
 * - non-alphanumeric runs collapsed to a single hyphen
 * - leading/trailing hyphens trimmed
 *
 * Pure function: given the same input it always returns the same output.
 */
export function slugify(input: string): string {
  return (
    input
      .normalize('NFD')
      // Remove combining diacritical marks (á -> a, ç -> c, etc.).
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      // Any run of non [a-z0-9] becomes a single hyphen.
      .replace(/[^a-z0-9]+/g, '-')
      // Trim leading/trailing hyphens.
      .replace(/^-+|-+$/g, '')
  );
}

// ---------------------------------------------------------------------------
// Catalog filter predicate
// ---------------------------------------------------------------------------

/** The minimal shape a course needs to be matched by the catalog filters. */
export interface SearchableCourse {
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  tags: string[];
  /** Display name / username of the creator, when available. */
  creatorName?: string | null;
  status?: CourseStatus;
  visibility?: CourseVisibility;
}

/** Catalog filter state. All fields are combinable. */
export interface CatalogFilters {
  /** Free-text search across title/slug/tags/category/creator/description. */
  search: string;
  /** When set, only courses whose tags include this tag match. */
  tag: string | null;
  /** When set, only courses with this exact category match. */
  category: string | null;
}

export const EMPTY_FILTERS: CatalogFilters = {
  search: '',
  tag: null,
  category: null,
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Build a predicate that reflects the combined catalog filters.
 *
 * Search matches (case- and accent-insensitively) across title, slug, tags,
 * category, creator name and description. The tag and category filters are
 * additive (AND): a course must satisfy every active filter to match.
 *
 * Returned predicate is pure and reusable (e.g. for client-side refinement or
 * tests). The server query mirrors the same fields.
 */
export function buildCatalogPredicate(
  filters: CatalogFilters,
): (course: SearchableCourse) => boolean {
  const term = normalizeText(filters.search);
  const wantTag = filters.tag ? normalizeText(filters.tag) : null;
  const wantCategory = filters.category
    ? normalizeText(filters.category)
    : null;

  return (course: SearchableCourse): boolean => {
    if (wantCategory) {
      if (!course.category || normalizeText(course.category) !== wantCategory) {
        return false;
      }
    }

    if (wantTag) {
      const hasTag = course.tags.some((t) => normalizeText(t) === wantTag);
      if (!hasTag) return false;
    }

    if (term) {
      const haystack = [
        course.title,
        course.slug,
        course.description ?? '',
        course.category ?? '',
        course.creatorName ?? '',
        ...course.tags,
      ]
        .map(normalizeText)
        .join(' ');
      if (!haystack.includes(term)) return false;
    }

    return true;
  };
}

/** True when no filter is active (used to short-circuit client refinement). */
export function hasActiveFilters(filters: CatalogFilters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.tag !== null ||
    filters.category !== null
  );
}

/** Average of a rating list, rounded to one decimal. 0 when empty. */
export function averageRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, r) => acc + r, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Course editability gating (mirrors the server-side RLS in migration 0019)
// ---------------------------------------------------------------------------

/** The minimal course shape the editability decision needs. */
export interface EditableCourseState {
  /** Whether we are editing a course that already exists in the DB. */
  isExistingCourse: boolean;
  /** The course's persisted status. */
  status: CourseStatus;
}

/**
 * Whether a published course's PRE-EXISTING content (modules/lessons/questions
 * that existed at/before publication) is locked against edit/delete.
 *
 * This mirrors the server authority in migration 0019: a draft course is fully
 * editable; a published course's existing content is immutable (only brand-new
 * modules, and lessons/questions within them, may be added). A course that is
 * not yet persisted (creation flow) is always editable.
 *
 * Pure function: UI affordances derive from it, but the DB RLS is the real
 * enforcement.
 */
export function isExistingContentLocked(state: EditableCourseState): boolean {
  return state.isExistingCourse && state.status === 'published';
}

/**
 * Whether an existing module (and its lessons/questions) may be edited/removed
 * in the editor. Pre-existing content of a published course is locked; adding a
 * brand-new module is always allowed regardless, so this gate only applies to
 * content that already exists.
 */
export function canEditExistingContent(state: EditableCourseState): boolean {
  return !isExistingContentLocked(state);
}

// ---------------------------------------------------------------------------
// Position numbering for appended modules
// ---------------------------------------------------------------------------

/**
 * Compute the next free `position` for a module being appended to a course,
 * given the positions of the modules that are RETAINED (not rebuilt).
 *
 * When editing a published course, pre-existing modules keep their stored
 * positions and are never renumbered; brand-new modules are only inserted. If
 * new modules were numbered by their index in the full draft list they could
 * collide with a retained module's stored position (there is no unique
 * constraint on (course_id, position), so the insert would silently corrupt
 * ordering). This derives the next position from the retained set instead:
 * `max(existingPositions) + 1`, or 0 when there are none.
 *
 * Pure function. Callers increment per inserted module (e.g. by passing the
 * growing list, or by adding a running offset) so successive appends do not
 * collide with each other either.
 */
export function nextModulePosition(existingPositions: number[]): number {
  if (existingPositions.length === 0) return 0;
  return Math.max(...existingPositions) + 1;
}

// ---------------------------------------------------------------------------
// New-module detection (published-course edit guard)
// ---------------------------------------------------------------------------

/**
 * Whether the given module drafts include at least one brand-new module, i.e.
 * one that has not been persisted yet (no `id`).
 *
 * When editing an already-published course, `saveCourseTree` only inserts
 * brand-new modules and skips every pre-existing (id-bearing) one. If no new
 * module exists the save would be a no-op, so the editor uses this predicate to
 * block a misleading zero-write "success". Pure and dependency-free.
 */
export function hasNewModule(modules: { id?: string }[]): boolean {
  return modules.some((m) => !m.id);
}

// ---------------------------------------------------------------------------
// CourseDetail -> CourseDraft transform (edit-mode hydration)
// ---------------------------------------------------------------------------

/**
 * Map a loaded {@link CourseDetail} (from `useCourseDetail`) into the editor's
 * {@link CourseDraft} form shape so an existing course can be opened in the
 * create/edit page.
 *
 * The transform PRESERVES every persisted id (course.id, module.id, lesson.id,
 * question.id) and stored `position`, which is what makes the editor's
 * `isPersisted()` lock gate and `saveCourseTree`'s published-append / UPDATE
 * paths behave correctly. `config` (Json) and `xp_value` -> `xpValue` are
 * carried through unchanged; nullable `description`/`category` collapse to ''.
 *
 * Pure and dependency-free (types only): it never touches react or supabase,
 * so it stays unit-testable in isolation. `useCourseDetail` already returns the
 * modules/lessons/questions position-sorted, so no re-sorting is done here.
 */
export function courseDetailToDraft(detail: CourseDetail): CourseDraft {
  const { course } = detail;

  const modules: ModuleDraft[] = detail.modules.map((m): ModuleDraft => {
    const lessons: LessonDraft[] = m.lessons.map((l): LessonDraft => {
      const questions: QuestionDraft[] = l.questions.map(
        (q): QuestionDraft => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          position: q.position,
          config: q.config,
          xpValue: q.xp_value,
        }),
      );
      return {
        id: l.lesson.id,
        title: l.lesson.title,
        content: l.lesson.content ?? '',
        position: l.lesson.position,
        questions,
      };
    });
    return {
      id: m.module.id,
      title: m.module.title,
      description: m.module.description ?? '',
      position: m.module.position,
      color: m.module.color,
      lessons,
    };
  });

  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description ?? '',
    category: course.category ?? '',
    tags: course.tags ?? [],
    visibility: course.visibility,
    status: course.status,
    modules,
  };
}
