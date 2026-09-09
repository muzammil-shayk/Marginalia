/**
 * Run with: npx tsx --test src/components/pdf/annotationModel.test.ts
 *
 * Selection rectangles come from the browser one per text run, and turning them into per-line
 * bars is where a two-column page goes wrong: the two columns share every vertical band, so
 * grouping on vertical overlap alone spans the gutter.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRectsIntoLines } from './annotationModel';

// Node has no DOM, and only these six numbers are read.
class Rect {
  constructor(
    public left: number,
    public top: number,
    public width: number,
    public height: number
  ) {}
  get right() { return this.left + this.width; }
  get bottom() { return this.top + this.height; }
}
const rect = (left: number, top: number, width: number, height = 12) =>
  new Rect(left, top, width, height) as unknown as DOMRect;

test('runs on the same line merge into one bar', () => {
  const merged = mergeRectsIntoLines([rect(100, 40, 60), rect(163, 40, 50)]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].left, 100);
  assert.equal(merged[0].right, 213);
});

test('two columns on the same band stay apart', () => {
  // Column one ends at x=300; column two starts at x=520. Same vertical band.
  const merged = mergeRectsIntoLines([rect(100, 40, 200), rect(520, 40, 180)]);
  assert.equal(merged.length, 2, 'the gutter must not be swallowed into one rectangle');
  assert.deepEqual(
    merged.map((m) => [m.left, m.right]),
    [
      [100, 300],
      [520, 700]
    ]
  );
});

test('separate lines stay separate', () => {
  const merged = mergeRectsIntoLines([rect(100, 40, 200), rect(100, 60, 200)]);
  assert.equal(merged.length, 2);
});
