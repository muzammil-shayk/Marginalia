/**
 * "Getting the most from Marginalia" at the foot of My Collections: a deck of tutorial cards, one
 * per feature (`data/guide.ts`), each a real screenshot of the app (`scripts/capture-guide.cjs`).
 *
 * The cards stand in a stack: the front one in the middle, the next two tucked behind it on each
 * side. Swipe or drag either way (finger, pen, mouse, or a sideways trackpad swipe), press the
 * arrows or ← →, or click a card behind to bring it forward; the deck loops. The front card plays:
 * a card with a step script (data/guideSteps.ts) plays every step over real frames of the app
 * (useStepPlayer); one without shows only its words. Nothing plays
 * while the deck is off screen or moving, and with reduced motion the pictures stay still.
 *
 * Positions are one continuous number (see `guideDeck.ts`), so a card follows the finger and the
 * cards around it move with it, and letting go eases the deck to a whole card.
 */

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from 'motion/react';
import { ArrowLeft, ArrowRight, Lightbulb, RotateCcw } from './icons';
import { GUIDE_GROUPS, MOD, type GuideFeature, type GuideGroup } from '../data/guide';
import type { GuideStep, GuideSteps } from '../data/guideSteps';
import { applyCue, cardAt, cardPose, KEY_ROWS_START, keyLabel, keyRows, keyScriptId, nearestPos, openingState, releaseTarget, settledState, stepCaption, stepTimeline, wrapOffset, type KeyRowEvent, type PlayerState } from './guideDeck';
import { createWheelTurn } from './swipeTurn';

/** Every picture a step script can name (data/guideSteps.ts `frame`, a path under assets/guide/steps/). */
const FRAMES = import.meta.glob('../assets/guide/steps/**/*.{jpg,png,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
function frameUrl(frame: string): string | undefined {
  if (/^(https?:|data:|blob:|\/)/.test(frame)) return frame;
  const base = `../assets/guide/${frame}`;
  return FRAMES[base] ?? FRAMES[`${base}.jpg`] ?? FRAMES[`${base}.png`] ?? FRAMES[`${base}.webp`];
}

/** The scripts the capture script made; a card with none shows its words over an empty frame. */
const GENERATED = import.meta.glob<GuideSteps>('../data/guideSteps.generated.ts', { eager: true, import: 'GUIDE_STEPS' });
const SCRIPTS: GuideSteps = Object.values(GENERATED)[0] ?? {};

/** One caption per step of each shortcut's script, by script id (`key-highlight`); none yet = plain words. */
type StepCaptions = Record<string, string[]>;
const KEY_CAPTION_FILE = import.meta.glob<StepCaptions>('../data/guideKeyCaptions.ts', { eager: true, import: 'KEY_STEP_CAPTIONS' });
const KEY_CAPTIONS: StepCaptions = Object.values(KEY_CAPTION_FILE)[0] ?? {};

/** What the cards play: the step scripts, and the shortcut steps' captions. */
type GuideData = { scripts: GuideSteps; captions: StepCaptions };
const GUIDE: GuideData = { scripts: SCRIPTS, captions: KEY_CAPTIONS };

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

/** Key captions say ⌘ on a Mac, Ctrl+ elsewhere (as data/guide.ts does). */
const IS_MAC = MOD === '⌘';

/** The eased glide every move on a card uses: no spring, no overshoot. */
const GLIDE = 'cubic-bezier(0.45, 0, 0.2, 1)';

/**
 * A card that plays its script (data/guideSteps.ts): the picture eases in on each step, the pointer
 * glides there and acts (a click ripples, a drag draws, a key shows on a keycap), and the step's
 * frame fades in, so the card shows the feature working. Under it, the step's caption and a dot
 * per step: a dot stops the card on that step, the replay button plays it again. With reduced
 * motion the card shows the finished result and lists the steps.
 */
type PlayerOptions = {
  /** Captions in place of the card's own `steps` (a shortcut row's). */
  captions?: string[];
  /** Called each time the script has played to its end. */
  onPlayed?: () => void;
};

function useStepPlayer(card: Card, script: GuideStep[], playing: boolean, front: boolean, { captions, onPlayed }: PlayerOptions = {}) {
  const reduce = useReducedMotion();
  const zoom = card.zoom ?? 1.5;
  const timeline = useMemo(() => stepTimeline(script, zoom, IS_MAC), [script, zoom]);
  const urls = useMemo(() => script.map((s) => frameUrl(s.frame)), [script]);
  const [state, setState] = useState<PlayerState>(() => openingState(script));
  /** The step a dot stopped the card on, or null while it plays. */
  const [stopped, setStopped] = useState<number | null>(null);
  const [round, setRound] = useState(0);

  // Fetch every frame up front, so none pops in half-drawn.
  useEffect(() => {
    if (!playing) return;
    for (const u of new Set(urls)) if (u) new Image().src = u;
  }, [playing, urls]);

  useEffect(() => {
    if (!playing || reduce || stopped !== null) return;
    const timers = timeline.cues.map((c) => window.setTimeout(() => setState((s) => applyCue(s, c.state)), c.t));
    timers.push(
      window.setTimeout(() => {
        onPlayed?.();
        setRound((n) => n + 1);
      }, timeline.total)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [playing, reduce, stopped, round, timeline, onPlayed]);

  const last = script.length - 1;
  const n = reduce ? last : state.step;
  const caption = (i: number) => stepCaption(script[i], (captions ?? card.steps)?.[i], IS_MAC);
  const stopOn = (i: number) => {
    setStopped(i);
    setState((s) => settledState(s, script, i, zoom));
  };
  const replay = () => {
    setStopped(null);
    setState(openingState(script));
    setRound((r) => r + 1);
  };
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const shown = reduce ? { ...state, frame: last, under: last, view: { tx: 0, ty: 0, z: 1 }, pointerOn: false, chip: null } : state;
  const v = shown.view;
  return {
    picture: (
      <div className="deck-steps" aria-hidden>
        <div className="deck-zoom" style={{ transform: `translate(${v.tx}%, ${v.ty}%) scale(${v.z})`, transition: `transform ${shown.viewMs}ms ${GLIDE}` }}>
          <img src={urls[shown.under] ?? urls[0]} alt="" draggable={false} decoding="async" className="block w-full select-none" />
          {shown.fadeKey > 0 && shown.frame !== shown.under && (
            <img key={shown.fadeKey} src={urls[shown.frame]} alt="" draggable={false} decoding="async" className="deck-step-top" style={{ animationDuration: `${shown.fadeMs}ms` }} />
          )}
        </div>
        {shown.tap > 0 && <span key={shown.tap} className="deck-tap" style={{ left: `${shown.pointer.x}%`, top: `${shown.pointer.y}%` }} />}
        <span
          className={`deck-cursor ${shown.pointerOn ? 'is-on' : ''} ${shown.pressed ? 'is-pressed' : ''}`}
          style={{ left: `${shown.pointer.x}%`, top: `${shown.pointer.y}%`, transitionDuration: `${shown.pointerMs}ms, ${shown.pointerMs}ms, 240ms, 140ms` }}
        >
          <PointerGlyph />
        </span>
        {shown.chip !== null && (
          <kbd key={`${shown.step}-${shown.chip}`} className="deck-chip">
            {shown.chip}
          </kbd>
        )}
      </div>
    ),
    // A plain step list under the reduced-motion picture; otherwise the caption, dots and replay.
    steps: reduce ? (
      <ol className="deck-steplist">
        {script.map((s, i) => (
          <li key={i}>{caption(i)}</li>
        ))}
      </ol>
    ) : (
      <div className="deck-steprow">
        <p className="deck-stepcap">
          <span className="caps caps-sm text-gold">
            {n + 1} of {script.length}
          </span>{' '}
          · {caption(n)}
        </p>
        <span className="sr-only" aria-live="polite">
          {stopped !== null ? `Step ${n + 1} of ${script.length}: ${caption(n)}` : ''}
        </span>
        <div className="flex items-center gap-0.5" role="group" aria-label="Steps">
          {script.map((s, i) => (
            <button
              key={i}
              type="button"
              tabIndex={front ? 0 : -1}
              aria-label={`Step ${i + 1}: ${caption(i)}`}
              aria-current={i === n ? 'step' : undefined}
              onPointerDown={stop}
              onClick={(e) => {
                stop(e);
                stopOn(i);
              }}
              className="deck-stepdot"
            >
              <span className={i === n ? 'is-on' : ''} />
            </button>
          ))}
          <button
            type="button"
            tabIndex={front ? 0 : -1}
            aria-label="Play the steps again"
            onPointerDown={stop}
            onClick={(e) => {
              stop(e);
              replay();
            }}
            className="deck-replay"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  };
}

/** A card's title and caption, under its picture. */
const CardText: React.FC<{ card: Card; index: number }> = ({ card, index }) => (
  <div className="px-5 pt-4 pb-5">
    <p className="caps caps-sm text-gold">
      {card.group.title} <span className="text-muted">· {index + 1} of {COUNT}</span>
    </p>
    <h3 className="title-hand text-[26px] leading-tight text-stone-900 dark:text-paper mt-1">{card.title}</h3>
    <p className="text-[13px] leading-relaxed text-muted mt-1.5">{keyLabel(card.caption, IS_MAC)}</p>
  </div>
);

/** A card that plays its step script, with the step row between its picture and its text. */
const ScriptFace: React.FC<{ card: Card; index: number; script: GuideStep[]; playing: boolean; front: boolean }> = ({ card, index, script, playing, front }) => {
  const player = useStepPlayer(card, script, playing, front);
  return (
    <>
      <div className="deck-frame">{player.picture}</div>
      {player.steps}
      <CardText card={card} index={index} />
    </>
  );
};

/** How long a shortcut with no script of its own holds the card. */
const SHORTCUT_MS = 3800;

type Shortcut = NonNullable<GuideFeature['keys']>[number];

/** A shortcut with no captured script: just its keys, held for a moment. */
const KeysOnly: React.FC<{ k: Shortcut; playing: boolean; onPlayed: () => void }> = ({ k, playing, onPlayed }) => {
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(onPlayed, SHORTCUT_MS);
    return () => window.clearTimeout(t);
  }, [playing, onPlayed]);
  return (
    <div className="deck-keys">
      {keyLabel(k.keys, IS_MAC).split(' · ').map((c) => (
        <kbd key={c} className="deck-keycap">
          {c}
        </kbd>
      ))}
    </div>
  );
};

/** One shortcut row playing its script in the card's frame, with the step row under it. */
const KeyScript: React.FC<{ card: Card; script: GuideStep[]; captions?: string[]; playing: boolean; front: boolean; onPlayed: () => void }> = ({ card, script, captions, playing, front, onPlayed }) => {
  const player = useStepPlayer(card, script, playing, front, { captions, onPlayed });
  return (
    <>
      <div className="deck-frame">{player.picture}</div>
      {player.steps}
    </>
  );
};

/**
 * The keyboard shortcuts card: the frame plays the chosen key's script in the real app (keys show
 * on a keycap), and the keys stand in a row under it. While the card is at the front it goes
 * through the keys by itself; picking one (click, or ← → Home End in the row) keeps it there.
 */
const KeysFace: React.FC<{ card: Card; index: number; playing: boolean; playKey: number; front: boolean; guide: GuideData }> = ({ card, index, playing, playKey, front, guide }) => {
  const keys = card.keys ?? [];
  const [rows, dispatch] = useReducer((s: typeof KEY_ROWS_START, e: KeyRowEvent) => keyRows(s, e, keys.length), KEY_ROWS_START);
  const played = useCallback(() => dispatch({ type: 'played' }), []);
  const listRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Back at the front: it goes through the keys again from the one it shows.
  useEffect(() => {
    if (playKey > 0) dispatch({ type: 'resume' });
  }, [playKey]);

  // The row list scrolls itself, never the page, to keep the key shown in the middle.
  useEffect(() => {
    const list = listRef.current;
    const btn = list?.children[rows.row] as HTMLElement | undefined;
    if (!list || !btn) return;
    list.scrollTo({ left: btn.offsetLeft - (list.clientWidth - btn.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
  }, [rows.row, reduce]);

  // A sideways swipe over the key row scrolls the row, not the deck.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const keep = (e: Event) => e.stopPropagation();
    list.addEventListener('wheel', keep, { passive: true });
    return () => list.removeEventListener('wheel', keep);
  }, []);

  const k = keys[rows.row];
  if (!k) return null;
  const id = keyScriptId(k.demo);
  const script = guide.scripts[id];
  const move = (by: 'prev' | 'next' | 'first' | 'last') => {
    dispatch({ type: 'move', by });
    const n = keyRows(rows, { type: 'move', by }, keys.length).row;
    (listRef.current?.children[n] as HTMLElement | undefined)?.focus({ preventScroll: true });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const by = ({ ArrowLeft: 'prev', ArrowRight: 'next', Home: 'first', End: 'last' } as const)[e.key as 'ArrowLeft'];
    if (!by) return;
    e.preventDefault();
    e.stopPropagation();
    move(by);
  };
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <>
      {script && script.length > 0 ? (
        <KeyScript key={`${playKey}-${id}`} card={card} script={script} captions={guide.captions[id]} playing={playing} front={front} onPlayed={played} />
      ) : (
        <>
          <div className="deck-frame">
            <KeysOnly key={`${playKey}-${id}`} k={k} playing={playing} onPlayed={played} />
          </div>
          <div className="deck-steprow" aria-hidden>
            <p className="deck-stepcap" />
          </div>
        </>
      )}
      <CardText card={{ ...card, caption: k.does }} index={index} />
      <div
        ref={listRef}
        role="group"
        aria-label="Shortcuts: pick one to watch it"
        className="deck-keylist"
        onKeyDown={onKeyDown}
        onPointerDown={stop}
      >
        {keys.map((s, n) => (
          <button
            key={s.keys}
            type="button"
            tabIndex={front && n === rows.row ? 0 : -1}
            aria-pressed={n === rows.row}
            aria-label={`${keyLabel(s.keys, IS_MAC)}: ${keyLabel(s.does, IS_MAC)}`}
            onClick={(e) => {
              stop(e);
              dispatch({ type: 'pick', row: n });
            }}
            className="deck-keypick"
          >
            {keyLabel(s.keys, IS_MAC)}
          </button>
        ))}
      </div>
    </>
  );
};

/** The face of a card: its picture over its title and caption. */
const CardFace: React.FC<{ card: Card; index: number; playing: boolean; playKey: number; guide?: GuideData; front?: boolean }> = ({ card, index, playing, playKey, guide, front = false }) => {
  const script = guide?.scripts[card.id];
  if (card.keys && guide) return <KeysFace card={card} index={index} playing={playing} playKey={playKey} front={front} guide={guide} />;
  if (script && script.length > 0) return <ScriptFace key={playKey} card={card} index={index} script={script} playing={playing} front={front} />;
  return (
    <>
      <div className="deck-frame" />
      <CardText card={card} index={index} />
    </>
  );
};

const DeckCard: React.FC<{
  card: Card;
  index: number;
  pos: MotionValue<number>;
  front: boolean;
  playing: boolean;
  playKey: number;
  guide: GuideData;
  onPick: (index: number) => void;
}> = ({ card, index, pos, front, playing, playKey, guide, onPick }) => {
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
      <CardFace card={card} index={index} playing={playing} playKey={playKey} guide={guide} front={front} />
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
  // Starts at 1, so the first card remounts (picture back to its start) when it leaves the front, as every card does.
  const [playKey, setPlayKey] = useState(1);

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
        // Any new press ends the last drag's hold on clicks, even on a control that keeps its press from the deck.
        onPointerDownCapture={() => (justDragged.current = false)}
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
            guide={GUIDE}
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
