/** Run with: npx tsx --test src/components/marginLayout.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stackMargin } from './marginLayout';

test('a lone note sits level with its line', () => {
  const { tops, bottom } = stackMargin([{ id: 'a', desired: 120, height: 80 }]);
  assert.equal(tops.get('a'), 120);
  assert.equal(bottom, 200);
});

test('notes on nearby lines stack without overlapping, in line order', () => {
  const { tops } = stackMargin(
    [
      { id: 'b', desired: 140, height: 60 },
      { id: 'a', desired: 100, height: 90 },
      { id: 'c', desired: 400, height: 50 }
    ],
    8
  );
  assert.equal(tops.get('a'), 100);
  assert.equal(tops.get('b'), 198); // pushed below a (100 + 90 + 8)
  assert.equal(tops.get('c'), 400); // far enough down to keep its own line
});

test('no notes, no height', () => {
  assert.equal(stackMargin([]).bottom, 0);
});
