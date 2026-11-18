/**
 * Collapse to marks, on the page (text reader: useReaderCollapse.ts; PDF: PdfCollapsed.tsx): the
 * bar that says what the document is collapsed to and lets the reader change it, and the fold
 * that stands in for each hidden run.
 */

import React from 'react';
import { ChevronDown, ChevronUp, CollapseIcon } from '../icons';
import type { UserSettings } from '../../types';
import { plural } from '../../utils/plural';
import type { ReaderCollapseFilter } from './useReaderCollapse';
import { COLLAPSE_HOTKEY } from './useReaderCollapse';

const sameFilter = (a: ReaderCollapseFilter, b: ReaderCollapseFilter) =>
  a.type === b.type && (a.type !== 'theme' || (b.type === 'theme' && a.id === b.id));

const CONTEXTS = [0, 1, 2, 3];

export const CollapseBar: React.FC<{
  filter: ReaderCollapseFilter;
  context: number;
  /** "Showing 5 of 30 paragraphs", "8 of 240 pages". */
  summary: string;
  /** How many units (paragraphs, pages) a filter would keep, for its chip. */
  countFor: (f: ReaderCollapseFilter) => number;
  /** What the context buttons mean at `n`: "and 1 paragraph either side". */
  contextText: (n: number) => string;
  onFilter: (f: ReaderCollapseFilter) => void;
  onContext: (n: number) => void;
  onExit: () => void;
  themes: UserSettings['activeThemes'];
  terminologyColor: string;
  /** What Find is looking for, when it is open with hits (text reader only). */
  findQuery?: string | null;
}> = ({ filter, context, summary, countFor, contextText, onFilter, onContext, onExit, themes, terminologyColor, findQuery }) => {
  const chip = (f: ReaderCollapseFilter, label: React.ReactNode, dot?: string) => {
    const n = countFor(f);
    const on = sameFilter(filter, f);
    return (
      <button type="button" onClick={() => onFilter(f)} aria-pressed={on} disabled={n === 0 && !on} className={`collapse-chip ${on ? 'is-on' : ''}`}>
        {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />}
        <span className="truncate max-w-[14ch]">{label}</span>
        <span className="opacity-60 tabular-nums">{n}</span>
      </button>
    );
  };
  return (
    <section aria-label="Collapsed to marks" className="collapse-bar">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <CollapseIcon className="w-4 h-4 text-gold" aria-hidden />
        <h2 className="caps caps-sm text-stone-800 dark:text-paper">Collapsed to marks</h2>
        <span className="text-[12px] text-muted" aria-live="polite">
          {summary}
        </span>
        <button type="button" onClick={onExit} className="ml-auto rounded-full caps caps-sm px-3 py-1.5 border border-stone-300 dark:border-stone-600 hover:border-gold cursor-pointer transition-colors">
          Show everything ({COLLAPSE_HOTKEY})
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5" role="group" aria-label="Collapse to">
        {chip({ type: 'all' }, 'All marks')}
        {themes.map((t) => (
          <React.Fragment key={t.id}>{chip({ type: 'theme', id: t.id }, t.name, t.color)}</React.Fragment>
        ))}
        {chip({ type: 'terminology' }, 'Terminology', terminologyColor)}
        {chip({ type: 'notes' }, 'Notes')}
        {findQuery && chip({ type: 'find' }, <>Find “{findQuery}”</>, '#eab308')}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[12px] text-muted">
        <span id="collapse-context-label">Context</span>
        <div role="radiogroup" aria-labelledby="collapse-context-label" className="flex items-center rounded-full p-0.5 bg-stone-100 dark:bg-night-2">
          {CONTEXTS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={context === n}
              onClick={() => onContext(n)}
              className={`min-w-7 h-6 px-2 rounded-full text-[11.5px] cursor-pointer transition-colors ${
                context === n ? 'bg-accent text-on-accent' : 'hover:text-ink dark:hover:text-paper'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <span>{contextText(context)}</span>
      </div>
    </section>
  );
};

/** One run of hidden units: open it in place, or read on from it with everything shown. */
export const CollapseFold: React.FC<{
  from: number;
  to: number;
  total: number;
  /** "paragraph" or "page". */
  unit?: string;
  onOpen: () => void;
  onReadFrom: () => void;
}> = ({ from, to, total, unit = 'paragraph', onOpen, onReadFrom }) => {
  const n = to - from + 1;
  const whole = n === total;
  return (
    <div className="collapse-fold" role="group" aria-label={`${plural(n, unit)} hidden`}>
      <span className="collapse-fold-rule" aria-hidden />
      <button type="button" onClick={onOpen} className="collapse-fold-btn">
        <ChevronDown className="w-3.5 h-3.5" aria-hidden />
        {whole ? `Nothing marked here: all ${plural(n, unit)} hidden` : `${plural(n, unit)} hidden`}
      </button>
      {!whole && (
        <button type="button" onClick={onReadFrom} className="collapse-fold-read" title="Show everything, at this place">
          <ChevronUp className="w-3 h-3" aria-hidden />
          Read from here
        </button>
      )}
      <span className="collapse-fold-rule" aria-hidden />
    </div>
  );
};
