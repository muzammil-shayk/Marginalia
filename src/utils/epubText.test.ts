/**
 * Run with: npx tsx --test src/utils/epubText.test.ts
 *
 * The .epub is generated here with jszip, and its chapters parsed with @xmldom/xmldom — both
 * already installed as epubjs's own dependencies. epubjs itself does not run under Node.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { chapterText, collectEpubText } from './epubText';

const xhtml = (body: string) =>
  `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>c</title></head><body>${body}</body></html>`;

async function tinyEpub(): Promise<JSZip> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file('OEBPS/one.xhtml', xhtml(
    '<h1>Chapter One</h1><p>First   paragraph,\n wrapped.</p><p>Second <em>paragraph</em>.</p>' +
    '<ul><li>Item a</li><li>Item b</li></ul><blockquote>A quote.</blockquote>' +
    '<div>Loose div text</div><div><p>Nested p</p></div><pre>line 1\n\nline 2</pre>'
  ));
  zip.file('OEBPS/two.xhtml', xhtml('<h2>Chapter Two</h2><p>The end.</p>'));
  return JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }));
}

async function loadChapter(zip: JSZip, href: string) {
  const file = zip.file(`OEBPS/${href}`);
  if (!file) throw new Error(`missing ${href}`);
  return new DOMParser().parseFromString(await file.async('string'), 'application/xhtml+xml');
}

test('a chapter keeps its paragraphs, headings and list items as separate paragraphs', async () => {
  const zip = await tinyEpub();
  assert.deepEqual(chapterText((await loadChapter(zip, 'one.xhtml')) as unknown as Document).split('\n\n'), [
    'Chapter One',
    'First paragraph, wrapped.',
    'Second paragraph.',
    'Item a',
    'Item b',
    'A quote.',
    'Loose div text',
    'Nested p',
    'line 1\nline 2'
  ]);
});

test('a chapter that fails to load is logged and the rest still import', async () => {
  const zip = await tinyEpub();
  const warnings: unknown[][] = [];
  const text = await collectEpubText(
    ['one.xhtml', 'gone.xhtml', 'two.xhtml'],
    async (href) => (await loadChapter(zip, href)) as unknown as Document,
    (...args) => warnings.push(args)
  );
  assert.ok(text.startsWith('Chapter One\n\nFirst paragraph, wrapped.'));
  assert.ok(text.endsWith('line 1\nline 2\n\nChapter Two\n\nThe end.'));
  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0][0]), /gone\.xhtml/);
});
