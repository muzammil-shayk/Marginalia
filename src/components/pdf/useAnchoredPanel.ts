/**
 * Keeping a floating panel inside the window.
 *
 * Both the selection menu and the properties strip are positioned from something on the page —
 * a passage, a mark — and both used a hard-coded guess at their own width to stay on screen. That
 * guess was wrong the moment a panel grew: the bracket strip carries a palette, four weights,
 * three dash styles and two directions, and ran off the right edge of the window with its last
 * controls unreachable.
 *
 * So the panel is measured instead of guessed. It renders once at its preferred position, is
 * measured before the browser paints, and placed above its anchor (below when there is no room
 * above), clamped inside the viewport. Measuring in a layout effect rather than
 * an ordinary one is what keeps that correction from being visible as a flicker. The maths lives in
 * `panelPlacement.ts`, where it is tested.
 */

import { RefObject, useLayoutEffect, useState } from 'react';
import { placePanel, PlacementRect } from './panelPlacement';

/** What a page tells its panels about itself at measure time (see `placePanel`). */
export interface PanelContext {
  obstacles: PlacementRect[];
  lane?: { left: number; right: number };
  dock?: PlacementRect;
}

export interface AnchorRect {
  left: number;
  top: number;
  bottom: number;
}

export function useAnchoredPanel(
  ref: RefObject<HTMLElement | null>,
  anchor: AnchorRect | null,
  /** Anything that changes the panel's own size, so it is re-measured when its contents change. */
  deps: unknown[] = [],
  /**
   * Height of anything already occupying the foot of the window — today the instance navigator.
   * "Inside the viewport" is not the same as "not on top of something else": a panel clamped to
   * the bottom edge landed squarely over the navigator pill, burying the controls the reader was
   * mid-way through using. Treated as if the window ended that many pixels higher.
   */
  bottomInset = 0,
  /** The same for the top: the toolbar. A panel above a passage near it drops below instead. */
  topInset = 0,
  /** Elements the panel should not cover when the other side is free (the reader's note cards). */
  avoidSelector?: string,
  /** Text the panel must never cover, and the free places it may use instead (the reader's). */
  context?: () => PanelContext
): { left: number; top: number; visibility: 'hidden' | 'visible' } {
  const [position, setPosition] = useState<{ left: number; top: number; width?: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anchor) {
      setPosition(null);
      return;
    }

    // Above the anchor by preference, so the panel never covers the next line being read; see
    // `placePanel` for the fallbacks.
    const measure = () => {
      const ctx = context?.();
      // In the margin lane the panel wraps to the lane's width; set before measuring.
      el.style.maxWidth = ctx?.lane ? `${Math.floor(ctx.lane.right - ctx.lane.left)}px` : '';
      const { width, height } = el.getBoundingClientRect();
      // A docked width from the last pass must not feed this one's measurement.
      el.style.width = '';
      const { left, top, width: docked } = placePanel({
        anchor,
        width,
        height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        topInset,
        bottomInset,
        // A clear gap from the passage, so the panel never sits on the words it acts on.
        gap: 12,
        avoid: avoidSelector
          ? Array.from(document.querySelectorAll(avoidSelector), (n) => n.getBoundingClientRect()).filter(
              (r) => r.width > 0 && r.bottom > 0 && r.top < window.innerHeight
            )
          : undefined,
        ...ctx
      });
      if (docked) el.style.width = `${docked}px`;
      setPosition((prev) =>
        prev && prev.left === left && prev.top === top && prev.width === docked ? prev : { left, top, width: docked }
      );
    };

    measure();
    // A window resize can leave a panel hanging off an edge it used to fit inside, and a panel
    // that wraps to a second row on a narrow window changes height without any prop changing.
    window.addEventListener('resize', measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, anchor?.left, anchor?.top, anchor?.bottom, bottomInset, topInset, avoidSelector, context, ...deps]);

  return {
    left: position?.left ?? (anchor?.left ?? 0),
    top: position?.top ?? (anchor?.top ?? 0),
    // Hidden for the single frame between mounting and being measured, so a panel is never seen
    // at the wrong place before it is corrected.
    visibility: position ? 'visible' : 'hidden'
  };
}
