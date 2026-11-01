/**
 * Run with: npx tsx --test src/utils/selectionTrigger.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inputKindOf, KEY_SETTLE_MS, selectionTrigger, TOUCH_SETTLE_MS } from './selectionTrigger';

test('a mouse or pen release reads the selection at once and lets an armed tool mark it', () => {
  assert.deepEqual(selectionTrigger('mouse', 'pointerup'), { mode: 'now', applyArmedTool: true });
  assert.deepEqual(selectionTrigger('pen', 'pointerup'), { mode: 'now', applyArmedTool: true });
});

test('a mouse drag in progress never opens the menu from selectionchange', () => {
  assert.deepEqual(selectionTrigger('mouse', 'selectionchange'), { mode: 'ignore' });
  assert.deepEqual(selectionTrigger(null, 'selectionchange'), { mode: 'ignore' });
});

test('touch waits for the selection to settle, from either event, and never auto-marks', () => {
  for (const ev of ['pointerup', 'selectionchange'] as const) {
    assert.deepEqual(selectionTrigger('touch', ev), { mode: 'debounce', delayMs: TOUCH_SETTLE_MS, applyArmedTool: false });
  }
});

test('keyboard selection keeps its 300 ms settle', () => {
  assert.deepEqual(selectionTrigger('key', 'selectionchange'), { mode: 'debounce', delayMs: KEY_SETTLE_MS, applyArmedTool: false });
});

test('pointer types map to input kinds; unknown counts as mouse', () => {
  assert.equal(inputKindOf('touch'), 'touch');
  assert.equal(inputKindOf('pen'), 'pen');
  assert.equal(inputKindOf('mouse'), 'mouse');
  assert.equal(inputKindOf(''), 'mouse');
});
