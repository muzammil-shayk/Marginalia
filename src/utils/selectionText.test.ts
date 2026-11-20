/**
 * Run with: npx tsx --test src/utils/selectionText.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteFromFragments, type TextFragment } from './selectionText';

/** One fragment per pdf.js span, as a PDF lays them out: x, width; one line unless `y` is given. */
const frag = (text: string, x: number, w: number, y = 100, h = 20): TextFragment => ({ text, x, y, w, h });

test('an Urdu line whose runs come left to right on the page is quoted right to left', () => {
  // Real producers (LibreOffice, Word) write Arabic-script runs in visual order: the last word
  // of the line comes first. pdf.js gives each run in reading order, but the runs stay as drawn.
  const line = [frag('اور', 100, 30), frag(' ', 130, 5), frag('تھی', 135, 30), frag(' ', 165, 5), frag('شام', 170, 30)];
  assert.equal(quoteFromFragments(line), 'شام تھی اور');
});

test('an English line keeps its order', () => {
  assert.equal(quoteFromFragments([frag('Who said:', 40, 60), frag(' ', 100, 4), frag('Two vast', 104, 60)]), 'Who said: Two vast');
});

test('lines follow each other, each in its own direction, joined by a space', () => {
  const quote = quoteFromFragments([
    frag('اور', 100, 30, 100),
    frag(' ', 130, 5, 100),
    frag('شام', 135, 30, 100),
    frag('ہم', 150, 20, 130),
    frag(' ', 170, 5, 130),
    frag('دریا', 175, 30, 130)
  ]);
  assert.equal(quote, 'شام اور دریا ہم');
});

test('a run of Nastaliq glyphs sitting a little higher or lower stays on its line', () => {
  // Nastaliq slopes: pdf.js boxes of one line rise and fall by part of a line height.
  const line = [frag('اور', 100, 30, 108), frag(' ', 130, 5, 100), frag('شام', 135, 30, 94)];
  assert.equal(quoteFromFragments(line), 'شام اور');
});

test('control characters from glyphs with no Unicode are dropped', () => {
  assert.equal(quoteFromFragments([frag('ت\u0000\u0003', 100, 10), frag('\u0007', 110, 0), frag('ھے', 112, 20)]), 'ھےت');
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
