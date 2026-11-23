/**
 * What the "make text selectable" controls say for each OCR state (ocr/usePageOcr.ts). Pure, so
 * the wording and which control shows are tested (ocrView.test.ts); OcrControls.tsx draws them.
 */

import type { DocOcrState, PageOcrState } from './ocr/ocrStore';
import type { PdfTool } from './annotationModel';
import { hasReadableText } from './textMarking';
import { OCR_REFUSAL_TEXT } from './ocr/autoOcr';

/** Said wherever OCR is offered: true about what it can and cannot do. */
export const OCR_ACCURACY = `English scans are read accurately. ${OCR_REFUSAL_TEXT.rtl}`;
/** A drag that selected only characters with no letters (a PDF font with no letter map): selection capture. */
export const UNREADABLE_SELECTION = OCR_REFUSAL_TEXT.unmapped;
export const OCR_PAGES_NOTE = 'Inserting or deleting a page clears the read text for this document; read it again afterwards.';

export type PageOcrView =
  | { kind: 'hidden' }
  | { kind: 'running'; label: string; percent: number }
  | { kind: 'error'; label: string; detail: string }
  | { kind: 'note'; label: string };

/**
 * A scanned page's status over the page. Nothing at rest: selecting on the page reads it
 * (`readsOnSelect`), and only that read shows, as small progress or a quiet error.
 */
export function pageOcrView(s: Pick<PageOcrState, 'status' | 'progress' | 'error' | 'refusal'>): PageOcrView {
  if (s.status === 'unsupported') return { kind: 'note', label: OCR_REFUSAL_TEXT[s.refusal ?? 'rtl'] };
  if (s.status === 'has-text' || s.status === 'done') return { kind: 'hidden' };
  if (s.status === 'running') {
    const percent = Math.round(Math.min(1, Math.max(0, s.progress)) * 100);
    return { kind: 'running', label: `Reading this page… ${percent}%`, percent };
  }
  if (s.status === 'error') return { kind: 'error', label: 'Could not read this page', detail: s.error || 'Something went wrong.' };
  return { kind: 'hidden' };
}

/** Tools that act on selected words, so a drag with them on a scan means "these words". */
const SELECTING_TOOLS: readonly PdfTool[] = ['select', 'highlight', 'underline', 'strikeout', 'terminology', 'maskWords'];

/**
 * Whether a press on a page should read it by OCR first: a primary-button press with a tool that
 * selects words, on a page known to have no text, not read and not being read. Pure.
 */
export function readsOnSelect(s: { hasText: boolean | null; tool: PdfTool; status: PageOcrState['status']; button: number }): boolean {
  return s.hasText === false && SELECTING_TOOLS.includes(s.tool) && s.button === 0 && (s.status === 'idle' || s.status === 'error');
}

export type DocOcrView =
  | { kind: 'offer'; label: string }
  | { kind: 'running'; label: string; percent: number }
  | { kind: 'done'; label: string }
  | { kind: 'error'; label: string; detail: string };

/** The whole document's control. */
export function docOcrView(s: Pick<DocOcrState, 'status' | 'done' | 'total' | 'error'>): DocOcrView {
  const total = Math.max(0, s.total);
  if (s.status === 'running') {
    const percent = total ? Math.round((s.done / total) * 100) : 0;
    return { kind: 'running', label: `Reading page ${Math.min(s.done + 1, total || 1)} of ${total || '…'}`, percent };
  }
  if (s.status === 'done') return { kind: 'done', label: `Done: every page of ${total} can be selected` };
  if (s.status === 'error') return { kind: 'error', label: s.error || 'Some pages could not be read', detail: 'Pages already read keep their text. Try again for the rest.' };
  return { kind: 'offer', label: 'Make whole document selectable' };
}

/** How many pages Find cannot search: no text of their own (`raw`, by index) and not read by OCR. Pure. */
export function unreadScanPages(raw: string[], isRead: (page: number) => boolean): number {
  return raw.reduce((n, text, i) => (!hasReadableText(text) && !isRead(i + 1) ? n + 1 : n), 0);
}

/** What Find searches on a page: its own text, or its OCR words when its own text has no letters. Pure. */
export function pageSearchText(raw: string, ocrText: () => string): string {
  return hasReadableText(raw) ? raw : ocrText();
}

/**
 * Find's one quiet line about pages it cannot search yet (no text of their own, not read by OCR),
 * with the action that reads them. Said on a mostly scanned document, or when the search found
 * nothing; a book with text and a few covers or blank pages is not nagged on every search. Pure.
 */
export function findScanNote(
  unread: number,
  run: Pick<DocOcrState, 'status' | 'done' | 'total' | 'error'>,
  search: { hits: number; pages: number; query?: string }
): { text: string; action: string | null } | null {
  if (run.status === 'running') {
    return { text: `Reading scanned pages: page ${Math.min(run.done + 1, run.total || 1)} of ${run.total || '…'}`, action: null };
  }
  if (unread <= 0 && run.status === 'error' && run.error) return { text: run.error, action: null };
  const mostlyScans = unread * 2 >= search.pages;
  const foundNothing = search.hits === 0 && (search.query ?? 'x').trim() !== '';
  if (unread <= 0 || !(mostlyScans || foundNothing)) return null;
  return { text: unread === 1 ? '1 page has no text to search yet.' : `${unread} pages have no text to search yet.`, action: 'Read pages' };
}
