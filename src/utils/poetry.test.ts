/**
 * Run with: npx tsx --test src/utils/poetry.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analysePoem, poemNumber, rhymeTail } from './poetry';

const GHAZAL = [
  'ہزاروں خواہشیں ایسی کہ ہر خواہش پہ دم نکلے\nبہت نکلے مرے ارمان لیکن پھر بھی کم نکلے',
  'ڈرے کیوں میرا قاتل کیا رہے گا اس کی گردن پر\nوہ خوں جو چشم تر سے عمر بھر یوں دم بہ دم نکلے',
  'نکلنا خلد سے آدم کا سنتے آئے ہیں لیکن\nبہت بے آبرو ہو کر ترے کوچے سے ہم نکلے'
];

test('lines and shers are numbered through the poem, two lines a sher', () => {
  const { lines } = analysePoem(GHAZAL);
  assert.equal(lines.length, 6);
  assert.deepEqual(lines.map((l) => l.lineNo), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(lines.map((l) => l.sherNo), [1, 1, 2, 2, 3, 3]);
  assert.deepEqual(lines.map((l) => l.sherLine), [0, 1, 0, 1, 0, 1]);
  assert.equal(lines[1].paragraphIndex, 0);
  assert.equal(GHAZAL[0].slice(lines[1].start, lines[1].end), 'بہت نکلے مرے ارمان لیکن پھر بھی کم نکلے');
});

test('a ghazal: the radif on every second line and on the matla, the qafiya before it', () => {
  const { radif, spans } = analysePoem(GHAZAL);
  assert.equal(radif, 'نکلے');
  const radifs = spans.filter((s) => s.kind === 'radif');
  // The matla's two lines and the second line of each later sher.
  assert.equal(radifs.length, 4);
  for (const s of radifs) assert.equal(GHAZAL[s.paragraphIndex].slice(s.start, s.end), 'نکلے');
  const rhymes = spans.filter((s) => s.kind === 'rhyme').map((s) => GHAZAL[s.paragraphIndex].slice(s.start, s.end));
  // دم / کم / دم / ہم share their last letter.
  assert.deepEqual(rhymes, ['م', 'م', 'م', 'م']);
});

test('a poem without a radif gets a rhyme scheme per stanza', () => {
  const poem = ['The stars come out at night\nThe sea is grey by day\nThe lamp gives off its light\nAnd sorrow fades away'];
  const { radif, lines, spans } = analysePoem(poem);
  assert.equal(radif, null);
  assert.deepEqual(lines.map((l) => l.rhyme), ['A', 'B', 'A', 'B']);
  assert.deepEqual(spans.map((s) => poem[0].slice(s.start, s.end)), ['ight', 'ay', 'ight', 'ay']);
});

test('a refrain that fills the whole line is not taken for a radif', () => {
  const poem = ['a b\nonce more', 'c d\nonce more', 'e f\nonce more'];
  assert.equal(analysePoem(poem).radif, null);
});

test('indentation and blank lines are skipped; offsets point at the words', () => {
  const poem = ['   indented line\n\n  second'];
  const { lines } = analysePoem(poem);
  assert.equal(lines.length, 2);
  assert.equal(poem[0].slice(lines[0].start, lines[0].end), 'indented line');
  assert.equal(poem[0].slice(lines[1].start, lines[1].end), 'second');
});

test('rhyme tails and Urdu digits', () => {
  assert.equal(rhymeTail('Night,'), 'ight');
  assert.equal(rhymeTail('away'), 'ay');
  assert.equal(poemNumber(12, true), '۱۲');
  assert.equal(poemNumber(12, false), '12');
});
