/**
 * Where the focus-mode tool palette sits, and when it shows. Pure, so it is tested
 * (paletteSpot.test.ts); FocusPalette.tsx draws it.
 *
 * The palette lives against the left or right edge of the window, at a height the reader chose by
 * dragging it. `y` is the palette's centre as a fraction of the window height, so it lands in the
 * same place after the window is resized.
 */

export type PaletteSide = 'left' | 'right';
export interface PaletteSpot {
  side: PaletteSide;
  y: number;
}

export const DEFAULT_SPOT: PaletteSpot = { side: 'left', y: 0.5 };
/** T shows or hides the palette in focus mode. */
export const PALETTE_HOTKEY = 'T';
/** The strip along the palette's edge that calls it, in px. */
export const EDGE_PX = 28;
/** Gap between the palette and the window edge, in px. */
export const EDGE_GAP = 12;

/** A spot read from settings: anything malformed falls back to the default. */
export function spotOf(raw: unknown): PaletteSpot {
  const s = raw as Partial<PaletteSpot> | null | undefined;
  const side = s?.side === 'right' ? 'right' : s?.side === 'left' ? 'left' : DEFAULT_SPOT.side;
  const y = typeof s?.y === 'number' && Number.isFinite(s.y) ? clampY(s.y) : DEFAULT_SPOT.y;
  return { side, y };
}

const clampY = (y: number) => Math.min(0.95, Math.max(0.05, y));

/** Where a drag let go: the nearer side, and the height it was dropped at. */
export function dropSpot(clientX: number, clientY: number, viewW: number, viewH: number): PaletteSpot {
  return { side: clientX < viewW / 2 ? 'left' : 'right', y: clampY(viewH > 0 ? clientY / viewH : 0.5) };
}

/** The palette's top-left in px for a spot, kept wholly inside the window. */
export function spotBox(spot: PaletteSpot, w: number, h: number, viewW: number, viewH: number): { left: number; top: number } {
  const left = spot.side === 'left' ? EDGE_GAP : Math.max(EDGE_GAP, viewW - w - EDGE_GAP);
  const top = Math.min(Math.max(EDGE_GAP, spot.y * viewH - h / 2), Math.max(EDGE_GAP, viewH - h - EDGE_GAP));
  return { left, top };
}

/** Whether the pointer is in the strip along the palette's edge that calls it. */
export function nearEdge(clientX: number, side: PaletteSide, viewW: number): boolean {
  return side === 'left' ? clientX <= EDGE_PX : clientX >= viewW - EDGE_PX;
}

/** Arrow keys on the grip: up and down move it 5% of the window, left and right change side. */
export function nudgeSpot(spot: PaletteSpot, key: string): PaletteSpot | null {
  if (key === 'ArrowUp') return { ...spot, y: clampY(spot.y - 0.05) };
  if (key === 'ArrowDown') return { ...spot, y: clampY(spot.y + 0.05) };
  if (key === 'ArrowLeft') return { ...spot, side: 'left' };
  if (key === 'ArrowRight') return { ...spot, side: 'right' };
  return null;
}

/** Shown when called by the edge, pinned by T, hovered, holding keyboard focus, or being dragged. */
export function paletteShown(o: { nearEdge: boolean; pinned: boolean; hovered: boolean; focusWithin: boolean; dragging: boolean }): boolean {
  return o.nearEdge || o.pinned || o.hovered || o.focusWithin || o.dragging;
}
