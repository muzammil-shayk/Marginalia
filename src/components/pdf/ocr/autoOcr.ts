/**
 * Reading scanned pages on their own while the reader looks at them: which pages, in what order,
 * and which pages OCR refuses (it reads English only). Pure; useAutoOcr.ts and ocrStore run it.
 */

import type { OcrWord } from '../../../utils/ocrWords';
import type { PageOcrStatus } from './ocrStore';

/** Every page in view plus the one before and after each, in order, inside 1..pageCount. */
export function autoOcrWindow(visible: number[], pageCount: number): number[] {
  const set = new Set<number>();
  for (const p of visible) for (const n of [p - 1, p, p + 1]) if (n >= 1 && n <= pageCount) set.add(n);
  return [...set].sort((a, b) => a - b);
}

/** The window's page to read next: nearest the current page, the later one on a tie; null if none needs it. */
export function autoOcrNext(s: { window: number[]; current: number; needs: (page: number) => boolean }): number | null {
  let best: number | null = null;
  for (const n of s.window) {
    if (!s.needs(n)) continue;
    const d = Math.abs(n - s.current);
    const bd = best === null ? Infinity : Math.abs(best - s.current);
    if (d < bd || (d === bd && n > best!)) best = n;
  }
  return best;
}

/** Primary language subtags written right to left. */
const RTL_LANGS = new Set(['ar', 'ur', 'fa', 'he', 'iw', 'ps', 'sd', 'ug', 'yi', 'ckb', 'dv', 'ks']);

/** Whether the PDF says it is a right-to-left document (its catalog /Lang, or /Direction R2L). */
export function isRtlDocument(meta: { language?: string | null; direction?: string | null }): boolean {
  const primary = (meta.language ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return RTL_LANGS.has(primary) || (meta.direction ?? '').toUpperCase() === 'R2L';
}

/** More than half the words read right to left. */
export function mostlyRtlWords(words: Pick<OcrWord, 'rtl'>[]): boolean {
  return words.length > 0 && words.filter((w) => w.rtl).length * 2 > words.length;
}

/** Why OCR will not read a page: a right-to-left book, or a text layer whose font has no letter map. */
export type OcrRefusal = 'rtl' | 'unmapped';

export const OCR_REFUSAL_TEXT: Record<OcrRefusal, string> = {
  rtl: "Urdu and other right-to-left books aren't supported yet.",
  unmapped: "This text can't be read: the PDF hides its letters."
};

/**
 * The one rule on whether OCR may read a page (every entry point asks it: a drag, Read pages, the
 * automatic read). English only, so never a right-to-left document (its /Lang or /Direction, or
 * pages an older version read came back mostly right to left), nor a page whose text has
 * characters but no letter map (usually Urdu in a legacy font; read in English it is garbage).
 */
export function ocrRefusal(s: { rtlDoc: boolean; rtlReadBefore: boolean; unmapped: boolean }): OcrRefusal | null {
  if (s.rtlDoc || s.rtlReadBefore) return 'rtl';
  return s.unmapped ? 'unmapped' : null;
}

/**
 * Whether a page in the window should be read: not read, not being read, not failed (no retry on
 * its own), not refused by `ocrRefusal`, and not known to have text. Unknown (not drawn yet)
 * counts: the store asks pdf.js for the page's text before any OCR.
 */
export function autoOcrNeeds(s: { textKnown: boolean | undefined; status: PageOcrStatus; refused?: boolean }): boolean {
  return s.textKnown !== true && s.status === 'idle' && !s.refused;
}
