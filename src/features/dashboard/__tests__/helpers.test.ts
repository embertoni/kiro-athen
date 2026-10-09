import { describe, expect, it } from 'vitest';
import {
  buildTrailGradient,
  computeCarouselWindow,
  computeCenterScrollLeft,
  computeModuleTrailPoints,
  computeTrailPoints,
  createSmoothPath,
  deriveDailyMissions,
  hexToRgba,
  nextModuleIndex,
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

  it('uses explicit phases to override the per-node sine index', () => {
    // Phases reset [0,1,0,1] so pairs of nodes share the same y even though x
    // keeps advancing by step.
    const points = computeTrailPoints({
      count: 4,
      step: 10,
      startX: 0,
      midY: 100,
      amplitude: 50,
      phases: [0, 1, 0, 1],
    });
    expect(points.map((p) => p.x)).toEqual([0, 10, 20, 30]);
    expect(points[0].y).toBeCloseTo(points[2].y);
    expect(points[1].y).toBeCloseTo(points[3].y);
  });
});

describe('computeModuleTrailPoints', () => {
  it('yields 1 + lessonCount nodes per module with x advancing by step', () => {
    const { points, ranges } = computeModuleTrailPoints({
      modules: [{ lessonCount: 2 }, { lessonCount: 1 }],
      step: 100,
      startX: 50,
      midY: 160,
      amplitude: 40,
    });
    // module A: 3 nodes, module B: 2 nodes => 5 points.
    expect(points).toHaveLength(5);
    expect(points.map((p) => p.x)).toEqual([50, 150, 250, 350, 450]);
    expect(ranges).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 4 },
    ]);
  });

  it('repeats the SAME wave pattern per module (phase resets at boundaries)', () => {
    const { points, ranges } = computeModuleTrailPoints({
      modules: [{ lessonCount: 2 }, { lessonCount: 2 }],
      step: 100,
      startX: 0,
      midY: 160,
      amplitude: 40,
    });
    // The first node of each module shares the same y (phase reset to 0), and
    // likewise for the second and third nodes.
    const a = ranges[0];
    const b = ranges[1];
    expect(points[a.start].y).toBeCloseTo(points[b.start].y);
    expect(points[a.start + 1].y).toBeCloseTo(points[b.start + 1].y);
    expect(points[a.start + 2].y).toBeCloseTo(points[b.start + 2].y);
  });

  it('oscillates y around midY within [midY-amp, midY+amp]', () => {
    const { points } = computeModuleTrailPoints({
      modules: [{ lessonCount: 3 }],
      step: 50,
      startX: 0,
      midY: 170,
      amplitude: 92,
    });
    // First node sits on the mid line (sin(0) = 0); later nodes vary.
    expect(points[0].y).toBeCloseTo(170);
    expect(points.some((p) => p.y !== 170)).toBe(true);
    for (const p of points) {
      expect(p.y).toBeGreaterThanOrEqual(170 - 92 - 0.001);
      expect(p.y).toBeLessThanOrEqual(170 + 92 + 0.001);
    }
  });

  it('handles a module with no lessons (single node)', () => {
    const { points, ranges } = computeModuleTrailPoints({
      modules: [{ lessonCount: 0 }],
      step: 100,
      startX: 10,
      midY: 100,
      amplitude: 20,
    });
    expect(points).toHaveLength(1);
    expect(ranges).toEqual([{ start: 0, end: 0 }]);
  });

  it('returns empty layout for no modules', () => {
    const layout = computeModuleTrailPoints({
      modules: [],
      step: 100,
      startX: 0,
      midY: 100,
      amplitude: 20,
    });
    expect(layout.points).toEqual([]);
    expect(layout.ranges).toEqual([]);
  });
});

describe('computeCarouselWindow', () => {
  it('returns [prev, current, next] in the middle of the list', () => {
    expect(computeCarouselWindow({ moduleCount: 5, activeIndex: 2 })).toEqual([
      1, 2, 3,
    ]);
  });

  it('wraps around at the start (prev wraps to the last)', () => {
    expect(computeCarouselWindow({ moduleCount: 4, activeIndex: 0 })).toEqual([
      3, 0, 1,
    ]);
  });

  it('wraps around at the end (next wraps to the first)', () => {
    expect(computeCarouselWindow({ moduleCount: 4, activeIndex: 3 })).toEqual([
      2, 3, 0,
    ]);
  });

  it('returns a single slot for one module', () => {
    expect(computeCarouselWindow({ moduleCount: 1, activeIndex: 0 })).toEqual([
      0,
    ]);
  });

  it('returns an empty window for zero modules', () => {
    expect(computeCarouselWindow({ moduleCount: 0, activeIndex: 0 })).toEqual(
      [],
    );
  });
});

describe('nextModuleIndex', () => {
  it('moves forward by one', () => {
    expect(
      nextModuleIndex({ moduleCount: 5, activeIndex: 2, direction: 1 }),
    ).toBe(3);
  });

  it('moves backward by one', () => {
    expect(
      nextModuleIndex({ moduleCount: 5, activeIndex: 2, direction: -1 }),
    ).toBe(1);
  });

  it('wraps forward past the end to the first', () => {
    expect(
      nextModuleIndex({ moduleCount: 4, activeIndex: 3, direction: 1 }),
    ).toBe(0);
  });

  it('wraps backward past the start to the last', () => {
    expect(
      nextModuleIndex({ moduleCount: 4, activeIndex: 0, direction: -1 }),
    ).toBe(3);
  });

  it('returns 0 for an empty list without crashing', () => {
    expect(
      nextModuleIndex({ moduleCount: 0, activeIndex: 0, direction: 1 }),
    ).toBe(0);
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
