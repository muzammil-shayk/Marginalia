/**
 * Run with: npx tsx --test src/components/boardLayout.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARD_H, CARD_W, nextFreeSlot } from './boardLayout';

test('the first slot is top left; taken slots are skipped across, then down', () => {
  assert.deepEqual(nextFreeSlot([], 800), { x: 24, y: 24 });
  const second = nextFreeSlot([{ x: 24, y: 24 }], 800);
  assert.deepEqual(second, { x: 24 + CARD_W + 24, y: 24 });
  const row = [{ x: 24, y: 24 }, second, { x: 24 + 2 * (CARD_W + 24), y: 24 }];
  assert.deepEqual(nextFreeSlot(row, 800), { x: 24, y: 24 + CARD_H + 24 });
});

test('a card dropped near a slot blocks it; a narrow board is one column', () => {
  assert.notDeepEqual(nextFreeSlot([{ x: 40, y: 30 }], 800), { x: 24, y: 24 });
  assert.deepEqual(nextFreeSlot([{ x: 24, y: 24 }], 200), { x: 24, y: 24 + CARD_H + 24 });
});
