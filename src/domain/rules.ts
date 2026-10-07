/**
 * Athen domain rules (pure functions).
 *
 * AUTHORITY NOTE: These mirror the Supabase SQL domain functions for UI display
 * and client-side pre-validation ONLY. The server is authoritative for all final
 * XP/PAC/level/division computations. Keep in sync with the SQL migrations.
 */

import {
  DIVISION_BANDS,
  LEVEL6_FLOOR,
  LEVEL_STEP_ABOVE,
  LEVEL_THRESHOLDS,
  QUESTION_XP,
  type Division,
  type QuestionType,
} from './constants';

/** XP awarded for a correct answer of the given question type. */
export function xpForQuestion(type: QuestionType): number {
  return QUESTION_XP[type];
}

/**
 * Resolve the level for an amount of accumulated global XP.
 * L1 0-99, L2 100-249, L3 250-499, L4 500-999, L5 1000-1999, then L6+ every
 * additional +2000 XP (L6 at 2000, L7 at 4000, ...). Negative XP clamps to L1.
 */
export function levelForXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;

  for (const band of LEVEL_THRESHOLDS) {
    if (band.max !== null && xp >= band.min && xp <= band.max) {
      return band.level;
    }
  }

  // L6 and above: 2000 -> L6, 4000 -> L7, 6000 -> L8, ...
  return 6 + Math.floor((xp - LEVEL6_FLOOR) / LEVEL_STEP_ABOVE);
}

/**
 * Resolve the division for a PAC value (0-100).
 * Bronze 0-59, Prata 60-74, Gold 75-84, Platina 85-94, Diamante 95-100.
 */
export function divisionForPac(pac: number): Division {
  const value = clampPac(pac);
  for (const band of DIVISION_BANDS) {
    if (value >= band.min && value <= band.max) {
      return band.division;
    }
  }
  // Defensive fallback (should be unreachable given clamping).
  return 'Diamante';
}

/**
 * PAC = correct / total * 100. Returns 0 when total is 0 (or invalid).
 */
export function pacFromCounts(correct: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const safeCorrect = Number.isFinite(correct) ? Math.max(0, correct) : 0;
  return (safeCorrect / total) * 100;
}

/**
 * Normalize a fill-in-the-blank answer for comparison: lowercase, strip accents
 * (diacritics), and trim surrounding whitespace. Internal whitespace is collapsed
 * to a single space so "a  b" matches "a b".
 */
export function normalizeFillBlank(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Compare two fill-blank answers after normalization. */
export function fillBlankMatches(answer: string, expected: string): boolean {
  return normalizeFillBlank(answer) === normalizeFillBlank(expected);
}

function clampPac(pac: number): number {
  if (!Number.isFinite(pac)) return 0;
  if (pac < 0) return 0;
  if (pac > 100) return 100;
  return pac;
}
