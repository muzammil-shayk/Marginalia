/**
 * Run with: npx tsx --test src/hooks/historyCore.test.ts
 *
 * The undo history both the PDF workspace and the text reader use: whole-list snapshots, 100 steps.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyHistory, historyCommit, historyUndo, historyRedo, HISTORY_LIMIT } from './historyCore';

type M = { id: string };
const a = { id: 'a' };
const b = { id: 'b' };

test('a commit can be undone and redone', () => {
  const h1 = historyCommit(emptyHistory<M>([a]), [a, b])!;
  assert.deepEqual(h1.present, [a, b]);
  const h2 = historyUndo(h1)!;
  assert.deepEqual(h2.present, [a]);
  assert.deepEqual(historyRedo(h2)!.present, [a, b]);
});

test('a commit of the same objects is not a step', () => {
  const list = [a, b];
  assert.equal(historyCommit(emptyHistory<M>(list), [...list]), null);
});

test('a new commit clears the redo stack', () => {
  const h = historyUndo(historyCommit(emptyHistory<M>([]), [a])!)!;
  const next = historyCommit(h, [b])!;
  assert.equal(historyRedo(next), null);
});

test('history keeps the last 100 steps', () => {
  assert.equal(HISTORY_LIMIT, 100);
  let h = emptyHistory<M>([]);
  for (let i = 0; i < 101; i++) h = historyCommit(h, [{ id: `m${i}` }])!;
  let undos = 0;
  for (let next = historyUndo(h); next; next = historyUndo(next)) {
    h = next;
    undos++;
  }
  assert.equal(undos, 100);
  assert.deepEqual(h.present, [{ id: 'm0' }]);
});

test('undo with nothing to undo is null', () => {
  assert.equal(historyUndo(emptyHistory<M>([a])), null);
});
