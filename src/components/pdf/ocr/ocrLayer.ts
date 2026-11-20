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
    if (s.rtl) span.dir = 'rtl';
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
