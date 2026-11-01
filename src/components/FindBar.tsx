/**
 * Find in document (Cmd+F / Ctrl+F) for the reader (paragraphs, single or spread view) and the PDF
 * workspace (pages). `useDocumentFind` owns the query, the options and the current hit; it paints
 * the hits with the CSS Custom Highlight API (`findHighlight.ts`) and asks the surface to bring the
 * current one into view. `FindBar` is the strip: a row docked under the surface's toolbar, so it
 * pushes the page down instead of covering any text.
 *
 * Keys: Cmd/Ctrl+F opens (or reselects), Enter / Cmd+G next, Shift+Enter / Shift+Cmd+G previous,
 * Escape closes and gives focus back.
 */

import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Search, X } from './icons';
import { findInParagraphs, type FindOptions, type ParagraphHit } from '../utils/findInDocument';
import { paintFindHits, piecesText, rangeFor, readPieces } from './findHighlight';
import { HoverTooltip } from './HoverTooltip';

const IS_APPLE = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
const MOD = IS_APPLE ? '⌘' : 'Ctrl+';

export interface DocumentFindConfig {
  /** False while the surface cannot be searched (another tab, a dialog): Cmd+F is left alone. */
  enabled: boolean;
  /** The text of each unit (paragraph or page), in order; null while it is being read. */
  units: string[] | null;
  /** The unit's element on the page (a paragraph, a page's text layer), or null when not drawn. */
  unitElement: (index: number) => Element | null;
  /** Brings unit `index` into view; `range` is the current hit when the unit is drawn. */
  reveal: (index: number, range: Range | null) => void;
  /** Where units are drawn, watched so newly drawn pages are painted too. */
  root: () => Element | null;
  /** The first unit in view, so a new search starts where the reader is. */
  startUnit?: () => number;
}

export interface DocumentFind {
  open: boolean;
  openFind: () => void;
  close: () => void;
  query: string;
  setQuery: (q: string) => void;
  options: FindOptions;
  setOptions: (o: FindOptions) => void;
  hits: ParagraphHit[];
  /** Index into `hits`, -1 with none. */
  current: number;
  next: () => void;
  prev: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  loading: boolean;
}

/** The hit the search starts on: the first in or after `unit`, else the first. Pure. */
export function startHit(hits: { paragraphIndex: number }[], unit: number): number {
  if (!hits.length) return -1;
  const i = hits.findIndex((h) => h.paragraphIndex >= unit);
  return i === -1 ? 0 : i;
}

/** "3 of 12", "No results", or '' for an empty query. Pure. */
export function findCountLabel(query: string, count: number, current: number, loading: boolean): string {
  if (!query.trim()) return '';
  if (loading) return 'Searching…';
  if (!count) return 'No results';
  return `${(current + 1).toLocaleString()} of ${count.toLocaleString()}`;
}

export function useDocumentFind(cfg: DocumentFindConfig): DocumentFind {
  const c = useRef(cfg);
  c.current = cfg;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<FindOptions>({});
  const [current, setCurrent] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const deferred = useDeferredValue(query);

  const hits = useMemo(
    () => (open && cfg.units ? findInParagraphs(cfg.units, deferred, options) : []),
    [open, cfg.units, deferred, options]
  );
  // A new search starts at the first hit from where the reader is.
  useEffect(() => {
    setCurrent(startHit(hits, c.current.startUnit?.() ?? 0));
  }, [hits]);

  const openFind = useCallback(() => {
    if (!open) opener.current = document.activeElement as HTMLElement | null;
    setOpen(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [open]);
  const close = useCallback(() => {
    setOpen(false);
    paintFindHits([], null);
    const back = opener.current;
    opener.current = null;
    // Back to the control that opened it; a page or text area that merely had focus is not
    // refocused (it would light up a focus ring around the whole page).
    const control = back?.isConnected && back.matches('button, input, textarea, select, a[href], [role=button]');
    requestAnimationFrame(() => (control ? back!.focus({ preventScroll: true }) : (document.activeElement as HTMLElement | null)?.blur()));
  }, []);
  const step = useCallback((d: 1 | -1) => setCurrent((i) => (hits.length ? (i + d + hits.length) % hits.length : -1)), [hits.length]);

  // Cmd/Ctrl+F anywhere on the surface; Cmd+G steps while the bar is open.
  useEffect(() => {
    if (!cfg.enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'f' && !e.shiftKey) {
        if (document.querySelector('[aria-modal="true"]')) return;
        e.preventDefault();
        openFind();
      } else if (k === 'g' && open) {
        e.preventDefault();
        step(e.shiftKey ? -1 : 1);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cfg.enabled, open, openFind, step]);
  // Leaving the surface (another tab, the document closing) takes the paint with it.
  useEffect(() => {
    if (!cfg.enabled && open) close();
  }, [cfg.enabled, open, close]);
  useEffect(() => () => paintFindHits([], null), []);

  // Paint: every hit on a drawn unit, matched by its ordinal inside that unit.
  const pendingReveal = useRef(false);
  const paint = useCallback(() => {
    if (!open || !hits.length) {
      paintFindHits([], null);
      return null;
    }
    const ordinals: number[] = [];
    const byUnit = new Map<number, number[]>();
    hits.forEach((h, i) => {
      const list = byUnit.get(h.paragraphIndex) ?? [];
      ordinals[i] = list.length;
      list.push(i);
      byUnit.set(h.paragraphIndex, list);
    });
    const all: Range[] = [];
    let currentRange: Range | null = null;
    for (const [unit, members] of byUnit) {
      const el = c.current.unitElement(unit);
      if (!el) continue;
      const pieces = readPieces(el);
      const dom = findInParagraphs([piecesText(pieces)], deferred, options);
      for (const i of members) {
        const h = dom[ordinals[i]];
        const r = h && rangeFor(pieces, h.start, h.end);
        if (!r) continue;
        all.push(r);
        if (i === current) currentRange = r;
      }
    }
    paintFindHits(all, currentRange);
    if (pendingReveal.current && currentRange) {
      pendingReveal.current = false;
      c.current.reveal(hits[current].paragraphIndex, currentRange);
    }
    return currentRange;
  }, [open, hits, current, deferred, options]);

  // The current hit changed: paint, then bring it into view (once more after its page draws).
  useEffect(() => {
    const range = paint();
    if (!open || current < 0 || !hits[current]) return;
    pendingReveal.current = !range;
    c.current.reveal(hits[current].paragraphIndex, range ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, hits, open]);

  // Repaint when the surface redraws (a page renders, a paragraph re-renders, the spread turns).
  useEffect(() => {
    if (!open) return;
    const root = c.current.root();
    if (!root) return;
    let frame = 0;
    const obs = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => void paint());
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true });
    paint();
    return () => {
      obs.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [open, paint]);

  return {
    open,
    openFind,
    close,
    query,
    setQuery,
    options,
    setOptions,
    hits,
    current,
    next: () => step(1),
    prev: () => step(-1),
    inputRef,
    loading: open && cfg.units === null
  };
}

const OPTION_LIST: { key: keyof FindOptions; glyph: string; label: string }[] = [
  { key: 'matchCase', glyph: 'Aa', label: 'Match case' },
  { key: 'matchDiacritics', glyph: 'é', label: 'Match accents (é is not e)' },
  { key: 'wholeWord', glyph: 'W', label: 'Whole words only' }
];

/** The find strip. Render it inside the surface's sticky toolbar block so it never covers text. */
export const FindBar: React.FC<{ find: DocumentFind; isDark: boolean; className?: string }> = ({ find, isDark, className = '' }) => {
  if (!find.open) return null;
  const label = findCountLabel(find.query, find.hits.length, find.current, find.loading);
  const none = !find.loading && !!find.query.trim() && find.hits.length === 0;
  const btn = `w-8 h-8 shrink-0 flex items-center justify-center rounded-lg cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-default ${
    isDark ? 'text-paper/80 hover:bg-nav-hover hover:text-paper' : 'text-stone-600 hover:bg-stone-200/70 hover:text-ink'
  }`;
  return (
    <div
      role="search"
      aria-label="Find in document"
      className={`find-bar flex flex-wrap items-center gap-x-1 gap-y-1.5 ${className}`}
    >
      <label
        className={`flex items-center gap-2 flex-1 min-w-0 sm:max-w-sm h-9 pl-3 pr-2 rounded-full border transition-colors focus-within:border-gold ${
          isDark ? 'bg-night-1 border-stone-700' : 'bg-white border-stone-300'
        } ${none ? 'border-red-400/70 dark:border-red-300/60' : ''}`}
      >
        <Search className="w-3.5 h-3.5 shrink-0 text-muted" />
        <input
          ref={find.inputRef}
          type="text"
          value={find.query}
          onChange={(e) => find.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (e.shiftKey) find.prev();
              else find.next();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              find.close();
            }
          }}
          placeholder="Find in document"
          aria-label="Find in document"
          aria-describedby="find-count"
          spellCheck={false}
          className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-stone-900 dark:text-paper placeholder:text-muted"
        />
        <span id="find-count" aria-live="polite" className={`shrink-0 text-[11.5px] tabular-nums ${none ? 'text-red-700 dark:text-red-300' : 'text-muted'}`}>
          {label}
        </span>
      </label>

      <div className="flex items-center gap-0.5 max-sm:order-last max-sm:basis-full max-sm:pl-1">
        {OPTION_LIST.map((o) => {
          const on = !!find.options[o.key];
          return (
            <HoverTooltip key={o.key} label={o.label}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={o.label}
                onClick={() => find.setOptions({ ...find.options, [o.key]: !on })}
                className={`${btn} text-[12.5px] font-semibold ${o.key === 'wholeWord' ? 'underline decoration-1 underline-offset-2' : ''} ${
                  on ? (isDark ? 'bg-nav-active text-nav-active-fg' : 'bg-nav-active text-nav-active-fg') : ''
                }`}
              >
                {o.glyph}
              </button>
            </HoverTooltip>
          );
        })}
      </div>

      <div className="flex items-center gap-0.5">
        <HoverTooltip label={`Previous (⇧Enter, ⇧${MOD}G)`}>
          <button type="button" onClick={find.prev} disabled={!find.hits.length} aria-label="Previous match" className={btn}>
            <ChevronUp className="w-4 h-4" />
          </button>
        </HoverTooltip>
        <HoverTooltip label={`Next (Enter, ${MOD}G)`}>
          <button type="button" onClick={find.next} disabled={!find.hits.length} aria-label="Next match" className={btn}>
            <ChevronDown className="w-4 h-4" />
          </button>
        </HoverTooltip>
        <HoverTooltip label="Close (Esc)">
          <button type="button" onClick={find.close} aria-label="Close find" className={btn}>
            <X className="w-3.5 h-3.5" />
          </button>
        </HoverTooltip>
      </div>
    </div>
  );
};

export const FIND_SHORTCUT = `${MOD}F`;
