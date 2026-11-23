/**
 * Scrolling to a mark, the annotated-PDF export, Find in document, linked marks and the marks
 * archive (moved verbatim from PdfWorkspace).
 */

import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { useDocumentFind } from '../../FindBar';
import { UserSettings } from '../../../types';
import { Annotation, annotationBounds, asPdfMarks } from '../annotationModel';
import { blackoutsByPage } from '../export/redaction';
import { excerpt, useMarksArchive } from '../../MarksArchive';
import type { LinkOption, MarkLinks } from '../MarkProperties';
import { linkMarks, linkedIds, unlinkMarks } from '../../../utils/markLinks';
import { isAreaHighlight } from '../../../utils/areaMark';
import type { DebouncedSaver } from '../../../hooks/debouncedSaver';
import type { WorkspaceMarks, WorkspaceSelection, WorkspaceStatus, WorkspaceView } from './workspaceState';
import type { PdfNavigation } from './usePdfNavigation';
import { ocrStore } from '../ocr/usePageOcr';
import { ocrPageText } from '../../../utils/ocrWords';
import { pageSearchText, unreadScanPages } from '../ocrView';
import { pageElementAt } from './pageElement';
import type { PdfCollapse } from './PdfCollapsed';

export interface UseWorkspaceExtrasDeps {
  docId: string;
  documentTitle: string;
  isDark: boolean;
  onAddThemes: ((themes: UserSettings["activeThemes"]) => void) | undefined;
  saver: DebouncedSaver<Annotation[]>;
  settings: UserSettings;
  marks: Pick<WorkspaceMarks, 'annotations' | 'resetAnnotations' | 'setAnnotations'>;
  selection: Pick<WorkspaceSelection, 'editingId' | 'setSelectedId'>;
  view: Pick<WorkspaceView, 'currentPage' | 'pdf' | 'scrollRef'>;
  status: Pick<WorkspaceStatus, 'fileUrl' | 'setFailure' | 'setIsExporting'>;
  nav: Pick<PdfNavigation, 'bookTurnRef' | 'goToPage' | 'pageRef' | 'reduceMotion' | 'scrollAnimation'>;
  collapse: Pick<PdfCollapse, 'on' | 'readFrom'>;
}

export function useWorkspaceExtras(deps: UseWorkspaceExtrasDeps) {
  const { docId, documentTitle, isDark, onAddThemes, saver, settings } = deps;
  const { annotations, resetAnnotations, setAnnotations } = deps.marks;
  const { editingId, setSelectedId } = deps.selection;
  const { currentPage, pdf, scrollRef } = deps.view;
  const { fileUrl, setFailure, setIsExporting } = deps.status;
  const { bookTurnRef, goToPage, pageRef, reduceMotion, scrollAnimation } = deps.nav;
  const { collapse } = deps;

  /**
   * Brings a mark into view, reporting whether it could.
   *
   * Animated by hand rather than with `scrollTo({ behavior: 'smooth' })`, because the target
   * moves while the scroll runs: pages above are still settling to their real heights, which at
   * high zoom in a long book is centimetres of drift. The browser's smooth scroll commits to the
   * distance it was given and lands short, so this used to fire two corrective jumps after it —
   * a glide, then a stutter, then another. Recomputing the destination every frame absorbs that
   * drift continuously instead, and the mark simply arrives.
   *
   * Cubic ease-out over 380ms: fast at the start, where the eye is watching, settling at the end.
   * A jump already on screen is left alone — re-centring something the reader can already see is
   * movement for its own sake — and `prefers-reduced-motion` gets the destination with no travel.
   *
   * The boolean matters for the instance navigator, which jumps to the first match the moment the
   * document loads, when the page elements may not exist yet. Returning false rather than failing
   * silently is what lets the caller try again on the next frame.
   */
  const scrollToAnnotation = useCallback((a: Annotation): boolean => {
    // In the book, a mark on another pair turns there first; the caller retries once it is drawn.
    if (bookTurnRef.current && Math.floor((a.page - 1) / 2) !== Math.floor((pageRef.current - 1) / 2)) {
      bookTurnRef.current(a.page, true);
      return false;
    }
    const container = scrollRef.current;
    const bounds = annotationBounds(a);
    const pageEl = pageElementAt(container, a.page, bounds ? bounds.y + bounds.h / 2 : 0);
    // A page that has not been measured yet still has a height — `PdfPage` gives it a 60vh
    // placeholder — so "it rendered" is not the same as "it is the right size". Jumping against a
    // placeholder lands near the mark rather than on it, and the caller's retry never fired
    // because this reported success.
    if (!container || !pageEl || pageEl.dataset.pageSized !== 'true') return false;

    /**
     * The page's top within the SCROLL CONTAINER's coordinates.
     *
     * `offsetTop` is measured from the nearest positioned ancestor, and nothing between the page
     * and `<body>` is positioned — so it also counted the header and the toolbar above the
     * viewer, about 135px that is not part of the scrollable content. Every jump over-scrolled by
     * that much, which on a short window put the mark above the visible area entirely. Both
     * elements share the same offsetParent, so subtracting the container's own offset cancels it.
     */
    // A strip (collapsed to marks) is positioned, so its page's offsetTop counts from the strip.
    const pageTop = () =>
      pageEl.closest('[data-band-top]')
        ? pageEl.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
        : pageEl.offsetTop - container.offsetTop;
    const destination = () => {
      const raw = bounds
        ? pageTop() + bounds.y * pageEl.offsetHeight - container.clientHeight / 3
        : pageTop();
      return Math.max(0, Math.min(raw, container.scrollHeight - container.clientHeight));
    };

    // A jump replaces whatever is in flight — including on the paths that return early below,
    // or a half-finished glide would carry on to the previous mark after arriving at this one.
    if (scrollAnimation.current !== null) {
      cancelAnimationFrame(scrollAnimation.current);
      scrollAnimation.current = null;
    }

    // Already comfortably in view: leave it where it is.
    if (bounds) {
      const markTop = pageTop() + bounds.y * pageEl.offsetHeight - container.scrollTop;
      const markBottom = markTop + bounds.h * pageEl.offsetHeight;
      const margin = container.clientHeight * 0.12;
      if (markTop > margin && markBottom < container.clientHeight - margin) return true;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      container.scrollTop = destination();
      return true;
    }

    const from = container.scrollTop;
    const startedAt = performance.now();
    const DURATION_MS = 380;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / DURATION_MS);
      container.scrollTop = from + (destination() - from) * easeOut(t);
      scrollAnimation.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    scrollAnimation.current = requestAnimationFrame(step);
    return true;
  }, []);

  // A workspace torn down mid-jump must not leave a frame callback writing to a dead node.
  useEffect(
    () => () => {
      if (scrollAnimation.current !== null) cancelAnimationFrame(scrollAnimation.current);
    },
    []
  );

  /**
   * Pages with words blacked out: asked first whether to remove the hidden text too (a true
   * redaction) or keep it underneath, said plainly (BlackoutExportDialog).
   */
  const blackoutPages = useMemo(() => blackoutsByPage(annotations).size, [annotations]);
  const [askRedact, setAskRedact] = useState(false);
  const handleExport = useCallback(async () => {
    if (blackoutPages) setAskRedact(true);
    else await exportPdf(false);
    // `exportPdf` is declared below (naming it here would read it before it exists), so its own inputs are listed instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blackoutPages, fileUrl, annotations, documentTitle, settings.terminologyColor, settings.activeThemes]);

  const exportPdf = useCallback(async (redact: boolean) => {
    setAskRedact(false);
    setIsExporting(true);
    try {
      const safe = (documentTitle || 'document').replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
      const name = `${safe}_${redact ? 'redacted' : 'annotated'}.pdf`;
      // Loaded on first export: pdf-lib and fontkit stay out of the start-up bundle.
      const { exportAnnotatedPdf, downloadBlob } = await import('../exportAnnotatedPdf');
      const blob = await exportAnnotatedPdf(fileUrl, annotations, name, settings.terminologyColor, settings.activeThemes, { redact });
      downloadBlob(blob, name);
    } catch (err) {
      console.error('PDF export failed:', err);
      setFailure(
        'Could not build the annotated PDF. The source file may have changed on disk since this document was opened. Press Export PDF again to retry.'
      );
    } finally {
      setIsExporting(false);
    }
  }, [fileUrl, annotations, documentTitle, settings.terminologyColor, settings.activeThemes]);

  // ── Find in document (Cmd+F) ──
  /** Each page's text-layer string, read from pdf.js the first time find opens on this file. */
  const [pageTexts, setPageTexts] = useState<string[] | null>(null);
  /** The same, as pdf.js has them (no OCR words): which pages are pictures Find cannot search yet. */
  const [rawTexts, setRawTexts] = useState<string[] | null>(null);
  useEffect(() => {
    setPageTexts(null);
    setRawTexts(null);
  }, [pdf]);
  const pageTextLayer = (i: number) =>
    scrollRef.current?.querySelector(`[data-page-number="${i + 1}"] .marginalia-text-layer`) ?? null;
  // A page can be drawn more than once: the book's hidden neighbours, strips when collapsed.
  const pageTextLayers = (i: number) =>
    Array.from(scrollRef.current?.querySelectorAll(`[data-page-number="${i + 1}"] .marginalia-text-layer`) ?? []);
  /** A hit the reader can see: not on a hidden book page, and inside its strip when collapsed. */
  const hitShown = (range: Range) => {
    const el = range.startContainer.parentElement;
    if (!el || el.closest('[data-offstage]')) return false;
    const band = el.closest('.pdf-band');
    if (!band) return true;
    const r = range.getBoundingClientRect();
    const b = band.getBoundingClientRect();
    return r.top >= b.top && r.bottom <= b.bottom;
  };
  const find = useDocumentFind({
    enabled: Boolean(pdf) && !editingId,
    units: pageTexts,
    unitElement: pageTextLayer,
    unitElements: pageTextLayers,
    shown: hitShown,
    root: () => scrollRef.current,
    startUnit: () => currentPage - 1,
    reveal: (i, range) => {
      const box = scrollRef.current?.getBoundingClientRect();
      // Not in sight: collapsed to marks, the document opens at that page; otherwise go (or turn) there.
      if (!range && collapse.on) return collapse.readFrom(i + 1);
      if (!range || !box) return goToPage(i + 1);
      const r = range.getBoundingClientRect();
      if (r.top >= box.top + 24 && r.bottom <= box.bottom - 72 && r.left >= box.left && r.right <= box.right) return;
      scrollRef.current!.scrollBy({
        top: r.top - (box.top + box.bottom) / 2,
        left: r.right > box.right || r.left < box.left ? r.left - (box.left + box.right) / 2 : 0,
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
    }
  });
  useEffect(() => {
    if (!find.open || pageTexts || !pdf) return;
    let cancelled = false;
    void Promise.all(
      Array.from({ length: pdf.numPages }, (_, i) =>
        pdf
          .getPage(i + 1)
          .then((page) => page.getTextContent())
          // A line end is a space, as the text layer's <br> is read back (findHighlight.ts).
          .then((tc) => tc.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? ' ' : '') : '')).join(''))
          .catch(() => '')
      )
    ).then((texts) => {
      if (cancelled) return;
      setRawTexts(texts);
      setPageTexts(withOcrText(texts));
    });
    return () => {
      cancelled = true;
    };
  }, [find.open, pageTexts, pdf]);
  /** A scanned page has no text of its own; once read by OCR, its OCR words are what Find searches. */
  const withOcrText = useCallback(
    (texts: string[]) => texts.map((t, i) => pageSearchText(t, () => ocrPageText(ocrStore.page(docId, i + 1).words))),
    [docId]
  );
  // A page read while Find is open joins the search.
  useEffect(() => {
    if (!find.open || !pageTexts) return;
    return ocrStore.subscribe(() =>
      setPageTexts((prev) => {
        if (!prev) return prev;
        const next = withOcrText(prev);
        return next.some((t, i) => t !== prev[i]) ? next : prev;
      })
    );
  }, [find.open, pageTexts, withOcrText]);

  const unreadScans = useSyncExternalStore(ocrStore.subscribe, () =>
    rawTexts ? unreadScanPages(rawTexts, (n) => ocrStore.page(docId, n).status === 'done' || ocrStore.refused(docId, n)) : 0
  );

  // ── Linked marks ──
  const linkOption = (a: Annotation): LinkOption => ({
    id: a.id,
    label: excerpt(a.quote || a.text || (isAreaHighlight(a) ? 'Area highlight' : a.kind)),
    where: `p. ${a.page}`
  });
  const markLinksFor = (id: string): MarkLinks => {
    const linked = new Set(linkedIds(annotations, id));
    const ordered = [...annotations].sort((x, y) => x.page - y.page);
    return {
      linked: ordered.filter((a) => linked.has(a.id)).map(linkOption),
      candidates: ordered.filter((a) => a.id !== id).map(linkOption),
      onLink: (other) => setAnnotations((prev) => linkMarks(prev, id, other)),
      onUnlink: (other) => setAnnotations((prev) => unlinkMarks(prev, id, other)),
      onJump: (other) => {
        const target = annotations.find((a) => a.id === other);
        if (!target) return;
        setSelectedId(other);
        scrollToAnnotation(target);
      }
    };
  };

  // ── Marks archive (Markdown/JSON, commonplace book, import, restore) ──
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  const archive = useMarksArchive({
    docId,
    doc: { id: docId, title: documentTitle || 'document', format: 'PDF' },
    entries: () => annotationsRef.current,
    themes: settings.activeThemes,
    saver,
    reset: (entries) => resetAnnotations(asPdfMarks(entries)),
    onAddThemes: (t) => onAddThemes?.(t),
    isDark,
    teacher: settings.name
  });

  return { askRedact, setAskRedact, exportPdf, blackoutPages, archive, find, unreadScans, handleExport, markLinksFor, scrollToAnnotation };
}

export type WorkspaceExtras = ReturnType<typeof useWorkspaceExtras>;
