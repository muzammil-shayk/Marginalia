/**
 * Run with: npx tsx --test src/utils/textFormatting.test.ts
 *
 * Text-reader selections: a selection across paragraphs used to keep only the first paragraph
 * (with an end offset running past its text), and anything of 3 characters or fewer could not be
 * marked at all while the previous passage's popover stayed up and acted on the old passage.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangesFromSelectionParts, selectionState, toggleFormatRanges } from './textFormatting';

test('a selection across three paragraphs becomes one range per paragraph', () => {
  const ranges = rangesFromSelectionParts([
    { index: 0, text: 'First paragraph here.', start: 6, end: 21 },
    { index: 1, text: 'Middle one.', start: 0, end: 11 },
    { index: 2, text: 'Last paragraph.', start: 0, end: 4 }
  ]);
  assert.deepEqual(ranges, [
    { paraIdx: 0, start: 6, end: 21 },
    { paraIdx: 1, start: 0, end: 11 },
    { paraIdx: 2, start: 0, end: 4 }
  ]);
});

test('a paragraph the selection only touches at its edge is left out', () => {
  const ranges = rangesFromSelectionParts([
    { index: 0, text: 'Ends here.', start: 10, end: 10 },
    { index: 1, text: 'Picked text', start: 0, end: 6 },
    { index: 2, text: '   spaced', start: 0, end: 3 }
  ]);
  assert.deepEqual(ranges, [{ paraIdx: 1, start: 0, end: 6 }]);
});

test('offsets are clamped to the paragraph text', () => {
  const ranges = rangesFromSelectionParts([{ index: 4, text: 'abc', start: -2, end: 9 }]);
  assert.deepEqual(ranges, [{ paraIdx: 4, start: 0, end: 3 }]);
});

test('a single character can be marked', () => {
  const state = selectionState('a', [{ paraIdx: 0, start: 3, end: 4 }]);
  assert.deepEqual(state, { text: 'a', ranges: [{ paraIdx: 0, start: 3, end: 4 }] });
});

test('a three-character word can be marked', () => {
  assert.notEqual(selectionState('the', [{ paraIdx: 1, start: 0, end: 3 }]), null);
});

test('a whitespace-only selection clears the popover state', () => {
  assert.equal(selectionState('  \n ', [{ paraIdx: 0, start: 0, end: 2 }]), null);
});

test('a selection outside the text paragraphs clears the popover state', () => {
  assert.equal(selectionState('Add note', []), null);
});

test('highlighting across two paragraphs marks both, each with its own offsets', () => {
  const result = toggleFormatRanges(
    [],
    [
      { paraIdx: 0, start: 6, end: 21 },
      { paraIdx: 1, start: 0, end: 4 }
    ],
    'highlight',
    '#ff0000',
    't1'
  );
  assert.deepEqual(
    result.map(({ paragraphIndex, start, end, type, color, themeId }) => ({ paragraphIndex, start, end, type, color, themeId })),
    [
      { paragraphIndex: 0, start: 6, end: 21, type: 'highlight', color: '#ff0000', themeId: 't1' },
      { paragraphIndex: 1, start: 0, end: 4, type: 'highlight', color: '#ff0000', themeId: 't1' }
    ]
  );
});

test('toggling again over the same two-paragraph selection removes both marks', () => {
  const ranges = [
    { paraIdx: 0, start: 6, end: 21 },
    { paraIdx: 1, start: 0, end: 4 }
  ];
  const once = toggleFormatRanges([], ranges, 'underline', '#00f', null);
  assert.deepEqual(toggleFormatRanges(once, ranges, 'underline', '#00f', null), []);
});

test('when only one paragraph is already marked, the other is added and the first kept', () => {
  const ranges = [
    { paraIdx: 0, start: 0, end: 5 },
    { paraIdx: 1, start: 0, end: 5 }
  ];
  const first = toggleFormatRanges([], [ranges[0]], 'highlight', '#f00', null);
  const result = toggleFormatRanges(first, ranges, 'highlight', '#f00', null);
  assert.deepEqual(
    result.map((f) => [f.paragraphIndex, f.start, f.end]).sort(),
    [
      [0, 0, 5],
      [1, 0, 5]
    ]
  );
});
