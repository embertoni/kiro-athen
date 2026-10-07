/**
 * Client-side answer-shaping utilities for the lesson runner.
 *
 * AUTHORITY NOTE: Everything here is NON-AUTHORITATIVE. These helpers build the
 * raw `submitted` jsonb the client sends to the server and mirror the SQL grader
 * (grade_answer in 0010_domain_functions.sql) ONLY for optimistic/preview UI.
 * The server (finalize_attempt) remains the single source of truth for whether
 * an answer is correct and how much XP it earns. The client never sends a
 * trusted is_correct/xp_earned value.
 *
 * These functions are pure and unit-tested (see __tests__/answerShaping.test.ts).
 */

import type {
  FillBlankConfig,
  FillBlankSubmitted,
  MatchConfig,
  MatchSubmitted,
  MultipleChoiceConfig,
  MultipleChoiceSubmitted,
  SumAlternativesConfig,
  SumAlternativesSubmitted,
} from '@/types/domain';
import { normalizeFillBlank } from '@/domain/rules';

// ---------------------------------------------------------------------------
// Submitted-payload builders (what the client inserts into answers.submitted)
// ---------------------------------------------------------------------------

export function buildMatchSubmitted(
  pairs: { left: string; right: string }[],
): MatchSubmitted {
  return { pairs: pairs.map((p) => ({ left: p.left, right: p.right })) };
}

export function buildMultipleChoiceSubmitted(
  selectedIds: string[],
): MultipleChoiceSubmitted {
  // De-dupe while preserving order; the server grades as a set.
  const seen = new Set<string>();
  const selected: string[] = [];
  for (const id of selectedIds) {
    if (!seen.has(id)) {
      seen.add(id);
      selected.push(id);
    }
  }
  return { selected };
}

export function buildFillBlankSubmitted(text: string): FillBlankSubmitted {
  return { text };
}

export function buildSumAlternativesSubmitted(sum: number): SumAlternativesSubmitted {
  return { sum };
}

// ---------------------------------------------------------------------------
// Non-authoritative preview grading (mirror of the SQL grader, display-only)
// ---------------------------------------------------------------------------

/**
 * multiple_choice set logic: the selected set must EXACTLY equal the set of
 * configured-correct option ids. Any extra or missing selection => wrong. No
 * partial credit. Mirrors the SQL grader for optimistic display only.
 */
export function previewMultipleChoiceCorrect(
  config: MultipleChoiceConfig,
  selectedIds: string[],
): boolean {
  const correct = new Set(
    config.options.filter((o) => o.correct).map((o) => o.id),
  );
  const selected = new Set(selectedIds);
  if (correct.size !== selected.size) return false;
  for (const id of correct) {
    if (!selected.has(id)) return false;
  }
  return true;
}

/**
 * sum_alternatives: the expected sum is `config.expected` when provided,
 * otherwise the sum of the values of the correct statements. Mirrors the SQL
 * grader for optimistic display only.
 */
export function expectedSumFor(config: SumAlternativesConfig): number {
  if (typeof config.expected === 'number') return config.expected;
  return config.statements
    .filter((s) => s.correct)
    .reduce((acc, s) => acc + s.value, 0);
}

export function previewSumCorrect(
  config: SumAlternativesConfig,
  submittedSum: number,
): boolean {
  return submittedSum === expectedSumFor(config);
}

/**
 * fill_blank: the submitted text matches any configured answer after the same
 * normalization the SQL grader applies (lowercase + strip accents + trim +
 * collapse internal whitespace). Mirrors the SQL grader for display only.
 */
export function previewFillBlankCorrect(
  config: FillBlankConfig,
  text: string,
): boolean {
  const normalized = normalizeFillBlank(text);
  if (!normalized) return false;
  return config.answers.some((a) => normalizeFillBlank(a) === normalized);
}

/**
 * match: all submitted pairs must map left -> right exactly as configured, and
 * every configured pair must be present. Mirrors the SQL grader's "all pairs"
 * is_correct condition (partial XP is computed server-side only). Display only.
 */
export function previewMatchCorrect(
  config: MatchConfig,
  submittedPairs: { left: string; right: string }[],
): boolean {
  if (config.pairs.length === 0) return false;
  const submittedByLeft = new Map(submittedPairs.map((p) => [p.left, p.right]));
  if (submittedByLeft.size !== config.pairs.length) return false;
  return config.pairs.every((p) => submittedByLeft.get(p.left) === p.right);
}

/** Count of matched pairs (for a non-authoritative progress hint). */
export function matchCorrectCount(
  config: MatchConfig,
  submittedPairs: { left: string; right: string }[],
): number {
  const submittedByLeft = new Map(submittedPairs.map((p) => [p.left, p.right]));
  return config.pairs.filter((p) => submittedByLeft.get(p.left) === p.right)
    .length;
}
