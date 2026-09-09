/**
 * Run with: npx tsx --test src/hooks/usePlainTextAnnotations.test.ts
 *
 * The round-trip is what matters: a document's annotations are one shared list, and this hook
 * owns only the entries it stamped a `kind` on. Anything it drops on load, it erases on save —
 * which is exactly how opening an annotated PDF once used to wipe every mark in it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitEntries, mergeEntries } from './usePlainTextAnnotations';

test('PDF marks survive a load and save that never touches them', () => {
  const stored = [
    { id: 'pdf-1', page: 3, kindOfMark: 'highlight' },
    { id: 'note-1', kind: 'note', title: 'A note' },
    { id: 'fmt-1', kind: 'format', paragraphIndex: 2 }
  ];
  const { notes, formats, others } = splitEntries(stored as never);
  assert.equal(notes.length, 1);
  assert.equal(formats.length, 1);
  assert.deepEqual(others, [stored[0]]);

  const written = mergeEntries(notes, formats, others);
  assert.deepEqual(
    written.map((e) => e.id).sort(),
    ['fmt-1', 'note-1', 'pdf-1']
  );
});

test('a document of nothing but PDF marks is written back unchanged', () => {
  const stored = [{ id: 'pdf-1' }, { id: 'pdf-2' }];
  const { notes, formats, others } = splitEntries(stored as never);
  assert.deepEqual(mergeEntries(notes, formats, others), stored);
});
