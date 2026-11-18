/**
 * "Getting the most from Marginalia" at the foot of My Collections: a deck of tutorial cards, one
 * per feature (`data/guide.ts`), each a real screenshot of the app (`scripts/capture-guide.cjs`).
 *
 * The cards stand in a stack: the front one in the middle, the next two tucked behind it on each
 * side. Swipe or drag either way (finger, pen, mouse, or a sideways trackpad swipe), press the
 * arrows or ← →, or click a card behind to bring it forward; the deck loops. The front card plays
 * its picture: it eases in on the feature while a pointer glides over and clicks it. Nothing plays
 * while the deck is off screen or moving, and with reduced motion the pictures stay still.
 *
 * Positions are one continuous number (see `guideDeck.ts`), so a card follows the finger and the
 * cards around it move with it, and letting go eases the deck to a whole card.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from 'motion/react';
import { ArrowLeft, ArrowRight, Lightbulb } from './icons';
import { GUIDE_GROUPS, type GuideFeature, type GuideGroup, type ShortcutDemo } from '../data/guide';
import { cardAt, cardPose, nearestPos, releaseTarget, wrapOffset, zoomTo } from './guideDeck';
import { createWheelTurn } from './swipeTurn';

/** The screenshots, found by file name; a missing one leaves its caption standing alone. */
const IMAGES = import.meta.glob('../assets/guide/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const imageFor = (id: string) => IMAGES[`../assets/guide/${id}.jpg`];

export const GUIDE_SECTION_ID = 'getting-the-most';

type Card = GuideFeature & { group: GuideGroup };
const CARDS: Card[] = GUIDE_GROUPS.flatMap((group) => group.features.map((f) => ({ ...f, group })));
const COUNT = CARDS.length;
/** The card with the most to say sets the deck's height, so the deck never jumps. */
const TALLEST = CARDS.reduce((a, b) => (b.caption.length > a.caption.length ? b : a));

const EASE = [0.22, 1, 0.36, 1] as const;

/** Scrolls My Collections to the guide (the tour's "See the full guide") and puts focus on the deck. */
export function showGuide(): void {
  const el = document.getElementById(GUIDE_SECTION_ID);
  if (!el) return;
  el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  el.querySelector<HTMLElement>('[data-guide-deck]')?.focus({ preventScroll: true });
}

/** The arrow a reader's pointer is drawn as in the pictures. */
const PointerGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
    <path d="M5 3 L5 19 L9.4 15 L12.3 21.2 L15 20 L12.2 13.9 L18 13.6 Z" fill="var(--color-ink)" stroke="#fffdf8" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

/** A screenshot that, while `playing`, zooms in on its feature while a pointer clicks it. */
const ShotPicture: React.FC<{ card: Card; playing: boolean }> = ({ card, playing }) => {
  const src = imageFor(card.id);
  const f = card.focus ?? { x: 50, y: 50, zoom: 1.3 };
  const zoom = zoomTo(f);
  // The pointer comes in from whichever side has room.
  // A toolbar card first clicks its tool (`tool`), then zooms to the mark it made.
  const start = card.tool ?? zoom;
  const style = {
    '--fx': `${zoom.x}%`,
    '--fy': `${zoom.y}%`,
    '--bx': `${start.x}%`,
    '--by': `${start.y}%`,
    '--tx': `${zoom.tx}%`,
    '--ty': `${zoom.ty}%`,
    '--z': f.zoom,
    '--ox': start.x > 70 ? '-70px' : '70px',
    '--oy': start.y > 70 ? '-56px' : '56px'
  } as React.CSSProperties;
  if (!src) return null;
  return (
    <div className={`deck-shot ${card.tool ? 'has-tool' : ''} ${playing ? 'is-playing' : ''}`} style={style}>
      <div className="deck-zoom">
        <img src={src} alt="" draggable={false} decoding="async" className="block w-full select-none" />
      </div>
      {card.tool && <span className="deck-ripple deck-ripple-tool" aria-hidden />}
      <span className="deck-ripple" aria-hidden />
      <span className="deck-pointer" aria-hidden>
        <PointerGlyph />
      </span>
    </div>
  );
};

/**
 * A shortcut's example: a scrap of page where the key's effect happens, a beat after the key goes
 * down (CSS `.sd-*` in index.css). Words, not boxes, so it reads as a page.
 */
const ShortcutScene: React.FC<{ demo: ShortcutDemo }> = ({ demo }) => {
  const words = (
    <>
      Reading slowly is a way of keeping company with <span className="sd-target">a book. The pencil in the <span className="sd-hit">margin</span></span> is a way of answering it, line by line.
    </>
  );
  if (demo === 'collapse') {
    return (
      <div className="sd-scene sd-collapse" aria-hidden>
        <p className="sd-line sd-fold-away">Reading slowly is a way of keeping company.</p>
        <p className="sd-line">
          <span className="sd-target">The pencil in the margin</span> answers it.
        </p>
        <p className="sd-line sd-fold-away">Line by line, the way one answers a letter.</p>
        <p className="sd-line sd-fold-away">Every reader has a private index.</p>
        <span className="sd-foldpill">3 paragraphs hidden</span>
        <p className="sd-line">
          Old <span className="sd-target sd-target-2">commonplace books</span> were built this way.
        </p>
      </div>
    );
  }
  if (demo === 'turn') {
    return (
      <div className="sd-scene sd-turn" aria-hidden>
        <div className="sd-spread">
          <div className="sd-leaf sd-leaf-left">
            <span className="sd-folio sd-folio-old">12</span>
            <span className="sd-folio sd-folio-new">14</span>
          </div>
          <div className="sd-leaf sd-leaf-right"><span className="sd-folio">15</span></div>
          <div className="sd-leaf sd-leaf-turning"><span className="sd-folio">13</span></div>
        </div>
      </div>
    );
  }
  return (
    <div className={`sd-scene sd-${demo}`} aria-hidden>
      {(demo === 'focus' || demo === 'find' || demo === 'escape' || demo === 'undo') && (
        <div className="sd-bar">
          {demo === 'find' ? (
            <span className="sd-findbox">
              <span className="sd-typed">margin</span> <span className="sd-count">1 of 1</span>
            </span>
          ) : (
            <>
              <i /> <i /> <i /> <i />
            </>
          )}
        </div>
      )}
      <p className="sd-page">{words}</p>
      {demo === 'area' && <span className="sd-areabox" />}
      {demo === 'pen' && (
        <svg className="sd-pen" viewBox="0 0 200 20" preserveAspectRatio="none">
          <path d="M2 12 C 22 2, 38 20, 58 10 S 98 2, 118 12 S 158 20, 198 8" />
        </svg>
      )}
      {demo === 'note' && <span className="sd-sticky">Answer it!</span>}
      {demo === 'escape' && (
        <span className="sd-menu">
          <i /> <i /> <i />
        </span>
      )}
      {demo === 'theme' && (
        <span className="sd-chips">
          <b>1 Key Concepts</b>
          <b>2 Questions</b>
        </span>
      )}
      {(demo === 'selectErase' || demo === 'area' || demo === 'note') && (
        <span className="sd-pointer">
          <PointerGlyph />
        </span>
      )}
    </div>
  );
};

/** How long each shortcut holds the card. */
const SHORTCUT_MS = 3800;

/**
 * The keyboard shortcuts card: each shortcut in turn, its keys pressed, what they do in words,
 * and an example of it happening on a scrap of page. The dots step through them by hand.
 */
const KeysPicture: React.FC<{ card: Card; playing: boolean }> = ({ card, playing }) => {
  const keys = card.keys ?? [];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!playing || keys.length === 0) return;
    const t = window.setTimeout(() => setI((n) => (n + 1) % keys.length), SHORTCUT_MS);
    return () => window.clearTimeout(t);
  }, [playing, keys.length, i]);
  const k = keys[i];
  if (!k) return null;
  const caps = k.keys.split(' · ');
  return (
    <div className="deck-keys">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: EASE }}
          className={`deck-keys-row ${playing ? 'is-playing' : ''}`}
        >
          <div className="deck-keys-side">
            <div className="flex flex-wrap items-center gap-2">
              {caps.map((c, n) => (
                <kbd key={c} className="deck-keycap" style={{ animationDelay: `${0.3 + n * 0.9}s` }}>
                  {c}
                </kbd>
              ))}
            </div>
            <p className="text-[12.5px] leading-snug text-stone-700 dark:text-stone-300">{k.does}</p>
          </div>
          <ShortcutScene demo={k.demo} />
        </motion.div>
      </AnimatePresence>
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-0.5">
        {keys.map((s, n) => (
          <button
            key={s.keys}
            type="button"
            tabIndex={-1}
            aria-label={`Show ${s.keys}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setI(n);
            }}
            className="h-3 px-0.5 flex items-center cursor-pointer"
          >
            <span className={`block h-1 rounded-full transition-all duration-300 ${n === i ? 'w-4 bg-gold' : 'w-1 bg-stone-300 dark:bg-stone-600'}`} />
          </button>
        ))}
      </div>
    </div>
  );
};

/** The face of a card: its picture over its title and caption. */
const CardFace: React.FC<{ card: Card; index: number; playing: boolean; playKey: number }> = ({ card, index, playing, playKey }) => (
  <>
    <div className="deck-frame">
      {card.keys ? <KeysPicture card={card} playing={playing} /> : <ShotPicture key={playKey} card={card} playing={playing} />}
    </div>
    <div className="px-5 pt-4 pb-5">
      <p className="caps caps-sm text-gold">
        {card.group.title} <span className="text-muted">· {index + 1} of {COUNT}</span>
      </p>
      <h3 className="title-hand text-[26px] leading-tight text-stone-900 dark:text-paper mt-1">{card.title}</h3>
      <p className="text-[13px] leading-relaxed text-muted mt-1.5">{card.caption}</p>
    </div>
  </>
);

const DeckCard: React.FC<{
  card: Card;
  index: number;
  pos: MotionValue<number>;
  front: boolean;
  playing: boolean;
  playKey: number;
  onPick: (index: number) => void;
}> = ({ card, index, pos, front, playing, playKey, onPick }) => {
  const pose = (v: number) => cardPose(wrapOffset(index, v, COUNT));
  const x = useTransform(pos, (v) => `${pose(v).x}%`);
  const scale = useTransform(pos, (v) => pose(v).scale);
  const rotate = useTransform(pos, (v) => pose(v).rotate);
  const opacity = useTransform(pos, (v) => pose(v).opacity);
  const zIndex = useTransform(pos, (v) => pose(v).zIndex);
  const visibility = useTransform(pos, (v) => (pose(v).opacity > 0 ? 'visible' : 'hidden'));
  const shade = useTransform(pos, (v) => pose(v).shade);
  return (
    <motion.div
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${COUNT}: ${card.title}`}
      aria-hidden={!front}
      onClick={() => onPick(index)}
      style={{ x, scale, rotate, opacity, zIndex, visibility }}
      className={`deck-card ${front ? '' : 'cursor-pointer'}`}
    >
      <CardFace card={card} index={index} playing={playing} playKey={playKey} />
      <motion.span className="deck-shade" style={{ opacity: shade }} aria-hidden />
    </motion.div>
  );
};

export const GuideSection: React.FC<{ isDark: boolean }> = () => {
  const reduce = useReducedMotion();
  const pos = useMotionValue(0);
  const [active, setActive] = useState(0);
  const [moving, setMoving] = useState(false);
  const [inView, setInView] = useState(false);
  /** Bumped each time a card settles at the front, so its picture starts from the beginning. */
  const [playKey, setPlayKey] = useState(0);

  const sectionRef = useRef<HTMLElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const target = useRef(0);
  const running = useRef<AnimationPlaybackControls | null>(null);

  useEffect(() => pos.on('change', (v) => setActive(cardAt(v, COUNT))), [pos]);

  // Pictures play only while the deck is on screen.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const goTo = useCallback(
    (to: number) => {
      target.current = to;
      running.current?.stop();
      const distance = Math.abs(to - pos.get());
      if (distance < 0.001) {
        pos.set(to);
        setMoving(false);
        setPlayKey((k) => k + 1);
        return;
      }
      setMoving(true);
      running.current = animate(pos, to, {
        duration: reduce ? 0.18 : Math.min(0.9, 0.5 + 0.12 * (distance - 1)),
        ease: EASE,
        onComplete: () => {
          setMoving(false);
          setPlayKey((k) => k + 1);
        }
      });
    },
    [pos, reduce]
  );

  const step = useCallback((delta: 1 | -1) => goTo(Math.round(target.current) + delta), [goTo]);
  const pick = (index: number) => goTo(nearestPos(index, target.current, COUNT));

  // A sideways trackpad swipe moves one card.
  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;
    const wheel = createWheelTurn(step, () => false);
    el.addEventListener('wheel', wheel.onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', wheel.onWheel);
      wheel.dispose();
    };
  }, [step]);

  // Dragging: the deck follows the pointer; a mostly-up-and-down movement is left to scroll the page.
  const drag = useRef<{ id: number; x: number; y: number; from: number; on: boolean; samples: { t: number; p: number }[] } | null>(null);
  const justDragged = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: pos.get(), on: false, samples: [] };
    justDragged.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        drag.current = null;
        return;
      }
      if (Math.abs(dx) < 6) return;
      d.on = true;
      running.current?.stop();
      setMoving(true);
      deckRef.current?.setPointerCapture(e.pointerId);
    }
    const width = deckRef.current?.querySelector<HTMLElement>('.deck-card')?.offsetWidth || 400;
    const p = d.from - dx / width;
    pos.set(p);
    const t = performance.now();
    d.samples.push({ t, p });
    while (d.samples.length > 2 && t - d.samples[0].t > 100) d.samples.shift();
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || !d.on) return;
    justDragged.current = true;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = last && first ? (last.t - first.t) / 1000 : 0;
    const velocity = dt > 0 ? (last.p - first.p) / dt : 0;
    goTo(releaseTarget(Math.round(d.from), pos.get(), velocity));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    }
  };

  const activeGroup = CARDS[active].group.id;
  const groupStarts = useMemo(() => GUIDE_GROUPS.map((g) => CARDS.findIndex((c) => c.group.id === g.id)), []);
  const playing = inView && !moving && !reduce;

  return (
    <section
      ref={sectionRef}
      id={GUIDE_SECTION_ID}
      aria-labelledby="guide-title"
      className="scroll-mt-6 rounded-2xl border overflow-hidden border-stone-200/70 bg-paper-3 dark:border-stone-800/80 dark:bg-night-4"
    >
      <div className="px-5 pt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gold/10 dark:bg-gold/15 flex items-center justify-center text-gold">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <h2 id="guide-title" className="title-hand text-[26px] text-stone-900 dark:text-stone-100 leading-none">
              Getting the most from Marginalia
            </h2>
            <p className="text-[12.5px] text-muted mt-1">Swipe through the cards either way. Each one is the feature as it looks in the app.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Jump to a part of the guide">
          {GUIDE_GROUPS.map((g, n) => (
            <button
              key={g.id}
              type="button"
              onClick={() => pick(groupStarts[n])}
              aria-pressed={activeGroup === g.id}
              className={`rounded-full caps caps-sm px-3 py-1.5 cursor-pointer transition-colors duration-200 ${
                activeGroup === g.id
                  ? 'bg-accent text-on-accent'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
            >
              {g.title}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={deckRef}
        data-guide-deck
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Tutorial cards. Use the left and right arrow keys to move through them."
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(e) => {
          // The click that ends a drag is not a pick.
          if (justDragged.current) {
            justDragged.current = false;
            e.stopPropagation();
          }
        }}
        className="deck-stage outline-none"
      >
        {/* Sizes the stage: the same card, unseen, with the longest caption. */}
        <div className="deck-card deck-sizer" aria-hidden>
          <CardFace card={TALLEST} index={0} playing={false} playKey={0} />
        </div>
        {CARDS.map((card, i) => (
          <DeckCard
            key={card.id}
            card={card}
            index={i}
            pos={pos}
            front={i === active}
            playing={playing && i === active}
            playKey={i === active ? playKey : 0}
            onPick={pick}
          />
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 pb-5">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous card"
          className="w-9 h-9 rounded-full flex items-center justify-center border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex flex-col items-center gap-1.5 w-28">
          <span className="caps caps-sm text-muted" aria-live="polite">
            {active + 1} / {COUNT}
          </span>
          <span className="h-0.5 w-full rounded-full bg-stone-300/60 dark:bg-stone-700 overflow-hidden" aria-hidden>
            <span className="block h-full bg-gold transition-[width] duration-500 ease-out" style={{ width: `${((active + 1) / COUNT) * 100}%` }} />
          </span>
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next card"
          className="w-9 h-9 rounded-full flex items-center justify-center border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};
