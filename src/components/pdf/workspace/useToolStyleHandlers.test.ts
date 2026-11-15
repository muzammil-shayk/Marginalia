/**
 * Run with: npx tsx --test src/components/pdf/workspace/useToolStyleHandlers.test.ts
 *
 * `matchesSelection`: which marks a recolour over the live selection reaches — same kind, page and
 * quote, and the first rectangle within 0.004 of the selection's.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesSelection } from './useToolStyleHandlers';
import type { Annotation } from '../annotationModel';

const group = { page: 2, quote: 'the words', rects: [{ x: 0.1, y: 0.3, w: 0.5, h: 0.02 }] };
const mark = (extra: Partial<Annotation> = {}): Annotation => ({
  id: 'm',
  page: 2,
  kind: 'highlight',
  color: '#aa0000',
  themeIds: [],
  rects: [{ x: 0.1, y: 0.3, w: 0.5, h: 0.02 }],
  quote: 'the words',
  createdAt: '2026-11-15T00:00:00.000Z',
  ...extra
});

test('the mark made from this selection matches', () => {
  assert.equal(matchesSelection(mark(), group, 'highlight'), true);
  assert.equal(matchesSelection(mark({ rects: [{ x: 0.103, y: 0.297, w: 0.5, h: 0.02 }] }), group, 'highlight'), true);
});

test('another kind, page, quote or position does not', () => {
  assert.equal(matchesSelection(mark(), group, 'underline'), false);
  assert.equal(matchesSelection(mark({ page: 3 }), group, 'highlight'), false);
  assert.equal(matchesSelection(mark({ quote: 'other words' }), group, 'highlight'), false);
  assert.equal(matchesSelection(mark({ rects: [{ x: 0.1, y: 0.31, w: 0.5, h: 0.02 }] }), group, 'highlight'), false);
});

test('a mark without rectangles never matches', () => {
  assert.equal(matchesSelection(mark({ rects: undefined }), group, 'highlight'), false);
});
