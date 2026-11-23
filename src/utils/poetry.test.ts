/**
 * Run with: npx tsx --test src/utils/poetry.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analysePoem, rhymeTail } from './poetry';

const POEM = [
  'The stars come out at night\nThe sea is grey by day\nThe lamp gives off its light\nAnd sorrow fades away',
  'The ships are in the bay\nThe gulls are gone to rest\nThe tide has had its say\nThe sun is in the west'
];

test('lines and couplets are numbered through the poem, two lines a couplet', () => {
  const { lines } = analysePoem(POEM);
  assert.equal(lines.length, 8);
  assert.deepEqual(lines.map((l) => l.lineNo), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(lines.map((l) => l.coupletNo), [1, 1, 2, 2, 3, 3, 4, 4]);
  assert.deepEqual(lines.map((l) => l.coupletLine), [0, 1, 0, 1, 0, 1, 0, 1]);
  assert.equal(lines[1].paragraphIndex, 0);
  assert.equal(POEM[0].slice(lines[1].start, lines[1].end), 'The sea is grey by day');
});

test('a poem gets a rhyme scheme per stanza', () => {
  const poem = [POEM[0]];
  const { lines, spans } = analysePoem(poem);
  assert.deepEqual(lines.map((l) => l.rhyme), ['A', 'B', 'A', 'B']);
  assert.deepEqual(spans.map((s) => poem[0].slice(s.start, s.end)), ['ight', 'ay', 'ight', 'ay']);
});

test('the same closing words on every second line are rhymes like any other: no radif is looked for', () => {
  const poem = ['a stone by the sea\nthe road to the sea', 'a bird in the tree\nthe road to the sea', 'a key in the door\nthe road to the sea'];
  const analysis = analysePoem(poem);
  assert.deepEqual(Object.keys(analysis).sort(), ['lines', 'spans']);
  assert.ok(analysis.spans.every((s) => poem[s.paragraphIndex].slice(s.start, s.end) === 'ea' || poem[s.paragraphIndex].slice(s.start, s.end) === 'ee'));
});

test('indentation and blank lines are skipped; offsets point at the words', () => {
  const poem = ['   indented line\n\n  second'];
  const { lines } = analysePoem(poem);
  assert.equal(lines.length, 2);
  assert.equal(poem[0].slice(lines[0].start, lines[0].end), 'indented line');
  assert.equal(poem[0].slice(lines[1].start, lines[1].end), 'second');
});

test('rhyme tails', () => {
  assert.equal(rhymeTail('Night,'), 'ight');
  assert.equal(rhymeTail('away'), 'ay');
});
