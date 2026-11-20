/**
 * "Make text selectable": reading a scanned page's words (OCR) so it can be highlighted,
 * underlined and searched like any PDF with text. Runs only when pressed (ocr/usePageOcr.ts).
 *
 * - `OcrPageButton`: on a scanned page, a pill to read that page, its progress with Cancel, and
 *   an error with Try again. Gone once the page has text.
 * - `OcrDocumentMenu`: a toolbar button whose panel reads every scanned page, with page n of N,
 *   Cancel, and plain words on what OCR gets right and wrong.
 * The wording lives in ocrView.ts (tested).
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, Loader2, ScanText, X } from '../icons';
import { HoverTooltip } from '../HoverTooltip';
import { useDismiss } from './useDismiss';
import { useDocumentOcr, usePageOcr } from './ocr/usePageOcr';
import { OCR_ACCURACY, OCR_PAGES_NOTE, docOcrView, pageOcrView } from './ocrView';

const pill = 'flex items-center gap-1.5 rounded-full caps px-3 py-1.5 text-[11px] cursor-pointer transition-colors';

/** `lowered`: the page's own hint (Black it out on a scan) holds the top, so this sits under it. */
export const OcrPageButton: React.FC<{ docId: string; pageNumber: number; lowered?: boolean }> = ({ docId, pageNumber, lowered = false }) => {
  const ocr = usePageOcr(docId, pageNumber);
  const view = pageOcrView(ocr);
  if (view.kind === 'hidden') return null;
  return (
    // Over the page's paper, which is light in both themes: fixed ink colours, not theme tokens.
    <div data-ocr-page={pageNumber} data-mark-ui className={`absolute ${lowered ? 'top-11' : 'top-3'} left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-full bg-white/95 shadow-md ring-1 ring-black/10 p-1 text-stone-800`}>
      {view.kind === 'offer' && (
        <>
          <button type="button" onClick={() => void ocr.run()} className={`${pill} bg-ink text-paper hover:bg-stone-700`}>
            <ScanText className="w-3.5 h-3.5" />
            {view.label}
          </button>
          <HoverTooltip label={`This page is a picture. Reading its words lets you highlight, underline and Find in it. ${OCR_ACCURACY}`}>
            <span tabIndex={0} aria-label={`About reading this page. ${OCR_ACCURACY}`} className="p-1.5 rounded-full text-stone-600 hover:text-stone-900 cursor-help">
              <Info className="w-3.5 h-3.5" />
            </span>
          </HoverTooltip>
        </>
      )}
      {view.kind === 'running' && (
        <>
          <span role="status" className="flex items-center gap-2 pl-2 pr-1 text-[12px]">
            <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin" />
            {view.label}
            <span aria-hidden className="w-16 h-1 rounded-full bg-stone-200 overflow-hidden">
              <span className="block h-full bg-ink transition-[width] duration-300 ease-out" style={{ width: `${view.percent}%` }} />
            </span>
          </span>
          <button type="button" onClick={ocr.cancel} className={`${pill} text-stone-700 hover:bg-stone-100`}>
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </>
      )}
      {view.kind === 'error' && (
        <>
          <span role="alert" title={view.detail} className="pl-2 pr-1 text-[12px] text-red-800">
            {view.label}
          </span>
          <button type="button" onClick={() => void ocr.run()} className={`${pill} bg-ink text-paper hover:bg-stone-700`}>
            Try again
          </button>
        </>
      )}
    </div>
  );
};

/** The toolbar's "make the whole document selectable" button and its panel. */
export const OcrDocumentMenu: React.FC<{ docId: string; isDark: boolean }> = ({ docId, isDark }) => {
  const ocr = useDocumentOcr(docId);
  const view = docOcrView(ocr);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // A click elsewhere closes it and leaves focus where the reader clicked.
  useDismiss(ref, open, () => setOpen(false), '[data-ocr-menu]');
  // Like the note editors: focus goes to the panel's first control as it opens, and again when
  // that control is swapped (Make → Cancel → Try again), so it never drops to the page.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.querySelector<HTMLElement>('button')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, view.kind]);
  /** Escape: closed, and focus back on the toolbar button that opened it. */
  const closeToButton = () => {
    setOpen(false);
    buttonRef.current?.focus({ preventScroll: true });
  };
  useLayoutEffect(() => {
    if (!open) return setPos(null);
    const measure = () => {
      const a = ref.current?.getBoundingClientRect();
      const m = panelRef.current?.getBoundingClientRect();
      if (!a || !m) return;
      setPos({ left: Math.max(8, Math.min(a.right - m.width, window.innerWidth - m.width - 8)), top: a.bottom + 6 });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);
  const running = view.kind === 'running';
  return (
    <div ref={ref} className="relative">
      <HoverTooltip label={running ? view.label : 'Make scanned pages selectable'}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Make scanned pages selectable"
          className={`p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer ${running || open ? 'text-gold dark:text-gold' : 'text-muted'}`}
        >
          {running ? <Loader2 className="w-4 h-4 motion-safe:animate-spin" /> : <ScanText className="w-4 h-4" weight={open ? 'bold' : 'regular'} />}
        </button>
      </HoverTooltip>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            data-ocr-menu
            role="dialog"
            aria-label="Make scanned pages selectable"
            aria-modal="false"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                closeToButton();
                return;
              }
              if (e.key !== 'Tab') return;
              // Tab stays inside the panel while it is open.
              const stops = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])')];
              if (!stops.length) return;
              e.preventDefault();
              const at = stops.indexOf(document.activeElement as HTMLElement);
              stops[(at + (e.shiftKey ? -1 : 1) + stops.length) % stops.length].focus();
            }}
            className={`fixed z-50 w-[320px] max-w-[calc(100vw-16px)] p-4 space-y-3 rounded-2xl shadow-2xl border text-[12.5px] leading-relaxed ${
              isDark ? 'bg-night-3 border-stone-700 text-stone-200' : 'bg-white border-stone-200 text-stone-700'
            }`}
            style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          >
            <h3 className={`title-hand text-[21px] ${isDark ? 'text-paper' : 'text-ink'}`}>Scanned pages</h3>
            <p>Reads the words on every page that is only a picture, on this computer, so you can highlight, underline and Find in them. Pages with text of their own are left as they are.</p>
            <p className="text-muted">{OCR_ACCURACY}</p>
            <p className="text-muted">{OCR_PAGES_NOTE}</p>
            {view.kind === 'running' ? (
              <div className="space-y-2">
                <div role="status" className="flex items-center justify-between gap-2">
                  <span>{view.label}</span>
                  <span className="tabular-nums text-muted">{view.percent}%</span>
                </div>
                <div aria-hidden className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-stone-700' : 'bg-stone-200'}`}>
                  <div className="h-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${view.percent}%` }} />
                </div>
                <button
                  type="button"
                  onClick={ocr.cancel}
                  className={`w-full rounded-full caps px-4 py-2 text-[12px] border cursor-pointer transition-colors ${
                    isDark ? 'border-stone-600 text-stone-200 hover:bg-white/5' : 'border-stone-300 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {view.kind === 'done' && <p role="status">{view.label}</p>}
                {view.kind === 'error' && (
                  <p role="alert" className="text-red-700 dark:text-red-300">
                    {view.label}. {view.detail}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void ocr.run()}
                  className="w-full rounded-full caps px-4 py-2 text-[12px] font-semibold bg-accent text-on-accent hover:bg-accent-hover cursor-pointer transition-colors"
                >
                  {view.kind === 'error' ? 'Try again' : view.kind === 'done' ? 'Read any new pages' : 'Make whole document selectable'}
                </button>
              </div>
            )}
          </div>,
          // Inside the app container, not body, so the dark theme's tokens still apply.
          document.getElementById('app-container') ?? document.body
        )}
    </div>
  );
};
