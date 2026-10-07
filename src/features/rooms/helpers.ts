/**
 * Pure helpers for the rooms (salas) feature.
 *
 * These are display/formatting utilities and client-side sort comparators ONLY.
 * The server (RLS + RPCs: join_room, finalize_attempt, recompute_room_metrics)
 * is authoritative for room access, membership, and all XP/PAC/progress values.
 */

import { divisionForPac } from '@/domain/rules';
import type { Division } from '@/domain/constants';

// ---------------------------------------------------------------------------
// Access codes
// ---------------------------------------------------------------------------

/** Characters used when generating a human-friendly access code (no 0/O/1/I). */
export const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ACCESS_CODE_LENGTH = 6;

/**
 * Generate a random, human-friendly access code (uppercase, ambiguity-free).
 * The uniqueness constraint lives on rooms.access_code; on the rare collision
 * the caller retries. Uses crypto.getRandomValues when available.
 */
export function generateAccessCode(length: number = ACCESS_CODE_LENGTH): string {
  const alphabet = ACCESS_CODE_ALPHABET;
  const out: string[] = [];
  const cryptoObj =
    typeof globalThis !== 'undefined'
      ? (globalThis.crypto as Crypto | undefined)
      : undefined;

  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(length);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < length; i += 1) {
      out.push(alphabet[buf[i] % alphabet.length]);
    }
  } else {
    for (let i = 0; i < length; i += 1) {
      out.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
    }
  }
  return out.join('');
}

/**
 * Normalize a user-typed access code for lookup: uppercase, strip whitespace
 * and any separator the user might paste (dashes/spaces), keep only allowed
 * characters. Does NOT validate length.
 */
export function normalizeAccessCode(raw: string): string {
  return (raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Format an access code for display, grouping into blocks of 3 for readability
 * (e.g. "ABC-DEF"). Normalizes first. Returns an empty string for empty input.
 */
export function formatAccessCode(raw: string, groupSize = 3): string {
  const code = normalizeAccessCode(raw);
  if (!code) return '';
  const groups: string[] = [];
  for (let i = 0; i < code.length; i += groupSize) {
    groups.push(code.slice(i, i + groupSize));
  }
  return groups.join('-');
}

/** True when the normalized code is a plausible access code (length only). */
export function isValidAccessCodeFormat(
  raw: string,
  length: number = ACCESS_CODE_LENGTH,
): boolean {
  const code = normalizeAccessCode(raw);
  return code.length >= Math.min(length, 4) && code.length <= 16;
}

// ---------------------------------------------------------------------------
// Copyable join link
// ---------------------------------------------------------------------------

/**
 * Build a copyable join link derived from the access code. No email is needed:
 * sharing the link (or just the code) is enough for a student to self-join via
 * the join_room RPC. The link points at /rooms with a ?join=<code> param that
 * the rooms list page prefills.
 *
 * `origin` defaults to the browser's window.location.origin when available so
 * the helper stays pure and testable (callers can pass an explicit origin).
 */
export function buildRoomJoinLink(accessCode: string, origin?: string): string {
  const code = normalizeAccessCode(accessCode);
  const base =
    origin ??
    (typeof window !== 'undefined' && window.location
      ? window.location.origin
      : '');
  return `${base}/rooms?join=${encodeURIComponent(code)}`;
}

// ---------------------------------------------------------------------------
// Ranking sort comparators
// ---------------------------------------------------------------------------

export interface RankableByXp {
  xp: number;
  /** Tiebreaker label (name) so ordering is stable/deterministic. */
  name: string;
}

/**
 * Comparator for a ranking ordered by XP descending, breaking ties by name
 * ascending (case-insensitive). Works for both the global ranking (xp_global)
 * and the room ranking (xp_internal) — pass whichever XP into `xp`.
 */
export function compareByXpDesc(a: RankableByXp, b: RankableByXp): number {
  if (b.xp !== a.xp) return b.xp - a.xp;
  return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
}

/** Sort a copy of the list by XP desc (does not mutate the input). */
export function sortByXpDesc<T extends RankableByXp>(items: T[]): T[] {
  return [...items].sort(compareByXpDesc);
}

export interface RankableByPac {
  pac: number;
  name: string;
}

/** Comparator for friends ranking by PAC descending, name as tiebreaker. */
export function compareByPacDesc(a: RankableByPac, b: RankableByPac): number {
  if (b.pac !== a.pac) return b.pac - a.pac;
  return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
}

export function sortByPacDesc<T extends RankableByPac>(items: T[]): T[] {
  return [...items].sort(compareByPacDesc);
}

// ---------------------------------------------------------------------------
// PAC / division display mapping
// ---------------------------------------------------------------------------

/** Brand-ish accent color per division for badges (display only). */
export const DIVISION_COLORS: Record<Division, string> = {
  Bronze: '#9c6b3f',
  Prata: '#8a8f98',
  Gold: '#d4a017',
  Platina: '#4aa3a3',
  Diamante: '#5b8def',
};

export interface PacDisplay {
  /** PAC rounded to 1 decimal for display. */
  value: number;
  label: string;
  division: Division;
  color: string;
}

/**
 * Map a raw PAC (0-100) to a display view-model. The division MIRRORS the
 * server rule (divisionForPac) for display only; the server value remains
 * authoritative. Prefer passing a server-provided division when available.
 */
export function pacDisplay(pac: number, serverDivision?: string): PacDisplay {
  const safe = Number.isFinite(pac) ? Math.max(0, Math.min(100, pac)) : 0;
  const rounded = Math.round(safe * 10) / 10;
  const division = (serverDivision as Division) ?? divisionForPac(safe);
  const resolved: Division = DIVISION_COLORS[division]
    ? division
    : divisionForPac(safe);
  return {
    value: rounded,
    label: `${rounded.toLocaleString('pt-BR')}%`,
    division: resolved,
    color: DIVISION_COLORS[resolved],
  };
}
