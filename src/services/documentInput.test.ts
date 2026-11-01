/**
 * Run with: npx tsx --test src/services/documentInput.test.ts
 *
 * The body of POST /api/documents turned into what the store saves: uploads unchanged, pasted
 * custom text (`layout: 'verbatim'`) with its layout kept and its HTML formatting read safely.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentParamsFromBody } from './documentInput';

test('an upload body is stored as before: text untouched, no layout', () => {
  assert.deepEqual(documentParamsFromBody({ title: ' Book ', text: '  a\n\n b ', format: 'PDF', filename: 'b.pdf' }), {
    title: 'Book',
    text: '  a\n\n b ',
    format: 'PDF',
    filename: 'b.pdf'
  });
});

test('missing text is refused', () => {
  assert.deepEqual(documentParamsFromBody({ title: 'x', text: '   ' }), { error: 'Document text is required.' });
  assert.deepEqual(documentParamsFromBody(null), { error: 'Document text is required.' });
});

test('an empty name falls back to the default the client sent being absent', () => {
  assert.equal((documentParamsFromBody({ text: 'a' }) as { title: string }).title, 'Untitled Document');
});

test('pasted plain text keeps its layout', () => {
  assert.deepEqual(documentParamsFromBody({ title: 'Poem', text: '  One\r\n    two  \r\n\r\n\r\nThree', layout: 'verbatim' }), {
    title: 'Poem',
    text: '  One\n    two\n\nThree',
    format: 'TXT',
    filename: undefined,
    layout: 'verbatim'
  });
});

test('pasted HTML gives the text and its styles; scripts never reach the text', () => {
  const params = documentParamsFromBody({
    title: 'Poem',
    text: 'One two',
    html: '<p><b>One</b> two<script>alert(1)</script></p>',
    layout: 'verbatim'
  }) as { text: string; textStyles: unknown };
  assert.equal(params.text, 'One two');
  assert.deepEqual(params.textStyles, [{ style: 'bold', anchor: { paragraphIndex: 0, start: 0, end: 3 } }]);
});

test('pasted HTML with no readable text falls back to the plain text', () => {
  const params = documentParamsFromBody({ text: 'Plain', html: '<img src=x>', layout: 'verbatim' }) as { text: string; textStyles?: unknown };
  assert.equal(params.text, 'Plain');
  assert.equal(params.textStyles, undefined);
});

test('html is ignored unless the body is pasted text', () => {
  const params = documentParamsFromBody({ text: 'T', html: '<b>H</b>' }) as { text: string };
  assert.equal(params.text, 'T');
});
