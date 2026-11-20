/**
 * Text read off a scanned PDF page (OCR, tesseract.js): its words as page fractions, how they are
 * laid out as a selectable text layer over the page image, and the check a saved page must pass.
 * Pure, so it is tested; the worker itself lives in components/pdf/ocr.
 */

import { isMostlyRtl } from './scriptDirection';

/** A box in image pixels, as tesseract.js gives it. */
export interface OcrBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The part of tesseract.js's `blocks` output that is read. */
export interface OcrBlock {
  paragraphs: { is_ltr?: number | boolean; lines: { text: string; words: { text: string; bbox: OcrBox }[] }[] }[];
}

/** One word on the page: its text and box as fractions of the page (top-left origin). */
export interface OcrWord {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Line number on the page, counted from 0 in reading order. */
  line: number;
  /** On a right-to-left line (Urdu, Arabic, Hebrew). */
  rtl?: true;
}

/** One page's OCR result as saved on disk. */
export interface OcrPage {
  words: OcrWord[];
  /** The languages it was read with, as tesseract names them ("eng+urd"). */
  langs: string;
  createdAt: string;
}

/** Direction marks tesseract wraps words in; the layer sets direction itself, quotes need none. */
const BIDI_MARKS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/**
 * Words from tesseract.js blocks, in reading order (tesseract gives an Urdu line right to left),
 * as fractions of an image `width` x `height`. Blank words and empty boxes are dropped.
 */
export function ocrWordsFromBlocks(blocks: OcrBlock[], width: number, height: number): OcrWord[] {
  const out: OcrWord[] = [];
  let line = 0;
  for (const block of blocks) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const l of paragraph.lines ?? []) {
        const rtl = isMostlyRtl(l.text);
        let kept = false;
        for (const word of l.words ?? []) {
          const text = word.text.replace(BIDI_MARKS, '').trim();
          const { x0, y0, x1, y1 } = word.bbox;
          if (!text || x1 <= x0 || y1 <= y0) continue;
          out.push({ text, x: x0 / width, y: y0 / height, w: (x1 - x0) / width, h: (y1 - y0) / height, line, ...(rtl && { rtl: true as const }) });
          kept = true;
        }
        if (kept) line++;
      }
    }
  }
  return out;
}

/** One span of the OCR text layer, in page pixels. */
export interface OcrSpan {
  text: string;
  left: number;
  top: number;
  fontSize: number;
  /** Horizontal stretch so the word's glyphs span its box. */
  scaleX: number;
  rtl: boolean;
}

/**
 * The text layer for a page `pageW` x `pageH` pixels: one span per word, its font as tall as the
 * word's box and stretched to its width (`measure` gives a text's width at a font size), as
 * pdf.js lays out its own layer. Words of a line are followed by a space, so quotes have spaces.
 */
export function ocrSpans(words: OcrWord[], pageW: number, pageH: number, measure: (text: string, fontSize: number) => number): OcrSpan[] {
  return words.map((w, i) => {
    const fontSize = w.h * pageH;
    const natural = measure(w.text, fontSize);
    const lastInLine = words[i + 1]?.line !== w.line;
    return {
      text: lastInLine ? w.text : `${w.text} `,
      left: w.x * pageW,
      top: w.y * pageH,
      fontSize,
      scaleX: natural > 0 ? (w.w * pageW) / natural : 1,
      rtl: w.rtl === true
    };
  });
}

/**
 * A page's OCR text for Find, read the way the layer reads back (findHighlight.ts): the span texts
 * of `ocrSpans`, and a space for the `<br>` that ends each line.
 */
export function ocrPageText(words: OcrWord[]): string {
  return words.map((w) => `${w.text} `).join('');
}

const MAX_WORDS = 20000;
const fraction = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;

/** Whether `x` is a saved OCR page in the shape above (checked before it is written to disk). */
export function isValidOcrPage(x: unknown): x is OcrPage {
  if (!x || typeof x !== 'object') return false;
  const page = x as Record<string, unknown>;
  if (typeof page.langs !== 'string' || page.langs.length > 100 || typeof page.createdAt !== 'string' || page.createdAt.length > 40) return false;
  if (!Array.isArray(page.words) || page.words.length > MAX_WORDS) return false;
  return page.words.every((w: unknown) => {
    if (!w || typeof w !== 'object') return false;
    const word = w as Record<string, unknown>;
    return (
      typeof word.text === 'string' &&
      word.text.length > 0 &&
      word.text.length <= 200 &&
      [word.x, word.y, word.w, word.h].every(fraction) &&
      Number.isInteger(word.line) &&
      (word.line as number) >= 0 &&
      (word.rtl === undefined || word.rtl === true)
    );
  });
}
