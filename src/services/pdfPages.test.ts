/**
 * Run with: npx tsx --test src/services/pdfPages.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName } from 'pdf-lib';
import { insertBlankPages, removePdfPage, PageEditError } from './pdfPages';
import type { StoredAnnotation } from './storage/types';

async function pdfWithPages(count: number, encrypted = false): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < count; i++) doc.addPage([600, 800]);
  if (encrypted) {
    // pdf-lib cannot encrypt; a trailer /Encrypt entry is what `isEncrypted` (and every reader) checks.
    doc.context.trailerInfo.Encrypt = doc.context.register(doc.context.obj({ Filter: PDFName.of('Standard') }));
  }
  return Buffer.from(await doc.save());
}

const marks = (...pages: number[]) => pages.map((page, i) => ({ id: `m${i}`, page }) as StoredAnnotation);
const pagesOf = (list: StoredAnnotation[]) => list.map((a) => a.page);

test('inserting after page 1 adds a page and shifts the marks after it', async () => {
  const out = await insertBlankPages(
    { pdf: await pdfWithPages(2), filename: 'b.pdf', annotations: marks(1, 2) },
    { placement: 'after', anchorPage: 1, height: 'full' }
  );
  assert.deepEqual(pagesOf(out.annotations), [1, 3]);
  assert.deepEqual(out.result, { insertedPages: [2], pageCount: 3 });
  assert.equal((await PDFDocument.load(out.pdf)).getPageCount(), 3);
});

test('both-ends inserts at the start and the end and shifts every mark by one', async () => {
  const out = await insertBlankPages(
    { pdf: await pdfWithPages(2), filename: 'b.pdf', annotations: marks(1, 2) },
    { placement: 'both-ends', height: 'notes' }
  );
  assert.deepEqual(pagesOf(out.annotations), [2, 3]);
  assert.deepEqual(out.result, { insertedPages: [1, 4], pageCount: 4 });
});

test('removing a page drops its marks and shifts later ones down', async () => {
  const out = await removePdfPage({ pdf: await pdfWithPages(3), filename: 'b.pdf', annotations: marks(1, 2, 3) }, 2);
  assert.deepEqual(pagesOf(out.annotations), [1, 2]);
  assert.deepEqual(out.result, { pageCount: 2 });
});

test('page edits on an encrypted PDF are refused with a clear 400', async () => {
  const input = { pdf: await pdfWithPages(2, true), filename: 'b.pdf', annotations: [] };
  for (const run of [
    () => insertBlankPages(input, { placement: 'after', anchorPage: 1, height: 'full' }),
    () => removePdfPage(input, 1)
  ]) {
    await assert.rejects(run(), (err: unknown) => {
      assert.ok(err instanceof PageEditError);
      assert.equal(err.status, 400);
      assert.match(err.message, /encrypted/i);
      return true;
    });
  }
});

test('page edits refuse a non-PDF, a missing page and the last page', async () => {
  const one = await pdfWithPages(1);
  await assert.rejects(removePdfPage({ pdf: one, filename: 'b.epub', annotations: [] }, 1), PageEditError);
  await assert.rejects(removePdfPage({ pdf: one, filename: 'b.pdf', annotations: [] }, 2), /doesn't exist/);
  await assert.rejects(removePdfPage({ pdf: one, filename: 'b.pdf', annotations: [] }, 1), /only page/);
});
