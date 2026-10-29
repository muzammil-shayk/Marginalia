/**
 * The page edits behind `POST /api/documents/:id/pages` and `DELETE /api/documents/:id/pages/:n`,
 * as pure transforms of (PDF bytes, marks). The store runs them inside the document's lock via
 * `editPdfPages`, which writes the result back as one crash-safe step.
 */

import path from 'path';
import { PDFDocument } from 'pdf-lib';
import type { PdfPageEditInput, PdfPageEditOutput } from './storage/types';

/** A refusal the route reports to the reader as-is, with this HTTP status. */
export class PageEditError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/**
 * Loads the stored PDF for editing, refusing what must not be rewritten.
 *
 * Encrypted PDFs are refused: pdf-lib can only open them by ignoring the encryption, and saving
 * then writes a file whose strings and streams no longer decrypt — a broken copy of the reader's
 * book in place of the real one.
 */
async function loadEditable(input: PdfPageEditInput, action: string): Promise<PDFDocument> {
  if (path.extname(input.filename).toLowerCase() !== '.pdf') {
    throw new PageEditError(`Only PDF documents support ${action}.`);
  }
  const pdfDoc = await PDFDocument.load(input.pdf, { ignoreEncryption: true });
  if (pdfDoc.isEncrypted) {
    throw new PageEditError(
      'This PDF is encrypted (password-protected or copy-protected), so its pages cannot be changed without damaging it.'
    );
  }
  if (pdfDoc.getPageCount() === 0) throw new PageEditError('This PDF has no pages.');
  return pdfDoc;
}

/**
 * Inserts a blank page before/after `anchorPage`, or one at each end for 'both-ends'. Its width
 * matches the page it sits next to; `height` picks full, header (1.5in) or notes (3.5in).
 */
export async function insertBlankPages(
  input: PdfPageEditInput,
  options: { placement: 'before' | 'after' | 'both-ends'; anchorPage?: number; height: 'full' | 'header' | 'notes' }
): Promise<PdfPageEditOutput<{ insertedPages: number[]; pageCount: number }>> {
  const pdfDoc = await loadEditable(input, 'inserted pages');
  const pageCountBefore = pdfDoc.getPageCount();
  const referenceIndex = Math.min(Math.max((options.anchorPage || 1) - 1, 0), pageCountBefore - 1);
  const { width, height: fullHeight } = pdfDoc.getPage(referenceIndex).getSize();
  const insertHeight = options.height === 'full' ? fullHeight : options.height === 'header' ? 108 : 252;

  let insertedPages: number[];
  if (options.placement === 'both-ends') {
    pdfDoc.insertPage(0, [width, insertHeight]);
    pdfDoc.addPage([width, insertHeight]);
    insertedPages = [1, pdfDoc.getPageCount()];
  } else {
    const index0 = options.placement === 'before' ? referenceIndex : referenceIndex + 1;
    pdfDoc.insertPage(index0, [width, insertHeight]);
    insertedPages = [index0 + 1];
  }

  // Only a page inserted at the start (or before/after a page) shifts existing marks; one
  // appended at the end is after all of them.
  const shiftFrom = options.placement === 'both-ends' ? 1 : insertedPages[0];
  const annotations = input.annotations.map((a) =>
    typeof a.page === 'number' && a.page >= shiftFrom ? { ...a, page: a.page + 1 } : a
  );
  return { pdf: await pdfDoc.save(), annotations, result: { insertedPages, pageCount: pdfDoc.getPageCount() } };
}

/** Removes one page; marks on it go with it and later marks shift down. Never the last page. */
export async function removePdfPage(
  input: PdfPageEditInput,
  pageNumber: number
): Promise<PdfPageEditOutput<{ pageCount: number }>> {
  const pdfDoc = await loadEditable(input, 'removing pages');
  const pageCountBefore = pdfDoc.getPageCount();
  if (pageNumber > pageCountBefore) throw new PageEditError("That page doesn't exist.");
  if (pageCountBefore <= 1) throw new PageEditError("Can't remove the only page left. Delete the document instead.");

  pdfDoc.removePage(pageNumber - 1);
  const annotations = input.annotations
    .filter((a) => typeof a.page !== 'number' || a.page !== pageNumber)
    .map((a) => (typeof a.page === 'number' && a.page > pageNumber ? { ...a, page: a.page - 1 } : a));
  return { pdf: await pdfDoc.save(), annotations, result: { pageCount: pdfDoc.getPageCount() } };
}
