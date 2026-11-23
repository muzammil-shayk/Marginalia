/**
 * Where a key or swipe takes the PDF book, including while a turn still waits for its pages to paint.
 *
 * Run with: npx tsx --test src/components/pdf/workspace/bookStep.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookStep } from './bookStep';

test('a step turns to the first page of the next or previous pair', () => {
  assert.deepEqual(bookStep(3, null, 1, 10), { page: 5, now: false });
  assert.deepEqual(bookStep(4, null, -1, 10), { page: 1, now: false });
});

test('no step past either end of the book', () => {
  assert.equal(bookStep(1, null, -1, 10), null);
  assert.equal(bookStep(9, null, 1, 10), null);
});

test('a second step the same way while the turn waits for paint starts that turn now, it does not skip a pair', () => {
  assert.deepEqual(bookStep(3, 5, 1, 10), { page: 5, now: true });
  assert.deepEqual(bookStep(5, 3, -1, 10), { page: 3, now: true });
});

test('a step back while a forward turn waits stays on the open pair', () => {
  assert.deepEqual(bookStep(3, 5, -1, 10), { page: 3, now: false });
});
