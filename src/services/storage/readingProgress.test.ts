/**
 * Run with: npx tsx --test src/services/storage/readingProgress.test.ts
 *
 * Reading progress: the last position, the furthest point reached (a fraction, so a PDF that
 * gains or loses pages keeps a sensible value) and the percentage the library shows.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextReadingProgress, progressPercent } from './types';

test('first report stores the position and its fraction as the furthest point', () => {
  assert.deepEqual(nextReadingProgress(null, { position: 3, total: 10 }), { position: 3, total: 10, furthest: 0.3 });
});

test('going back keeps the furthest point', () => {
  const prev = { position: 8, total: 10, furthest: 0.8 };
  assert.deepEqual(nextReadingProgress(prev, { position: 2, total: 10 }), { position: 2, total: 10, furthest: 0.8 });
});

test('a position past the total is clamped to the end', () => {
  assert.deepEqual(nextReadingProgress(null, { position: 12, total: 10 }), { position: 10, total: 10, furthest: 1 });
});

test('invalid input is refused with null', () => {
  for (const input of [
    { position: 1, total: 0 },
    { position: -1, total: 10 },
    { position: Number.NaN, total: 10 },
    { position: 1, total: Number.POSITIVE_INFINITY },
    { position: '3', total: 10 },
    null
  ]) {
    assert.equal(nextReadingProgress(null, input as never), null, JSON.stringify(input));
  }
});

test('the percentage is the furthest point, rounded, 0 to 100; null when never read', () => {
  assert.equal(progressPercent(null), null);
  assert.equal(progressPercent({ position: 1, total: 3, furthest: 1 / 3 }), 33);
  assert.equal(progressPercent({ position: 1, total: 10, furthest: 0.105 }), 11);
  assert.equal(progressPercent({ position: 10, total: 10, furthest: 1 }), 100);
});

test('a stored value from a bad write cannot push the percentage out of range', () => {
  assert.equal(progressPercent({ position: 1, total: 1, furthest: 7 }), 100);
  assert.equal(progressPercent({ position: 1, total: 1, furthest: -2 }), 0);
  assert.equal(progressPercent({ position: 1, total: 1, furthest: 'x' } as never), null);
});
