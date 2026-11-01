/**
 * The first-run picture tour on the home page: five illustrated steps, drawn in the shelf's own
 * language (inked outlines, cloth spines, a gold pen stroke). Skippable at any step; Settings →
 * "Show tutorial" opens it again. Whether it was seen is the caller's to keep.
 */

import React, { useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, X } from './icons';
import { CLOTHS } from './Bookshelf';
import { useDialogFocus } from '../hooks/useDialogFocus';

export interface TutorialStep {
  title: string;
  body: string;
  art: React.FC;
}

/** Moves within the tour: a step outside it means the tour is finished (-1 back, length forward). */
export function stepAfter(index: number, delta: 1 | -1, count: number): number | 'done' {
  const next = index + delta;
  if (next >= count) return 'done';
  return Math.max(0, next);
}

const INK = 'var(--tut-ink)';
const PAPER = 'var(--tut-paper)';
const GOLD = 'var(--tut-gold)';
const stroke = { stroke: INK, strokeWidth: 1.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** A few lines of "text" on a page. */
const Lines: React.FC<{ x: number; y: number; w: number; n: number; gap?: number; short?: number[] }> = ({ x, y, w, n, gap = 12, short = [] }) => (
  <>
    {Array.from({ length: n }, (_, i) => (
      <line key={i} x1={x} y1={y + i * gap} x2={x + (short.includes(i) ? w * 0.6 : w)} y2={y + i * gap} stroke={INK} strokeOpacity={0.45} strokeWidth={3} strokeLinecap="round" />
    ))}
  </>
);

const ShelfArt: React.FC = () => {
  const spines = [
    [62, 38, 112],
    [102, 30, 100],
    [134, 44, 118],
    [180, 32, 96],
    [214, 40, 108],
    [256, 28, 104]
  ];
  return (
    <svg viewBox="0 0 360 200" aria-hidden>
      {spines.map(([x, w, h], i) => {
        const c = CLOTHS[i % CLOTHS.length];
        const lift = i === 2 ? -14 : 0;
        return (
          <g key={x} transform={`translate(0 ${lift})`}>
            <rect x={x} y={160 - h} width={w} height={h} rx={3} fill={c.base} {...stroke} />
            <rect x={x} y={160 - h + 16} width={w} height={8} fill={c.band} />
            <line x1={x + w / 2} y1={160 - h + 36} x2={x + w / 2} y2={160 - h + 36 + h * 0.4} stroke="#2a2621" strokeOpacity={0.5} strokeWidth={2} strokeLinecap="round" />
          </g>
        );
      })}
      <rect x={40} y={160} width={280} height={9} rx={2} fill={PAPER} {...stroke} />
      <path d="M150 28 c 6 -10 18 -10 22 0" fill="none" stroke={GOLD} strokeWidth={2} strokeLinecap="round" />
      <text x={180} y={190} textAnchor="middle" className="tut-hand" fill={INK}>
        My Readings
      </text>
    </svg>
  );
};

const AddArt: React.FC = () => (
  <svg viewBox="0 0 360 200" aria-hidden>
    {/* A file being dropped in */}
    <g transform="rotate(-6 110 100)">
      <path d="M70 40 h60 l20 20 v96 h-80 z" fill={PAPER} {...stroke} />
      <path d="M130 40 v20 h20" fill="none" {...stroke} />
      <Lines x={82} y={78} w={52} n={6} short={[5]} />
      <rect x={82} y={140} width={30} height={12} rx={6} fill={CLOTHS[0].base} {...stroke} />
    </g>
    {/* The paste: a clipboard with a gold-marked passage */}
    <rect x={200} y={46} width={96} height={118} rx={8} fill={PAPER} {...stroke} />
    <rect x={226} y={38} width={44} height={16} rx={5} fill={CLOTHS[5].base} {...stroke} />
    <Lines x={214} y={78} w={68} n={6} short={[2, 5]} />
    <path d="M212 102 h72" stroke={GOLD} strokeOpacity={0.45} strokeWidth={10} strokeLinecap="round" />
    <circle cx={180} cy={100} r={13} fill={GOLD} />
    <path d="M180 93 v14 M173 100 h14" stroke="#2a2621" strokeWidth={2} strokeLinecap="round" />
  </svg>
);

const MarkArt: React.FC = () => (
  <svg viewBox="0 0 360 200" aria-hidden>
    <rect x={40} y={22} width={190} height={160} rx={4} fill={PAPER} {...stroke} />
    <Lines x={58} y={48} w={154} n={10} gap={13} short={[3, 9]} />
    {/* The highlighted line and its note */}
    <rect x={54} y={85} width={130} height={14} rx={3} fill={CLOTHS[0].band} fillOpacity={0.85} />
    <line x1={58} y1={92} x2={180} y2={92} stroke={INK} strokeOpacity={0.6} strokeWidth={3} strokeLinecap="round" />
    <path d="M188 92 C 214 92, 226 76, 250 72" fill="none" stroke={INK} strokeOpacity={0.55} strokeDasharray="2 4" {...{ strokeWidth: 1.5 }} />
    <rect x={250} y={50} width={84} height={64} rx={6} fill={CLOTHS[5].base} {...stroke} />
    <text x={262} y={74} className="tut-hand" fill="#2a2621">
      a click
    </text>
    <text x={262} y={94} className="tut-hand" fill="#2a2621">
      of fitting!
    </text>
    {/* Pen */}
    <g transform="rotate(38 300 150)">
      <rect x={270} y={144} width={56} height={10} rx={3} fill={GOLD} {...stroke} />
      <path d="M326 144 l12 5 l-12 5 z" fill={PAPER} {...stroke} />
    </g>
  </svg>
);

const TrackerArt: React.FC = () => {
  const rows = [
    ['Key Concepts', 128, CLOTHS[0].base],
    ['Questions', 88, CLOTHS[4].base],
    ['Metaphors', 60, CLOTHS[3].base],
    ['Terminology', 104, CLOTHS[6].base]
  ] as const;
  return (
    <svg viewBox="0 0 360 200" aria-hidden>
      <rect x={52} y={24} width={256} height={152} rx={10} fill={PAPER} {...stroke} />
      <text x={72} y={52} className="tut-hand tut-hand-lg" fill={INK}>
        My Margins
      </text>
      <path d="M72 58 q 40 6 92 0" fill="none" stroke={GOLD} strokeWidth={2} strokeLinecap="round" />
      {rows.map(([label, w, fill], i) => (
        <g key={label} transform={`translate(0 ${78 + i * 22})`}>
          <circle cx={78} cy={0} r={5} fill={fill} {...stroke} />
          <text x={90} y={4} className="tut-small" fill={INK}>
            {label}
          </text>
          <rect x={170} y={-6} width={w} height={12} rx={6} fill={fill} {...stroke} />
        </g>
      ))}
    </svg>
  );
};

const ExportArt: React.FC = () => (
  <svg viewBox="0 0 360 200" aria-hidden>
    <rect x={44} y={34} width={104} height={136} rx={4} fill={PAPER} {...stroke} />
    <Lines x={58} y={58} w={76} n={8} short={[2, 7]} />
    <rect x={54} y={70} width={60} height={10} rx={3} fill={CLOTHS[0].band} fillOpacity={0.85} />
    <path d="M166 102 h40 m-10 -10 l10 10 l-10 10" fill="none" {...stroke} />
    {(['PDF', 'MD', 'TXT'] as const).map((label, i) => (
      <g key={label} transform={`translate(${222 + i * 34} ${62 + i * 12})`}>
        <path d="M0 0 h34 l12 12 v56 h-46 z" fill={[CLOTHS[2].base, CLOTHS[4].base, CLOTHS[5].base][i]} {...stroke} />
        <text x={23} y={50} textAnchor="middle" className="tut-small tut-bold" fill="#2a2621">
          {label}
        </text>
      </g>
    ))}
  </svg>
);

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Your reading shelf',
    body: 'Everything you add stands on My Readings. Click a spine to take the book down to the desk, then press Read.',
    art: ShelfArt
  },
  {
    title: 'Add a document or an excerpt',
    body: 'Bring in a PDF, EPUB, DOCX or TXT from Add Document, or paste a passage you want to keep.',
    art: AddArt
  },
  {
    title: 'Highlight, then write in the margin',
    body: 'Select words to highlight, underline or tag them. A note sits in the margin, level with its line.',
    art: MarkArt
  },
  {
    title: 'Watch your themes gather',
    body: 'My Margins Tracker collects key concepts, terminology and themes from every book in one place.',
    art: TrackerArt
  },
  {
    title: 'Take your notes with you',
    body: 'Export a book’s marks and notes as PDF, Markdown or plain text whenever you need them.',
    art: ExportArt
  }
];

export const Tutorial: React.FC<{ open: boolean; onClose: () => void; isDark: boolean }> = ({ open, onClose, isDark }) => {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useDialogFocus(ref, open, onClose);
  // Starts at the beginning each time it is opened.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setIndex(0);
  }
  if (!open) return null;

  const step = TUTORIAL_STEPS[index];
  const Art = step.art;
  const last = index === TUTORIAL_STEPS.length - 1;
  const go = (delta: 1 | -1) => {
    const next = stepAfter(index, delta, TUTORIAL_STEPS.length);
    if (next === 'done') return onClose();
    setDir(delta);
    setIndex(next);
  };
  const slide = reduce ? 0 : 18;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center px-4 bg-black/45 backdrop-blur-xs"
      // The backdrop keeps focus inside the dialog; leaving is Skip, Escape or the last step.
      onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        aria-describedby="tutorial-body"
        data-theme={isDark ? 'dark' : 'light'}
        className="tutorial ink-card w-full max-w-[520px] rounded-3xl shadow-2xl border overflow-hidden bg-white border-stone-200 text-stone-900 dark:bg-night-3 dark:border-stone-700 dark:text-paper motion-safe:animate-[panel-in_220ms_var(--ease-out)]"
      >
        <div className="relative tutorial-stage">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={index}
              initial={{ opacity: 0, x: dir * slide }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -dir * slide }}
              transition={{ duration: reduce ? 0.12 : 0.24, ease: [0.23, 1, 0.32, 1] }}
              className="tutorial-art"
            >
              <Art />
            </motion.div>
          </AnimatePresence>
          <button
            type="button"
            onClick={onClose}
            aria-label="Skip the tour"
            className="absolute top-3 right-3 flex items-center gap-1 rounded-full caps caps-sm px-3 py-1.5 text-muted hover:text-ink dark:hover:text-paper hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
          >
            Skip
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-6 pt-5 pb-6 space-y-2">
          <p className="caps caps-sm text-gold" aria-live="polite">
            Step {index + 1} of {TUTORIAL_STEPS.length}
          </p>
          <h2 id="tutorial-title" className="title-hand text-[30px] leading-tight">
            {step.title}
          </h2>
          <p id="tutorial-body" className="text-[14px] leading-relaxed text-muted min-h-[3em]">
            {step.body}
          </p>
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-1.5" aria-hidden>
              {TUTORIAL_STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ease-out ${
                    i === index ? 'w-5 bg-gold' : 'w-1.5 bg-stone-300 dark:bg-stone-600'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="flex items-center gap-1.5 rounded-full caps px-4 py-2.5 text-[12px] text-muted hover:text-ink dark:hover:text-paper hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={() => go(1)}
                className="flex items-center gap-1.5 rounded-full caps px-5 py-2.5 text-[12px] bg-accent hover:bg-accent-hover text-on-accent cursor-pointer transition-colors"
              >
                {last ? 'Start reading' : 'Next'}
                {!last && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
