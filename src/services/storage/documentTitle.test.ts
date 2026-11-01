/**
 * Run with: npx tsx --test src/services/storage/documentTitle.test.ts
 *
 * Names of documents, including pasted custom texts ("An excerpt from Hamlet by Shakespeare").
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTitle } from './types';

test('a name is trimmed and kept as typed', () => {
  assert.equal(cleanTitle('  An excerpt from Hamlet by Shakespeare \n'), 'An excerpt from Hamlet by Shakespeare');
});

test('line breaks and runs of spaces inside a name become one space', () => {
  assert.equal(cleanTitle('Sonnet\n18   by\tShakespeare'), 'Sonnet 18 by Shakespeare');
});

test('a name is capped at 300 characters', () => {
  assert.equal(cleanTitle('x'.repeat(400))?.length, 300);
});

test('an empty or non-string name gives null, so callers can fall back or refuse', () => {
  for (const v of ['', '   ', undefined, null, 42, {}]) assert.equal(cleanTitle(v), null, String(v));
});
