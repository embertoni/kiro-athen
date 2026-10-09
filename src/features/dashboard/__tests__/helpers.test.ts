import { describe, expect, it } from 'vitest';
import {
  buildTrailGradient,
  computeCenterScrollLeft,
  computeTrailPoints,
  createSmoothPath,
  deriveDailyMissions,
  hexToRgba,
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

describe('hexToRgba', () => {
  it('converts a 6-digit hex to rgba with the given alpha', () => {
    expect(hexToRgba('#7b4bab', 0.5)).toBe('rgba(123, 75, 171, 0.5)');
  });

  it('expands a 3-digit shorthand hex', () => {
    expect(hexToRgba('#abc', 1)).toBe('rgba(170, 187, 204, 1)');
  });

  it('tolerates a leading hash being absent', () => {
    expect(hexToRgba('ff8800', 0.25)).toBe('rgba(255, 136, 0, 0.25)');
  });

  it('clamps alpha into the [0, 1] range', () => {
    expect(hexToRgba('#000000', 5)).toBe('rgba(0, 0, 0, 1)');
    expect(hexToRgba('#000000', -1)).toBe('rgba(0, 0, 0, 0)');
  });

  it('returns the input unchanged when it is not a hex color', () => {
    expect(hexToRgba('var(--brand-purple)', 0.5)).toBe('var(--brand-purple)');
  });
});

describe('buildTrailGradient', () => {
  it('tints with a translucent rgba derived from a hex color', () => {
    const bg = buildTrailGradient('#7b4bab');
    expect(bg).toContain('rgba(123, 75, 171, 0.16)');
    expect(bg).toContain('var(--color-bg)');
  });

  it('falls back to a brand tint when the color is a CSS var', () => {
    const bg = buildTrailGradient('var(--brand-purple)');
    expect(bg).toContain('rgba(123, 75, 171, 0.14)');
    expect(bg).toContain('var(--color-bg)');
  });
});

describe('computeTrailPoints', () => {
  it('spaces points horizontally by step from startX', () => {
    const points = computeTrailPoints({
      count: 3,
      step: 100,
      startX: 50,
      midY: 160,
      amplitude: 0,
    });
    expect(points.map((p) => p.x)).toEqual([50, 150, 250]);
    // amplitude 0 keeps every node on the mid line.
    expect(points.every((p) => p.y === 160)).toBe(true);
  });

  it('oscillates y around midY by the amplitude', () => {
    const points = computeTrailPoints({
      count: 4,
      step: 10,
      startX: 0,
      midY: 100,
      amplitude: 50,
    });
    expect(points[0].y).toBeCloseTo(100); // sin(0) = 0
    expect(points[1].y).toBeGreaterThan(100); // sin(0.72) > 0
    for (const p of points) {
      expect(p.y).toBeGreaterThanOrEqual(50);
      expect(p.y).toBeLessThanOrEqual(150);
    }
  });

  it('returns an empty array for zero nodes', () => {
    expect(
      computeTrailPoints({
        count: 0,
        step: 10,
        startX: 0,
        midY: 0,
        amplitude: 0,
      }),
    ).toEqual([]);
  });
});

describe('createSmoothPath', () => {
  it('returns an empty string for fewer than two points', () => {
    expect(createSmoothPath([])).toBe('');
    expect(createSmoothPath([{ x: 1, y: 2 }])).toBe('');
  });

  it('starts with a move to the first point', () => {
    const d = createSmoothPath([
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ]);
    expect(d.startsWith('M 0 0')).toBe(true);
  });

  it('uses midpoint-x control points for each cubic segment', () => {
    const d = createSmoothPath([
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ]);
    // midX = 50; both control points share x = 50, endpoint is (100, 50).
    expect(d).toBe('M 0 0 C 50 0, 50 50, 100 50');
  });

  it('emits one cubic segment per gap between points', () => {
    const d = createSmoothPath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ]);
    expect(d.match(/C/g)?.length).toBe(2);
  });
});
