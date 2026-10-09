import { describe, expect, it } from 'vitest';
import {
  computeCenterScrollLeft,
  deriveDailyMissions,
  resolveModuleColor,
  toLocalDateKey,
} from '../helpers';

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

describe('resolveModuleColor', () => {
  it('returns the module color when present', () => {
    expect(resolveModuleColor('#ff8800')).toBe('#ff8800');
  });

  it('falls back to the brand color when null or undefined', () => {
    expect(resolveModuleColor(null)).toBe('var(--brand-purple)');
    expect(resolveModuleColor(undefined)).toBe('var(--brand-purple)');
  });
});

describe('computeCenterScrollLeft', () => {
  it('centers a node in the middle of the scrollable range', () => {
    // Node spans [800, 900], center 850; container 400 wide => target 650.
    expect(
      computeCenterScrollLeft({
        containerWidth: 400,
        nodeOffsetLeft: 800,
        nodeWidth: 100,
        maxScrollLeft: 2000,
      }),
    ).toBe(650);
  });

  it('clamps to 0 for a node near the start', () => {
    // Node center 50, container 400 => target -150, clamped to 0.
    expect(
      computeCenterScrollLeft({
        containerWidth: 400,
        nodeOffsetLeft: 0,
        nodeWidth: 100,
        maxScrollLeft: 2000,
      }),
    ).toBe(0);
  });

  it('clamps to maxScrollLeft for a node near the end', () => {
    // Node center 2950, container 400 => target 2750, clamped to 2000.
    expect(
      computeCenterScrollLeft({
        containerWidth: 400,
        nodeOffsetLeft: 2900,
        nodeWidth: 100,
        maxScrollLeft: 2000,
      }),
    ).toBe(2000);
  });

  it('accounts for node width when centering', () => {
    // Wider node: span [500, 700], center 600; container 200 => target 500.
    expect(
      computeCenterScrollLeft({
        containerWidth: 200,
        nodeOffsetLeft: 500,
        nodeWidth: 200,
        maxScrollLeft: 2000,
      }),
    ).toBe(500);
  });

  it('never returns a negative scroll when maxScrollLeft is negative', () => {
    // Content fits the container (maxScrollLeft < 0) => always 0.
    expect(
      computeCenterScrollLeft({
        containerWidth: 1000,
        nodeOffsetLeft: 100,
        nodeWidth: 100,
        maxScrollLeft: -200,
      }),
    ).toBe(0);
  });
});
