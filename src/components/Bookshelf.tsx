/**
 * The library as a bookshelf.
 *
 * Every stored document stands on one shelf as a spine: thickness follows its length, colour and
 * height are fixed per book (hashed from its id, so a book keeps its look between visits), and a
 * ribbon peeks out of any book that carries marks. Pointing at a spine, or tabbing to it, lifts
 * it and writes its name above the shelf. Choosing it pulls it out of its slot (the gap stays), carries
 * it down to the desk and opens it at its first page; there it can be read, renamed, deleted, or put
 * back, and it travels back into its slot.
 *
 * When sorted by recency, gold bookends divide the shelf by month.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react';
import { documentThumbnail } from '../utils/documentThumbnail';
import type { StoredDocumentMeta } from '../utils/documentStorage';

const SPINE_COLOR = '#435c52';

export function monogram(title: string): string {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase();
}

export const formatBytes = (bytes: number) =>
  !bytes ? '—' : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** First-page cover, or a monogram while it renders (and for formats without one). */
export const DocumentCover: React.FC<{ doc: StoredDocumentMeta; className?: string }> = ({ doc, className = '' }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    void documentThumbnail(doc).then((dataUrl) => {
      if (!cancelled) setSrc(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [doc.id, doc.updatedAt, doc.format, doc.originalBytes]);

  return (
    <div className={`relative h-full w-full overflow-hidden bg-stone-100 dark:bg-stone-900 ${className}`}>
      {src ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top bg-white select-none pointer-events-none"
        />
      ) : (
        <span
          className="absolute inset-0 flex items-center justify-center select-none"
          style={{ background: `linear-gradient(145deg, ${SPINE_COLOR} 0%, #2f423a 100%)` }}
        >
          <span className="font-serif text-[28px] md:text-[34px] font-bold text-white/95 tracking-tight">
            {monogram(doc.title)}
          </span>
        </span>
      )}
    </div>
  );
};

/** Cloth colours for spines: base, ink, and the painted band near the foot. */
const CLOTHS = [
  { base: '#e0603c', ink: '#fff4e8', band: '#a83a22' },
  { base: '#2f9c8a', ink: '#f6efe2', band: '#1d6b5e' },
  { base: '#7440ab', ink: '#fbefff', band: '#c4412f' },
  { base: '#efe6d4', ink: '#1b1a18', band: '#d9a441' },
  { base: '#161616', ink: '#f3efe7', band: '#b8452a' },
  { base: '#3e7d5c', ink: '#f3efe7', band: '#24533b' },
  { base: '#c4412f', ink: '#fff0e6', band: '#6a3797' },
  { base: '#3a4fc4', ink: '#f3efe7', band: '#23338f' }
] as const;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

type Look = ReturnType<typeof spineLook>;

function spineLook(doc: StoredDocumentMeta) {
  const h = hash(doc.id);
  const cloth = CLOTHS[h % CLOTHS.length];
  // Thicker for longer books: about 34px for an essay, capped at 66px for a long novel.
  const width = Math.round(Math.min(66, 30 + Math.sqrt(Math.max(0, doc.wordCount)) / 6));
  const height = 262 + ((h >> 4) % 5) * 11;
  return { ...cloth, width, height, bandAt: 70 + ((h >> 8) % 14) };
}

const clothVars = (look: Look) =>
  ({ color: look.ink, '--cloth': look.base, '--band': look.band, '--band-at': `${look.bandAt}%` }) as React.CSSProperties;

const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

type ShelfItem = { kind: 'book'; doc: StoredDocumentMeta } | { kind: 'bookend'; key: string; label: string };

/* ── Spine titles ──────────────────────────────────────────────────────────
   The reference sets each spine title on a canvas: the largest size from 7px up
   to about half the spine's thickness at which the title wraps into the columns
   the spine has room for (1, 2, or 3 when 40px or thicker), lines balanced;
   failing that, the smallest size with the last column cut at a word and "…". */
let measureCtx: CanvasRenderingContext2D | null = null;

export function fitSpineTitle(title: string, breadth: number, length: number, family: string) {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  const ctx = measureCtx;
  if (!ctx || length <= 0) return null;
  const width = (text: string) => ctx.measureText(text).width;
  const columnsFor = (size: number) => Math.max(1, Math.min(breadth >= 40 ? 3 : 2, Math.floor((breadth - 4) / (size * 1.08))));
  const words = title.trim().split(/\s+/).filter(Boolean);
  const wrap = (max: number) => {
    const out: string[] = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (line && width(next) > max) {
        out.push(line);
        line = w;
      } else line = next;
    }
    if (line) out.push(line);
    return out;
  };
  // Narrowest measure that still needs no more columns, so two columns come out even.
  const balance = (n: number) => {
    let lo = 0;
    let hi = length;
    while (hi - lo > 1) {
      const mid = (lo + hi) / 2;
      if (wrap(mid).length <= n) hi = mid;
      else lo = mid;
    }
    return wrap(hi);
  };

  for (let size = Math.max(7, Math.min(16, breadth * 0.52)); size >= 7; size -= 0.5) {
    ctx.font = `600 ${size}px ${family}`;
    const n = columnsFor(size);
    const lines = wrap(length);
    if (lines.length <= n && lines.every((l) => width(l) <= length)) {
      return { size, lines: lines.length > 1 ? balance(lines.length) : lines };
    }
  }

  ctx.font = `600 7px ${family}`;
  const n = columnsFor(7);
  const clip = (text: string) => {
    if (width(text) <= length) return text;
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (width(`${text.slice(0, mid).trimEnd()}…`) <= length) lo = mid;
      else hi = mid - 1;
    }
    return `${text.slice(0, lo).trimEnd()}…`;
  };
  const all = wrap(length);
  const lines = all.slice(0, n);
  if (all.length > n) {
    const last = lines[n - 1].split(' ');
    while (last.length > 1 && width(`${last.join(' ')} …`) > length) last.pop();
    lines[n - 1] =
      last.length > 1 || width(`${last[0]} …`) <= length ? `${last.join(' ').replace(/[\s,;:–—-]+$/, '')} …` : last[0];
  }
  return { size: 7, lines: lines.map(clip) };
}

const SpineTitle: React.FC<{ title: string; breadth: number }> = ({ title, breadth }) => {
  const boxRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState<{ size: number; lines: string[] } | null>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;
    let alive = true;
    // The spine's height is fixed, so its title box only changes size when the webfont arrives.
    const run = () => alive && setFit(fitSpineTitle(title, breadth, box.clientHeight - 2, getComputedStyle(text).fontFamily));
    run();
    void document.fonts?.ready.then(run);
    return () => {
      alive = false;
    };
  }, [title, breadth]);

  return (
    <span ref={boxRef} className="shelf-spine-title">
      <span ref={textRef} style={{ fontSize: fit?.size ?? 13 }}>
        {fit
          ? fit.lines.map((line, i) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </React.Fragment>
            ))
          : title}
      </span>
    </span>
  );
};

/** What a spine shows, on the shelf and in flight. */
const SpineFace: React.FC<{ doc: StoredDocumentMeta; look: Look }> = ({ doc, look }) => (
  <>
    {doc.annotationCount > 0 && <span className="shelf-ribbon" aria-hidden="true" />}
    <SpineTitle title={doc.title} breadth={look.width - 6} />
    <span className="shelf-spine-foot">
      <span className="shelf-spine-format">{doc.format}</span>
      <span className="shelf-spine-badge">{monogram(doc.title)}</span>
    </span>
  </>
);

/** A short hand-drawn arrow, the shelf's pointer. */
const Doodle: React.FC<{ className?: string; d: string; viewBox: string; style?: React.CSSProperties; show?: boolean }> = ({
  className,
  d,
  viewBox,
  style,
  show
}) => (
  <svg viewBox={viewBox} style={style} data-show={show ? '' : undefined} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d={d} />
  </svg>
);

/* ── The flight between shelf and desk ─────────────────────────────────────
   A book is a CSS box: its spine faces out on the shelf, its front cover (hinged
   at the spine) and first page sit on the right-hand side. One eased clock drives
   a pose per frame, transform only. Timings are the reference's (ShelfCanvas):
   to the desk, pull 500ms + arc 700ms (ease-in-out cubic) + land 200ms (ease-out
   cubic), then here the cover opens, 550ms; back to the shelf 1100ms, 78% arc
   and 22% push into the slot. Previous/Next runs both at 600/1400 speed, the
   incoming book waiting until the outgoing one has closed and lifted. Every
   curve is monotonic: no spring, no overshoot. */

type Pose = { x: number; y: number; s: number; ry: number; rz: number; leaf: number };
type Flight = { key: number; id: string; to: 'desk' | 'shelf'; from: Pose; fromSlot: boolean; fast: boolean; delay: number };

const DESK_TILT = -3;
const SWAP_DELAY = 450;
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out = (t: number) => 1 - Math.pow(1 - t, 3);
const mix = (a: number, b: number, e: number) => a + (b - a) * e;
const mixPose = (a: Pose, b: Pose, e: number): Pose => ({
  x: mix(a.x, b.x, e),
  y: mix(a.y, b.y, e),
  s: mix(a.s, b.s, e),
  ry: mix(a.ry, b.ry, e),
  rz: mix(a.rz, b.rz, e),
  leaf: mix(a.leaf, b.leaf, e)
});
const bezier = (a: number, c: number, b: number, e: number) => (1 - e) * (1 - e) * a + 2 * e * (1 - e) * c + e * e * b;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function phases(f: Flight) {
  if (f.to === 'desk') {
    const k = f.fast ? 600 / 1400 : 1;
    const pull = f.fromSlot ? 500 * k : 0;
    const arc = 700 * k;
    const land = 200 * k;
    const open = f.fast ? 400 : 550;
    return { pull, arc, land, open, total: pull + arc + land + open };
  }
  const trip = f.fast ? 600 : 1100;
  const close = (f.fast ? 200 : 350) * (-f.from.leaf / 180);
  return { close, arc: trip * 0.78, push: trip * 0.22, total: close + trip };
}

/** Where a flight is `ms` into it, given where it is headed now. */
function poseAt(f: Flight, ms: number, target: Pose): Pose {
  const p = phases(f);
  if (f.to === 'desk') {
    const pulled = f.fromSlot ? { ...f.from, y: f.from.y - 14, s: f.from.s * 1.08 } : f.from;
    const preLand = { ...target, y: target.y - 16 };
    if (ms < p.pull) return mixPose(f.from, pulled, inOut(ms / p.pull));
    const a = ms - p.pull;
    if (a < p.arc) {
      // Out and across first, then down onto the desk: the control point sits level with the pulled book.
      const e = inOut(a / p.arc);
      const turn = mixPose(pulled, { ...preLand, leaf: 0 }, e);
      return { ...turn, x: bezier(pulled.x, preLand.x, preLand.x, e), y: bezier(pulled.y, pulled.y - 24, preLand.y, e) };
    }
    const l = a - p.arc;
    if (l < p.land) return mixPose(preLand, target, out(l / p.land));
    return { ...target, leaf: -180 * inOut(clamp01((l - p.land) / p.open)) };
  }
  // Back to the shelf: close the cover where it lies, lift up and over, push into the slot.
  const pre = { ...target, y: target.y - 24, s: 1.08 };
  if (ms < p.close) return { ...f.from, leaf: f.from.leaf * (1 - inOut(ms / p.close)) };
  const shut = { ...f.from, leaf: 0 };
  const a = ms - p.close;
  if (a < p.arc) {
    const e = inOut(a / p.arc);
    const turn = mixPose(shut, pre, e);
    return { ...turn, x: bezier(shut.x, shut.x, pre.x, e), y: bezier(shut.y, pre.y - 24, pre.y, e) };
  }
  return mixPose(pre, target, out(clamp01((a - p.arc) / p.push)));
}

const FlyingBook: React.FC<{
  flight: Flight;
  doc: StoredDocumentMeta;
  look: Look;
  target: (f: Flight) => Pose | null;
  poses: Map<string, Pose>;
  onDone: (f: Flight) => void;
}> = ({ flight, doc, look, target, poses, onDone }) => {
  const bookRef = useRef<HTMLDivElement>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  const t = look.width;
  const h = look.height;
  const c = Math.round(h * 0.75);

  // Latest callbacks without restarting the flight on every parent render.
  const live = useRef({ target, onDone });
  live.current = { target, onDone };

  useLayoutEffect(() => {
    const book = bookRef.current;
    const leaf = leafRef.current;
    if (!book || !leaf) return;
    let last = flight.from;
    const draw = (p: Pose) => {
      last = p;
      poses.set(flight.id, p);
      const ry = (p.ry * Math.PI) / 180;
      // Keep the face nearest the reader on the page plane, so the start and end frames match the
      // spine and the desk exactly and the book never swells toward the viewer mid-turn.
      const depth = (t / 2) * Math.abs(Math.sin(ry)) + (c / 2) * Math.cos(ry);
      book.style.transform = `translate3d(${p.x - t / 2}px, ${p.y - h / 2}px, 0) perspective(1600px) rotateZ(${p.rz}deg) scale3d(${p.s}, ${p.s}, ${p.s}) translateZ(${-depth}px) rotateY(${p.ry}deg)`;
      leaf.style.transform = `rotateY(${p.leaf}deg)`;
    };
    draw(flight.from);
    const { total } = phases(flight);
    const controls = animate(0, total, {
      duration: total / 1000,
      delay: flight.delay / 1000,
      ease: 'linear',
      onUpdate: (ms) => draw(poseAt(flight, ms, live.current.target(flight) ?? last)),
      onComplete: () => live.current.onDone(flight)
    });
    return () => {
      controls.stop();
      if (poses.get(flight.id) === last) poses.delete(flight.id);
    };
  }, [flight, poses, t, h, c]);

  return (
    <div ref={bookRef} className="shelf-flyer" aria-hidden="true" style={{ width: t, height: h, ...clothVars(look) }}>
      <div className="shelf-spine shelf-fly-spine" style={{ width: t, height: h, transform: `translateZ(${c / 2}px)` }}>
        <SpineFace doc={doc} look={look} />
      </div>
      <div className="shelf-fly-side" style={{ width: c, height: h, left: (t - c) / 2, transform: `rotateY(90deg) translateZ(${t / 2}px)` }}>
        <div className="shelf-fly-page">
          <DocumentCover doc={doc} className="rounded-[3px]" />
        </div>
        <div ref={leafRef} className="shelf-fly-leaf">
          <div className="shelf-cover">
            <span className="shelf-label shelf-cover-format">{doc.format}</span>
            <span className="shelf-cover-title">{doc.title}</span>
            <span className="shelf-spine-badge">{monogram(doc.title)}</span>
          </div>
          <span className="shelf-endpaper shelf-fly-back" />
        </div>
      </div>
    </div>
  );
};

interface BookshelfProps {
  docs: StoredDocumentMeta[];
  groupByMonth: boolean;
  themes: { id: string; name: string; color: string }[];
  busyId: string | null;
  onOpen: (doc: StoredDocumentMeta) => void;
  onRename: (id: string, title: string) => Promise<void>;
  /** Resolves true once the document is gone. */
  onDelete: (id: string) => Promise<boolean>;
}

const EXPO = [0.16, 1, 0.3, 1] as const;

export const Bookshelf: React.FC<BookshelfProps> = ({ docs, groupByMonth, themes, busyId, onOpen, onRename, onDelete }) => {
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const deskBookRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLButtonElement>(null);
  const spineRefs = useRef(new Map<string, HTMLButtonElement>());
  /** Where each book in the air was last drawn, so a new flight can start from there. */
  const poses = useRef(new Map<string, Pose>());
  const flightKey = useRef(0);
  const restTimer = useRef(0);
  /** Which desk button Previous/Next was pressed with, to focus again once the card remounts. */
  const refocus = useRef<'prev' | 'next' | null>(null);

  const [pointed, setPointed] = useState<string | null>(null);
  const [captionX, setCaptionX] = useState(0);
  /** Where the pointer arrow sits: just above the lifted book's top edge, never inside the caption band. */
  const [pointerTop, setPointerTop] = useState(0);
  /** The book whose details are on the desk. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** The book lying open on the desk (it has finished its flight). */
  const [landedId, setLandedId] = useState<string | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  /** 'swap' when Previous/Next changed the book on an open desk. */
  const [entry, setEntry] = useState<'enter' | 'swap'>('enter');
  const [stopId, setStopId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const items = useMemo<ShelfItem[]>(() => {
    const out: ShelfItem[] = [];
    let lastMonth = '';
    for (const doc of docs) {
      if (groupByMonth) {
        const month = monthLabel(doc.updatedAt);
        if (month !== lastMonth) {
          out.push({ kind: 'bookend', key: `end-${month}`, label: month });
          lastMonth = month;
        }
      }
      out.push({ kind: 'book', doc });
    }
    return out;
  }, [docs, groupByMonth]);

  const byId = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const selectedIndex = selected ? docs.findIndex((d) => d.id === selected.id) : -1;
  const flying = new Set(flights.map((f) => f.id));
  const isOut = (id: string) => id === selectedId || flying.has(id);
  const pointedDoc = pointed && !isOut(pointed) ? byId.get(pointed) ?? null : null;

  // A book that leaves the library (deleted, filtered out) leaves the desk too.
  useEffect(() => {
    if (selectedId && !byId.has(selectedId)) setSelectedId(null);
    if (pointed && !byId.has(pointed)) setPointed(null);
    if (landedId && !byId.has(landedId)) setLandedId(null);
    // A book deleted mid-flight takes its flight (and its last drawn pose) with it.
    setFlights((fs) => (fs.some((f) => !byId.has(f.id)) ? fs.filter((f) => byId.has(f.id)) : fs));
    for (const id of poses.current.keys()) if (!byId.has(id)) poses.current.delete(id);
  }, [byId, selectedId, pointed, landedId]);

  // A rename closes its field once the new title lands; a failed rename keeps the field and draft.
  const selectedTitle = selected?.title;
  useEffect(() => setRenaming(false), [selectedTitle]);

  // The one spine that takes Tab; the arrow keys move along the shelf from there.
  const tabStop = stopId && byId.has(stopId) ? stopId : docs[0]?.id ?? null;

  const placeCaption = useCallback((id: string) => {
    const el = spineRefs.current.get(id);
    const scroller = scrollerRef.current;
    if (!el || !scroller) return;
    // `.shelf-row` is positioned, so a spine's offsets are relative to the row's unscrolled content;
    // the row's own offsets bring them into the stage, where the caption and arrow live.
    setCaptionX(scroller.offsetLeft + el.offsetLeft - scroller.scrollLeft + el.offsetWidth / 2);
    // 20px lift, 26px of arrow, a little air; never up into the caption band (it ends ~80px down).
    setPointerTop(Math.max(84, scroller.offsetTop + el.offsetTop - 20 - 30));
  }, []);

  const point = (id: string) => {
    window.clearTimeout(restTimer.current);
    setPointed(id);
    placeCaption(id);
  };

  /** Nothing under the pointer: back to rest, unless a spine holds visible keyboard focus. */
  const rest = () => {
    window.clearTimeout(restTimer.current);
    const el = document.activeElement;
    const id = [...spineRefs.current].find(([, s]) => s === el)?.[0];
    if (id && el?.matches(':focus-visible')) point(id);
    else setPointed(null);
  };
  // The 2px gaps between spines would flicker the caption; a short grace lets the next spine take over.
  const restSoon = () => {
    window.clearTimeout(restTimer.current);
    restTimer.current = window.setTimeout(rest, 90);
  };
  useEffect(() => () => window.clearTimeout(restTimer.current), []);

  /* Poses in stage coordinates, so page scroll during a flight moves both ends together. */
  const centreOf = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = stageRef.current!.getBoundingClientRect();
    return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top };
  };
  const slotPose = (id: string): Pose | null => {
    const el = spineRefs.current.get(id);
    return el && stageRef.current ? { ...centreOf(el), s: 1, ry: 0, rz: 0, leaf: 0 } : null;
  };
  const deskPose = (id: string): Pose | null => {
    const el = deskBookRef.current;
    const doc = byId.get(id);
    if (!el || !doc || !stageRef.current) return null;
    return { ...centreOf(el), s: el.offsetHeight / spineLook(doc).height, ry: -90, rz: DESK_TILT, leaf: 0 };
  };
  const target = (f: Flight) => (f.to === 'desk' ? deskPose(f.id) : slotPose(f.id));

  const fly = (id: string, to: Flight['to'], fast: boolean, delay = 0) => {
    const inAir = flying.has(id) ? poses.current.get(id) : undefined;
    const atDesk = to === 'shelf' && !inAir ? deskPose(id) : null;
    const from = inAir ?? (atDesk ? { ...atDesk, leaf: -180 } : slotPose(id));
    if (!from) return;
    const flight: Flight = { key: ++flightKey.current, id, to, from, fromSlot: !inAir && to === 'desk', fast, delay };
    setFlights((fs) => [...fs.filter((f) => f.id !== id), flight]);
  };

  const landed = (f: Flight) => {
    setFlights((fs) => fs.filter((x) => x.key !== f.key));
    if (f.to === 'desk') setLandedId(f.id);
  };

  const resetDesk = () => {
    setRenaming(false);
    setConfirmingDelete(false);
  };

  /** Take a book off the shelf and lay it open on the desk. */
  const take = (id: string) => {
    if (id === selectedId) return;
    const prev = selectedId;
    resetDesk();
    setEntry(prev ? 'swap' : 'enter');
    if (!reduced) {
      // The static book hands over to the flight at the same pose; hide it now, since an exiting desk
      // keeps rendering its last props.
      if (prev) {
        fly(prev, 'shelf', true);
        if (deskBookRef.current) deskBookRef.current.style.visibility = 'hidden';
      }
      fly(id, 'desk', Boolean(prev), prev ? SWAP_DELAY : 0);
    }
    setSelectedId(id);
    setLandedId(reduced ? id : null);
  };

  /** Put the desk's book back in its slot. */
  const shelve = () => {
    const id = selectedId;
    if (!id) return;
    if (!reduced) {
      fly(id, 'shelf', false);
      if (deskBookRef.current) deskBookRef.current.style.visibility = 'hidden';
    }
    resetDesk();
    setSelectedId(null);
    setLandedId(null);
    spineRefs.current.get(id)?.focus({ preventScroll: true });
  };

  // Opening the desk: focus its Read button (the spine it came from is now a gap), then, once the
  // book is on its way, bring the desk into view, as the reference does at 640ms.
  useEffect(() => {
    if (!selectedId || entry !== 'enter') return;
    readRef.current?.focus({ preventScroll: true });
    const t = window.setTimeout(
      () => deskRef.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }),
      reduced ? 0 : 640
    );
    return () => window.clearTimeout(t);
  }, [selectedId, entry, reduced]);

  const focusSpine = (id: string) => {
    setStopId(id);
    const el = spineRefs.current.get(id);
    el?.focus();
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  };

  const onShelfKey = (e: React.KeyboardEvent, id: string) => {
    const at = docs.findIndex((d) => d.id === id);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(docs.length - 1, at + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, at - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = docs.length - 1;
    else if (e.key === 'Escape' && selectedId) {
      e.preventDefault();
      shelve();
      return;
    }
    if (next >= 0) {
      e.preventDefault();
      focusSpine(docs[next].id);
    }
  };

  const step = (by: 1 | -1) => {
    if (selectedIndex < 0 || docs.length === 0) return;
    const next = docs[(selectedIndex + by + docs.length) % docs.length];
    // Scroll the shelf sideways to its slot before measuring it, but never the page: the reader stays at the desk.
    const el = spineRefs.current.get(next.id);
    const row = scrollerRef.current;
    if (el && row) row.scrollLeft = el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2;
    refocus.current = by === 1 ? 'next' : 'prev';
    take(next.id);
    setStopId(next.id);
  };

  // The desk card remounts per book (its fade is keyed on the id), which drops focus to the body;
  // put it back on the button that was pressed so Escape and the arrows keep working.
  useEffect(() => {
    const which = refocus.current;
    refocus.current = null;
    if (which) deskRef.current?.querySelector<HTMLButtonElement>(`[data-step="${which}"]`)?.focus({ preventScroll: true });
  }, [selectedId]);

  const scrollerWidth = scrollerRef.current?.clientWidth ?? 0;
  // Half the caption's width (`min(30rem, 100% - 2rem)`), so the whole line stays inside the stage.
  const half = Math.min(240, scrollerWidth / 2 - 16);
  const clampedX = Math.max(half, Math.min(captionX, scrollerWidth - half));
  const selectedLook = selected ? spineLook(selected) : null;

  return (
    <div ref={stageRef} className="shelf-stage">
      {/* ── The shelf ── */}
      <div className="relative pt-28">
        {/* Hover / focus caption, in its own band above the tallest book; the arrow points down to it. */}
        <div
          aria-hidden="true"
          className="shelf-caption"
          data-show={pointedDoc ? '' : undefined}
          style={{ left: clampedX }}
        >
          {pointedDoc && (
            <>
              <p className="font-handwriting text-[26px] leading-tight truncate">{pointedDoc.title}</p>
              <p className="shelf-label mt-1 truncate">
                {pointedDoc.format} · {pointedDoc.annotationCount} {pointedDoc.annotationCount === 1 ? 'mark' : 'marks'} ·{' '}
                {pointedDoc.wordCount.toLocaleString()} words
              </p>
            </>
          )}
        </div>
        <Doodle
          viewBox="0 0 15 22"
          d="M7.5 1.5c-.6 5 .5 11 0 18M3.5 15.5c1.6 1.4 2.8 2.8 4 4.3 1.1-1.6 2.3-3 3.9-4.4"
          className="shelf-pointer"
          show={Boolean(pointedDoc)}
          style={{ left: captionX - 7.5, top: pointerTop }}
        />

        <div
          ref={scrollerRef}
          role="group"
          aria-roledescription="bookshelf"
          aria-label={`${docs.length} ${docs.length === 1 ? 'book' : 'books'} on the shelf. Arrow keys move along it.`}
          className="shelf-row no-scrollbar"
          onScroll={() => pointed && placeCaption(pointed)}
          onPointerLeave={rest}
        >
          {items.map((item) => {
            if (item.kind === 'bookend') {
              return (
                <span key={item.key} aria-hidden="true" className="shelf-bookend">
                  {item.label}
                </span>
              );
            }
            const { doc } = item;
            const look = spineLook(doc);
            const onDesk = doc.id === selectedId;
            return (
              <button
                key={doc.id}
                ref={(el) => {
                  if (el) spineRefs.current.set(doc.id, el);
                  else spineRefs.current.delete(doc.id);
                }}
                type="button"
                className="shelf-spine"
                data-out={isOut(doc.id) || undefined}
                data-lifted={pointed === doc.id || undefined}
                tabIndex={doc.id === tabStop ? 0 : -1}
                aria-label={`${doc.title}, ${doc.format}, ${doc.annotationCount} ${doc.annotationCount === 1 ? 'mark' : 'marks'}`}
                aria-expanded={onDesk}
                aria-controls={selectedId ? 'shelf-desk' : undefined}
                onPointerEnter={() => point(doc.id)}
                onPointerLeave={restSoon}
                onFocus={(e) => {
                  setStopId(doc.id);
                  // A mouse click focuses the button too; only keyboard focus keeps a caption up.
                  if (e.currentTarget.matches(':focus-visible')) point(doc.id);
                }}
                onBlur={() => setPointed((p) => (p === doc.id ? null : p))}
                onKeyDown={(e) => onShelfKey(e, doc.id)}
                onClick={() => (onDesk ? shelve() : take(doc.id))}
                style={{ width: look.width, height: look.height, ...clothVars(look) }}
              >
                <SpineFace doc={doc} look={look} />
              </button>
            );
          })}
        </div>

        {/* The plank, with its two brackets. */}
        <div aria-hidden="true" className="shelf-plank">
          <span className="shelf-bracket left-[6%]" />
          <span className="shelf-bracket right-[6%] -scale-x-100" />
        </div>
        <span aria-hidden="true" className="shelf-edge shelf-edge-l" />
        <span aria-hidden="true" className="shelf-edge shelf-edge-r" />
      </div>

      {/* ── Books in the air ── */}
      {flights.map((f) => {
        const doc = byId.get(f.id);
        return doc ? (
          <FlyingBook key={f.key} flight={f} doc={doc} look={spineLook(doc)} target={target} poses={poses.current} onDone={landed} />
        ) : null;
      })}

      {/* ── The desk ── */}
      <AnimatePresence initial={false}>
        {selected && selectedLook && (
          <motion.div
            key="desk"
            id="shelf-desk"
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            // Shelving: the desk folds once the book has closed and lifted clear of it.
            exit={{ height: reduced ? 'auto' : 0, opacity: 0, transition: { duration: reduced ? 0.25 : 0.6, ease: EXPO, delay: reduced ? 0 : 0.8 } }}
            transition={reduced ? { height: { duration: 0 }, opacity: { duration: 0.25 } } : { duration: 0.6, ease: EXPO }}
            className="overflow-hidden"
          >
            <div ref={deskRef} className="px-3 sm:px-8 pt-12 pb-16">
              <div className="shelf-desk mx-auto max-w-5xl">
                <div className="grid gap-8 grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center">
                  {/* The book, lying open at its first page. */}
                  <div className="flex justify-center py-4" aria-hidden="true">
                    <motion.div
                      key={selected.id}
                      initial={entry === 'swap' || reduced ? { opacity: 0 } : false}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.36, ease: 'easeOut' }}
                      className="shelf-desk-spread"
                      style={{ '--cloth': selectedLook.base } as React.CSSProperties}
                    >
                      <div
                        ref={deskBookRef}
                        className="shelf-desk-book"
                        style={{ visibility: landedId === selected.id ? undefined : 'hidden' }}
                      >
                        <DocumentCover doc={selected} className="rounded-[3px]" />
                        <span className="shelf-endpaper shelf-desk-endpaper" />
                      </div>
                    </motion.div>
                  </div>

                  <motion.div
                    key={selected.id}
                    initial={reduced || entry === 'swap' ? { opacity: 0 } : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      reduced || entry === 'swap' ? { duration: 0.36, ease: 'easeOut' } : { duration: 0.9, ease: EXPO, delay: 0.26 }
                    }
                  >
                    <DeskCard
                      doc={selected}
                      themes={themes}
                      busy={busyId === selected.id}
                      renaming={renaming}
                      draft={draft}
                      confirmingDelete={confirmingDelete}
                      readRef={readRef}
                      onOpen={() => onOpen(selected)}
                      onStartRename={() => {
                        setDraft(selected.title);
                        setRenaming(true);
                      }}
                      onDraft={setDraft}
                      onCommitRename={async () => {
                        const title = draft.trim();
                        // A changed title closes the field through the effect above.
                        if (title && title !== selected.title) await onRename(selected.id, title);
                        else setRenaming(false);
                      }}
                      onCancelRename={() => setRenaming(false)}
                      onAskDelete={() => setConfirmingDelete(true)}
                      onCancelDelete={() => setConfirmingDelete(false)}
                      onDelete={async () => {
                        const at = docs.findIndex((d) => d.id === selected.id);
                        const neighbour = docs[at + 1] ?? docs[at - 1];
                        if ((await onDelete(selected.id)) && neighbour) focusSpine(neighbour.id);
                      }}
                      onPrev={() => step(-1)}
                      onNext={() => step(1)}
                      onShelve={shelve}
                      canStep={docs.length > 1}
                    />
                  </motion.div>
                </div>
                <span aria-hidden="true" className="shelf-desk-leg left-[4%]" />
                <span aria-hidden="true" className="shelf-desk-leg right-[4%]" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DeskCard: React.FC<{
  doc: StoredDocumentMeta;
  themes: { id: string; name: string; color: string }[];
  busy: boolean;
  renaming: boolean;
  draft: string;
  confirmingDelete: boolean;
  canStep: boolean;
  readRef: React.Ref<HTMLButtonElement>;
  onOpen: () => void;
  onStartRename: () => void;
  onDraft: (v: string) => void;
  onCommitRename: () => Promise<void>;
  onCancelRename: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => Promise<void>;
  onPrev: () => void;
  onNext: () => void;
  onShelve: () => void;
}> = (p) => {
  const { doc } = p;
  const docThemes = p.themes.filter((t) => doc.themeIds?.includes(t.id));
  const added = new Date(doc.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const chipLabels = [...docThemes.map((t) => t.name), ...(doc.analysis?.primaryThemes.slice(0, 3) ?? [])].join('\n');

  // The chip slot is two rows tall and never grows: chips that fall below it are hidden and a "+N"
  // chip takes the last place that still fits. Set imperatively (the `hidden` attribute is not a
  // React prop here) so a resize re-fits without a render loop.
  const chipsRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = chipsRef.current;
    if (!box) return;
    const fit = () => {
      const chips = Array.from(box.querySelectorAll<HTMLElement>('[data-chip]'));
      const more = box.querySelector<HTMLElement>('[data-more]')!;
      const fits = (el: HTMLElement) => el.offsetTop + el.offsetHeight <= box.clientHeight;
      chips.forEach((c) => (c.hidden = false));
      more.hidden = true;
      if (!chips.length || fits(chips[chips.length - 1])) return;
      more.hidden = false;
      for (let k = chips.length - 1; k >= 0; k--) {
        chips[k].hidden = true;
        more.textContent = `+${chips.length - k}`;
        if (fits(more)) return;
      }
    };
    fit();
    // Chip widths change once the handwriting font arrives.
    let live = true;
    void document.fonts.ready.then(() => live && fit());
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [doc.id, chipLabels]);

  // The row being swapped out turns invisible, which would drop focus to <body> (and Escape on the
  // card with it): hand focus to "Keep it" when the question opens, and back to "Delete" when it closes.
  const askDeleteRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(p.confirmingDelete);
  useEffect(() => {
    if (wasConfirming.current === p.confirmingDelete) return;
    wasConfirming.current = p.confirmingDelete;
    (p.confirmingDelete ? keepRef : askDeleteRef).current?.focus({ preventScroll: true });
  }, [p.confirmingDelete]);

  const summary =
    doc.annotationCount > 0
      ? `${doc.annotationCount} ${doc.annotationCount === 1 ? 'mark' : 'marks'}${
          docThemes.length ? ` filed under ${docThemes.length} ${docThemes.length === 1 ? 'theme' : 'themes'}` : ''
        }${doc.terminologyCount > 0 ? `, ${doc.terminologyCount} ${doc.terminologyCount === 1 ? 'term' : 'terms'} defined` : ''}.`
      : 'No marks yet. Open it to start annotating.';

  return (
    <div
      className="shelf-note"
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || p.renaming) return;
        // Escape backs out of the delete question first; only then does it shelve the book.
        if (p.confirmingDelete) p.onCancelDelete();
        else p.onShelve();
      }}
    >
      <p className="shelf-label shelf-underline truncate">
        {doc.format} · added {added}
      </p>

      {/* Fixed slot: the title clamps to two lines and the rename field sits in the same space. */}
      <div className="shelf-note-title mt-5">
        {p.renaming ? (
          <div className="flex items-center gap-2 h-full">
            <input
              autoFocus
              maxLength={300}
              value={p.draft}
              onChange={(e) => p.onDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void p.onCommitRename();
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  p.onCancelRename();
                }
              }}
              aria-label="New title"
              className="flex-1 min-w-0 bg-transparent border-b-2 border-[var(--shelf-ink)]/50 focus:border-[var(--shelf-ink)] outline-none font-handwriting text-[34px] leading-tight py-1"
            />
            <button type="button" className="shelf-pill" disabled={p.busy} onClick={() => void p.onCommitRename()}>
              {p.busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="shelf-pill" onClick={p.onCancelRename}>
              Cancel
            </button>
          </div>
        ) : (
          <h3 className="shelf-clamp font-handwriting" title={doc.title}>
            {doc.title}
          </h3>
        )}
      </div>

      <p className="shelf-label mt-3 truncate">
        {doc.wordCount.toLocaleString()} words{doc.originalBytes > 0 ? ` · ${formatBytes(doc.originalBytes)}` : ''}
      </p>

      <p className="shelf-note-summary shelf-clamp font-serif text-[var(--shelf-ink)]/90 mt-4">{summary}</p>

      <div ref={chipsRef} className="shelf-chips mt-4">
        {docThemes.map((t) => (
          <span key={t.id} data-chip className="shelf-chip" title={t.name}>
            <span className="w-2 h-2 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="truncate">{t.name}</span>
          </span>
        ))}
        {doc.analysis?.primaryThemes.slice(0, 3).map((t) => (
          <span key={t} data-chip className="shelf-chip opacity-75" title={t}>
            <span className="truncate">{t}</span>
          </span>
        ))}
        <span data-more hidden className="shelf-chip" />
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button ref={p.readRef} type="button" className="shelf-primary" onClick={p.onOpen}>
          Read <span aria-hidden="true">→</span>
        </button>
        <Doodle viewBox="0 0 40 20" d="M38 3C28 3 18 7 9 15M8 8.5c0 2.5.2 4.6.6 7 2.4-.2 4.6-.3 7-.2" className="w-10 h-5 opacity-80" />
      </div>

      {/* Hidden, not removed, while renaming, so the card keeps its height. */}
      <button type="button" className={`shelf-link mt-4 ${p.renaming ? 'invisible' : ''}`} onClick={p.onStartRename}>
        Rename
      </button>

      {/* Both rows share one grid cell; the cell is as tall as the taller row, so the delete question
          never resizes the card. The inactive row is invisible (and so unfocusable). */}
      <div className="grid mt-6">
        <div className={`shelf-actions ${p.confirmingDelete ? '' : 'invisible'}`}>
          <span className="shelf-label self-center text-[#f2a08a]">Delete permanently?</span>
          <button type="button" className="shelf-pill shelf-pill-danger" disabled={p.busy} onClick={() => void p.onDelete()}>
            {p.busy ? 'Deleting…' : 'Delete'}
          </button>
          <button ref={keepRef} type="button" className="shelf-pill" onClick={p.onCancelDelete}>
            Keep it
          </button>
        </div>
        <div className={`shelf-actions ${p.confirmingDelete ? 'invisible' : ''}`}>
          <button type="button" className="shelf-pill" data-step="prev" disabled={!p.canStep} onClick={p.onPrev}>
            ← Previous
          </button>
          <button type="button" className="shelf-pill" data-step="next" disabled={!p.canStep} onClick={p.onNext}>
            Next →
          </button>
          <button ref={askDeleteRef} type="button" className="shelf-pill" onClick={p.onAskDelete}>
            Delete
          </button>
          <button type="button" className="shelf-pill" onClick={p.onShelve}>
            Shelve it
          </button>
        </div>
      </div>
    </div>
  );
};
