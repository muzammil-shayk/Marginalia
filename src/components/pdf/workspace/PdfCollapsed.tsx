/**
 * Collapse to marks in the PDF workspace (see utils/collapse.ts): the document folded shut around
 * what the reader marked. Each marked page shows only strips of itself, a band around each mark
 * with a little context above and below, still the real page (its marks can be clicked, changed
 * and added to); pages with nothing marked fold into one "N pages hidden" row per run.
 *
 * C or the toolbar button opens and shuts it. "Open page" and "Read from here" show the whole
 * document again at that page.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { UserSettings } from '../../../types';
import type { Annotation } from '../annotationModel';
import { PDF_CONTEXT, collapseSegments, markExtent, markMatches, pageBands, readPageSizes, shownCount, type Band, type CollapseSegment } from '../../../utils/collapse';
import { themeIdsOf } from '../../../utils/markThemes';
import { plural } from '../../../utils/plural';
import { isTypingTarget } from '../workspaceKeys';
import { COLLAPSE_HOTKEY, useCollapseState, type ReaderCollapseFilter } from '../../reader/useReaderCollapse';
import { CollapseBar, CollapseFold } from '../../reader/CollapseParts';

export function usePdfCollapse(deps: {
  annotations: Annotation[];
  pageCount: number;
  currentPage: number;
  goToPage: (page: number, animate?: boolean) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { annotations, pageCount, currentPage, goToPage, scrollRef } = deps;
  const state = useCollapseState();
  const { on, setOn, filter, context, opened, setOpened } = state;

  const matching = useCallback(
    (f: ReaderCollapseFilter) =>
      annotations.filter((a) => f.type !== 'find' && markMatches({ kind: a.kind, themeIds: themeIdsOf(a), isTerminology: a.isTerminology, blackout: a.blackout }, f)),
    [annotations]
  );
  /** Pages (1-based) holding marks under a filter. */
  const pagesFor = useCallback((f: ReaderCollapseFilter) => new Set(matching(f).map((a) => a.page)), [matching]);

  const plan = useMemo(() => {
    if (!on) return null;
    const marks = matching(filter);
    const keep = new Set(marks.map((a) => a.page - 1));
    const segments = collapseSegments(pageCount, keep, 0, opened);
    const bands = new Map<number, Band[]>();
    const extents = new Map<number, Band[]>();
    for (const a of marks) {
      const e = markExtent(a);
      if (e) (extents.get(a.page) ?? extents.set(a.page, []).get(a.page)!).push(e);
    }
    for (const s of segments) {
      if (s.kind !== 'show') continue;
      for (let i = s.from; i <= s.to; i++) {
        const page = i + 1;
        const ext = extents.get(page);
        // A page opened from a fold, or one whose marks have no shape, shows whole.
        bands.set(page, ext?.length ? pageBands(ext, PDF_CONTEXT[context] ?? PDF_CONTEXT[0]) : [{ top: 0, bottom: 1 }]);
      }
    }
    return { segments, bands, shown: shownCount(segments) };
  }, [on, matching, filter, pageCount, opened, context]);

  /** The page to show on going in: where the reader was, or the next marked page after it. */
  const enterAt = useRef<number | null>(null);
  const toggle = useCallback(() => {
    if (on) {
      // Out: the whole document again, at the page the reader was looking at.
      const page = pageInView(scrollRef.current) ?? currentPage;
      setOn(false);
      window.setTimeout(() => goToPage(page, false), 60);
    } else {
      enterAt.current = currentPage;
      setOn(true);
    }
    setOpened(new Set());
  }, [on, currentPage, goToPage, scrollRef, setOn, setOpened]);
  /** Lands on `enterAt`; PdfCollapsed calls it once the strips have their real sizes. */
  const land = useCallback(() => {
    const target = enterAt.current;
    const root = scrollRef.current;
    if (target == null || !root) return;
    enterAt.current = null;
    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-collapse-page]'));
    const el = sections.find((s) => Number(s.dataset.collapsePage) >= target) ?? sections[sections.length - 1];
    if (el) root.scrollTop += el.getBoundingClientRect().top - root.getBoundingClientRect().top - 12;
    else root.scrollTop = 0;
  }, [scrollRef]);

  const readFrom = (page: number) => {
    setOn(false);
    setOpened(new Set());
    window.setTimeout(() => goToPage(page, false), 60);
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

  return { ...state, toggle, readFrom, land, pagesFor, plan, pageCount };
}

export type PdfCollapse = ReturnType<typeof usePdfCollapse>;

/** The first collapsed page section still in view at the top of the scroller. */
function pageInView(root: HTMLElement | null): number | null {
  if (!root) return null;
  const top = root.getBoundingClientRect().top;
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-collapse-page]'))) {
    if (el.getBoundingClientRect().bottom > top + 8) return Number(el.dataset.collapsePage);
  }
  return null;
}

/**
 * Each page's size at the current zoom, read from pdf.js as pages come into the plan. `ready` once
 * every page in the plan has been asked, even if some failed (those keep placeholder strips).
 */
function usePageSizes(pdf: PDFDocumentProxy, scale: number, pages: number[]) {
  const [read, setRead] = useState<{ for: string; sizes: Map<number, { w: number; h: number }> }>({ for: '', sizes: new Map() });
  const key = `${scale}|${pages.join(',')}`;
  useEffect(() => {
    let cancelled = false;
    void readPageSizes(pdf, scale, pages).then((sizes) => {
      if (!cancelled) setRead({ for: key, sizes });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, key]);
  return { sizes: read.sizes, ready: read.for === key };
}

export const PdfCollapsed: React.FC<{
  collapse: PdfCollapse;
  pdf: PDFDocumentProxy;
  scale: number;
  renderPage: (page: number) => React.ReactNode;
  settings: UserSettings;
}> = ({ collapse, pdf, scale, renderPage, settings }) => {
  const { plan, filter, context, pageCount } = collapse;
  const pages = useMemo(() => (plan ? [...plan.bands.keys()] : []), [plan]);
  const { sizes, ready: sized } = usePageSizes(pdf, scale, pages);
  // Strips are measured before landing: placeholders above the target would push it away after.
  const { land } = collapse;
  useLayoutEffect(() => {
    if (sized) land();
  }, [sized, land]);
  if (!plan) return null;

  const band = (page: number, b: Band, i: number) => {
    const size = sizes.get(page);
    if (!size) return <div key={i} className="pdf-band pdf-band-loading" style={{ height: 120 }} />;
    return (
      <div key={i} className="pdf-band" data-band-top={b.top} data-band-bottom={b.bottom} style={{ width: size.w, height: Math.max(24, (b.bottom - b.top) * size.h) }}>
        <div style={{ marginTop: -b.top * size.h }}>{renderPage(page)}</div>
      </div>
    );
  };

  const section = (page: number) => {
    const bands = plan.bands.get(page) ?? [];
    return (
      <section key={page} data-collapse-page={page} className="collapse-run flex flex-col items-center gap-1.5" aria-label={`Page ${page}`}>
        <div className="flex items-center gap-3 self-stretch max-w-full mx-auto" style={{ width: sizes.get(page)?.w }}>
          <span className="caps caps-sm text-gold">Page {page}</span>
          <button type="button" onClick={() => collapse.readFrom(page)} className="collapse-fold-read ml-auto" title="Show the whole document, at this page">
            Open page
          </button>
        </div>
        {bands.map((b, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="pdf-band-gap" aria-hidden />}
            {band(page, b, i)}
          </React.Fragment>
        ))}
      </section>
    );
  };

  return (
    <div className="space-y-5 max-w-full">
      <div className="mx-auto" style={{ maxWidth: 760 }}>
        <CollapseBar
          filter={filter}
          context={context}
          summary={`${plural(plan.shown, 'page')} of ${pageCount} shown, as strips around the marks`}
          countFor={(f) => collapse.pagesFor(f).size}
          contextText={(n) => ['about a line around each mark', 'a few lines around each mark', 'a paragraph around each mark', 'more of the page around each mark'][n] ?? ''}
          onFilter={collapse.setFilter}
          onContext={collapse.setContext}
          onExit={collapse.toggle}
          themes={settings.activeThemes}
          terminologyColor={settings.terminologyColor}
        />
      </div>
      {plan.segments.map((s: CollapseSegment) =>
        s.kind === 'show' ? (
          <React.Fragment key={`show-${s.from}`}>{Array.from({ length: s.to - s.from + 1 }, (_, i) => section(s.from + i + 1))}</React.Fragment>
        ) : (
          <div key={`fold-${s.from}-${s.to}`} className="mx-auto" style={{ maxWidth: 760 }}>
            <CollapseFold from={s.from} to={s.to} total={pageCount} unit="page" onOpen={() => collapse.openFold(s)} onReadFrom={() => collapse.readFrom(s.from + 1)} />
          </div>
        )
      )}
    </div>
  );
};
