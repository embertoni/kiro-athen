/**
 * useHorizontalDragScroll — pointer-drag + wheel horizontal scrolling for a
 * scroll container (the dashboard trail). Returns props to spread onto the
 * scrollable element. The container must have overflow-x: auto.
 *
 * - Pointer/touch drag pans the trail horizontally (grab/grabbing cursor).
 * - A vertical wheel is translated to horizontal scroll so a mouse wheel also
 *   moves the trail left/right.
 */

import { useCallback, useRef, type RefObject } from 'react';

export interface DragScrollHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLDivElement>) => void;
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
}

export function useHorizontalDragScroll(
  ref: RefObject<HTMLDivElement | null>,
): DragScrollHandlers {
  const state = useRef({ dragging: false, startX: 0, startScroll: 0 });

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      // Let interactive controls (lesson buttons) keep their click behavior.
      state.current = {
        dragging: true,
        startX: e.clientX,
        startScroll: el.scrollLeft,
      };
    },
    [ref],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el || !state.current.dragging) return;
      const dx = e.clientX - state.current.startX;
      // Only hijack once the drag is meaningful, so clicks still register.
      if (Math.abs(dx) < 4) return;
      el.scrollLeft = state.current.startScroll - dx;
    },
    [ref],
  );

  const endDrag = useCallback(() => {
    state.current.dragging = false;
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      // Translate predominantly-vertical wheel movement into horizontal scroll.
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
      }
    },
    [ref],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerLeave: endDrag,
    onWheel,
  };
}
