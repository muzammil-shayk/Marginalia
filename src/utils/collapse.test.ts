/**
 * Run with: npx tsx --test src/utils/collapse.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collapseSegments, foldKey, markExtent, markMatches, pageBands, readPageSizes, shownCount } from './collapse';

test('marked paragraphs show, the runs between fold', () => {
  assert.deepEqual(collapseSegments(10, [2, 7]), [
    { kind: 'fold', from: 0, to: 1 },
    { kind: 'show', from: 2, to: 2 },
    { kind: 'fold', from: 3, to: 6 },
    { kind: 'show', from: 7, to: 7 },
    { kind: 'fold', from: 8, to: 9 }
  ]);
});

test('context shows paragraphs either side, merging runs that meet, and stays in the document', () => {
  assert.deepEqual(collapseSegments(10, [0, 4], 1), [
    { kind: 'show', from: 0, to: 1 },
    { kind: 'fold', from: 2, to: 2 },
    { kind: 'show', from: 3, to: 5 },
    { kind: 'fold', from: 6, to: 9 }
  ]);
  assert.deepEqual(collapseSegments(5, [1, 3], 1), [{ kind: 'show', from: 0, to: 4 }]);
});

test('nothing marked folds the whole document; bad indices are ignored', () => {
  assert.deepEqual(collapseSegments(4, [-1, 9, 1.5]), [{ kind: 'fold', from: 0, to: 3 }]);
  assert.deepEqual(collapseSegments(0, [0]), []);
});

test('an opened fold shows and joins its neighbours', () => {
  const opened = new Set([foldKey({ from: 3, to: 6 })]);
  const segs = collapseSegments(10, [2, 7], 0, opened);
  assert.deepEqual(segs, [
    { kind: 'fold', from: 0, to: 1 },
    { kind: 'show', from: 2, to: 7 },
    { kind: 'fold', from: 8, to: 9 }
  ]);
  assert.equal(shownCount(segs), 6);
});

test('filters: all marks, one theme, terminology, notes; formatting and black-outs never count', () => {
  const hl = { kind: 'highlight', themeIds: ['1', '2'] };
  assert.equal(markMatches(hl, { type: 'all' }), true);
  assert.equal(markMatches(hl, { type: 'theme', id: '2' }), true);
  assert.equal(markMatches(hl, { type: 'theme', id: '3' }), false);
  assert.equal(markMatches({ kind: 'underline', isTerminology: true }, { type: 'terminology' }), true);
  assert.equal(markMatches(hl, { type: 'terminology' }), false);
  assert.equal(markMatches({ kind: 'note' }, { type: 'notes' }), true);
  assert.equal(markMatches(hl, { type: 'notes' }), false);
  assert.equal(markMatches({ kind: 'bold' }, { type: 'all' }), false);
  assert.equal(markMatches({ kind: 'rect', blackout: true }, { type: 'all' }), false);
});

test('page bands grow by the context, stay on the page and merge when close', () => {
  const bands = pageBands([{ top: 0.5, bottom: 0.52 }, { top: 0.01, bottom: 0.03 }, { top: 0.56, bottom: 0.58 }], 0.02, 0.03);
  assert.equal(bands.length, 2);
  assert.equal(bands[0].top, 0);
  assert.ok(Math.abs(bands[0].bottom - 0.05) < 1e-9);
  assert.ok(Math.abs(bands[1].top - 0.48) < 1e-9 && Math.abs(bands[1].bottom - 0.6) < 1e-9);
  const edge = pageBands([{ top: 0.98, bottom: 0.99 }], 0.05);
  assert.ok(edge.length === 1 && Math.abs(edge[0].top - 0.93) < 1e-9 && edge[0].bottom === 1);
});

test('a PDF mark reaches from its highest to its lowest point, whatever its shape', () => {
  assert.deepEqual(markExtent({ rects: [{ y: 0.2, h: 0.02 }, { y: 0.23, h: 0.02 }] }), { top: 0.2, bottom: 0.25 });
  assert.deepEqual(markExtent({ box: { y: 0.5, h: 0.1 } }), { top: 0.5, bottom: 0.6 });
  assert.deepEqual(markExtent({ points: [{ y: 0.4 }, { y: 0.3 }] }), { top: 0.3, bottom: 0.4 });
  assert.deepEqual(markExtent({ from: { y: 0.7 }, to: { y: 0.6 } }), { top: 0.6, bottom: 0.7 });
  assert.equal(markExtent({}), null);
});

test('page sizes: a page that fails to open is left out, the rest still resolve', async () => {
  const pdf = {
    getPage: (n: number) =>
      n === 3 ? Promise.reject(new Error('bad page')) : Promise.resolve({ getViewport: ({ scale }: { scale: number }) => ({ width: 100 * scale, height: 200 * scale }) })
  };
  const sizes = await readPageSizes(pdf, 2, [1, 3, 5]);
  assert.deepEqual([...sizes], [
    [1, { w: 200, h: 400 }],
    [5, { w: 200, h: 400 }]
  ]);
});
