/**
 * Run with: npx tsx --test src/components/pdf/ocrView.test.ts
 *
 * What the "make text selectable" controls show and say for each OCR state (ocrView.ts).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PdfTool } from './annotationModel';
import { OCR_ACCURACY, OCR_PAGES_NOTE, UNREADABLE_SELECTION, docOcrView, findScanNote, pageOcrView, pageSearchText, readsOnSelect, unreadScanPages } from './ocrView';
import { OCR_REFUSAL_TEXT } from './ocr/autoOcr';

test('page status: nothing on a scanned page at rest (no button over the page), nothing once read', () => {
  assert.deepEqual(pageOcrView({ status: 'idle', progress: 0 }), { kind: 'hidden' });
  assert.equal(pageOcrView({ status: 'has-text', progress: 0 }).kind, 'hidden');
  assert.equal(pageOcrView({ status: 'done', progress: 1 }).kind, 'hidden');
});

test('selecting on a scanned page reads it: only a primary-button drag with a selecting tool, on a page with no text not read yet', () => {
  const scan = { hasText: false, tool: 'highlight' as const, status: 'idle' as const, button: 0 };
  assert.equal(readsOnSelect(scan), true);
  // A failed read is tried again by the next attempt.
  assert.equal(readsOnSelect({ ...scan, status: 'error' }), true);
  assert.equal(readsOnSelect({ ...scan, hasText: true }), false);
  // Not known yet (the text layer has not been looked at): never guess.
  assert.equal(readsOnSelect({ ...scan, hasText: null }), false);
  assert.equal(readsOnSelect({ ...scan, status: 'running' }), false);
  assert.equal(readsOnSelect({ ...scan, status: 'done' }), false);
  assert.equal(readsOnSelect({ ...scan, status: 'has-text' }), false);
  assert.equal(readsOnSelect({ ...scan, button: 2 }), false);
});

test('selecting on a scanned page reads it only for tools that select text', () => {
  const at = (tool: PdfTool) => readsOnSelect({ hasText: false, tool, status: 'idle', button: 0 });
  for (const tool of ['select', 'highlight', 'underline', 'strikeout', 'terminology', 'maskWords'] as PdfTool[]) assert.equal(at(tool), true, tool);
  // Erase and Area act on the page, not on words; drawing tools draw.
  for (const tool of ['erase', 'area', 'ink', 'inkArrow', 'mask', 'maskPen', 'note', 'rect', 'ellipse', 'arrow', 'line', 'bracket', 'text'] as PdfTool[]) assert.equal(at(tool), false, tool);
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

test('the copy is honest: English scans only, right-to-left books not yet; and about page edits', () => {
  assert.match(OCR_ACCURACY, /English scans are read accurately/);
  assert.match(OCR_ACCURACY, /right-to-left books aren.t supported yet/);
  assert.match(OCR_PAGES_NOTE, /Inserting or deleting a page clears/);
});

test('Find: pages with no text of their own and not read yet are the ones Find cannot search', () => {
  const raw = ['Page one words', '', '   ', 'more', ''];
  // Page 3 (index 2) was read by OCR.
  assert.equal(unreadScanPages(raw, (n) => n === 3), 2);
  assert.equal(unreadScanPages(raw, () => true), 0);
  assert.equal(unreadScanPages(['a', 'b'], () => false), 0);
  // A font with no letter map gives only control characters: nothing Find can search.
  assert.equal(unreadScanPages(['\u0001\u0002 \u0003', 'a'], () => false), 1);
});

test('Find: one quiet line about pages with no text, with Read pages; progress while reading; nothing when all are searchable', () => {
  const idle = { status: 'idle' as const, done: 0, total: 0 };
  // A scanned book (most pages unread): always said, hits or not.
  assert.equal(findScanNote(0, idle, { hits: 0, pages: 10 }), null);
  assert.deepEqual(findScanNote(1, idle, { hits: 0, pages: 1 }), { text: '1 page has no text to search yet.', action: 'Read pages' });
  assert.deepEqual(findScanNote(12, idle, { hits: 3, pages: 20 }), { text: '12 pages have no text to search yet.', action: 'Read pages' });
  assert.deepEqual(findScanNote(12, idle, { hits: 3, pages: 30 }), null);
  // A book with text and a few covers or blank pages: only when the search found nothing.
  assert.deepEqual(findScanNote(2, idle, { hits: 0, pages: 300 }), { text: '2 pages have no text to search yet.', action: 'Read pages' });
  assert.equal(findScanNote(2, idle, { hits: 5, pages: 300 }), null);
  assert.deepEqual(findScanNote(12, { status: 'running', done: 2, total: 30 }, { hits: 3, pages: 300 }), { text: 'Reading scanned pages: page 3 of 30', action: null });
  // A failed run leaves pages unread: offered again.
  assert.equal(findScanNote(2, { status: 'error', done: 30, total: 30 }, { hits: 0, pages: 30 })?.action, 'Read pages');
  // Nothing typed yet is not "found nothing": a book with text says nothing; a scanned one still does.
  assert.equal(findScanNote(2, idle, { hits: 0, pages: 300, query: '  ' }), null);
  assert.equal(findScanNote(758, idle, { hits: 0, pages: 758, query: '' })?.action, 'Read pages');
  // Nothing left to read, and the run said why (a right-to-left book): that line, nothing to press.
  const refused = { status: 'error' as const, done: 758, total: 758, error: OCR_REFUSAL_TEXT.rtl };
  assert.deepEqual(findScanNote(0, refused, { hits: 0, pages: 758, query: 'x' }), { text: OCR_REFUSAL_TEXT.rtl, action: null });
});

test('a page OCR refuses shows one short muted line after the reader tried; never a button', () => {
  assert.deepEqual(pageOcrView({ status: 'unsupported', progress: 0, refusal: 'rtl' }), { kind: 'note', label: OCR_REFUSAL_TEXT.rtl });
  assert.deepEqual(pageOcrView({ status: 'unsupported', progress: 0, refusal: 'unmapped' }), { kind: 'note', label: UNREADABLE_SELECTION });
  assert.equal(readsOnSelect({ hasText: false, tool: 'highlight', status: 'unsupported', button: 0 }), false);
});

test('Find searches a page\'s own text, or its OCR words when its own text holds no letters', () => {
  assert.equal(pageSearchText('Red sky', () => 'ocr'), 'Red sky');
  assert.equal(pageSearchText('  ', () => 'ocr words'), 'ocr words');
  assert.equal(pageSearchText('\u0001\u0002 \u0003', () => 'میں بہت'), 'میں بہت');
});

test('a drag over letters the PDF hides gets one short, plain line', () => {
  assert.match(UNREADABLE_SELECTION, /can.t be read/);
  assert.ok(UNREADABLE_SELECTION.length < 80);
});
