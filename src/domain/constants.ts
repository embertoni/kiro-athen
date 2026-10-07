/**
 * Athen domain constants.
 *
 * AUTHORITY NOTE: The Supabase SQL layer (domain functions, RLS policies and
 * triggers) is the single source of truth for XP, PAC, level, division, medals,
 * permissions and room access. This TypeScript module MIRRORS those constants so
 * the UI can display and pre-validate values. The client must NEVER send a
 * computed/trusted final XP; grading is finalized server-side. Keep these numbers
 * byte-for-byte in sync with the SQL migrations.
 */

// ---------------------------------------------------------------------------
// Question types
// ---------------------------------------------------------------------------

/**
 * Supported question types. `order_sequence` is LEGACY and must not be used as a
 * final question type.
 */
export const QUESTION_TYPES = [
  'match',
  'multiple_choice',
  'fill_blank',
  'sum_alternatives',
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

/** XP awarded per correctly answered question, by type. */
export const QUESTION_XP: Record<QuestionType, number> = {
  match: 2,
  multiple_choice: 4,
  fill_blank: 6,
  sum_alternatives: 8,
};

// ---------------------------------------------------------------------------
// Levels (based on accumulated global XP)
// ---------------------------------------------------------------------------

/**
 * Inclusive lower/upper XP bounds per level.
 * L1 0-99, L2 100-249, L3 250-499, L4 500-999, L5 1000-1999.
 * From L6 onward, each additional level requires +2000 XP (L6 starts at 2000,
 * L7 at 4000, and so on).
 */
export interface LevelBand {
  level: number;
  min: number;
  /** Inclusive max; null means open-ended (handled by the +2000 rule). */
  max: number | null;
}

export const LEVEL_THRESHOLDS: readonly LevelBand[] = [
  { level: 1, min: 0, max: 99 },
  { level: 2, min: 100, max: 249 },
  { level: 3, min: 250, max: 499 },
  { level: 4, min: 500, max: 999 },
  { level: 5, min: 1000, max: 1999 },
] as const;

/** XP at which the repeating +2000 band (L6+) begins. */
export const LEVEL6_FLOOR = 2000;
/** XP step for each level at and beyond L6. */
export const LEVEL_STEP_ABOVE = 2000;

// ---------------------------------------------------------------------------
// Divisions (based on PAC, 0-100)
// ---------------------------------------------------------------------------

export const DIVISIONS = [
  'Bronze',
  'Prata',
  'Gold',
  'Platina',
  'Diamante',
] as const;

export type Division = (typeof DIVISIONS)[number];

/** Inclusive PAC bands per division. */
export interface DivisionBand {
  division: Division;
  min: number;
  max: number;
}

export const DIVISION_BANDS: readonly DivisionBand[] = [
  { division: 'Bronze', min: 0, max: 59 },
  { division: 'Prata', min: 60, max: 74 },
  { division: 'Gold', min: 75, max: 84 },
  { division: 'Platina', min: 85, max: 94 },
  { division: 'Diamante', min: 95, max: 100 },
] as const;

// ---------------------------------------------------------------------------
// Roles / course lifecycle / notifications / medals
// ---------------------------------------------------------------------------

export const ROLES = ['student', 'educator', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const COURSE_STATUS = ['draft', 'published'] as const;
export type CourseStatus = (typeof COURSE_STATUS)[number];

export const COURSE_VISIBILITY = ['public', 'private'] as const;
export type CourseVisibility = (typeof COURSE_VISIBILITY)[number];

/**
 * Notification types. These MIRROR the Postgres `notification_type` enum (the
 * authority) EXACTLY — keep them byte-for-byte in sync with the SQL migrations
 * and src/types/database.ts.
 *   atualizacao_curso  — a course the user is enrolled in was updated/published
 *   pedido_amizade     — someone sent a friend request
 *   convite_sala       — the user was invited to / added to a room (sala)
 *   missao             — a mission was created/updated in a room the user is in
 *   lembrete_estudo    — a friend sent a "lembrete para estudar" reminder
 */
export const NOTIFICATION_TYPES = [
  'atualizacao_curso',
  'pedido_amizade',
  'convite_sala',
  'missao',
  'lembrete_estudo',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** pt-BR labels for each notification type (UI display). */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  atualizacao_curso: 'Atualização de curso',
  pedido_amizade: 'Pedido de amizade',
  convite_sala: 'Convite para sala',
  missao: 'Missão',
  lembrete_estudo: 'Lembrete de estudo',
};

/**
 * Medal codes. These MIRROR the `medals.code` catalog seeded in SQL (0013) and
 * awarded by `grant_medals()` in 0010 — keep them byte-for-byte in sync.
 *   first_lesson — completed at least one lesson
 *   on_fire      — streak_count reached 7
 *   bookworm     — completed at least 5 courses
 *   owl          — completed at least 10 lessons
 * The medals UI reads the DB catalog (name/description/icon) directly; this
 * constant exists only as a typed parity reference for the SQL codes. Out-of-scope
 * (section 17) medals such as "Top da semana", joint streaks and educator-created
 * medals are intentionally excluded.
 */
export const MEDAL_CODES = [
  'first_lesson',
  'on_fire',
  'bookworm',
  'owl',
] as const;
export type MedalCode = (typeof MEDAL_CODES)[number];

/** Timezone used for streak/day-boundary calculations (one-day tolerance). */
export const STREAK_TIMEZONE = 'America/Sao_Paulo';
