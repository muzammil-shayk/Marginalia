/**
 * Poetry-aware reading in the text reader: the settings pop-over, and the overlay that numbers
 * lines or couplets in the gutter and underlines the rhymes. The overlay never touches the
 * paragraphs' text: numbers are positioned spans beside each line, and the underlines are painted
 * with the CSS Custom Highlight API, so marks and selection offsets are unchanged.
 */

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Feather, Plus, X } from './icons';
import type { PoetryPrefs } from '../types';
import type { PoemAnalysis } from '../utils/poetry';
import { paintHighlight, rangeFor, readPieces } from './findHighlight';
import { useDialogFocus } from '../hooks/useDialogFocus';

export const DEFAULT_POETRY: PoetryPrefs = { on: false, numbering: 'couplets', prosody: true };

/** The themes "Add prosody themes" offers: metre and rhyme, each its own colour. */
export const PROSODY_THEMES = [
  { name: 'Metre', color: '#7c6aa6' },
  { name: 'Rhyme', color: '#5b8070' }
];

/**
 * Numbers and underlines for the poem. `textId(i)` is paragraph i's text element; numbers go in
 * its parent (the paragraph box, `position: relative`).
 */
export function usePoemOverlay(opts: {
  analysis: PoemAnalysis | null;
  prefs: PoetryPrefs;
  /** The column the paragraphs are in; observed for size changes. */
  flow: HTMLElement | null;
  textId: (i: number) => string;
  /** Bumps when the layout may have moved (font, size, spread page). */
  layoutKey: string;
}): void {
  const { analysis, prefs, flow, textId, layoutKey } = opts;
  useLayoutEffect(() => {
    const clear = () => {
      document.querySelectorAll('[data-poem-num]').forEach((n) => n.remove());
      paintHighlight('poem-rhyme', []);
    };
    clear();
    if (!analysis || !prefs.on || !flow) return clear;

    const draw = () => {
      document.querySelectorAll('[data-poem-num]').forEach((n) => n.remove());
      const pieces = new Map<number, ReturnType<typeof readPieces>>();
      const piecesOf = (i: number) => {
        if (!pieces.has(i)) {
          const el = document.getElementById(textId(i));
          pieces.set(i, el ? readPieces(el) : []);
        }
        return pieces.get(i)!;
      };
      for (const line of analysis.lines) {
        const show = prefs.numbering === 'lines' ? true : line.coupletLine === 0;
        if (!show) continue;
        const text = document.getElementById(textId(line.paragraphIndex));
        const box = text?.parentElement;
        const range = rangeFor(piecesOf(line.paragraphIndex), line.start, Math.min(line.end, line.start + 1));
        const rect = range?.getClientRects()[0];
        if (!box || !rect) continue;
        const top = rect.top - box.getBoundingClientRect().top;
        const n = document.createElement('span');
        n.dataset.poemNum = '';
        n.setAttribute('aria-hidden', 'true');
        n.className = 'poem-num';
        n.textContent = String(prefs.numbering === 'lines' ? line.lineNo : line.coupletNo);
        if (prefs.numbering === 'lines' && line.rhyme) n.title = `Rhyme ${line.rhyme}`;
        n.style.top = `${Math.round(top + rect.height / 2)}px`;
        box.appendChild(n);
      }
      const rhyme = prefs.prosody ? analysis.spans.map((s) => rangeFor(piecesOf(s.paragraphIndex), s.start, s.end)).filter((r): r is Range => Boolean(r)) : [];
      paintHighlight('poem-rhyme', rhyme);
    };
    draw();
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    });
    observer.observe(flow);
    // Webfonts change line heights when they arrive.
    void document.fonts?.ready.then(() => requestAnimationFrame(draw));
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      clear();
    };
  }, [analysis, prefs, flow, textId, layoutKey]);
}

/** The pop-over under the poetry button: on/off, numbering, rhyme, metre, prosody themes. */
export const PoetryPanel: React.FC<{
  open: boolean;
  prefs: PoetryPrefs;
  analysis: PoemAnalysis | null;
  isDark: boolean;
  onChange: (next: PoetryPrefs) => void;
  onClose: () => void;
  /** Adds Metre / Rhyme themes the reader does not have yet; absent when all exist. */
  onAddProsodyThemes?: () => void;
}> = ({ open, prefs, analysis, isDark, onChange, onClose, onAddProsodyThemes }) => {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, open, onClose);
  const [metre, setMetre] = React.useState(prefs.metre ?? '');
  useEffect(() => setMetre(prefs.metre ?? ''), [prefs.metre, open]);
  if (!open) return null;
  const seg = (on: boolean) =>
    `flex-1 px-3 py-1.5 rounded-full text-[12px] font-medium cursor-pointer transition-colors ${
      on ? 'bg-accent text-on-accent' : 'text-stone-700 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/10'
    }`;
  const lines = analysis?.lines.length ?? 0;
  const couplets = analysis?.lines.at(-1)?.coupletNo ?? 0;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="poetry-panel-title"
      className={`ink-card absolute right-3 sm:right-6 top-full mt-2 z-50 w-[min(21rem,calc(100vw-1.5rem))] rounded-2xl border p-4 space-y-3 shadow-2xl ${
        isDark ? 'bg-night-3 border-stone-700 text-paper' : 'bg-white border-stone-200 text-stone-900'
      }`}
    >
      <div className="flex items-center gap-2">
        <Feather className="w-4.5 h-4.5 text-gold" />
        <h2 id="poetry-panel-title" className="title-hand text-[23px] flex-1">Poetry view</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-muted hover:text-stone-900 dark:hover:text-paper cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <label className="flex items-center justify-between gap-3 text-[13px] cursor-pointer">
        <span>Read this as a poem</span>
        <input type="checkbox" checked={prefs.on} onChange={(e) => onChange({ ...prefs, on: e.target.checked })} className="w-4 h-4 accent-[var(--color-accent)]" />
      </label>
      <fieldset disabled={!prefs.on} className="space-y-3 disabled:opacity-50">
        <div>
          <legend className="caps caps-sm text-muted mb-1">Number</legend>
          <div role="radiogroup" aria-label="Number" className={`flex gap-1 p-1 rounded-full ${isDark ? 'bg-night-2' : 'bg-stone-100'}`}>
            <button type="button" role="radio" aria-checked={prefs.numbering === 'lines'} onClick={() => onChange({ ...prefs, numbering: 'lines' })} className={seg(prefs.numbering === 'lines')}>
              Lines
            </button>
            <button type="button" role="radio" aria-checked={prefs.numbering === 'couplets'} onClick={() => onChange({ ...prefs, numbering: 'couplets' })} className={seg(prefs.numbering === 'couplets')}>
              Couplets
            </button>
          </div>
          {analysis && (
            <p className="mt-1 text-[11.5px] text-muted">
              {lines} lines · {couplets} couplets
            </p>
          )}
        </div>
        <label className="flex items-start justify-between gap-3 text-[13px] cursor-pointer">
          <span>
            Underline rhymes
            <span className="block text-[11.5px] text-muted">
              <span className="poem-key-rhyme">solid green</span>: the sound each line ends on
            </span>
          </span>
          <input type="checkbox" checked={prefs.prosody} onChange={(e) => onChange({ ...prefs, prosody: e.target.checked })} className="w-4 h-4 mt-0.5 accent-[var(--color-accent)]" />
        </label>
        <label className="block text-[13px]">
          Metre
          <input
            type="text"
            value={metre}
            onChange={(e) => setMetre(e.target.value)}
            onBlur={() => metre.trim() !== (prefs.metre ?? '') && onChange({ ...prefs, metre: metre.trim() || undefined })}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            placeholder="e.g. iambic pentameter"
            className={`mt-1 w-full px-3 py-2 rounded-xl border text-[13px] focus:outline-none focus:ring-1 focus:ring-gold ${
              isDark ? 'bg-night-2 border-stone-700 placeholder:text-paper/50' : 'bg-white border-stone-300 placeholder:text-muted'
            }`}
          />
        </label>
        {onAddProsodyThemes && (
          <button type="button" onClick={onAddProsodyThemes} className="w-full flex items-center justify-center gap-1.5 rounded-full caps text-[12px] px-4 py-2 border border-stone-300 dark:border-stone-600 hover:border-gold hover:bg-gold/10 cursor-pointer">
            <Plus className="w-3.5 h-3.5 text-gold" /> Add Metre and Rhyme themes
          </button>
        )}
        <p className="text-[11.5px] text-muted leading-snug">
          Mark scansion or rhymes yourself with those themes; they export with your other marks.
        </p>
      </fieldset>
    </div>
  );
};
