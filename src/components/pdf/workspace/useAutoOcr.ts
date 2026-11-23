/**
 * Reads scanned pages on their own as the reader looks at them: the pages in view and the page
 * before and after each, nearest the current page first, one at a time through ocrStore (which
 * saves each page and never reads it again). Works in every view (scroll, book, grids, focus,
 * collapsed strips): "in view" is whichever page elements are on screen.
 *
 * - Only pages without text of their own (the store checks a page not drawn yet before any OCR),
 *   once the saved OCR is in; a page that failed is not retried on its own.
 * - A page scrolled far past is simply never picked; an automatic read whose page has left the
 *   window is stopped. The reader's own read (a drag, Read pages) always goes first (ocrStore).
 * - Only English: a page OCR refuses (`ocrRefusal`: a right-to-left book, a font with no letter
 *   map) is not read, and not tried again (ocrStore remembers it).
 * Local only (tesseract.js): no network, no AI.
 */

import { useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ocrStore } from '../ocr/usePageOcr';
import { autoOcrNeeds, autoOcrNext, autoOcrWindow } from '../ocr/autoOcr';

/** Page numbers whose element is on screen inside `root` (offstage book pages excluded). */
function pagesInView(root: HTMLElement): number[] {
  const box = root.getBoundingClientRect();
  const seen = new Set<number>();
  for (const el of root.querySelectorAll<HTMLElement>('[data-page-number]')) {
    if (el.closest('[data-offstage]')) continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.bottom > box.top && r.top < box.bottom && r.right > box.left && r.left < box.right) seen.add(Number(el.dataset.pageNumber));
  }
  return [...seen];
}

export function useAutoOcr(deps: { pdf: PDFDocumentProxy | null; scrollRef: React.RefObject<HTMLElement | null>; currentPage: number }) {
  const { pdf, scrollRef } = deps;
  const current = useRef(deps.currentPage);
  current.current = deps.currentPage;

  useEffect(() => {
    const root = scrollRef.current;
    const docId = pdf && ocrStore.docIdOf(pdf);
    if (!pdf || !docId || !root) return;
    let stopped = false;
    let timer = 0;

    const tick = () => {
      if (stopped || !ocrStore.loaded(docId)) return;
      const near = autoOcrWindow(pagesInView(root), pdf.numPages);
      const active = ocrStore.activeRead();
      if (active?.auto && active.docId === docId && !near.includes(active.page)) ocrStore.cancelAuto(docId);
      if (active) return;
      const next = autoOcrNext({
        window: near,
        current: current.current,
        needs: (n) => autoOcrNeeds({ textKnown: ocrStore.textKnown(docId, n), status: ocrStore.page(docId, n).status, refused: ocrStore.refused(docId, n) })
      });
      if (next !== null) void ocrStore.runPage(docId, next, { auto: true });
    };
    // At most every 300 ms, and only once scrolling has paused that long: a page flown past is not read.
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, 300);
    };
    // The store changes many times a second while reading (progress): a steady pulse instead of a debounce.
    let storeTimer = 0;
    const onStore = () => {
      if (!storeTimer) storeTimer = window.setTimeout(() => ((storeTimer = 0), tick()), 300);
    };
    const unsubscribe = ocrStore.subscribe(onStore);
    root.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // Book turns, grids, strips: pages come and go without a scroll.
    const obs = new MutationObserver(schedule);
    obs.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-offstage', 'data-painted'] });
    schedule();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearTimeout(storeTimer);
      unsubscribe();
      root.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      obs.disconnect();
      ocrStore.cancelAuto(docId);
    };
  }, [pdf, scrollRef]);
}
