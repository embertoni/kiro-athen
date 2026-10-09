import { describe, expect, it } from 'vitest';
import { deriveDailyMissions, toLocalDateKey } from '../helpers';

const NOW = new Date(2024, 4, 10, 9, 0, 0); // 2024-05-10 local

describe('toLocalDateKey', () => {
  it('formats a date as local YYYY-MM-DD', () => {
    expect(toLocalDateKey(NOW)).toBe('2024-05-10');
  });
});

describe('deriveDailyMissions', () => {
  it('marks study-today done when last study date is today', () => {
    const missions = deriveDailyMissions(
      { lastStudyDate: '2024-05-10', streakCount: 3 },
      NOW,
    );
    const study = missions.find((m) => m.id === 'study-today');
    expect(study?.done).toBe(true);
  });

  it('marks study-today not done when last study date is before today', () => {
    const missions = deriveDailyMissions(
      { lastStudyDate: '2024-05-09', streakCount: 3 },
      NOW,
    );
    const study = missions.find((m) => m.id === 'study-today');
    expect(study?.done).toBe(false);
  });

  it('accepts a full ISO timestamp for last study date', () => {
    const missions = deriveDailyMissions(
      { lastStudyDate: '2024-05-10T22:30:00Z', streakCount: 1 },
      NOW,
    );
    expect(missions.find((m) => m.id === 'study-today')?.done).toBe(true);
  });

  it('keep-streak is done only when studied today and streak active', () => {
    const active = deriveDailyMissions(
      { lastStudyDate: '2024-05-10', streakCount: 5 },
      NOW,
    );
    expect(active.find((m) => m.id === 'keep-streak')?.done).toBe(true);

    const atRisk = deriveDailyMissions(
      { lastStudyDate: '2024-05-09', streakCount: 5 },
      NOW,
    );
    expect(atRisk.find((m) => m.id === 'keep-streak')?.done).toBe(false);
  });

  it('labels the streak mission by count (singular/plural) and start case', () => {
    const plural = deriveDailyMissions(
      { lastStudyDate: null, streakCount: 4 },
      NOW,
    );
    expect(plural.find((m) => m.id === 'keep-streak')?.label).toContain(
      '4 dias',
    );

    const singular = deriveDailyMissions(
      { lastStudyDate: null, streakCount: 1 },
      NOW,
    );
    expect(singular.find((m) => m.id === 'keep-streak')?.label).toContain(
      '1 dia',
    );

    const none = deriveDailyMissions(
      { lastStudyDate: null, streakCount: 0 },
      NOW,
    );
    expect(none.find((m) => m.id === 'keep-streak')?.label).toBe(
      'Comece uma sequência de estudos',
    );
  });

  it('handles null/undefined inputs safely', () => {
    const missions = deriveDailyMissions(
      { lastStudyDate: null, streakCount: null },
      NOW,
    );
    expect(missions).toHaveLength(2);
    expect(missions.every((m) => m.done === false)).toBe(true);
  });
});
