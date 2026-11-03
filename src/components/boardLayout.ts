/** Geometry for the excerpt board (ExcerptBoard.tsx). Pure, so it is tested. */

export const CARD_W = 232;
export const CARD_H = 112;

/** The first free slot on a grid, so a card placed from the tray never lands on another. */
export function nextFreeSlot(taken: { x: number; y: number }[], width: number): { x: number; y: number } {
  const cols = Math.max(1, Math.floor((width - 24) / (CARD_W + 24)));
  for (let i = 0; i < 400; i++) {
    const x = 24 + (i % cols) * (CARD_W + 24);
    const y = 24 + Math.floor(i / cols) * (CARD_H + 24);
    if (!taken.some((p) => Math.abs(p.x - x) < CARD_W && Math.abs(p.y - y) < CARD_H)) return { x, y };
  }
  return { x: 24, y: 24 };
}
