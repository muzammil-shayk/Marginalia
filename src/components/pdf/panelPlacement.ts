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
}

export interface Placement {
  left: number;
  top: number;
  side: 'above' | 'below';
}

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
  avoid = []
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
