/**
 * Run with: npx tsx --test src/utils/markLinks.test.ts
 *
 * Linked marks: a link is stored on both marks (`links: string[]` of the other's id), so it is
 * part of the annotation list itself: saved, undone, backed up and exported with it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkMarks, unlinkMarks, pruneLinks, linkedIds } from './markLinks';

type M = { id: string; links?: string[]; page?: number };
const set = (): M[] => [{ id: 'a', page: 1 }, { id: 'b', page: 2 }, { id: 'c', page: 3 }];

test('linking puts each id on the other mark', () => {
  const out = linkMarks(set(), 'a', 'c');
  assert.deepEqual(out.find((m) => m.id === 'a')!.links, ['c']);
  assert.deepEqual(out.find((m) => m.id === 'c')!.links, ['a']);
  assert.equal(out.find((m) => m.id === 'b')!.links, undefined);
});

test('linkedIds answers from either side', () => {
  const out = linkMarks(linkMarks(set(), 'a', 'b'), 'c', 'a');
  assert.deepEqual(linkedIds(out, 'a'), ['b', 'c']);
  assert.deepEqual(linkedIds(out, 'b'), ['a']);
});

test('linking twice, linking to itself, or to a missing mark changes nothing (same array, no undo step)', () => {
  const once = linkMarks(set(), 'a', 'b');
  assert.equal(linkMarks(once, 'a', 'b'), once);
  assert.equal(linkMarks(once, 'b', 'a'), once);
  assert.equal(linkMarks(once, 'a', 'a'), once);
  assert.equal(linkMarks(once, 'a', 'zzz'), once);
});

test('untouched marks keep their identity (history sees only real changes)', () => {
  const before = set();
  const out = linkMarks(before, 'a', 'b');
  assert.equal(out[2], before[2]);
});

test('unlink removes both sides and drops an empty list', () => {
  const out = unlinkMarks(linkMarks(set(), 'a', 'b'), 'b', 'a');
  assert.equal(out.find((m) => m.id === 'a')!.links, undefined);
  assert.equal(out.find((m) => m.id === 'b')!.links, undefined);
  assert.equal('links' in out.find((m) => m.id === 'a')!, false);
});

test('deleting one side: pruneLinks removes the link from the survivor, the survivor stays', () => {
  const linked = linkMarks(linkMarks(set(), 'a', 'b'), 'a', 'c');
  const afterDelete = linked.filter((m) => m.id !== 'b');
  const out = pruneLinks(afterDelete);
  assert.equal(out.length, 2);
  assert.deepEqual(out.find((m) => m.id === 'a')!.links, ['c']);
  assert.deepEqual(out.find((m) => m.id === 'c')!.links, ['a']);
});

test('pruneLinks on a clean list returns the same array', () => {
  const linked = linkMarks(set(), 'a', 'b');
  assert.equal(pruneLinks(linked), linked);
});

test('pruneLinks ignores a malformed links field instead of throwing', () => {
  const out = pruneLinks([{ id: 'a', links: 'b' as unknown as string[] }]);
  assert.equal('links' in out[0], false);
});
