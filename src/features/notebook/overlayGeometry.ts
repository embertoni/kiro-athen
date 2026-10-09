/**
 * Pure geometry helpers for the draggable + resizable notebook overlay.
 *
 * These functions are intentionally DOM-free so they can be unit-tested
 * without a browser. The NotebookOverlay component wires pointer events to
 * these helpers: dragging calls `clampPosition`, resizing calls
 * `computeResize`. West/north resizes also move the top-left origin, which is
 * why `computeResize` returns both a `size` and a `position`.
 */

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Minimum panel size (px). Resizes never shrink below this. */
export const MIN_WIDTH = 240;
export const MIN_HEIGHT = 200;

/** Margin (px) kept between the panel's top-left corner and the viewport edge. */
export const SCREEN_MARGIN = 8;

/**
 * Clamp a desired top-left position so the panel stays on-screen.
 *
 * The top-left corner is kept at least `margin` px from the left/top edges and,
 * when viewport bounds are supplied, the panel is not allowed to slide fully
 * off the right/bottom edges (it keeps at least `margin` px visible there too).
 */
export function clampPosition(
  desired: Point,
  size: Size,
  viewport?: { width: number; height: number },
  margin: number = SCREEN_MARGIN,
): Point {
  let x = Math.max(margin, desired.x);
  let y = Math.max(margin, desired.y);

  if (viewport) {
    const maxX = Math.max(margin, viewport.width - size.width - margin);
    const maxY = Math.max(margin, viewport.height - size.height - margin);
    x = Math.min(x, maxX);
    y = Math.min(y, maxY);
  }

  return { x, y };
}

type ResizeInput = {
  direction: ResizeDirection;
  /** Pointer delta from the drag start (clientX/clientY - start). */
  deltaX: number;
  deltaY: number;
  /** Panel geometry captured when the resize started. */
  startLeft: number;
  startTop: number;
  startWidth: number;
  startHeight: number;
  minWidth?: number;
  minHeight?: number;
  margin?: number;
};

/**
 * Compute the new size (and, for west/north edges, the new top-left origin)
 * for a resize in a given direction.
 *
 * East/south edges grow width/height with the pointer. West/north edges grow
 * the panel in the opposite direction AND move the origin so the far edge stays
 * put. Minimum width/height are enforced; when a west/north resize is clamped
 * by the minimum, the origin stops moving so the panel does not drift.
 */
export function computeResize(input: ResizeInput): {
  size: Size;
  position: Point;
} {
  const {
    direction,
    deltaX,
    deltaY,
    startLeft,
    startTop,
    startWidth,
    startHeight,
    minWidth = MIN_WIDTH,
    minHeight = MIN_HEIGHT,
    margin = SCREEN_MARGIN,
  } = input;

  const resizingEast = direction.includes('e');
  const resizingWest = direction.includes('w');
  const resizingNorth = direction.includes('n');
  const resizingSouth = direction.includes('s');

  // Width + left origin.
  let width = startWidth;
  let x = startLeft;
  if (resizingEast) {
    width = Math.max(minWidth, startWidth + deltaX);
  } else if (resizingWest) {
    width = Math.max(minWidth, startWidth - deltaX);
    // The right edge stays fixed: new left = right - width.
    const right = startLeft + startWidth;
    x = right - width;
    // When the origin would cross the left margin, pin it to the margin and
    // RE-DERIVE the width from the fixed right edge. Without re-deriving, a
    // later on-screen clamp would shift the origin to the margin while leaving
    // the already-computed width intact, dragging the fixed right edge a few px
    // to the right. Clamping the width here keeps the right edge put (down to
    // the minimum width, which then wins).
    if (x < margin) {
      x = margin;
      width = Math.max(minWidth, right - margin);
    }
  }

  // Height + top origin.
  let height = startHeight;
  let y = startTop;
  if (resizingSouth) {
    height = Math.max(minHeight, startHeight + deltaY);
  } else if (resizingNorth) {
    height = Math.max(minHeight, startHeight - deltaY);
    const bottom = startTop + startHeight;
    y = bottom - height;
    // Mirror of the west case: pin the top to the margin and re-derive the
    // height from the fixed bottom edge so it does not drift.
    if (y < margin) {
      y = margin;
      height = Math.max(minHeight, bottom - margin);
    }
  }

  return { size: { width, height }, position: { x, y } };
}
