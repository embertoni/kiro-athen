/**
 * Pure, side-effect-free helpers for the courses feature.
 *
 * These are intentionally dependency-free so they can be unit-tested in
 * isolation (see src/features/courses/__tests__/). The data-access layer and
 * UI components build on top of them.
 */

import type { CourseStatus, CourseVisibility } from '@/types/database';

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
  return input
    .normalize('NFD')
    // Remove combining diacritical marks (á -> a, ç -> c, etc.).
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    // Any run of non [a-z0-9] becomes a single hyphen.
    .replace(/[^a-z0-9]+/g, '-')
    // Trim leading/trailing hyphens.
    .replace(/^-+|-+$/g, '');
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
  const wantCategory = filters.category ? normalizeText(filters.category) : null;

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
