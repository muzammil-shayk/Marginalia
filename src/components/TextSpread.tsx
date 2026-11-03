/**
 * The reader's two-page spread: the document's paragraphs flowed through CSS columns, one column
 * per page, two pages in view, turned like the desk book's cover (see `pageTurn.ts`).
 *
 * The paragraphs stay the reader's own live elements, in one flow, so selection, marks, notes and
 * the selection menu work exactly as in the scrolling view; only the window onto them moves.
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from './icons';
import { clampSpread, columnAt, pageCountFor, playTurn, snapshotPage, turnDirection, type PageBox } from './pageTurn';
import { isTypingTarget } from './pdf/workspaceKeys';
import { useSwipeTurn } from './swipeTurn';

export interface TextSpreadHandle {
  /** Turns to the spread holding `el` (a paragraph or a mark inside one). */
  showElement: (el: Element | Range, animate?: boolean) => void;
  /** Index of the first paragraph (top-level flow child) on the current spread. */
  firstChildInView: () => Element | null;
}

interface TextSpreadProps {
  children: React.ReactNode;
  /** The column flow, for the reader's own lookups (it is the same element the scrolling view uses). */
  flowRef: (el: HTMLDivElement | null) => void;
  className?: string;
  /** Shown first, without a turn, once the flow is laid out. */
  initialElement?: () => Element | null;
  reduced: boolean;
  /** A turn is starting: drop whatever was selected on the page being left. */
  onTurn?: () => void;
  /** After each turn: the first flow child now in view, so the reader can return to it. */
  onSettle?: (first: Element | null) => void;
}

const MAX_BOOK = 1120;
/** Below this a page column is too narrow to read; the reader falls back to one page. */
export const MIN_SPREAD_WIDTH = 860;

interface Geometry {
  bookW: number;
  bookH: number;
  pageW: number;
  padX: number;
  padTop: number;
  padBottom: number;
}

const sameGeometry = (a: Geometry | null, b: Geometry) =>
  !!a && a.bookW === b.bookW && a.bookH === b.bookH && a.padX === b.padX;

export const TextSpread = forwardRef<TextSpreadHandle, TextSpreadProps>(function TextSpread(
  { children, flowRef, className = '', initialElement, reduced, onTurn, onSettle },
  ref
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const flowEl = useRef<HTMLDivElement | null>(null);
  const [geo, setGeo] = useState<Geometry | null>(null);
  const [pages, setPages] = useState(1);
  const [spread, setSpread] = useState(0);
  const spreadRef = useRef(0);
  spreadRef.current = spread;
  const turning = useRef<{ finish: () => void } | null>(null);
  const placedInitial = useRef(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onResize = () => setTick((n) => n + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Geometry and page count follow the window and the content; read after every render (cheap:
  // the layout they read is the one the browser computes anyway).
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const bookW = Math.floor(Math.min(MAX_BOOK, rect.width) / 2) * 2;
    // 24: breathing room under the book; the window never scrolls in spread view.
    const bookH = Math.max(320, Math.floor(window.innerHeight - rect.top - 24));
    const pageW = bookW / 2;
    const padX = Math.round(Math.min(64, Math.max(32, pageW * 0.09)));
    const next: Geometry = { bookW, bookH, pageW, padX, padTop: 44, padBottom: 52 };
    if (!sameGeometry(geo, next)) {
      setGeo(next);
      return;
    }
    const flow = flowEl.current;
    if (!flow) return;
    const n = pageCountFor(flow.scrollWidth, pageW, 2 * padX);
    if (n !== pages) setPages(n);
  });

  const spreads = Math.max(1, Math.ceil(pages / 2));
  // A shorter document after a font change keeps the reader on a page that exists.
  useEffect(() => {
    if (spread > spreads - 1) setSpread(spreads - 1);
  }, [spread, spreads]);

  // The selection menu, mark toolbar and progress all re-measure on scroll; a turn moves the
  // page under them the same way, so tell them.
  const settleRef = useRef(onSettle);
  settleRef.current = onSettle;
  useEffect(() => {
    window.dispatchEvent(new Event('scroll'));
  }, [spread, tick, geo]);

  const columnOf = useCallback(
    (el: Element | Range): number => {
      const flow = flowEl.current;
      if (!flow || !geo) return 0;
      const r = el.getClientRects()[0] ?? el.getBoundingClientRect();
      return columnAt(r.left + r.width / 2, flow.getBoundingClientRect().left, geo.pageW);
    },
    [geo]
  );

  /** A copy of page `p` as it looks now: paper, gutter, folio and its lines of text. */
  const snapshotText = useCallback(
    (p: number): HTMLElement | null => {
      const flow = flowEl.current;
      if (!flow || !geo) return null;
      const { pageW, padX, padTop, padBottom, bookH } = geo;
      const origin = flow.getBoundingClientRect();
      const kids = Array.from(flow.children) as HTMLElement[];
      // The children with a fragment in column p, and the column the first of them began in.
      let first = -1;
      let last = -1;
      let startCol = p;
      let startTop = 0;
      kids.forEach((k, i) => {
        const rects = Array.from(k.getClientRects()).filter((r) => r.width > 0 || r.height > 0);
        if (!rects.length) return;
        const cols = rects.map((r) => columnAt(r.left + r.width / 2, origin.left, pageW));
        if (Math.min(...cols) <= p && Math.max(...cols) >= p) {
          if (first < 0) {
            first = i;
            const c0 = Math.min(...cols);
            startCol = c0;
            startTop = rects[cols.indexOf(c0)].top - origin.top;
          }
          last = i;
        }
      });

      const page = document.createElement('div');
      page.className = 'spread-page';
      page.dataset.side = p % 2 ? 'right' : 'left';
      page.style.cssText = 'left:0;right:0;width:100%;';
      const win = document.createElement('div');
      win.className = 'spread-window';
      win.style.cssText = `left:${padX}px;top:${padTop}px;width:${pageW - 2 * padX}px;height:${bookH - padTop - padBottom}px;`;
      if (first >= 0) {
        // The same columns from where the first child began, so its lines break exactly as on the page.
        const span = p - startCol + 1;
        const inner = document.createElement('div');
        inner.className = flow.className;
        // A fixed column count, not the flow's column-width: with fractional widths the browser can
        // round `span` columns down to one wide column, which put the wrong text on the turning leaf.
        inner.style.cssText = `${flow.style.cssText};width:${span * pageW - 2 * padX}px;column-width:auto;column-count:${span};transform:translateX(${-(p - startCol) * pageW}px);`;
        kids.slice(first, last + 1).forEach((k, i) => {
          const c = snapshotPage(k);
          if (i === 0) c.style.marginTop = `${Math.max(0, startTop)}px`;
          inner.appendChild(c);
        });
        win.appendChild(inner);
      }
      page.appendChild(win);
      const folio = document.createElement('div');
      folio.className = 'spread-folio';
      folio.textContent = String(p + 1);
      folio.style.cssText = 'left:0;right:0;text-align:center;';
      if (p < pages) page.appendChild(folio);
      return page;
    },
    [geo, pages]
  );

  const turnTo = useCallback(
    (target: number, animate = true) => {
      const to = clampSpread(target, spreads);
      const from = spreadRef.current;
      const dir = turnDirection(from, to);
      if (!dir) return;
      turning.current?.finish();
      onTurn?.();
      window.getSelection()?.removeAllRanges();
      const book = bookRef.current;
      if (animate && book && geo) {
        const left: PageBox = { left: 0, top: 0, width: geo.pageW, height: geo.bookH };
        const right: PageBox = { ...left, left: geo.pageW };
        const t = playTurn({
          layer: book,
          left,
          right,
          dir,
          front: snapshotText(dir === 1 ? 2 * from + 1 : 2 * from),
          cover: snapshotText(dir === 1 ? 2 * from : 2 * from + 1),
          back: () => snapshotText(dir === 1 ? 2 * to : 2 * to + 1),
          reduced
        });
        turning.current = t;
        void t.done.then(() => {
          if (turning.current === t) turning.current = null;
        });
      }
      spreadRef.current = to;
      setSpread(to);
    },
    [spreads, geo, snapshotText, reduced, onTurn]
  );

  useEffect(() => () => turning.current?.finish(), []);

  // The page the reader was on in the scrolling view, once the columns exist.
  useLayoutEffect(() => {
    if (placedInitial.current || !geo || !flowEl.current) return;
    const el = initialElement?.();
    placedInitial.current = true;
    if (!el) return;
    const s = Math.floor(columnOf(el) / 2);
    spreadRef.current = s;
    setSpread(s);
  }, [geo, columnOf, initialElement]);

  const firstChildInView = useCallback((): Element | null => {
    const flow = flowEl.current;
    if (!flow || !geo) return null;
    const col = 2 * spreadRef.current;
    const origin = flow.getBoundingClientRect().left;
    return (
      (Array.from(flow.children) as Element[]).find((k) =>
        Array.from(k.getClientRects()).some((r) => columnAt(r.left + r.width / 2, origin, geo.pageW) >= col)
      ) ?? null
    );
  }, [geo]);

  useImperativeHandle(
    ref,
    () => ({
      showElement: (el, animate = true) => turnTo(Math.floor(columnOf(el) / 2), animate),
      firstChildInView
    }),
    [turnTo, columnOf, firstChildInView]
  );

  useEffect(() => {
    if (placedInitial.current) settleRef.current?.(firstChildInView());
  }, [spread, geo, firstChildInView]);

  // Arrow keys and Page Up / Down turn; never while typing, in a dialog, or with a modifier
  // (Shift+Arrow extends a selection).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isTypingTarget(e.target) || document.querySelector('[aria-modal="true"]')) return;
      const step = e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'PageUp' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      turnTo(spreadRef.current + step);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [turnTo]);

  // A sideways swipe (finger, pen, trackpad) turns too.
  const swipe = useCallback((step: 1 | -1) => turnTo(spreadRef.current + step), [turnTo]);
  useSwipeTurn(hostRef, swipe);

  const g = geo;
  const colW = g ? g.pageW - 2 * g.padX : 0;
  const winH = g ? g.bookH - g.padTop - g.padBottom : 0;
  const leftPage = 2 * spread + 1;
  return (
    <div ref={hostRef} className={`w-full ${className}`}>
      {g && (
        <div ref={bookRef} className="spread-book" style={{ width: g.bookW, height: g.bookH }}>
          <div className="spread-page" data-side="left" aria-hidden />
          <div className="spread-page" data-side="right" aria-hidden />
          <div
            className="spread-window"
            style={{ left: g.padX, top: g.padTop, width: g.bookW - 2 * g.padX, height: winH }}
          >
            <div
              ref={(el) => {
                flowEl.current = el;
                flowRef(el);
              }}
              className="spread-flow relative space-y-6"
              style={{
                height: winH,
                columnWidth: colW,
                columnGap: 2 * g.padX,
                transform: `translateX(${-spread * g.bookW}px)`
              }}
            >
              {children}
            </div>
          </div>
          <span className="spread-folio" style={{ left: 0, width: g.pageW, textAlign: 'center' }} aria-hidden>
            {leftPage}
          </span>
          {leftPage + 1 <= pages && (
            <span className="spread-folio" style={{ left: g.pageW, width: g.pageW, textAlign: 'center' }} aria-hidden>
              {leftPage + 1}
            </span>
          )}
          <button
            type="button"
            className="spread-edge left-0"
            style={{ width: g.padX }}
            onClick={() => turnTo(spread - 1)}
            disabled={spread === 0}
            aria-label="Previous pages (Left arrow)"
            title="Previous pages (←)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="spread-edge right-0"
            style={{ width: g.padX }}
            onClick={() => turnTo(spread + 1)}
            disabled={spread >= spreads - 1}
            aria-label="Next pages (Right arrow)"
            title="Next pages (→)"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <p className="sr-only" aria-live="polite">
            {`Pages ${leftPage}${leftPage + 1 <= pages ? `–${leftPage + 1}` : ''} of ${pages}`}
          </p>
        </div>
      )}
    </div>
  );
});
