/**
 * Run with: npx tsx --test src/utils/selectionText.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteFromFragments, unreadableSelectionPage, type TextFragment } from './selectionText';

/** One fragment per pdf.js span, as a PDF lays them out: x, width; one line unless `y` is given. */
const frag = (text: string, x: number, w: number, y = 100, h = 20): TextFragment => ({ text, x, y, w, h });

test('every line keeps the order the PDF gives its runs, whatever the script (no right-to-left reordering)', () => {
  const line = [frag('اور', 100, 30), frag(' ', 130, 5), frag('تھی', 135, 30), frag(' ', 165, 5), frag('شام', 170, 30)];
  assert.equal(quoteFromFragments(line), 'اور تھی شام');
});

test('lines follow each other joined by a space; a run sitting a little higher or lower stays on its line', () => {
  const quote = quoteFromFragments([frag('Two', 100, 30, 108), frag(' ', 130, 5, 100), frag('vast', 135, 30, 94), frag('and', 100, 30, 130), frag(' trunkless', 130, 60, 130)]);
  assert.equal(quote, 'Two vast and trunkless');
});

test('an English line keeps its order', () => {
  assert.equal(quoteFromFragments([frag('Who said:', 40, 60), frag(' ', 100, 4), frag('Two vast', 104, 60)]), 'Who said: Two vast');
});

test('control characters from glyphs with no Unicode are dropped', () => {
  assert.equal(quoteFromFragments([frag('ت\u0000\u0003', 100, 10), frag('\u0007', 110, 0), frag('ھے', 112, 20)]), 'تھے');
  assert.equal(quoteFromFragments([frag('lo\u0000ve', 10, 40)]), 'love');
});

test('two columns side by side are not interleaved', () => {
  // Document order reads the left column, then the right; a drag across both keeps that order.
  const quote = quoteFromFragments([frag('left one', 40, 80, 100), frag('left two', 40, 80, 130), frag('right one', 300, 80, 100)]);
  assert.equal(quote, 'left one left two right one');
});

test('nothing selected gives an empty quote', () => {
  assert.equal(quoteFromFragments([]), '');
  assert.equal(quoteFromFragments([frag('  ', 10, 5), frag('\u0000', 15, 0)]), '');
});

test('a drag that selected only unreadable characters on a page with text is reported, never dropped silently', () => {
  // A font with no letter map: rects, but no quote.
  assert.equal(unreadableSelectionPage([{ page: 3, quote: '', rects: 2, noText: false }]), 3);
  // Something was marked: nothing to report.
  assert.equal(unreadableSelectionPage([{ page: 3, quote: '', rects: 2, noText: false }, { page: 4, quote: 'Red', rects: 1, noText: false }]), null);
  // A page with no text is read by OCR on the press (PdfPage), which shows its own progress.
  assert.equal(unreadableSelectionPage([{ page: 3, quote: '', rects: 2, noText: true }]), null);
  // Nothing on the page was selected.
  assert.equal(unreadableSelectionPage([{ page: 3, quote: '', rects: 0, noText: false }]), null);
  assert.equal(unreadableSelectionPage([]), null);
});
