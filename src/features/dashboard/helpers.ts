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

/** Brand fallback used when a module has no color. */
export const TRAIL_FALLBACK_COLOR = 'var(--brand-purple)';

/**
 * Resolve the color used to paint the trail for a module. Returns the module's
 * own color when present, otherwise the brand fallback. Pure and testable.
 */
export function resolveModuleColor(color: string | null | undefined): string {
  return color ?? TRAIL_FALLBACK_COLOR;
}

/**
 * Compute the horizontal `scrollLeft` needed to center a node inside its scroll
 * container, clamped to the valid scroll range. Pure (no DOM) so it is unit
 * testable: given the node's offset/width and the container width, place the
 * node's center at the container's center, then clamp to [0, maxScrollLeft].
 */
export function computeCenterScrollLeft(input: {
  containerWidth: number;
  nodeOffsetLeft: number;
  nodeWidth: number;
  maxScrollLeft: number;
}): number {
  const { containerWidth, nodeOffsetLeft, nodeWidth, maxScrollLeft } = input;
  const target = nodeOffsetLeft + nodeWidth / 2 - containerWidth / 2;
  const upperBound = Math.max(0, maxScrollLeft);
  return Math.min(Math.max(target, 0), upperBound);
}

/**
 * Convert a hex color (#rgb or #rrggbb) to an `rgba(r, g, b, a)` string. Used
 * to derive translucent gradient stops from a module's solid color so the trail
 * background can tint the whole surface with the focused module color while
 * keeping the brand-purple depth underneath. Pure and testable.
 *
 * Non-hex inputs (e.g. a CSS var fallback like `var(--brand-purple)`) cannot be
 * parsed to channels, so they are returned unchanged: callers then rely on the
 * CSS custom-property fallback instead of a computed rgba.
 */
export function hexToRgba(color: string, alpha: number): string {
  const hex = color.trim().replace('#', '');
  const expanded =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => `${c}${c}`)
          .join('')
      : hex;
  if (expanded.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return color;
  }
  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Build the per-module trail background: a soft radial tint of the focused
 * module color over the base background. When the color is a hex we derive a
 * translucent rgba stop; otherwise we fall back to a brand-purple tint so a CSS
 * var color still produces a valid gradient. Pure (returns a CSS value string)
 * so a CSS transition on `background-image` animates the module change smoothly.
 */
export function buildTrailGradient(color: string): string {
  const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color.trim());
  const tint = isHex ? hexToRgba(color, 0.16) : 'rgba(123, 75, 171, 0.14)';
  return (
    `radial-gradient(circle at 28% 32%, ${tint}, transparent 55%), ` +
    `var(--color-bg)`
  );
}

/**
 * A point on the trail used to lay out the SVG connector path. `x` grows with
 * the node index; `y` gently oscillates so the path reads as a flowing trail
 * rather than a straight line.
 */
export interface TrailPoint {
  x: number;
  y: number;
}

/**
 * Compute evenly-spaced points for `count` nodes, oscillating vertically around
 * `midY` by `amplitude`. Deterministic and DOM-free so the SVG path geometry is
 * unit-testable. `step` is the horizontal spacing; `startX` offsets the first
 * node from the left edge.
 *
 * `phases`, when provided, overrides the per-node sine phase index (otherwise
 * the node index `i` is used). This lets callers RESET the sine phase at module
 * boundaries so each module traces the same up/down wave (see
 * computeModuleTrailPoints), while x still advances monotonically by `step`.
 */
export function computeTrailPoints(input: {
  count: number;
  step: number;
  startX: number;
  midY: number;
  amplitude: number;
  phases?: number[];
}): TrailPoint[] {
  const { count, step, startX, midY, amplitude, phases } = input;
  const points: TrailPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const phase = phases ? phases[i] : i;
    points.push({
      x: startX + i * step,
      y: midY + amplitude * Math.sin(phase * 0.72),
    });
  }
  return points;
}

/**
 * The flat trail laid out as a REPEATING per-module wave. Each module
 * contributes a node (the module itself) followed by one node per lesson. The
 * sine phase RESETS at every module boundary so each module traces the same
 * up/down shape, while x still advances by a fixed `step` across the whole
 * sequence. Returns the flat point list plus the index range of each module so
 * callers can map nodes back to modules/lessons and draw per-module segments.
 */
export interface ModuleTrailLayout {
  /** One point per node, in flattened [module, lessons..., module, ...] order. */
  points: TrailPoint[];
  /** Per-module [startIndex, endIndex] inclusive ranges into `points`. */
  ranges: { start: number; end: number }[];
}

/**
 * Compute a repeating per-module wavy layout. `modules` lists each module's
 * lesson count; each module yields `1 + lessonCount` nodes. The phase index
 * resets to 0 at the first node of every module, so modules share the same wave
 * pattern instead of one monotonic sine across the whole trail. Pure and
 * DOM-free so the geometry stays unit-testable.
 */
export function computeModuleTrailPoints(input: {
  modules: { lessonCount: number }[];
  step: number;
  startX: number;
  midY: number;
  amplitude: number;
}): ModuleTrailLayout {
  const { modules, step, startX, midY, amplitude } = input;

  // Build the per-node phase indices (reset at each module boundary) and the
  // per-module index ranges in one pass.
  const phases: number[] = [];
  const ranges: { start: number; end: number }[] = [];
  let index = 0;
  for (const m of modules) {
    const nodeCount = 1 + Math.max(0, m.lessonCount);
    const start = index;
    for (let p = 0; p < nodeCount; p += 1) {
      phases.push(p);
      index += 1;
    }
    ranges.push({ start, end: index - 1 });
  }

  const points = computeTrailPoints({
    count: phases.length,
    step,
    startX,
    midY,
    amplitude,
    phases,
  });

  return { points, ranges };
}

/**
 * Compute the 3-module window [previous, current, next] for the bottom carousel,
 * with wraparound (modulo `moduleCount`). Returns the indices into the module
 * list. Guards tiny lists: for a single module every slot is 0; for an empty
 * list it returns an empty array (callers render nothing). Pure and testable.
 */
export function computeCarouselWindow(input: {
  moduleCount: number;
  activeIndex: number;
}): number[] {
  const { moduleCount, activeIndex } = input;
  if (moduleCount <= 0) return [];
  if (moduleCount === 1) return [0];
  const wrap = (i: number) => ((i % moduleCount) + moduleCount) % moduleCount;
  return [wrap(activeIndex - 1), wrap(activeIndex), wrap(activeIndex + 1)];
}

/**
 * Compute the module index reached by moving the carousel `direction` steps
 * (-1 previous, +1 next) from `activeIndex`, wrapping around both ends. Returns
 * the clamped index for tiny/empty lists (0 for a single module, 0 for empty).
 * Pure and testable.
 */
export function nextModuleIndex(input: {
  moduleCount: number;
  activeIndex: number;
  direction: -1 | 1;
}): number {
  const { moduleCount, activeIndex, direction } = input;
  if (moduleCount <= 0) return 0;
  return ((activeIndex + direction) % moduleCount + moduleCount) % moduleCount;
}

/**
 * Build a smooth SVG cubic-bezier path through a list of points. Each segment
 * uses the midpoint-x as both control points so the curve passes through every
 * node with continuous tangents. Returns '' for fewer than two points. Pure.
 */
export function createSmoothPath(points: TrailPoint[]): string {
  if (points.length < 2) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    path += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return path;
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
