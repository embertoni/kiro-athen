import { describe, expect, it } from 'vitest';
import {
  MIN_HEIGHT,
  MIN_WIDTH,
  SCREEN_MARGIN,
  clampPosition,
  computeResize,
  type ResizeDirection,
} from '../overlayGeometry';

const SIZE = { width: 440, height: 420 };

describe('clampPosition', () => {
  it('keeps the top-left corner at or beyond the margin', () => {
    expect(clampPosition({ x: -50, y: -20 }, SIZE)).toEqual({
      x: SCREEN_MARGIN,
      y: SCREEN_MARGIN,
    });
  });

  it('leaves an on-screen position untouched', () => {
    expect(clampPosition({ x: 120, y: 80 }, SIZE)).toEqual({ x: 120, y: 80 });
  });

  it('clamps against the right/bottom edges when a viewport is given', () => {
    const viewport = { width: 1000, height: 700 };
    const clamped = clampPosition({ x: 900, y: 650 }, SIZE, viewport);
    expect(clamped.x).toBe(1000 - SIZE.width - SCREEN_MARGIN);
    expect(clamped.y).toBe(700 - SIZE.height - SCREEN_MARGIN);
  });

  it('falls back to the margin when the panel is wider than the viewport', () => {
    const viewport = { width: 200, height: 150 };
    const clamped = clampPosition({ x: 500, y: 500 }, SIZE, viewport);
    expect(clamped).toEqual({ x: SCREEN_MARGIN, y: SCREEN_MARGIN });
  });

  it('respects a custom margin', () => {
    expect(clampPosition({ x: 0, y: 0 }, SIZE, undefined, 20)).toEqual({
      x: 20,
      y: 20,
    });
  });
});

const BASE = {
  startLeft: 100,
  startTop: 100,
  startWidth: 400,
  startHeight: 300,
};

function resize(direction: ResizeDirection, deltaX: number, deltaY: number) {
  return computeResize({ direction, deltaX, deltaY, ...BASE });
}

describe('computeResize', () => {
  it('east edge grows width only, origin fixed', () => {
    const { size, position } = resize('e', 60, 999);
    expect(size).toEqual({ width: 460, height: 300 });
    expect(position).toEqual({ x: 100, y: 100 });
  });

  it('south edge grows height only, origin fixed', () => {
    const { size, position } = resize('s', 999, 50);
    expect(size).toEqual({ width: 400, height: 350 });
    expect(position).toEqual({ x: 100, y: 100 });
  });

  it('west edge grows width and moves the left origin, keeping the right edge', () => {
    const { size, position } = resize('w', -40, 0);
    // Dragging west by 40 widens the panel by 40 and moves x left by 40.
    expect(size.width).toBe(440);
    expect(position.x).toBe(60);
    // Right edge (left + width) is unchanged.
    expect(position.x + size.width).toBe(BASE.startLeft + BASE.startWidth);
  });

  it('north edge grows height and moves the top origin, keeping the bottom edge', () => {
    const { size, position } = resize('n', 0, -30);
    expect(size.height).toBe(330);
    expect(position.y).toBe(70);
    expect(position.y + size.height).toBe(BASE.startTop + BASE.startHeight);
  });

  it('se corner grows both width and height', () => {
    const { size, position } = resize('se', 25, 35);
    expect(size).toEqual({ width: 425, height: 335 });
    expect(position).toEqual({ x: 100, y: 100 });
  });

  it('nw corner grows both and moves both origins', () => {
    const { size, position } = resize('nw', -20, -20);
    expect(size).toEqual({ width: 420, height: 320 });
    expect(position).toEqual({ x: 80, y: 80 });
  });

  it('respects the minimum width and stops the west origin from drifting', () => {
    // Drag east far enough that a west resize would collapse below the min.
    const { size, position } = resize('w', 1000, 0);
    expect(size.width).toBe(MIN_WIDTH);
    // The right edge stays put, so x = right - minWidth.
    const right = BASE.startLeft + BASE.startWidth;
    expect(position.x).toBe(right - MIN_WIDTH);
  });

  it('respects the minimum height and stops the north origin from drifting', () => {
    const { size, position } = resize('n', 0, 1000);
    expect(size.height).toBe(MIN_HEIGHT);
    const bottom = BASE.startTop + BASE.startHeight;
    expect(position.y).toBe(bottom - MIN_HEIGHT);
  });

  it('east/south also clamp to the minimum when shrinking', () => {
    const { size } = resize('se', -1000, -1000);
    expect(size).toEqual({ width: MIN_WIDTH, height: MIN_HEIGHT });
  });

  it('pins the west origin at the margin and keeps the fixed right edge put', () => {
    // Drag west far enough that the origin would cross the left margin. The
    // panel starts at left=100 (right edge = 500); dragging west by 200 would
    // put the origin at -100, past the margin.
    const { size, position } = resize('w', -200, 0);
    expect(position.x).toBe(SCREEN_MARGIN);
    // The right edge must stay fixed at startLeft + startWidth; the width is
    // re-derived from it rather than left at the pre-clamp value.
    expect(position.x + size.width).toBe(BASE.startLeft + BASE.startWidth);
  });

  it('pins the north origin at the margin and keeps the fixed bottom edge put', () => {
    const { size, position } = resize('n', 0, -200);
    expect(position.y).toBe(SCREEN_MARGIN);
    expect(position.y + size.height).toBe(BASE.startTop + BASE.startHeight);
  });

  it('nw corner pins both origins at the margin, keeping both far edges put', () => {
    const { size, position } = resize('nw', -200, -200);
    expect(position).toEqual({ x: SCREEN_MARGIN, y: SCREEN_MARGIN });
    expect(position.x + size.width).toBe(BASE.startLeft + BASE.startWidth);
    expect(position.y + size.height).toBe(BASE.startTop + BASE.startHeight);
  });
});
