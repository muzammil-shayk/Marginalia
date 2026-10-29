/**
 * Run with: npx tsx --test src/components/pdf/pageBox.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, degrees } from 'pdf-lib';
import { pageTransform } from './pageBox';

/** A 600x800 MediaBox whose visible CropBox is the 500x600 box at (50, 100). */
async function croppedPage(rotation = 0) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  page.setCropBox(50, 100, 500, 600);
  page.setRotation(degrees(rotation));
  const reloaded = await PDFDocument.load(await doc.save());
  return reloaded.getPage(0);
}

test('marks map into the CropBox, offset included, not the MediaBox at 0,0', async () => {
  const t = pageTransform(await croppedPage());
  assert.deepEqual(t.toPdf(0, 0), [50, 700]); // visual top-left
  assert.deepEqual(t.toPdf(1, 1), [550, 100]); // visual bottom-right
  assert.equal(t.pw, 500);
});

test('a rotated cropped page maps by the CropBox too', async () => {
  const t = pageTransform(await croppedPage(90));
  assert.equal(t.rotation, 90);
  assert.equal(t.pw, 600); // visual width is the crop height on a 90-degree page
  assert.deepEqual(t.toPdf(0, 0), [50, 100]);
  assert.deepEqual(t.toPdf(1, 1), [550, 700]);
});

test('an uncropped page still maps by its MediaBox', async () => {
  const doc = await PDFDocument.create();
  const t = pageTransform(doc.addPage([600, 800]));
  assert.deepEqual(t.toPdf(0, 0), [0, 800]);
  assert.deepEqual(t.toPdf(1, 1), [600, 0]);
});
