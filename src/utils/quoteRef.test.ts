/**
 * Run with: npx tsx --test src/utils/quoteRef.test.ts
 *
 * "Copy quote with page ref": where a mark sits (page, line of a poem, or paragraph) and the
 * citation text that goes on the clipboard.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatQuoteRef, locationLabel, markLocation, lineNumberAt } from './quoteRef';

test('PDF quote: "quote" (Title, p. N)', () => {
  assert.equal(formatQuoteRef('To be, or not to be', 'Hamlet', { kind: 'page', page: 12 }), '"To be, or not to be" (Hamlet, p. 12)');
});

test('text document quote cites the paragraph', () => {
  assert.equal(formatQuoteRef('It was a dark night.', 'Story', { kind: 'paragraph', paragraph: 3 }), '"It was a dark night." (Story, para. 3)');
});

test('poem quote cites the line, a range when it spans lines, and marks line breaks with /', () => {
  assert.equal(formatQuoteRef('Shall I compare thee', 'Sonnet 18', { kind: 'line', line: 1 }), '"Shall I compare thee" (Sonnet 18, l. 1)');
  assert.equal(
    formatQuoteRef('Shall I compare thee\nThou art more lovely', 'Sonnet 18', { kind: 'line', line: 1, endLine: 2 }),
    '"Shall I compare thee / Thou art more lovely" (Sonnet 18, ll. 1–2)'
  );
});

test('runs of whitespace are collapsed and the quote is trimmed', () => {
  assert.equal(formatQuoteRef('  a   b\n\nc ', 'T', { kind: 'page', page: 1 }), '"a b / c" (T, p. 1)');
});

test('no location: the title alone', () => {
  assert.equal(formatQuoteRef('x', 'T', null), '"x" (T)');
});

test('lineNumberAt counts lines across stanzas (paragraphs) of a verbatim document', () => {
  const paras = ['one\ntwo', 'three\nfour\nfive'];
  assert.equal(lineNumberAt(paras, 0, 0), 1);
  assert.equal(lineNumberAt(paras, 0, 4), 2);
  assert.equal(lineNumberAt(paras, 1, 0), 3);
  assert.equal(lineNumberAt(paras, 1, paras[1].indexOf('five')), 5);
});

test('markLocation: PDF mark → page; text mark → paragraph; verbatim text → line(s)', () => {
  assert.deepEqual(markLocation({ id: 'a', page: 4 }), { kind: 'page', page: 4 });
  const anchor = { paragraphIndex: 1, start: 0, end: 10 };
  assert.deepEqual(markLocation({ id: 'b', anchor }), { kind: 'paragraph', paragraph: 2 });
  const paras = ['one\ntwo', 'three\nfour'];
  assert.deepEqual(markLocation({ id: 'c', anchor }, { paragraphs: paras, layout: 'verbatim' }), { kind: 'line', line: 3, endLine: 4 });
  assert.deepEqual(markLocation({ id: 'd', anchor: { paragraphIndex: 1, start: 0, end: 5 } }, { paragraphs: paras, layout: 'verbatim' }), { kind: 'line', line: 3 });
  assert.equal(markLocation({ id: 'e' }), null);
});

test('locationLabel', () => {
  assert.equal(locationLabel({ kind: 'page', page: 2 }), 'p. 2');
  assert.equal(locationLabel({ kind: 'line', line: 7 }), 'l. 7');
  assert.equal(locationLabel({ kind: 'line', line: 7, endLine: 9 }), 'll. 7–9');
  assert.equal(locationLabel({ kind: 'paragraph', paragraph: 5 }), 'para. 5');
});
