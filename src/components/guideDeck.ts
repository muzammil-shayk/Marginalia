/**
 * The tutorial deck at the foot of My Collections (GuideSection.tsx): one card per guide feature,
 * stacked, the front card in the middle and the next ones tucked behind it on both sides.
 *
 * The deck has one continuous position, `pos` (a card index, fractional mid-swipe), and every
 * card's pose is a function of how far it sits from it. Dragging moves `pos` with the finger, so
 * the card coming in and the card going out move together, and letting go eases `pos` to a whole
 * card. The deck loops: from the last card the next one is the first.
 */

/** A card's distance from the deck's position, wrapped so the deck loops: within (-n/2, n/2]. */
export function wrapOffset(index: number, pos: number, count: number): number {
  if (count <= 0) return 0;
  let d = (index - pos) % count;
  if (d > count / 2) d -= count;
  if (d <= -count / 2) d += count;
  return d;
}

/** The card a position shows (the whole card nearest to it), as an index into the deck. */
export function cardAt(pos: number, count: number): number {
  if (count <= 0) return 0;
  return ((Math.round(pos) % count) + count) % count;
}

export interface CardPose {
  /** Sideways, in percent of the card's own width. */
  x: number;
  scale: number;
  /** Degrees; cards behind lean away from the front one. */
  rotate: number;
  opacity: number;
  /** How much the card is shaded as it sits behind (0 front, up to 1). */
  shade: number;
  zIndex: number;
}

/** How far the first card behind peeks out, and each one after it. */
const FIRST_STEP = 34;
const NEXT_STEP = 14;

/** The pose of a card `d` cards from the front (negative to the left). */
export function cardPose(d: number): CardPose {
  const a = Math.abs(d);
  const side = Math.sign(d);
  const near = Math.min(a, 1);
  const far = Math.max(0, Math.min(a - 1, 2));
  return {
    x: side * (near * FIRST_STEP + far * NEXT_STEP),
    scale: 1 - near * 0.12 - far * 0.07,
    rotate: side * (near * 3 + far * 1.5),
    // Two cards show on each side; the third fades in only as it moves up to second place.
    opacity: a <= 2 ? 1 : Math.max(0, 3 - a),
    shade: Math.min(1, near * 0.28 + far * 0.22),
    zIndex: Math.round(100 - a * 10)
  };
}

/** A drag shorter than this (in card widths) springs back, unless it was a quick flick. */
export const SWIPE_COMMIT = 0.18;
/** A flick faster than this (card widths per second) moves one card, however short it was. */
export const FLICK_SPEED = 0.6;

/**
 * Where a drag lands. `start` is the whole card it began on, `pos` where it was let go, and
 * `velocity` how fast `pos` was moving (cards per second, positive towards later cards). A drag
 * moves as many cards as it was dragged across; a short quick flick still moves one.
 */
export function releaseTarget(start: number, pos: number, velocity: number): number {
  const moved = pos - start;
  const whole = Math.trunc(moved);
  const rest = moved - whole;
  if (Math.abs(velocity) >= FLICK_SPEED && Math.sign(velocity) === Math.sign(moved || velocity)) {
    // Thrown: carry on to the next whole card in the direction of the throw.
    return start + whole + Math.sign(velocity) * (rest === 0 && whole !== 0 ? 0 : 1);
  }
  if (Math.abs(rest) >= SWIPE_COMMIT) return start + whole + Math.sign(rest);
  return start + whole;
}

/** The nearest position showing card `index`, so jumping there takes the short way round. */
export function nearestPos(index: number, pos: number, count: number): number {
  return pos + wrapOffset(index, pos, count);
}

/**
 * How a card's picture zooms in on its feature: scaled by `zoom` from its top-left corner, then
 * moved by (tx, ty) so the feature sits as near the middle as it can without the picture's edge
 * coming into view. (x, y) is where the feature then shows, where the pointer clicks. All in
 * percent of the picture.
 */
export function zoomTo(focus: { x: number; y: number; zoom: number }): { tx: number; ty: number; x: number; y: number } {
  const z = Math.max(1, focus.zoom);
  const place = (f: number) => {
    const t = Math.min(0, Math.max(100 - 100 * z, 50 - z * f));
    return { t, at: t + z * f };
  };
  const h = place(focus.x);
  const v = place(focus.y);
  return { tx: h.t, ty: v.t, x: h.at, y: v.at };
}
