import { test } from 'node:test';
import assert from 'node:assert/strict';
import { returnFocusTarget } from './useDialogFocus';

const el = (connected: boolean, tagName = 'BUTTON') => ({ isConnected: connected, tagName }) as unknown as HTMLElement;

test('returnFocusTarget: a connected opener gets focus back', () => {
  const opener = el(true);
  assert.equal(returnFocusTarget(opener, 'x', () => el(true), () => el(true)), opener);
});

test('returnFocusTarget: a re-mounted twin (same aria-label) beats the fallback', () => {
  const twin = el(true);
  const seen: string[] = [];
  const got = returnFocusTarget(el(false), 'Write a comment on this mark', (s) => (seen.push(s), twin), () => el(true));
  assert.equal(got, twin);
  assert.deepEqual(seen, ['[aria-label="Write a comment on this mark"]']);
});

test('returnFocusTarget: no opener label or twin falls back; body is never the target', () => {
  const fb = el(true);
  assert.equal(returnFocusTarget(el(false), null, () => el(true), () => fb), fb);
  assert.equal(returnFocusTarget(el(false), 'Gone', () => null, () => fb), fb);
  assert.equal(returnFocusTarget(el(true, 'BODY'), null, () => null, () => fb), fb);
});

test('returnFocusTarget: quotes in a label are escaped for the selector', () => {
  let seen = '';
  returnFocusTarget(el(false), 'Note on "x"', (s) => ((seen = s), null));
  assert.equal(seen, '[aria-label="Note on \\"x\\""]');
});
