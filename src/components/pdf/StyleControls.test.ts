import test from 'node:test';
import assert from 'node:assert/strict';
import { isInkOnDark, NEUTRAL_COLORS } from './StyleControls';

test('near-black inks get the dark-mode ring; readable colours and non-hex values do not', () => {
  assert.equal(isInkOnDark(NEUTRAL_COLORS[0]), true); // #1c1917, 1.05:1 on night-3
  assert.equal(isInkOnDark('#1e3a8a'), true); // navy, under 3:1
  assert.equal(isInkOnDark('#6b7280'), false); // grey, ~3.9:1
  assert.equal(isInkOnDark('#dc2626'), false);
  assert.equal(isInkOnDark('rgb(0 0 0)'), false);
});
