/**
 * OCR for the UI: the app's one OCR store (tesseract.js engine, results saved on disk through the
 * server) and the hooks a button uses. OCR runs only from `run()`; nothing starts on its own.
 *
 *   const ocr = usePageOcr(docId, pageNumber);   // ocr.status, ocr.progress, ocr.error, ocr.run(), ocr.cancel()
 *   const all = useDocumentOcr(docId);           // all.status, all.done / all.total, all.run(), all.cancel()
 *
 * Read pages get a selectable text layer over the page image (PdfPage), so highlight, underline,
 * strikeout and quotes work on them as on any PDF with text.
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { OcrPage } from '../../../utils/ocrWords';
import { createOcrStore, type DocOcrState, type PageOcrState } from './ocrStore';
import { tesseractEngine } from './tesseractEngine';

export type { PageOcrState, PageOcrStatus, DocOcrState } from './ocrStore';

async function fetchPages(docId: string): Promise<Record<number, OcrPage>> {
  const res = await fetch(`/api/documents/${docId}/ocr`);
  if (!res.ok) throw new Error(`OCR could not be loaded (${res.status})`);
  return (await res.json()).pages ?? {};
}

async function savePage(docId: string, page: number, data: OcrPage): Promise<void> {
  const res = await fetch(`/api/documents/${docId}/ocr/${page}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('The text was read but could not be saved.');
}

export const ocrStore = createOcrStore(tesseractEngine, { fetchPages, savePage });

const IDLE_PAGE: PageOcrState = { status: 'idle', progress: 0, words: [] };

/** One page's OCR: its state and the actions for a "Read this page" button. */
export function usePageOcr(docId: string | null | undefined, pageNumber: number): PageOcrState & { run: () => Promise<void>; cancel: () => void } {
  const state = useSyncExternalStore(ocrStore.subscribe, () => (docId ? ocrStore.page(docId, pageNumber) : IDLE_PAGE));
  const run = useCallback(() => (docId ? ocrStore.runPage(docId, pageNumber) : Promise.resolve()), [docId, pageNumber]);
  const cancel = useCallback(() => {
    if (docId) ocrStore.cancel(docId);
  }, [docId]);
  return { ...state, run, cancel };
}

const IDLE_DOC: DocOcrState = { status: 'idle', done: 0, total: 0 };

/** The whole document's OCR: every page without text, in order, for a "Read all pages" button. */
export function useDocumentOcr(docId: string | null | undefined): DocOcrState & { run: () => Promise<void>; cancel: () => void } {
  const state = useSyncExternalStore(ocrStore.subscribe, () => (docId ? ocrStore.doc(docId) : IDLE_DOC));
  const run = useCallback(() => (docId ? ocrStore.runDocument(docId) : Promise.resolve()), [docId]);
  const cancel = useCallback(() => {
    if (docId) ocrStore.cancel(docId);
  }, [docId]);
  return { ...state, run, cancel };
}
