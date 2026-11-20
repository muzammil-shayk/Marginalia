/**
 * Run with: npx tsx --test src/components/pdf/ocrView.test.ts
 *
 * What the "make text selectable" controls show and say for each OCR state (ocrView.ts).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OCR_ACCURACY, OCR_PAGES_NOTE, docOcrView, pageOcrView } from './ocrView';

test('page control: offered on a scanned page, gone once it has text or was read', () => {
  assert.deepEqual(pageOcrView({ status: 'idle', progress: 0 }), { kind: 'offer', label: 'Make text selectable' });
  assert.equal(pageOcrView({ status: 'has-text', progress: 0 }).kind, 'hidden');
  assert.equal(pageOcrView({ status: 'done', progress: 1 }).kind, 'hidden');
});

test('page control: progress as a whole percent, clamped; errors keep their detail for Try again', () => {
  assert.deepEqual(pageOcrView({ status: 'running', progress: 0.416 }), { kind: 'running', label: 'Reading this page… 42%', percent: 42 });
  assert.equal((pageOcrView({ status: 'running', progress: 1.4 }) as { percent: number }).percent, 100);
  assert.deepEqual(pageOcrView({ status: 'error', progress: 0, error: 'The text was read but could not be saved.' }), {
    kind: 'error',
    label: 'Could not read this page',
    detail: 'The text was read but could not be saved.'
  });
});

test('document control: page n of N while reading, done, and errors that say what is kept', () => {
  assert.deepEqual(docOcrView({ status: 'idle', done: 0, total: 0 }), { kind: 'offer', label: 'Make whole document selectable' });
  assert.deepEqual(docOcrView({ status: 'running', done: 2, total: 8 }), { kind: 'running', label: 'Reading page 3 of 8', percent: 25 });
  // The last step reports done === total before the run ends: never "page 9 of 8".
  assert.equal(docOcrView({ status: 'running', done: 8, total: 8 }).label, 'Reading page 8 of 8');
  assert.equal(docOcrView({ status: 'done', done: 8, total: 8 }).label, 'Done: every page of 8 can be selected');
  const err = docOcrView({ status: 'error', done: 8, total: 8, error: '2 pages could not be read' });
  assert.equal(err.kind, 'error');
  assert.equal(err.label, '2 pages could not be read');
});

test('the copy is honest about Urdu scans and about page edits', () => {
  assert.match(OCR_ACCURACY, /English scans are read accurately/);
  assert.match(OCR_ACCURACY, /Urdu \(Nastaliq\).*right lines.*may be inaccurate/);
  assert.match(OCR_PAGES_NOTE, /Inserting or deleting a page clears/);
});
