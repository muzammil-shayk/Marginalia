/**
 * Puts a scanned page's OCR words into its text layer (`.marginalia-text-layer`) as transparent,
 * selectable spans over the page image, laid out like pdf.js's own (see utils/ocrWords.ts), so
 * selection, highlight, underline and quotes work on them unchanged.
 */

import { ocrSpans, type OcrWord } from '../../../utils/ocrWords';

const FONT = 'sans-serif';
let measurer: CanvasRenderingContext2D | null = null;

function measure(text: string, fontSize: number): number {
  measurer ??= document.createElement('canvas').getContext('2d');
  if (!measurer) return 0;
  measurer.font = `${fontSize}px ${FONT}`;
  return measurer.measureText(text).width;
}

/** Replaces the layer's content with the words, for a page drawn `width` x `height` CSS pixels. */
export function fillOcrLayer(layer: HTMLElement, words: OcrWord[], width: number, height: number): void {
  const nodes: HTMLElement[] = [];
  ocrSpans(words, width, height, measure).forEach((s, i) => {
    const span = document.createElement('span');
    span.textContent = s.text;
    span.dataset.ocr = '';
    span.style.cssText = `left:${s.left}px;top:${s.top}px;font-size:${s.fontSize}px;font-family:${FONT};transform:scaleX(${s.scaleX})`;
    nodes.push(span);
    // A line ends in <br>, as in pdf.js's layer: Find reads it back as a space (ocrPageText).
    if (words[i + 1]?.line !== words[i].line) nodes.push(document.createElement('br'));
  });
  // Keeps a drag from running away in the gaps, as on a page with text (see PdfPage).
  const end = document.createElement('div');
  end.className = 'endOfContent';
  layer.replaceChildren(...nodes, end);
}

/** A point on a page as fractions of its width and height (survives scrolling and zoom). */
export interface PagePoint {
  x: number;
  y: number;
}

/**
 * Selects the OCR words a drag from `from` to `to` crossed, as the browser would have had the
 * words been there: the word under each end (or the nearest one), in reading order. True when a
 * selection was made. The page's box is read now, so the page may have moved since the drag.
 */
export function selectBetween(page: Element, layer: Element, from: PagePoint, to: PagePoint): boolean {
  const spans = [...layer.querySelectorAll<HTMLElement>('span[data-ocr]')].filter((s) => s.firstChild);
  if (!spans.length) return false;
  const box = page.getBoundingClientRect();
  const nearest = (p: PagePoint) => {
    const x = box.left + p.x * box.width;
    const y = box.top + p.y * box.height;
    let best = spans[0];
    let bestD = Infinity;
    for (const s of spans) {
      const r = s.getBoundingClientRect();
      const dx = Math.max(r.left - x, 0, x - r.right);
      const dy = Math.max(r.top - y, 0, y - r.bottom);
      const d = dy * 4 + dx; // a line away counts for more than a word along it
      if (d < bestD) [best, bestD] = [s, d];
    }
    return best;
  };
  let a = nearest(from);
  let b = nearest(to);
  if (spans.indexOf(a) > spans.indexOf(b)) [a, b] = [b, a];
  const sel = window.getSelection();
  if (!sel) return false;
  sel.setBaseAndExtent(a.firstChild!, 0, b.firstChild!, b.firstChild!.textContent?.length ?? 0);
  return !sel.isCollapsed;
}
