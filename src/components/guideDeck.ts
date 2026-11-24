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

// ── Step scripts: a card that plays several steps over real frames (data/guideSteps.ts) ──

type Pt = { x: number; y: number };
interface ScriptStep {
  action: 'click' | 'drag' | 'type' | 'key' | 'hover';
  at: Pt;
  to?: Pt;
  keys?: string;
}

/** How the picture is zoomed: translate (tx, ty) then scale z, from its top-left; percent. */
export interface StepViewBox {
  tx: number;
  ty: number;
  z: number;
}

export const FULL_VIEW: StepViewBox = { tx: 0, ty: 0, z: 1 };

/** Where a point of the picture shows on the card under a view, in percent of the card's frame. */
export const onScreen = (v: StepViewBox, p: Pt): Pt => ({ x: v.tx + v.z * p.x, y: v.ty + v.z * p.y });

/**
 * The view for a step: zoomed in on its point (both ends of a drag) up to `zoom`, but never so far
 * that a drag's ends leave the frame, and never showing past the picture's edge.
 */
export function stepView(step: ScriptStep, zoom: number): StepViewBox {
  const end = step.to ?? step.at;
  const lo = { x: Math.min(step.at.x, end.x), y: Math.min(step.at.y, end.y) };
  const hi = { x: Math.max(step.at.x, end.x), y: Math.max(step.at.y, end.y) };
  const span = Math.max(hi.x - lo.x, hi.y - lo.y);
  // A drag keeps 15% of the frame free on each side.
  const z = Math.max(1, Math.min(zoom, span > 0 ? 70 / span : zoom));
  const v = zoomTo({ x: (lo.x + hi.x) / 2, y: (lo.y + hi.y) / 2, zoom: z });
  return { tx: v.tx, ty: v.ty, z };
}

/** Everything the player shows at one moment. */
export interface PlayerState {
  /** The step the caption and dots name. */
  step: number;
  /** The step whose frame is on top, and the one under it while it fades in. */
  frame: number;
  under: number;
  /** Bumped on every frame change, so the new frame fades in afresh. */
  fadeKey: number;
  fadeMs: number;
  view: StepViewBox;
  viewMs: number;
  pointer: Pt;
  pointerMs: number;
  pointerOn: boolean;
  pressed: boolean;
  /** Bumped on every click: a soft ripple where the pointer is. 0 = none yet. */
  tap: number;
  /** A keycap shown over the picture (typed text or a key), or none. */
  chip: string | null;
}

export interface Cue {
  t: number;
  state: Partial<Omit<PlayerState, 'under' | 'fadeKey'>>;
}

/** Applies a cue; a new frame keeps the old one underneath while it fades in. */
export function applyCue(prev: PlayerState, cue: Cue['state']): PlayerState {
  const next = { ...prev, ...cue };
  if (cue.frame !== undefined && cue.frame !== prev.frame) {
    next.under = prev.frame;
    next.fadeKey = prev.fadeKey + 1;
  }
  return next;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** A glide takes longer the further it goes. */
const glideMs = (a: Pt, b: Pt) => Math.round(clamp(420 + 7 * dist(a, b), 500, 1100));

/** The state a card starts in: the first frame, whole, the pointer just off its first point. */
export function openingState(steps: ScriptStep[]): PlayerState {
  const first = steps[0]?.at ?? { x: 50, y: 50 };
  // The pointer comes in from whichever side has room.
  const entry = { x: first.x + (first.x > 70 ? -14 : 14), y: first.y + (first.y > 70 ? -12 : 12) };
  return {
    step: 0,
    frame: 0,
    under: 0,
    fadeKey: 0,
    fadeMs: 0,
    view: FULL_VIEW,
    viewMs: 0,
    pointer: entry,
    pointerMs: 0,
    pointerOn: false,
    pressed: false,
    tap: 0,
    chip: null
  };
}

/**
 * A card's script as timed cues, in milliseconds from the start of one loop: the picture eases in
 * on each step's point while the pointer glides there, the step happens (a click with a ripple, a
 * drag from `at` to `to`, a key or typed text on a keycap, a hover), and that step's frame fades in.
 * At the end the picture eases back out so the whole result shows, holds, and fades back to the
 * first frame. `total` is when the loop starts again.
 */
export function stepTimeline(steps: ScriptStep[], zoom: number, mac = false): { cues: Cue[]; total: number } {
  const start = openingState(steps);
  const cues: Cue[] = [{ t: 0, state: { ...start } }];
  if (steps.length === 0) return { cues, total: 1000 };
  let t = 600;
  let pointer = start.pointer;
  let view = FULL_VIEW;
  let taps = 0;
  steps.forEach((s, i) => {
    const v = stepView(s, zoom);
    const target = onScreen(v, s.at);
    const g = glideMs(pointer, target);
    cues.push({ t, state: { step: i, view: v, viewMs: g, pointer: target, pointerMs: g, pointerOn: true } });
    t += g + 120;
    pointer = target;
    view = v;
    const fade = (ms: number) => (i > 0 ? { frame: i, fadeMs: ms } : {});
    switch (s.action) {
      case 'click':
        cues.push({ t, state: { pressed: true } });
        t += 150;
        cues.push({ t, state: { pressed: false, tap: ++taps, ...fade(420) } });
        t += 520;
        break;
      case 'drag': {
        const end = onScreen(v, s.to ?? s.at);
        const d = Math.round(clamp(500 + 9 * dist(pointer, end), 700, 1300));
        cues.push({ t, state: { pressed: true } });
        t += 140;
        // The mark appears as the pointer draws it.
        cues.push({ t, state: { pointer: end, pointerMs: d, ...fade(d) } });
        t += d;
        cues.push({ t, state: { pressed: false } });
        t += 280;
        pointer = end;
        break;
      }
      case 'type': {
        const n = (s.keys ?? '').length;
        cues.push({ t, state: { chip: s.keys ?? '' } });
        t += 200;
        cues.push({ t, state: fade(clamp(60 * n + 300, 400, 900)) });
        t += clamp(60 * n + 500, 700, 1300);
        break;
      }
      case 'key':
        cues.push({ t, state: { chip: chipText(s, mac) } });
        t += 260;
        cues.push({ t, state: fade(380) });
        t += 640;
        break;
      case 'hover':
        cues.push({ t, state: fade(380) });
        t += 500;
        break;
    }
    t += i === 0 && s.action === 'hover' ? 300 : 1000;
    if (s.action === 'type' || s.action === 'key') cues.push({ t: t - 400, state: { chip: null } });
  });
  // The whole result, then back to the start.
  cues.push({ t, state: { view: FULL_VIEW, viewMs: 900, pointer: unzoom(view, pointer), pointerMs: 900, pointerOn: false } });
  t += 900 + 1800;
  cues.push({ t, state: { frame: 0, fadeMs: 500 } });
  t += 700;
  cues.sort((a, b) => a.t - b.t);
  return { cues, total: t };
}

/** Where a point on screen under `v` lands once the picture is whole again. */
const unzoom = (v: StepViewBox, p: Pt): Pt => ({ x: (p.x - v.tx) / v.z, y: (p.y - v.ty) / v.z });

/** A card stopped on step i (its dot pressed): that step's frame and view, the pointer where it ended. */
export function settledState(prev: PlayerState, steps: ScriptStep[], i: number, zoom: number): PlayerState {
  const s = steps[i];
  const v = stepView(s, zoom);
  return applyCue(prev, {
    step: i,
    frame: i,
    fadeMs: 320,
    view: v,
    viewMs: 600,
    pointer: onScreen(v, s.to ?? s.at),
    pointerMs: 600,
    pointerOn: true,
    pressed: false,
    chip: null
  });
}

/** A key caption as the reader's keyboard shows it: "Mod+F" (or "Cmd/Ctrl+F") is ⌘F on a Mac, Ctrl+F elsewhere. */
export function keyLabel(keys: string, mac: boolean): string {
  const out = keys.replace(/\b(?:Mod|Cmd\/Ctrl)\+/g, mac ? '⌘' : 'Ctrl+');
  // A Mac chord is all symbols (⌘⇧Z), as the Mac's own menus write it.
  return mac ? out.replace(/⌘Shift\+/g, '⌘⇧') : out;
}

/** What a step's keycap shows: typed text as it is, a key in the reader's own keyboard's words. */
export function chipText(step: ScriptStep, mac: boolean): string {
  return step.action === 'key' ? keyLabel(step.keys ?? '', mac) : (step.keys ?? '');
}

/** A step's caption: the written one (data/guide.ts `steps`), or a plain one until it is written. */
export function stepCaption(step: ScriptStep, written: string | undefined, mac = false): string {
  if (written) return keyLabel(written, mac);
  switch (step.action) {
    case 'click':
      return 'Click';
    case 'drag':
      return 'Drag across';
    case 'type':
      return `Type “${step.keys ?? ''}”`;
    case 'key':
      return `Press ${keyLabel(step.keys ?? '', mac)}`;
    case 'hover':
      return 'Point at it';
  }
}

// ── The keyboard shortcuts card: one row per key, each with its own script ──

/** The script id for a shortcut row (data/guideSteps.generated.ts), e.g. `key-highlight`. */
export const keyScriptId = (demo: string) => `key-${demo}`;

/** Which shortcut the card shows, and whether it moves on to the next by itself. */
export interface KeyRows {
  row: number;
  auto: boolean;
}

export const KEY_ROWS_START: KeyRows = { row: 0, auto: true };

export type KeyRowEvent =
  /** The reader picked a row: it stays there, replaying, until the card comes to the front again. */
  | { type: 'pick'; row: number }
  /** ← → Home End on the row list: a pick too. */
  | { type: 'move'; by: 'prev' | 'next' | 'first' | 'last' }
  /** The row's script played to its end: on to the next row, unless one was picked. */
  | { type: 'played' }
  /** The card came back to the front: it goes through the rows again from where it is. */
  | { type: 'resume' };

/** The shortcuts card's row after an event, for `count` rows; the rows loop. */
export function keyRows(s: KeyRows, e: KeyRowEvent, count: number): KeyRows {
  if (count <= 0) return s;
  const wrap = (n: number) => ((n % count) + count) % count;
  switch (e.type) {
    case 'pick':
      return { row: wrap(e.row), auto: false };
    case 'move': {
      const row = e.by === 'first' ? 0 : e.by === 'last' ? count - 1 : wrap(s.row + (e.by === 'next' ? 1 : -1));
      return { row, auto: false };
    }
    case 'played':
      return s.auto ? { row: wrap(s.row + 1), auto: true } : s;
    case 'resume':
      return s.auto ? s : { ...s, auto: true };
  }
}
