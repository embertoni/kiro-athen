/**
 * Pure helpers for the dashboard (unit-tested; no I/O).
 *
 * The spec references "missões diárias globais" in Cursos mode, but there is no
 * server-side global daily-missions table (missions are room-scoped). To stay
 * honest we DERIVE lightweight daily goals from server-authoritative data the
 * dashboard already loads (the profile's last_study_date and streak_count).
 * These are display-only reminders: they never grant XP and never write back to
 * the server. See FEAT-004 findings for the limitation.
 */

export interface DailyMission {
  id: string;
  label: string;
  done: boolean;
}

/** Local YYYY-MM-DD for a date, so "today" is compared in the user's day. */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Derive the day's global daily missions from the profile's last study date and
 * current streak. Pure given a `now` reference so it is deterministic in tests.
 *
 * - "Estude uma aula hoje" is done when the last study date is today.
 * - "Mantenha a sequência" is done when there is an active streak (>= 1) AND the
 *   user has studied today (otherwise the streak is still at risk for the day).
 */
export function deriveDailyMissions(
  input: {
    lastStudyDate: string | null | undefined;
    streakCount: number | null | undefined;
  },
  now: Date = new Date(),
): DailyMission[] {
  const todayKey = toLocalDateKey(now);
  const studiedToday =
    !!input.lastStudyDate && input.lastStudyDate.slice(0, 10) === todayKey;
  const streak = input.streakCount ?? 0;

  return [
    {
      id: 'study-today',
      label: 'Estude uma aula hoje',
      done: studiedToday,
    },
    {
      id: 'keep-streak',
      label:
        streak > 0
          ? `Mantenha sua sequência de ${streak} ${streak === 1 ? 'dia' : 'dias'}`
          : 'Comece uma sequência de estudos',
      done: studiedToday && streak > 0,
    },
  ];
}
