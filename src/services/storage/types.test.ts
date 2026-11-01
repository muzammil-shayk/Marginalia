/**
 * Run with: npx tsx --test src/services/storage/types.test.ts
 *
 * Library counts. A text-document mark over several paragraphs is stored as one entry per
 * paragraph sharing a `groupId`; the library counts it once.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeThemeCounts, countMarks, countTerminology } from './types';

const entries = [
  { id: 'a', groupId: 'g', themeId: 'key', isTerminology: true },
  { id: 'b', groupId: 'g', themeId: 'key', isTerminology: true },
  { id: 'c', groupId: 'g', themeId: 'key', isTerminology: true },
  { id: 'pdf', page: 1, themeId: 'key' },
  { id: 'note', themeId: null }
];

test('a grouped mark counts once among all marks', () => {
  assert.equal(countMarks(entries), 3);
});

test('a grouped mark counts once under its theme', () => {
  assert.deepEqual(computeThemeCounts(entries), { key: 2 });
});

test('a grouped term counts once', () => {
  assert.equal(countTerminology(entries), 1);
});
