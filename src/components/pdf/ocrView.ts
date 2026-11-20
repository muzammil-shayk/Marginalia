/**
 * What the "make text selectable" controls say for each OCR state (ocr/usePageOcr.ts). Pure, so
 * the wording and which control shows are tested (ocrView.test.ts); OcrControls.tsx draws them.
 */

import type { DocOcrState, PageOcrState } from './ocr/ocrStore';

/** Said wherever OCR is offered: true about what it can and cannot do. */
export const OCR_ACCURACY =
  'English scans are read accurately. Urdu (Nastaliq) scans: highlights land on the right lines, but the recognised words, and so Find, may be inaccurate.';
export const OCR_PAGES_NOTE = 'Inserting or deleting a page clears the read text for this document; read it again afterwards.';

export type PageOcrView =
  | { kind: 'hidden' }
  | { kind: 'offer'; label: string }
  | { kind: 'running'; label: string; percent: number }
  | { kind: 'error'; label: string; detail: string };

/** A scanned page's control. Hidden once the page has text of its own or has been read. */
export function pageOcrView(s: Pick<PageOcrState, 'status' | 'progress' | 'error'>): PageOcrView {
  if (s.status === 'has-text' || s.status === 'done') return { kind: 'hidden' };
  if (s.status === 'running') {
    const percent = Math.round(Math.min(1, Math.max(0, s.progress)) * 100);
    return { kind: 'running', label: `Reading this page… ${percent}%`, percent };
  }
  if (s.status === 'error') return { kind: 'error', label: 'Could not read this page', detail: s.error || 'Something went wrong.' };
  return { kind: 'offer', label: 'Make text selectable' };
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
