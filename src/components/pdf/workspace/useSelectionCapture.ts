/**
 * Reading the live text selection into per-page groups, and capturing it on release (or after a
 * keyboard selection pauses): an armed text tool marks it at once, otherwise it is remembered for
 * the selection menu (moved verbatim from useTextMarking).
 */

import React, { useEffect, useCallback, useState } from 'react';
import { UserSettings } from '../../../types';
import { FractionRect, PdfTool, isTextAnchored, mergeRectsIntoLines, rectToFraction } from '../annotationModel';
import { isTypingTarget } from '../workspaceKeys';
import { clippedRange, quoteFromFragments, rangeFragments, unreadableSelectionPage } from '../../../utils/selectionText';
import { blackoutMarks } from '../textMarking';
import type { WorkspaceMarks, WorkspaceSelection } from './workspaceState';
import type { PdfToolStyles } from './usePdfToolStyles';

export interface UseSelectionCaptureDeps {
  settings: UserSettings;
  styles: Pick<PdfToolStyles, 'maskMode' | 'tool' | 'toolColors'>;
  marks: Pick<WorkspaceMarks, 'setAnnotations'>;
  selection: Pick<WorkspaceSelection, 'setPendingSelection' | 'setSelectedId' | 'setSelectionAnchor'>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Marks a selection with an armed text tool (useTextMarking's `applyTextMark`). */
  applyTextMark: (tool: PdfTool, groups: { page: number; rects: FractionRect[]; quote: string }[]) => void;
}

/**
 * Collapsed to marks, a page is shown as strips, each a copy of the whole page clipped to a band:
 * a drag between two strips runs through the copy's hidden rest. Keeps only the words in sight.
 */
function inSight(clip: Range, layer: Element, strip: Element): Range | null {
  const box = strip.getBoundingClientRect();
  const seen = Array.from(layer.querySelectorAll('span:not(:has(span))')).filter((n) => {
    const r = n.getBoundingClientRect();
    const mid = (r.top + r.bottom) / 2;
    return mid >= box.top && mid <= box.bottom && clip.intersectsNode(n);
  });
  if (!seen.length) return null;
  const out = clip.cloneRange();
  const first = document.createRange();
  first.selectNodeContents(seen[0]);
  if (out.compareBoundaryPoints(Range.START_TO_START, first) < 0) out.setStart(first.startContainer, first.startOffset);
  const last = document.createRange();
  last.selectNodeContents(seen[seen.length - 1]);
  if (out.compareBoundaryPoints(Range.END_TO_END, last) > 0) out.setEnd(last.endContainer, last.endOffset);
  return out.collapsed ? null : out;
}

export function useSelectionCapture(deps: UseSelectionCaptureDeps) {
  const { settings, scrollRef, applyTextMark } = deps;
  const { maskMode, tool, toolColors } = deps.styles;
  const { setAnnotations } = deps.marks;
  const { setPendingSelection, setSelectedId, setSelectionAnchor } = deps.selection;
  /** A page where the last drag selected only characters with no letters (font with no letter map). */
  const [unreadable, setUnreadable] = useState<number | null>(null);
  /** Bumped on every unreadable drag, so a second one on the same page restarts the timer. */
  const [unreadableDrag, setUnreadableDrag] = useState(0);
  useEffect(() => {
    if (unreadable === null) return;
    const t = window.setTimeout(() => setUnreadable(null), 4000);
    return () => window.clearTimeout(t);
  }, [unreadable, unreadableDrag]);

  // ── Text selection → highlight / underline / strikeout ──
  /**
   * Reads the live text selection into per-page groups of rectangles.
   *
   * Every client rect is kept rather than one bounding box: a selection spanning several lines
   * has a ragged outline, and a single box would tint the whitespace either side of it. Rects are
   * grouped by the page element containing them, so a selection dragged across a page break makes
   * one mark on each page rather than one mark whose coordinates make sense on neither.
   */
  const readSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    /*
     * Read page by page, from each page's text layer only. `Selection.toString()` and the range's
     * own rects run between the two ends in document order, so a drag begun just left of a line,
     * over the sidebar or the toolbar, used to put their labels in the quote (and a toolbar
     * scrolled over a page could add rects). Clipping the range to each text layer keeps exactly
     * the page's words and their boxes, one mark per page for a drag across a page break.
     */
    const groups: { page: number; rects: FractionRect[]; quote: string }[] = [];
    const seen: { page: number; quote: string; rects: number; noText: boolean }[] = [];
    for (const pageEl of Array.from(document.querySelectorAll<HTMLElement>('[data-page-number]'))) {
      const layer = pageEl.querySelector('.marginalia-text-layer');
      const whole = layer ? clippedRange(range, layer) : null;
      const strip = pageEl.closest('.pdf-band');
      const clip = whole && strip ? inSight(whole, layer!, strip) : whole;
      if (!clip) continue;
      const quote = quoteFromFragments(rangeFragments(clip));
      // Zero-area rects are emitted for collapsed line ends and would render as invisible slivers
      // that are impossible to click or erase.
      const rects = Array.from(clip.getClientRects()).filter((r) => r.width >= 0.5 && r.height >= 0.5);
      seen.push({ page: Number(pageEl.dataset.pageNumber), quote, rects: rects.length, noText: pageEl.dataset.noText !== undefined });
      if (!quote || rects.length === 0) continue;
      const pageBox = pageEl.getBoundingClientRect();
      groups.push({ page: Number(pageEl.dataset.pageNumber), rects: mergeRectsIntoLines(rects).map((r) => rectToFraction(r, pageBox)), quote });
    }
    return { groups: groups.length ? groups : null, unreadable: unreadableSelectionPage(seen) };
  }, []);

  /**
   * Remembers the selection on mouse release, and marks it straight away when a text tool is
   * already active.
   *
   * Reading on release rather than on every selection change means the mark is made once the
   * reader has finished dragging, instead of on each intermediate selection.
   */
  useEffect(() => {
    /** Reads the live selection into state; `byPointer` is false for a keyboard selection. */
    const sync = (byPointer: boolean) => {
      // Typing a new theme's name in the selection menu moves the browser's selection; the passage stays.
      if ((document.activeElement as HTMLElement | null)?.closest('[data-keep-selection]')) return;
      const read = readSelection();
      const groups = read?.groups ?? null;
      if (byPointer) {
        setUnreadable(read?.unreadable ?? null);
        if (read?.unreadable != null) setUnreadableDrag((n) => n + 1);
      }
      if (!groups) {
        // A click that collapses the selection clears it, so a later tool tap does not apply to
        // something the reader has visibly moved on from.
        if (!window.getSelection()?.toString().trim()) {
          setPendingSelection(null);
          setSelectionAnchor(null);
        }
        return;
      }
      // Marking by selection always adds — never undoes. Only on release of a drag: a keyboard
      // selection grows a character at a time, and an armed tool would mark every pause in it.
      // The new mark is selected, so its properties toolbar is the one that shows; the selection
      // menu stays closed (both at once stacked a second toolbar over the passage).
      // Black it out, Words: solid bars over the selected lines.
      if (byPointer && tool === 'mask' && maskMode === 'words') {
        const bars = blackoutMarks(groups, { color: toolColors.mask ?? '#000000', author: settings.name });
        if (bars.length) {
          setAnnotations((prev) => [...prev, ...bars]);
          setSelectedId(bars[0].id);
        }
        setPendingSelection(null);
        setSelectionAnchor(null);
        window.getSelection()?.removeAllRanges();
        return;
      }
      if (byPointer && isTextAnchored(tool)) {
        applyTextMark(tool, groups);
        setSelectionAnchor(null);
        window.getSelection()?.removeAllRanges();
        return;
      }
      setPendingSelection(groups);

      // Anchor the menu to the selection's own rectangle.
      const sel = window.getSelection();
      const rect = sel && sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
      if (rect && rect.width + rect.height > 0) {
        setSelectionAnchor({ left: rect.left, top: rect.top, bottom: rect.bottom });
      }
    };

    const handleUp = () => window.setTimeout(() => sync(true), 0);

    /*
      Keyboard selection (Shift+Arrow) never produces a mouseup, so the menu also follows
      `selectionchange` — debounced, so it opens once the reader pauses rather than on every
      character, and only when the last input was a key, so a drag is still read on release only.
    */
    let lastInputWasKey = false;
    let timer: number | undefined;
    const onPointerDown = () => {
      lastInputWasKey = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTypingTarget(e.target)) lastInputWasKey = true;
    };
    const onSelectionChange = () => {
      if (!lastInputWasKey) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const sel = window.getSelection();
        const node = sel?.anchorNode;
        // Only selections in the document itself, not in a field or the side panel.
        if (node && !scrollRef.current?.contains(node)) return;
        sync(false);
      }, 300);
    };

    document.addEventListener('mouseup', handleUp);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [tool, maskMode, readSelection, applyTextMark, toolColors, settings.name]);

  return { unreadable };
}
