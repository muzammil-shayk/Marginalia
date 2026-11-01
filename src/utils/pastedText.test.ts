/**
 * Run with: npx tsx --test src/utils/pastedText.test.ts
 *
 * Pasted custom text keeps its layout: line breaks, indentation and stanza gaps (poems), and
 * bold/italic/underline when the clipboard carried HTML.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitParagraphs, pastedTextLayout, pastedHtmlLayout } from './pastedText';

const SONNET =
  "  Shall I compare thee to a summer's day?\r\n    Thou art more lovely and more temperate:  \r\n\r\n\r\n  Rough winds do shake\n";

test('the default split is the reader\'s existing rule: blank lines, each paragraph trimmed', () => {
  assert.deepEqual(splitParagraphs('  One\n two \n\n\n\nThree  '), ['One\n two', 'Three']);
  assert.deepEqual(splitParagraphs('   '), []);
});

test('the verbatim split keeps leading indentation and inner line breaks', () => {
  assert.deepEqual(splitParagraphs('  One\n    two\n\n  Three', 'verbatim'), ['  One\n    two', '  Three']);
});

test('the verbatim split treats a whitespace-only line as a stanza gap and drops trailing spaces', () => {
  assert.deepEqual(splitParagraphs('a  \n \t \nb\n\n\n\nc\n', 'verbatim'), ['a', 'b', 'c']);
});

test('pasted plain text keeps indentation and line breaks; stanza gaps become one blank line', () => {
  assert.equal(
    pastedTextLayout(SONNET),
    "  Shall I compare thee to a summer's day?\n    Thou art more lovely and more temperate:\n\n  Rough winds do shake"
  );
});

test('pasted plain text: no-break spaces used for indentation count as spaces', () => {
  assert.equal(pastedTextLayout('  Indented'), '  Indented');
});

test('pasted plain text round-trips through the verbatim split', () => {
  const text = pastedTextLayout(SONNET);
  assert.equal(splitParagraphs(text, 'verbatim').join('\n\n'), text);
});

test('HTML: paragraphs become paragraphs, <br> a line break, <br><br> a stanza gap', () => {
  const { text } = pastedHtmlLayout('<p>First para</p>\n<p>Line one<br>Line two<br><br>Next stanza</p>');
  assert.deepEqual(splitParagraphs(text, 'verbatim'), ['First para', 'Line one\nLine two', 'Next stanza']);
});

test('HTML: source whitespace collapses, &nbsp; indentation is kept, entities are decoded', () => {
  const { text } = pastedHtmlLayout('<div>\n   &nbsp;&nbsp;Tom   &amp;\n  Jerry &lt;3 &#8212; &#x41;</div>');
  assert.equal(text, '  Tom & Jerry <3 — A');
});

test('HTML: <pre> keeps its own spacing', () => {
  const { text } = pastedHtmlLayout('<pre>  a\n    b</pre>');
  assert.equal(text, '  a\n    b');
});

test('HTML: bold, italic and underline become style ranges on the paragraph text', () => {
  const html = '<p>Plain</p><p>A <b>bold <i>both</i></b> and <u>under</u></p>';
  const { text, styles } = pastedHtmlLayout(html);
  const paras = splitParagraphs(text, 'verbatim');
  const pick = (s: (typeof styles)[number]) => [s.style, paras[s.anchor.paragraphIndex].slice(s.anchor.start, s.anchor.end)];
  assert.deepEqual(styles.map(pick), [
    ['bold', 'bold both'],
    ['italic', 'both'],
    ['underline', 'under']
  ]);
  assert.ok(styles.every((s) => s.anchor.paragraphIndex === 1));
});

test('HTML: inline CSS weight/style count, and font-weight:normal cancels a wrapping <b> (Google Docs)', () => {
  const html =
    '<b style="font-weight:normal" id="docs-internal-guid-x"><p><span style="font-weight:700">Loud</span> ' +
    '<span style="font-style:italic">soft</span> plain</p></b>';
  const { text, styles } = pastedHtmlLayout(html);
  assert.equal(text, 'Loud soft plain');
  assert.deepEqual(
    styles.map((s) => [s.style, text.slice(s.anchor.start, s.anchor.end)]),
    [
      ['bold', 'Loud'],
      ['italic', 'soft']
    ]
  );
});

test('HTML: a style range never covers trailing spaces dropped at a line end', () => {
  const { text, styles } = pastedHtmlLayout('<p><b>Bold   </b><br>next</p>');
  assert.equal(text, 'Bold\nnext');
  assert.deepEqual(styles.map((s) => [s.anchor.start, s.anchor.end]), [[0, 4]]);
});

test('HTML: script, style, head and comments contribute no text', () => {
  const html =
    '<html><head><title>T</title><style>p{color:red}</style></head><body><!-- c --><p>Hi</p>' +
    '<script>alert(1)</script></body></html>';
  assert.equal(pastedHtmlLayout(html).text, 'Hi');
});

test('HTML: a style range across two paragraphs is split per paragraph', () => {
  const { styles } = pastedHtmlLayout('<b><p>One</p><p>Two</p></b>');
  assert.deepEqual(
    styles.map((s) => [s.anchor.paragraphIndex, s.anchor.start, s.anchor.end]),
    [
      [0, 0, 3],
      [1, 0, 3]
    ]
  );
});
