/** Run with: npx tsx --test src/components/textStyleRuns.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { styleRuns } from './textStyleRuns';

const st = (start: number, end: number, style: 'bold' | 'italic' | 'underline') => ({ anchor: { paragraphIndex: 0, start, end }, style });

test('an unstyled piece is one plain run', () => {
  assert.deepEqual(styleRuns(0, 10, []), [{ start: 0, end: 10, styles: [] }]);
});

test('overlapping styles cut the piece at every boundary, offsets unchanged', () => {
  const runs = styleRuns(0, 12, [st(2, 8, 'bold'), st(5, 12, 'italic')]);
  assert.deepEqual(runs, [
    { start: 0, end: 2, styles: [] },
    { start: 2, end: 5, styles: ['bold'] },
    { start: 5, end: 8, styles: ['bold', 'italic'] },
    { start: 8, end: 12, styles: ['italic'] }
  ]);
});

test('a style reaching past the piece is clipped to it', () => {
  assert.deepEqual(styleRuns(4, 6, [st(0, 20, 'underline')]), [{ start: 4, end: 6, styles: ['underline'] }]);
});
