/**
 * The page turn shared by the reader's and the PDF workspace's two-page spread.
 *
 * A turn folds one leaf over at the gutter: its free edge lifts first, the sheet curls as it
 * rises, and it unrolls flat as it lands. The leaf is cut into FOLD_STRIPS vertical strips, each a
 * visual copy of its slice of the page (front: the page it leaves; back: the page it lands as),
 * placed along the curl in 3D. Every point of the sheet turns the same eased half circle, only
 * the edge starts sooner, so no part ever swings back (nothing springy). All of it is baked into
 * Web Animations keyframes, so it runs on the compositor.
 *
 * Copies, never the live pages, so ids, selection and the annotation layers stay single. The real
 * next spread is already rendered underneath; the copies hide what a real book would still be
 * covering, and are removed when the leaf lands. Building the strips takes tens of ms, so each
 * reader keeps the turns either way from the open spread built ahead (`TurnPrep`), and a click
 * only starts them.
 *
 * Reduced motion: no leaf, the old spread's copies cross-fade away over the new one.
 */

export type TurnDirection = 1 | -1;

/** One page's box inside the layer, in px. */
export interface PageBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TurnOptions {
  /** Positioned element (the book) the overlay is drawn in. */
  layer: HTMLElement;
  left: PageBox;
  right: PageBox;
  dir: TurnDirection;
  /** The old page that turns: the right page going forward, the left going back. */
  front: HTMLElement | null;
  /** The old page that stays put until the leaf lands on it. */
  cover: HTMLElement | null;
  /** The new page the leaf lands as (its back), read when the turn is built. */
  back: () => HTMLElement | null;
  /**
   * The new page on the side the leaf lifts from, shown under it. With it the overlay shows the whole
   * new spread by itself, so the reader re-renders only when the leaf lands (`start(onLand)`).
   */
  under?: () => HTMLElement | null;
  reduced: boolean;
  duration?: number;
}

export const TURN_MS = 540;
export const FADE_MS = 220;
/**
 * The overlay is gone this long after a turn starts, whatever happens. It used to wait for the
 * animation's `onfinish`, which a busy main thread (a scanned page painting) delayed to 3.5 s,
 * leaving the old page's marks over the new spread.
 */
export const TURN_FAILSAFE_MS = TURN_MS + 40;

/** When a turn's overlay is removed at the latest: just after the fade, or the turn, capped at TURN_FAILSAFE_MS. */
export function turnFailsafeMs(reduced: boolean | undefined, duration?: number): number {
  return reduced ? FADE_MS + 40 : Math.min(TURN_FAILSAFE_MS, (duration ?? TURN_MS) + 40);
}

/** Strips the leaf is cut into: enough that the curl reads as a curve, not facets. */
export const FOLD_STRIPS = 64;

/**
 * The curl: the free edge starts `lead` of the turn ahead of the hinge, points in between by
 * (1 - u^power). Tuned on contact sheets (spike, 2026-11-23).
 */
export const FOLD = { lead: 0.28, power: 1.2 };

/** Each point's own ease: sine in and out, so the edge visibly lifts from the first frames. */
export const pointEase = (x: number): number => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));

/** Angle (rad, 0..PI) of the sheet at fraction u (0 = hinge, 1 = free edge), at turn time t (0..1). */
export function angleAt(u: number, t: number, f = FOLD): number {
  const start = f.lead * (1 - Math.pow(u, f.power));
  return Math.PI * pointEase((t - start) / (1 - start));
}

export interface StripPose {
  /** Where the strip's hinge-side edge sits: along the book (x) and toward the viewer (z), px. */
  x: number;
  z: number;
  /** Its angle, rad. */
  phi: number;
}

/** The leaf of width W cut into n strips, at time t. Integrated along the sheet, so it never stretches. */
export function stripPoses(n: number, W: number, t: number, f = FOLD): StripPose[] {
  const w = W / n;
  const out: StripPose[] = [];
  let x = 0;
  let z = 0;
  for (let i = 0; i < n; i++) {
    const phi = angleAt((i + 0.5) / n, t, f);
    out.push({ x, z, phi });
    x += w * Math.cos(phi);
    z += w * Math.sin(phi);
  }
  return out;
}

/**
 * How shaded a strip turned to phi looks, 0..1: none flat, deepest edge-on. The same on its front
 * and back, so where the curl passes edge-on (front strips giving way to back ones) the shade is
 * continuous and the thin slivers there merge into one soft crease instead of stripes.
 */
export const foldShade = (phi: number): number => Math.pow(Math.max(0, Math.sin(phi)), 1.5);

/**
 * Keyframes for every strip: `samples + 1` poses at even times, played linearly, plus the shade
 * of each pose and the leaf's mean angle (for the shadows it casts). Pure, so it is tested.
 */
export function foldFrames(n: number, W: number, samples: number, f = FOLD) {
  const poses: StripPose[][] = [];
  for (let k = 0; k <= samples; k++) poses.push(stripPoses(n, W, k / samples, f));
  const mean = poses.map((p) => p.reduce((a, s) => a + s.phi, 0) / n);
  return { poses, mean };
}

/** Clamps a requested spread index into range. */
export function clampSpread(index: number, count: number): number {
  return Math.max(0, Math.min(Math.max(0, count - 1), Math.floor(index)));
}

/** The direction a move from `from` to `to` turns, or null when it does not move. */
export function turnDirection(from: number, to: number): TurnDirection | null {
  return to > from ? 1 : to < from ? -1 : null;
}

/** Whole pages a column flow of `scrollWidth` holds, given each page's stride (column + gap). */
export function pageCountFor(scrollWidth: number, stride: number, gap: number): number {
  if (stride <= 0) return 1;
  return Math.max(1, Math.round((scrollWidth + gap) / stride));
}

/**
 * Which column (page) a box sits in, from its centre `x`, for a flow whose first column starts at
 * `origin`. The centre, not the left edge: a paragraph's hover tint reaches a few px into the gap.
 */
export function columnAt(x: number, origin: number, stride: number): number {
  return stride > 0 ? Math.max(0, Math.floor((x - origin) / stride)) : 0;
}

/** Data attributes a copy keeps: they only style it. Every other one is a lookup hook for live code. */
const KEEP_DATA = new Set(['data-side', 'data-verbatim']);

/**
 * A visual copy of a live page: no ids, no lookup data attributes (live code querying
 * `[data-page-number]` and the like must never find a copy), not focusable, not read out.
 *
 * Kept cheap: a PDF page's text layer (invisible text, often thousands of spans) is not copied,
 * and canvases are copied at their on-screen size rather than at full device resolution.
 */
export function snapshotPage(el: HTMLElement): HTMLElement {
  const copy = el.cloneNode(false) as HTMLElement;
  for (const child of Array.from(el.childNodes)) {
    const skipInside = child instanceof HTMLElement && child.classList.contains('marginalia-text-layer');
    copy.appendChild(child.cloneNode(!skipInside));
  }
  for (const n of [copy, ...Array.from(copy.querySelectorAll('*'))]) {
    n.removeAttribute('id');
    for (const a of Array.from(n.attributes)) if (a.name.startsWith('data-') && !KEEP_DATA.has(a.name)) n.removeAttribute(a.name);
  }
  const from = el.querySelectorAll('canvas');
  copy.querySelectorAll('canvas').forEach((c, i) => {
    const src = from[i];
    if (!src) return;
    const w = Math.max(1, Math.round(src.clientWidth || src.width));
    const h = Math.max(1, Math.round(src.clientHeight || src.height));
    c.width = Math.min(w, src.width || w);
    c.height = Math.min(h, src.height || h);
    try {
      if (src.width && src.height) c.getContext('2d')?.drawImage(src, 0, 0, c.width, c.height);
    } catch {
      // A tainted or lost canvas just turns blank paper.
    }
  });
  return copy;
}

const place = (el: HTMLElement, box: PageBox) => {
  el.style.cssText += `;position:absolute;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;`;
};

/** A page-sized face holding a copy, clipped. */
const pageFace = (content: HTMLElement | null, box: PageBox) => {
  const f = document.createElement('div');
  f.className = 'page-turn-face';
  if (content) f.appendChild(content);
  place(f, box);
  return f;
};

/**
 * A copy of `src` (already a copy) showing only page x in [x0, x0 + w): moved left by x0 inside a
 * strip-wide face. Its canvases are cut to that slice, so all strips together hold one page of pixels.
 */
function sliceCopy(src: HTMLElement | null, x0: number, w: number, W: number, H: number): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = `position:absolute;top:0;left:${-x0}px;width:${W}px;height:${H}px;`;
  if (!src) return wrap;
  const c = src.cloneNode(true) as HTMLElement;
  const from = src.querySelectorAll('canvas');
  c.querySelectorAll('canvas').forEach((cv, i) => {
    const s = from[i];
    if (!s?.width) return;
    // shortcut: assumes the canvas fills the page box (true for a PDF page); a nested canvas would need its own offset.
    const kx = s.width / W;
    const sx = Math.max(0, Math.floor(x0 * kx));
    const sw = Math.max(1, Math.min(s.width - sx, Math.ceil((w + 2) * kx)));
    cv.width = sw;
    cv.height = s.height;
    cv.style.cssText = `position:absolute;top:0;left:${sx / kx}px;width:${sw / kx}px;height:${H}px;`;
    try {
      cv.getContext('2d')?.drawImage(s, sx, 0, sw, s.height, 0, 0, sw, s.height);
    } catch {
      // Blank paper, as in snapshotPage.
    }
  });
  wrap.appendChild(c);
  return wrap;
}

export interface TurnHandle {
  /** Resolves when the overlay is gone. */
  done: Promise<void>;
  /** Jumps to the end at once (a second turn asked for mid-flight finishes the first). */
  finish: () => void;
}

/** A turn built but not started: hidden in its layer until `start()`. */
export interface PreparedTurn {
  /** `onLand` runs as the leaf lands, just before the overlay goes (the reader shows the new spread then). */
  start: (onLand?: () => void) => TurnHandle;
  dispose: () => void;
}

/**
 * Builds a turn's whole overlay (copies, strips, keyframes) hidden in its layer, so starting it
 * later costs almost nothing. `.page-turn-prep` until started, `.page-turn` while playing.
 */
export function prepareTurn(o: TurnOptions): PreparedTurn {
  const root = document.createElement('div');
  root.className = 'page-turn-prep';
  root.setAttribute('aria-hidden', 'true');
  root.inert = true;
  const ms = o.duration ?? TURN_MS;
  /** Each makes one animation when the turn starts. */
  const plays: Array<() => Animation> = [];
  const timing: KeyframeAnimationOptions = { duration: ms, easing: 'linear', fill: 'forwards' };

  if (o.reduced) {
    // The old spread's two pages, over the new one, fading away.
    const turning = o.dir === 1 ? o.right : o.left;
    const staying = o.dir === 1 ? o.left : o.right;
    if (o.front) root.appendChild(pageFace(o.front, turning));
    if (o.cover) root.appendChild(pageFace(o.cover, staying));
    plays.push(() => root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-out', fill: 'forwards' }));
  } else {
    const fwd = o.dir === 1;
    const from = fwd ? o.right : o.left;
    const to = fwd ? o.left : o.right;
    const W = from.width;
    const H = from.height;
    const n = FOLD_STRIPS;
    const w = W / n;

    // Under the leaf, the new page; on the other side, what the leaf has not reached yet: the old page.
    const under = o.under?.() ?? null;
    if (under) root.appendChild(pageFace(under, from));
    if (o.cover) root.appendChild(pageFace(o.cover, to));
    // The shadow the lifting leaf casts on the page it uncovers, and on the one it lands over.
    const cast = (box: PageBox, side: string) => {
      const c = document.createElement('div');
      c.className = 'page-turn-cast';
      c.dataset.side = side;
      place(c, box);
      root.appendChild(c);
      return c;
    };
    const castFrom = cast(from, fwd ? 'left' : 'right');
    const castTo = cast(to, fwd ? 'right' : 'left');

    const back = o.back();
    // The leaf never shows past the pages (perspective enlarges the lifted edge).
    const clipBox: PageBox = {
      left: Math.min(o.left.left, o.right.left),
      top: Math.min(o.left.top, o.right.top),
      width: Math.max(o.left.left + o.left.width, o.right.left + o.right.width) - Math.min(o.left.left, o.right.left),
      height: Math.max(o.left.top + o.left.height, o.right.top + o.right.height) - Math.min(o.left.top, o.right.top)
    };
    const clip = document.createElement('div');
    clip.className = 'fold-clip';
    place(clip, clipBox);
    const hingeX = (fwd ? from.left : from.left + W) - clipBox.left;
    const stripTop = from.top - clipBox.top;
    const { poses, mean } = foldFrames(n, W, Math.max(24, Math.round(ms / 16)));
    const r2 = (v: number) => Math.round(v * 100) / 100;
    for (let i = 0; i < n; i++) {
      const strip = document.createElement('div');
      strip.className = 'fold-strip';
      // +1 px overlap toward the next strip hides the seam; the free-edge strip has none, or 1 px past
      // the page showed the face's own background as a hard line on dark paper.
      const sw = i === n - 1 ? w : w + 1;
      strip.style.cssText = `left:${fwd ? hingeX : hingeX - sw}px;top:${stripTop}px;width:${sw}px;height:${H}px;transform-origin:${fwd ? 'left' : 'right'} center;`;
      const s0 = i * w;
      const faces = [
        [o.front, fwd ? s0 : W - s0 - sw, W, 'fold-face'],
        [back, fwd ? to.width - s0 - sw : s0, to.width, 'fold-face fold-back']
      ] as const;
      const shades: HTMLElement[] = [];
      for (const [src, x0, pageW, cls] of faces) {
        const f = document.createElement('div');
        f.className = cls;
        f.appendChild(sliceCopy(src, x0, sw, pageW, H));
        const shade = document.createElement('div');
        shade.className = 'fold-shade';
        f.appendChild(shade);
        shades.push(shade);
        strip.appendChild(f);
      }
      clip.appendChild(strip);
      const tf = poses.map((p) => ({ transform: `translate3d(${r2(fwd ? p[i].x : -p[i].x)}px,0,${r2(p[i].z)}px) rotateY(${r2(fwd ? -p[i].phi : p[i].phi)}rad)` }));
      // Opacity is the shade's shape; its colour and depth per theme are in `.fold-shade`.
      const op = poses.map((p) => ({ opacity: r2(foldShade(p[i].phi)) }));
      plays.push(() => strip.animate(tf, timing));
      for (const s of shades) plays.push(() => s.animate(op, timing));
    }
    const fromShade = mean.map((p) => ({ opacity: 0.55 * Math.sin(p) * (p < Math.PI / 2 ? 1 : 2 * (1 - p / Math.PI)) }));
    const toShade = mean.map((p) => ({ opacity: 0.5 * Math.max(0, -Math.cos(p)) * Math.sin(p) * 2 }));
    plays.push(() => castFrom.animate(fromShade, timing), () => castTo.animate(toShade, timing));
    root.appendChild(clip);
  }
  o.layer.appendChild(root);
  // Made now and held at their first frame: parsing ~2,000 keyframes is most of a turn's start cost.
  const anims = plays.map((p) => {
    const a = p();
    a.pause();
    return a;
  });

  let started = false;
  return {
    dispose: () => {
      if (started) return;
      anims.forEach((a) => a.cancel());
      root.remove();
    },
    start: (onLand) => {
      started = true;
      root.className = 'page-turn';
      anims.forEach((a) => a.play());
      let resolve!: () => void;
      const done = new Promise<void>((r) => (resolve = r));
      let ended = false;
      const end = () => {
        if (ended) return;
        ended = true;
        window.clearTimeout(failsafe);
        try {
          onLand?.();
        } finally {
          anims.forEach((a) => a.cancel());
          root.remove();
          resolve();
        }
      };
      // Gone by TURN_FAILSAFE_MS (or just after a fade) whether or not `onfinish` has fired.
      const failsafe = window.setTimeout(end, turnFailsafeMs(o.reduced, o.duration));
      anims[0].onfinish = end;
      return { done, finish: end };
    }
  };
}

/** Builds and plays one turn at once (when none was prepared). */
export function playTurn(o: TurnOptions, onLand?: () => void): TurnHandle {
  return prepareTurn(o).start(onLand);
}

/**
 * Runs `fn` once the frame that starts a turn has been drawn. At a turn's first frames the leaf and
 * the cover hide the whole book, so the reader's own re-render for the new spread (tens of ms in
 * React) can wait for it instead of holding the leaf back.
 */
export function afterFirstFrame(fn: () => void): void {
  requestAnimationFrame(() => window.setTimeout(fn, 0));
}

/** What a reader gives `TurnPrep`: the key of the turn either way from where it is (null: none), and how to build it. */
export interface TurnSource {
  key: (dir: TurnDirection) => string | null;
  options: (dir: TurnDirection) => TurnOptions | null;
}

type IdleApi = {
  request: (cb: () => void) => number;
  cancel: (id: number) => void;
};
const browserIdle: IdleApi = {
  request: (cb) => window.requestIdleCallback(cb, { timeout: 500 }),
  cancel: (id) => window.cancelIdleCallback(id)
};

/**
 * Keeps the turns either way from the open spread built ahead, one direction per idle moment
 * (forward first), so a click or key starts its turn in the same frame. Anything that changes the
 * live pages calls `invalidate()`; a turn whose key or version no longer matches is thrown away
 * and the click builds fresh instead. While a turn plays (`after`) nothing is built.
 */
export class TurnPrep {
  private ready = new Map<TurnDirection, { key: string; version: number; turn: PreparedTurn }>();
  private version = 0;
  private idleId = 0;
  private source: TurnSource | null = null;
  private hold: Promise<unknown> | null = null;

  constructor(
    private prepare: (o: TurnOptions) => PreparedTurn = prepareTurn,
    private idle: IdleApi = browserIdle
  ) {}

  /** The spread moved or its geometry changed: build from here when next idle. */
  schedule(source: TurnSource): void {
    this.source = source;
    this.queue();
  }

  /** The live pages changed: what was built shows the old content. */
  invalidate(): void {
    this.version++;
    this.queue();
  }

  /** Builds nothing until `p` (a turn in flight) settles. */
  after(p: Promise<unknown>): void {
    const h = p.then(
      () => undefined,
      () => undefined
    );
    this.hold = h;
    if (this.idleId) this.idle.cancel(this.idleId);
    this.idleId = 0;
    void h.then(() => {
      if (this.hold !== h) return;
      this.hold = null;
      this.queue();
    });
  }

  /** The prepared turn for `key`, if it is still current (it is handed over, not kept). */
  take(dir: TurnDirection, key: string): PreparedTurn | null {
    const r = this.ready.get(dir);
    this.ready.delete(dir);
    // The other way was built from the spread being left: of no use once a turn starts. Removed when
    // idle (it is transparent meanwhile): taking a big subtree out cost ~10 ms on the click.
    const stale = [...this.ready.values()];
    this.ready.clear();
    if (stale.length) this.idle.request(() => stale.forEach((o) => o.turn.dispose()));
    if (r && r.key === key && r.version === this.version) return r.turn;
    r?.turn.dispose();
    return null;
  }

  dispose(): void {
    if (this.idleId) this.idle.cancel(this.idleId);
    this.idleId = 0;
    this.source = null;
    this.ready.forEach((r) => r.turn.dispose());
    this.ready.clear();
  }

  private queue(): void {
    if (this.idleId || this.hold || !this.source) return;
    this.idleId = this.idle.request(() => {
      this.idleId = 0;
      if (this.buildOne()) this.queue();
    });
  }

  /** Builds the first direction that is missing or stale; true if it did any work. */
  private buildOne(): boolean {
    const src = this.source;
    if (!src || this.hold) return false;
    for (const dir of [1, -1] as const) {
      const key = src.key(dir);
      const have = this.ready.get(dir);
      if (have && have.key === key && have.version === this.version) continue;
      have?.turn.dispose();
      this.ready.delete(dir);
      if (key === null) continue;
      const options = src.options(dir);
      if (!options) continue;
      this.ready.set(dir, { key, version: this.version, turn: this.prepare(options) });
      return true;
    }
    return false;
  }
}

/**
 * True when a mutation changes what a turn's copies show: not a turn's own overlay, and not a PDF
 * text layer (copies leave it out; OCR and pdf.js fill it long after a page paints).
 */
export function isLiveMutation(r: MutationRecord): boolean {
  const turnNode = (n: Node | null) => n instanceof Element && n.matches('.page-turn, .page-turn-prep');
  const el = r.target instanceof Element ? r.target : r.target.parentElement;
  if (el?.closest('.page-turn, .page-turn-prep, .marginalia-text-layer')) return false;
  if (r.type === 'childList') {
    const nodes = [...Array.from(r.addedNodes), ...Array.from(r.removedNodes)];
    if (nodes.length && nodes.every(turnNode)) return false;
  }
  return true;
}

/** The longest a turn waits for its new pages to paint before it turns anyway. */
export const TURN_WAIT_MAX_MS = 1500;

/** A second press the same way while a turn waits: the longest it waits on before turning. */
export const STEP_WAIT_MAX_MS = 250;

/** Sent to an offstage PDF page a turn is waiting on: draw now, not after the usual wait. */
export const DRAW_NOW_EVENT = 'marginalia:draw-now';

/**
 * Calls `then` once `ready()` is true (checked now, then whenever an attribute under `root`
 * changes, such as a page's `data-painted`), or after `maxMs` at the latest. Returns a cancel.
 */
export function waitFor(root: HTMLElement, ready: () => boolean, maxMs: number, then: () => void): () => void {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    observer.disconnect();
    window.clearTimeout(timer);
    then();
  };
  const observer = new MutationObserver(() => {
    if (ready()) finish();
  });
  observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['data-painted'] });
  const timer = window.setTimeout(finish, maxMs);
  if (ready()) finish();
  return () => {
    done = true;
    observer.disconnect();
    window.clearTimeout(timer);
  };
}
