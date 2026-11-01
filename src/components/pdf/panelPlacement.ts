/**
 * Where a floating panel goes relative to the thing it describes. Pure maths, tested.
 *
 * Above by default: a reader works down the page, so a panel below a passage covers the very
 * next line they are about to read. Below only when there is no room above (the passage sits at
 * the top of the viewer). If neither side fits, the side with more room wins and the panel is
 * clamped inside the window, which is the only case where it may overlap its anchor.
 *
 * `avoid` lists boxes the panel should not cover (the reader's note cards). A side that fits but
 * would cover one counts as blocked, and the other side is used when it is clear; when both are
 * blocked the usual order stands.
 *
 * `obstacles` are the glyph boxes of the text around the anchor. When given, the panel must not
 * cover a single one, so the search widens: a `lane` beside the text column first (the reader's
 * margin, level with the anchor), then directly above or below, then a `dock` over chrome that
 * already hides the page (the phone's bottom nav), then the nearest clear gap between lines or
 * paragraphs. Only when none of those is clear does the old above/below order apply.
 */

export interface PlacementRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PlacementAnchor {
  left: number;
  top: number;
  bottom: number;
}

export interface PlacementInput {
  anchor: PlacementAnchor;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  /** Space taken at the top of the window (the toolbar), treated as off limits. */
  topInset?: number;
  /** Space taken at the foot of the window (the instance navigator). */
  bottomInset?: number;
  /** Breathing room from the window edges. */
  margin?: number;
  /** Gap between the panel and its anchor. */
  gap?: number;
  /** Boxes the panel should stay off when it has the choice. */
  avoid?: PlacementRect[];
  /** Glyph boxes the panel must never cover (see the header). */
  obstacles?: PlacementRect[];
  /** A free column beside the text, e.g. the reader's margin: x-range the panel may sit in. */
  lane?: { left: number; right: number };
  /** Chrome the panel may sit on without hiding the page (the bottom nav). */
  dock?: PlacementRect;
}

export interface Placement {
  left: number;
  top: number;
  side: 'above' | 'below' | 'lane' | 'dock' | 'gap';
  /** Docked panels span the dock (less 8px each side). */
  width?: number;
}

/** How far the gap search may move a panel from its anchor before giving up. */
const GAP_REACH = 240;
/** Horizontal step of the sideways search for a clear spot. */
const SWEEP_STEP = 24;
/** Clearance kept between the panel and any glyph. */
const GLYPH_PAD = 2;

export function placePanel({
  anchor,
  width,
  height,
  viewportWidth,
  viewportHeight,
  topInset = 0,
  bottomInset = 0,
  margin = 8,
  gap = 8,
  avoid = [],
  obstacles,
  lane,
  dock
}: PlacementInput): Placement {
  const ceiling = topInset + margin;
  const floor = viewportHeight - bottomInset - margin;

  const aboveTop = anchor.top - gap - height;
  const belowTop = anchor.bottom + gap;
  const fitsAbove = aboveTop >= ceiling;
  const fitsBelow = belowTop + height <= floor;

  const maxLeft = Math.max(margin, viewportWidth - margin - width);
  const left = Math.min(Math.max(anchor.left, margin), maxLeft);
  const covers = (top: number) =>
    avoid.some((r) => r.left < left + width && r.right > left && r.top < top + height && r.bottom > top);

  if (obstacles) {
    const free = (l: number, t: number) =>
      t >= ceiling &&
      t + height <= floor &&
      // 8px of air from a note card, so the two never read as one block.
      !avoid.some((r) => r.left - 8 < l + width && r.right + 8 > l && r.top - 8 < t + height && r.bottom + 8 > t) &&
      !obstacles.some(
        (r) =>
          r.left - GLYPH_PAD < l + width &&
          r.right + GLYPH_PAD > l &&
          r.top - GLYPH_PAD < t + height &&
          r.bottom + GLYPH_PAD > t
      );
    // Nearest clear top to `ideal` along x = l, within `reach` either way.
    const nearest = (l: number, ideal: number, reach: number) => {
      for (let d = 0; d <= reach; d += 2) {
        if (free(l, ideal - d)) return ideal - d;
        if (free(l, ideal + d)) return ideal + d;
      }
      return null;
    };
    if (lane && lane.right - lane.left >= width) {
      // Level with the anchor's first line; pushed off a note card only as far as needed.
      const t = nearest(lane.left, anchor.top - 6, viewportHeight);
      if (t !== null) return { left: lane.left, top: t, side: 'lane' };
    }
    if (free(left, aboveTop)) return { left, top: aboveTop, side: 'above' };
    if (free(left, belowTop)) return { left, top: belowTop, side: 'below' };
    // Only while the anchor itself sits clear above the dock.
    if (dock && dock.bottom - dock.top >= height && dock.right - dock.left >= width && anchor.bottom + gap <= dock.top) {
      return {
        left: dock.left + 8,
        top: dock.top + (dock.bottom - dock.top - height) / 2,
        side: 'dock',
        width: dock.right - dock.left - 16
      };
    }
    const up = nearest(left, aboveTop, GAP_REACH);
    const down = nearest(left, belowTop, GAP_REACH);
    const t =
      up === null ? down : down === null ? up : anchor.top - (up + height) <= down - anchor.bottom ? up : down;
    if (t !== null) return { left, top: t, side: 'gap' };
    // Dense text straight above and below (a two-page spread): the nearest clear spot to either
    // side instead, by distance from where the panel wanted to be.
    let best: { left: number; top: number; d: number } | null = null;
    for (let l = margin; l <= maxLeft; l += SWEEP_STEP) {
      for (const ideal of [aboveTop, belowTop]) {
        const at = nearest(l, ideal, GAP_REACH);
        if (at === null) continue;
        const d = Math.abs(l - left) + Math.abs(at - ideal);
        if (!best || d < best.d) best = { left: l, top: at, d };
      }
    }
    if (best) return { left: best.left, top: best.top, side: 'gap' };
  }

  const clearAbove = fitsAbove && !covers(aboveTop);
  const clearBelow = fitsBelow && !covers(belowTop);

  let side: Placement['side'];
  if (clearAbove) side = 'above';
  else if (clearBelow) side = 'below';
  else if (fitsAbove) side = 'above';
  else if (fitsBelow) side = 'below';
  else side = anchor.top - ceiling >= floor - anchor.bottom ? 'above' : 'below';

  const rawTop = side === 'above' ? aboveTop : belowTop;
  const maxTop = Math.max(ceiling, floor - height);

  return {
    left,
    top: Math.min(Math.max(rawTop, ceiling), maxTop),
    side
  };
}
