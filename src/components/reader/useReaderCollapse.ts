/**
 * Collapse to marks in the text reader (see `utils/collapse.ts`): the document folded shut around
 * the paragraphs that hold marks, with a little context either side, so a whole reading can be
 * gone over at once. What counts is chosen in the collapse bar: every mark, one theme,
 * terminology, notes, or the current Find hits. Each fold opens on its own; C or the toolbar
 * button opens and shuts the whole thing.
 *
 * Two parts, because the layout (which turns the two-page spread off while collapsed) is worked
 * out before Find exists: `useCollapseState` holds the choices, `useReaderCollapse` works out the
 * folds and keeps the reader's place across the change.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { collapseSegments, foldKey, markMatches, shownCount, type CollapseFilter, type CollapseSegment } from '../../utils/collapse';
import { isTypingTarget } from '../pdf/workspaceKeys';
import type { TextMark } from '../../utils/textMarks';

export const COLLAPSE_HOTKEY = 'C';

/** What the document collapses to: a mark filter, or what Find has found. */
export type ReaderCollapseFilter = CollapseFilter | { type: 'find' };
const ALL_MARKS: ReaderCollapseFilter = { type: 'all' };

export function useCollapseState() {
  const [on, setOn] = useState(false);
  const [filter, setFilterState] = useState<ReaderCollapseFilter>({ type: 'all' });
  const [context, setContextState] = useState(0);
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  // Opened folds belong to one way of collapsing; a new filter or context starts them shut.
  const setFilter = useCallback((f: ReaderCollapseFilter) => {
    setFilterState(f);
    setOpened(new Set());
  }, []);
  const setContext = useCallback((n: number) => {
    setContextState(n);
    setOpened(new Set());
  }, []);
  const openFold = useCallback((s: Pick<CollapseSegment, 'from' | 'to'>) => setOpened((prev) => new Set(prev).add(foldKey(s))), []);
  return { on, setOn, filter, setFilter, context, setContext, opened, setOpened, openFold };
}

export type CollapseState = ReturnType<typeof useCollapseState>;

/** The reader's first paragraph still on screen below the bars: where the reader is. */
function paragraphInView(topInset: number): { idx: number; top: number } | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[id^="reader-para-"]:not([id^="reader-para-text-"])'));
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.bottom > topInset + 8) return { idx: Number(el.id.slice('reader-para-'.length)), top: r.top };
  }
  return null;
}

export function useReaderCollapse(deps: {
  state: CollapseState;
  paragraphCount: number;
  marks: TextMark[];
  findHits: { paragraphIndex: number }[];
  /** The bottom of the sticky bars, so "in view" means below them. */
  topInset: () => number;
}) {
  const { state, paragraphCount, marks, findHits, topInset } = deps;
  const { on, setOn, context, opened, setOpened } = state;
  // Collapsed to Find hits, then Find closed (or nothing found): every mark again, not a blank page.
  const filter: ReaderCollapseFilter = state.filter.type === 'find' && !findHits.length ? ALL_MARKS : state.filter;

  /** Which paragraphs each filter would keep, so the bar can show counts. */
  const keepFor = useCallback(
    (f: ReaderCollapseFilter): Set<number> => {
      if (f.type === 'find') return new Set(findHits.map((h) => h.paragraphIndex));
      const out = new Set<number>();
      for (const m of marks) if (markMatches(m, f)) out.add(m.anchor.paragraphIndex);
      return out;
    },
    [marks, findHits]
  );
  const keep = useMemo(() => keepFor(filter), [keepFor, filter]);
  const segments = useMemo(
    () => (on ? collapseSegments(paragraphCount, keep, context, opened) : null),
    [on, paragraphCount, keep, context, opened]
  );
  const shown = segments ? shownCount(segments) : paragraphCount;

  // Keeping the reader's place: the paragraph at the top before the change stays where it was
  // after it, or, when it folded away, the next one shown takes its place.
  const anchor = useRef<{ idx: number; top: number } | null>(null);
  const remember = () => {
    const at = paragraphInView(topInset());
    // At the very start of the document there is no place to keep: it stays at the top, where
    // the collapse bar is in sight.
    anchor.current = at && at.idx > 0 ? at : null;
  };
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    anchor.current = null;
    let el: HTMLElement | null = null;
    for (let i = a.idx; i < paragraphCount && !el; i++) el = document.getElementById(`reader-para-${i}`);
    for (let i = a.idx - 1; i >= 0 && !el; i--) el = document.getElementById(`reader-para-${i}`);
    if (!el) return;
    window.scrollBy({ top: el.getBoundingClientRect().top - a.top });
  }, [segments, paragraphCount]);

  const toggle = useCallback(() => {
    remember();
    setOn((v) => !v);
    setOpened(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setOn, setOpened]);
  const openFold = (s: Pick<CollapseSegment, 'from' | 'to'>) => state.openFold(s);
  /** Shows the whole document again at a paragraph (a fold's "read from here"). */
  const expandAt = (idx: number) => {
    anchor.current = { idx, top: topInset() + 16 };
    setOn(false);
  };

  // C opens and shuts it; never while typing, in a dialog, or with a modifier.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.repeat) return;
      if (isTypingTarget(e.target) || document.querySelector('[aria-modal="true"]')) return;
      if (e.key.toLowerCase() !== COLLAPSE_HOTKEY.toLowerCase()) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return { ...state, filter, toggle, openFold, expandAt, keepFor, segments, shown, total: paragraphCount, remember };
}

export type ReaderCollapse = ReturnType<typeof useReaderCollapse>;
