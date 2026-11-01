import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noun, plural } from './plural';

test('plural picks the singular only for exactly one', () => {
  assert.equal(plural(1, 'mark'), '1 mark');
  assert.equal(plural(0, 'mark'), '0 marks');
  assert.equal(plural(2, 'term'), '2 terms');
  assert.equal(plural(1204, 'word'), '1,204 words');
  assert.equal(plural(3, 'entry', 'entries'), '3 entries');
  assert.equal(noun(1, 'theme'), 'theme');
  assert.equal(noun(5, 'theme'), 'themes');
});
