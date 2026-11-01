/**
 * Find in document (Cmd+F) for every format: text paragraphs (TXT/EPUB/DOCX, split the way the
 * reader splits them) and PDF pages (each page's text-layer string, as the workspace builds it).
 *
 * Matching runs on a folded copy of the text (lower case, accents dropped, by default), but every
 * hit is reported as offsets into the ORIGINAL string, so the reader can scroll to it and wrap the
 * exact characters in a highlight. Pure and synchronous; nothing is cached between calls.
 */

export interface FindOptions {
  /** Exact case. Off by default. */
  matchCase?: boolean;
  /** Exact accents (é ≠ e). Off by default. */
  matchDiacritics?: boolean;
  /** Only hits with no letter, digit or underscore on either side. */
  wholeWord?: boolean;
}

/** `start`/`end` (exclusive) index the paragraph's original text. */
export interface ParagraphHit {
  paragraphIndex: number;
  start: number;
  end: number;
}

/** `page` is 1-based; `start`/`end` index that page's text-layer string. */
export interface PageHit {
  page: number;
  start: number;
  end: number;
}

interface Folded {
  text: string;
  /** Original start / end of the source character behind each folded character. Null = identity. */
  starts: number[] | null;
  ends: number[] | null;
}

const COMBINING = /\p{M}/u;
const WORD_CHAR = /[\p{L}\p{N}_]/u;
const ASCII_ONLY = /^[\x00-\x7f]*$/;

function foldPiece(piece: string, opts: FindOptions): string {
  let out = opts.matchDiacritics ? piece : piece.normalize('NFD').replace(/\p{M}/gu, '');
  if (!opts.matchCase) out = out.toLowerCase();
  return out;
}

function fold(text: string, opts: FindOptions): Folded {
  // Plain ASCII folds 1:1, which is most text and keeps long books fast.
  if (ASCII_ONLY.test(text)) return { text: opts.matchCase ? text : text.toLowerCase(), starts: null, ends: null };
  const pieces: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  const cache = new Map<string, string>();
  let i = 0;
  while (i < text.length) {
    // One character = a code point plus the combining marks that follow it.
    let j = i + (text.codePointAt(i)! > 0xffff ? 2 : 1);
    while (j < text.length && COMBINING.test(text[j])) j++;
    const seg = text.slice(i, j);
    let piece = cache.get(seg);
    if (piece === undefined) cache.set(seg, (piece = foldPiece(seg, opts)));
    for (let k = 0; k < piece.length; k++) {
      starts.push(i);
      ends.push(j);
    }
    pieces.push(piece);
    i = j;
  }
  return { text: pieces.join(''), starts, ends };
}

function isWordAt(text: string, index: number): boolean {
  return index >= 0 && index < text.length && WORD_CHAR.test(text[index]);
}

function findInUnits(units: string[], query: string, opts: FindOptions): { index: number; start: number; end: number }[] {
  if (!query || !query.trim()) return [];
  const needle = fold(query, opts).text;
  if (!needle) return [];
  const hits: { index: number; start: number; end: number }[] = [];
  units.forEach((unit, index) => {
    if (!unit) return;
    const f = fold(unit, opts);
    let at = f.text.indexOf(needle);
    while (at !== -1) {
      const last = at + needle.length - 1;
      const start = f.starts ? f.starts[at] : at;
      const end = f.ends ? f.ends[last] : last + 1;
      if (!opts.wholeWord || (!isWordAt(unit, start - 1) && !isWordAt(unit, end))) {
        hits.push({ index, start, end });
        at = f.text.indexOf(needle, at + needle.length);
      } else {
        at = f.text.indexOf(needle, at + 1);
      }
    }
  });
  return hits;
}

/** Every hit across the paragraphs, in reading order, non-overlapping. */
export function findInParagraphs(paragraphs: string[], query: string, opts: FindOptions = {}): ParagraphHit[] {
  return findInUnits(paragraphs, query, opts).map(({ index, start, end }) => ({ paragraphIndex: index, start, end }));
}

/** Every hit across the PDF's page texts (index 0 = page 1), in reading order, non-overlapping. */
export function findInPages(pageTexts: string[], query: string, opts: FindOptions = {}): PageHit[] {
  return findInUnits(pageTexts, query, opts).map(({ index, start, end }) => ({ page: index + 1, start, end }));
}
