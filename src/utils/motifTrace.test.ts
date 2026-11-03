/**
 * Run with: npx tsx --test src/utils/motifTrace.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTerms, documentUnits, hitSnippet, paragraphHits, traceMarkdown, traceParagraphs } from './motifTrace';

test('terms are tidied and deduplicated', () => {
  assert.deepEqual(cleanTerms(['  Moon ', 'moon', '', 'crescent   moon']), ['Moon', 'crescent moon']);
});

test('whole words only, any case, with plurals and possessives', () => {
  const paras = ['The moon rose. Moons wane; the moon’s light.', 'Honeymoon is not a moon word.'];
  const hits = traceParagraphs(paras, ['moon']);
  assert.deepEqual(hits.map((h) => h.match), ['moon', 'Moons', 'moon’s', 'moon']);
  assert.deepEqual(hits.map((h) => h.paragraphIndex), [0, 0, 0, 1]);
});

test('phrases match across spacing, and the longest term wins', () => {
  const hits = traceParagraphs(['a rose  garden and a rose'], ['rose', 'rose garden']);
  assert.deepEqual(hits.map((h) => h.match), ['rose  garden', 'rose']);
});

test('Urdu words match with their plural endings and not inside other words', () => {
  const paras = ['چاند نکلا، چاندوں کی بات', 'چاندنی رات'];
  assert.deepEqual(traceParagraphs(paras, ['چاند']).map((h) => h.match), ['چاند', 'چاندوں']);
});

test('no terms, no hits; snippets cut on spaces', () => {
  assert.deepEqual(traceParagraphs(['moon'], ['  ']), []);
  const text = 'one two three four five six seven eight nine ten moon eleven twelve thirteen fourteen';
  const i = text.indexOf('moon');
  const s = hitSnippet(text, i, i + 4, 20);
  assert.match(s, /^… .*moon.* …$/);
  assert.ok(!/\S…/.test(s.slice(2)));
});

test('PDF text is counted by page, empty pages kept; text by paragraph', () => {
  assert.deepEqual(documentUnits('p1\n\n\n\np3', 'PDF'), { units: ['p1', '', 'p3'], location: 'page' });
  assert.deepEqual(documentUnits('a\n\nb', 'TXT').units, ['a', 'b']);
});

test('hits for painting, and the Markdown trace', () => {
  assert.deepEqual(paragraphHits('Moon and moon', ['moon']), [{ start: 0, end: 4 }, { start: 9, end: 13 }]);
  const md = traceMarkdown('Moon', ['moon'], [
    { id: 'd', title: 'Odes', format: 'PDF', location: 'page', hits: [{ paragraphIndex: 2, start: 0, end: 4, match: 'moon', snippet: 'the moon' }] }
  ]);
  assert.match(md, /# Motif: Moon/);
  assert.match(md, /> the moon\n> \(p\. 3\)/);
});
