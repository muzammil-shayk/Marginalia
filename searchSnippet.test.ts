/**
 * Run with: npx tsx --test searchSnippet.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordWindow, markSearchText } from './searchSnippet';

const text = 'Notes on the Synthesis of Form describe fitness between two parts of a design problem.';

test('a mid-word start and end are moved to word boundaries, with ellipses', () => {
  // raw slice would be "e Synthesis of Form describe fitness betw"
  const start = text.indexOf('e Synthesis');
  const end = text.indexOf('ween two');
  assert.equal(wordWindow(text, start, end), '…Synthesis of Form describe fitness…');
});

test('a window at the start or end of the text gets no ellipsis there', () => {
  assert.equal(wordWindow(text, 0, text.length), text);
  assert.equal(wordWindow(text, 0, 12), 'Notes on the…');
  assert.equal(wordWindow(text, text.indexOf('of a design'), text.length), '…of a design problem.');
});

test('one word longer than the window falls back to the raw slice', () => {
  const word = 'x'.repeat(500);
  assert.equal(wordWindow(word, 10, 210), `…${'x'.repeat(200)}…`);
});

test('the matched term stays in the window even when it starts the first word', () => {
  // the match "ynthesis" is inside a word cut by start; trimming must not jump past it
  const start = text.indexOf('ynthesis');
  const keep: [number, number] = [start, start + 'ynthesis'.length];
  assert.ok(wordWindow(text, start, start + 30, keep).includes('ynthesis'));
  // and the end is never pulled back across the match
  const m = text.indexOf('fitne');
  assert.ok(wordWindow(text, m - 10, m + 5, [m, m + 5]).includes('fitne'));
});

test('unicode text: accents and non-Latin scripts cut on spaces', () => {
  const urdu = 'یہ کتاب علامہ اقبال کی شاعری کا مجموعہ ہے';
  const s = urdu.indexOf('تاب');
  const e = urdu.indexOf('عری') + 1;
  assert.equal(wordWindow(urdu, s, e), '…علامہ اقبال کی…');
  const fr = 'Une étude détaillée de la synthèse élégante';
  assert.equal(wordWindow(fr, 2, fr.indexOf('élégante') + 3), '…étude détaillée de la synthèse…');
});

test('whitespace runs are collapsed and the result is never empty', () => {
  assert.equal(wordWindow('a\n\n  b   c', 0, 10), 'a b c');
  assert.notEqual(wordWindow('abc def', 1, 5), '');
});

// ── Marks: what a mark is found by, and what its snippet shows ──────────────

test('a plain-text note is found by its content and its snippet shows that content', () => {
  const note = { id: 'n1', kind: 'note', title: 'On endings', content: 'Every story is about mortality.', quote: '' };
  const hit = markSearchText(note, 'mortality');
  assert.ok(hit);
  assert.match(wordWindow(hit.text, 0, 220, hit.keep), /about mortality\./);
});

test('a plain-text note is found by its title', () => {
  const note = { id: 'n1', kind: 'note', title: 'Mortality', content: 'see chapter two' };
  assert.ok(markSearchText(note, 'mortality'));
});

test('a PDF mark is still found by its quote, note text, theme name and "terminology"', () => {
  assert.ok(markSearchText({ id: 'a', quote: 'the long dark' }, 'dark'));
  assert.ok(markSearchText({ id: 'a', text: 'my note' }, 'note'));
  assert.ok(markSearchText({ id: 'a' }, 'grief', 'Grief'));
  assert.ok(markSearchText({ id: 'a', isTerminology: true }, 'terminology'));
  assert.equal(markSearchText({ id: 'a', quote: 'nothing here' }, 'absent'), null);
});
