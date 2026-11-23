/**
 * Run with: npx tsx --test src/components/pdf/ocr/autoOcr.test.ts
 *
 * Which scanned pages are read on their own while the reader looks at them (autoOcr.ts).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoOcrNeeds, autoOcrNext, autoOcrWindow, isRtlDocument, mostlyRtlWords, ocrRefusal } from './autoOcr';

test('the window is every page in view plus the page before and after each, inside the document', () => {
  assert.deepEqual(autoOcrWindow([5], 10), [4, 5, 6]);
  assert.deepEqual(autoOcrWindow([1, 2], 10), [1, 2, 3]);
  assert.deepEqual(autoOcrWindow([10], 10), [9, 10]);
  // Book view or a grid: several pages at once.
  assert.deepEqual(autoOcrWindow([3, 4, 5, 6], 10), [2, 3, 4, 5, 6, 7]);
  // Collapsed strips: pages far apart, each with its neighbours.
  assert.deepEqual(autoOcrWindow([2, 9], 10), [1, 2, 3, 8, 9, 10]);
  assert.deepEqual(autoOcrWindow([], 10), []);
});

test('next page to read: the one nearest the current page that still needs it; nothing when none does', () => {
  const needs = (pages: number[]) => (n: number) => pages.includes(n);
  assert.equal(autoOcrNext({ window: [4, 5, 6], current: 5, needs: needs([4, 5, 6]) }), 5);
  // Ties: the page after (reading goes forward).
  assert.equal(autoOcrNext({ window: [4, 5, 6], current: 5, needs: needs([4, 6]) }), 6);
  assert.equal(autoOcrNext({ window: [4, 5, 6], current: 5, needs: needs([4]) }), 4);
  assert.equal(autoOcrNext({ window: [4, 5, 6], current: 5, needs: needs([]) }), null);
  // A page scrolled far past is not in the window: never read.
  assert.equal(autoOcrNext({ window: [4, 5, 6], current: 5, needs: needs([40]) }), null);
});

test('a scanned document in a right-to-left language (Urdu and others) is never read on its own', () => {
  assert.equal(isRtlDocument({ language: 'ur' }), true);
  assert.equal(isRtlDocument({ language: 'ur-PK' }), true);
  assert.equal(isRtlDocument({ language: 'AR' }), true);
  assert.equal(isRtlDocument({ language: 'fa' }), true);
  assert.equal(isRtlDocument({ direction: 'R2L' }), true);
  assert.equal(isRtlDocument({ language: 'en-US', direction: 'L2R' }), false);
  assert.equal(isRtlDocument({}), false);
  // "urd"-like codes that are not Urdu: only the primary subtag counts.
  assert.equal(isRtlDocument({ language: 'uri' }), false);
});

test('a read page that came back mostly right-to-left marks the document as one not to read on its own', () => {
  const w = (rtl: boolean) => ({ text: 'x', x: 0, y: 0, w: 0.1, h: 0.1, line: 0, ...(rtl && { rtl }) });
  assert.equal(mostlyRtlWords([w(true), w(true), w(false)]), true);
  assert.equal(mostlyRtlWords([w(true), w(false), w(false)]), false);
  assert.equal(mostlyRtlWords([]), false);
});

test('a page needs reading when it is not read, not being read, not failed, and not known to have text (unknown is checked first by the store)', () => {
  assert.equal(autoOcrNeeds({ textKnown: false, status: 'idle' }), true);
  // Not drawn yet (a neighbour): the store asks pdf.js for its text before any OCR.
  assert.equal(autoOcrNeeds({ textKnown: undefined, status: 'idle' }), true);
  assert.equal(autoOcrNeeds({ textKnown: true, status: 'idle' }), false);
  assert.equal(autoOcrNeeds({ textKnown: false, status: 'done' }), false);
  assert.equal(autoOcrNeeds({ textKnown: false, status: 'running' }), false);
  // A failed page is not tried again on its own (the reader can, by selecting on it).
  assert.equal(autoOcrNeeds({ textKnown: false, status: 'error' }), false);
  assert.equal(autoOcrNeeds({ textKnown: undefined, status: 'has-text' }), false);
});

test('a page the store refused to read (right-to-left or no letter map) is not tried again on its own', () => {
  assert.equal(autoOcrNeeds({ textKnown: false, status: 'idle', refused: true }), false);
  assert.equal(autoOcrNeeds({ textKnown: false, status: 'idle', refused: false }), true);
});

test('OCR reads English only: a right-to-left document, or one whose read pages came back right to left, is refused; so is a page with no letter map', () => {
  assert.equal(ocrRefusal({ rtlDoc: true, rtlReadBefore: false, unmapped: false }), 'rtl');
  assert.equal(ocrRefusal({ rtlDoc: false, rtlReadBefore: true, unmapped: false }), 'rtl');
  assert.equal(ocrRefusal({ rtlDoc: false, rtlReadBefore: false, unmapped: true }), 'unmapped');
  assert.equal(ocrRefusal({ rtlDoc: true, rtlReadBefore: false, unmapped: true }), 'rtl');
  assert.equal(ocrRefusal({ rtlDoc: false, rtlReadBefore: false, unmapped: false }), null);
});
