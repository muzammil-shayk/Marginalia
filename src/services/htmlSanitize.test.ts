/**
 * Run with: npx tsx --test src/services/htmlSanitize.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeImportHtml } from './htmlSanitize';

const page = (head: string, body: string) => `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;

test('meta refresh and base are removed, other meta tags stay', () => {
  const out = sanitizeImportHtml(page(
    '<meta charset="utf-8"><META HTTP-EQUIV="Refresh" content="0; url=https://evil.example/"><base href="https://evil.example/">',
    '<p>x</p>'
  ));
  assert.doesNotMatch(out, /refresh/i);
  assert.doesNotMatch(out, /<base/i);
  assert.match(out, /<meta charset="utf-8">/);
});

test('scripts, iframes, objects and embeds are removed', () => {
  const out = sanitizeImportHtml(page('<script src="https://evil.example/x.js"></script>',
    '<p>a</p><SCRIPT>fetch("https://evil.example")</SCRIPT><iframe src="https://evil.example"></iframe><object data="x"></object><embed src="y">'));
  assert.doesNotMatch(out, /evil\.example/);
  assert.doesNotMatch(out, /<(iframe|object|embed)/i);
  assert.match(out, /<p>a<\/p>/);
});

test('on* event attributes are removed in any quoting', () => {
  const out = sanitizeImportHtml(page('', `<img src="data:image/png;base64,AA" onerror="x()"><p onclick='y()' ONLOAD=z() class="k">t</p>`));
  assert.doesNotMatch(out, /on(error|click|load)/i);
  assert.match(out, /<img src="data:image\/png;base64,AA">/);
  assert.match(out, /class="k"/);
});

test('remote CSS url() and every @import are removed; data: and relative urls stay', () => {
  const css = `@import url("https://evil.example/a.css"); @import 'b.css';
    .a { background: url(https://evil.example/t.png) } .b { background: url('//evil.example/t.png') }
    .c { background: url("data:image/png;base64,AA") } .d { background: url(img/local.png) }`;
  const out = sanitizeImportHtml(page(`<style>${css}</style>`, `<p style="background:url(http://evil.example/s.png)">t</p>`));
  assert.doesNotMatch(out, /evil\.example/);
  assert.doesNotMatch(out, /@import/i);
  assert.match(out, /data:image\/png;base64,AA/);
  assert.match(out, /img\/local\.png/);
});

test('the app\'s own layout-ready signal is the only script left', () => {
  const out = sanitizeImportHtml(page('', '<p>t</p><script>window.__marginaliaLayoutReady = true; steal()</script>'));
  assert.equal(out.match(/<script/gi)?.length, 1);
  assert.doesNotMatch(out, /steal/);
  assert.match(out, /__marginaliaLayoutReady = true/);
});

const onlyOurScript = (out: string) => {
  // Leftover inert text ("alert(1)") is fine; a script element holding it is not.
  assert.equal(out.match(/<script/gi)?.length, 1, out);
  assert.doesNotMatch(out, /<script[^>]*>[^<]*alert/i);
};

test('nested script tags cannot reassemble after one strip pass', () => {
  onlyOurScript(sanitizeImportHtml(page('', '<scr<script>ipt>alert(1)</scr<script>ipt>')));
  onlyOurScript(sanitizeImportHtml(page('', '<scr<script></script>ipt>alert(1)</scr<script></script>ipt>')));
});

test('a handler after a slash is removed: <img/onerror=…>', () => {
  const out = sanitizeImportHtml(page('', '<img/onerror=alert(1) src=x>'));
  assert.doesNotMatch(out, /onerror/i);
});

test('a handler after a quoted value holding ">" is removed', () => {
  const out = sanitizeImportHtml(page('', '<input value="a>b" onfocus=alert(1) autofocus>'));
  assert.doesNotMatch(out, /onfocus/i);
  assert.match(out, /value="a>b"/);
});

test('CSS backslash escapes cannot spell @import or url(', () => {
  const out = sanitizeImportHtml(page(
    '<style>@\\69mport "https://evil.example/a.css"; @im\\port "https://evil.example/b.css"; .a { background: u\\72l(https://evil.example/t.png) }</style>',
    ''
  ));
  assert.doesNotMatch(out, /@import/i);
  assert.doesNotMatch(out, /url\(\s*['"]?\s*(https?:|\/\/)/i);
  assert.doesNotMatch(out, /\\/);
});

test('entity-encoded URLs in a style attribute are caught', () => {
  const out = sanitizeImportHtml(page('', '<p style="background:url(&quot;http://evil.example/t.png&quot;)">t</p>'));
  assert.doesNotMatch(out, /evil\.example/);
});

test('an escape that reassembles a closing style tag cannot smuggle a script out', () => {
  const out = sanitizeImportHtml(page('<style>p{}</sty\\le><scr\\ipt>alert(1)</scr\\ipt></style>', ''));
  onlyOurScript(out);
});

test('javascript: links are neutralised, including entity and whitespace tricks', () => {
  const out = sanitizeImportHtml(page('',
    '<a href="javascript:alert(1)">a</a><a href=" JaVa&#x09;Script&colon;alert(1)">b</a><a href=\'&#106;avascript:alert(1)\'>c</a><a href="https://ok.example/">d</a>'));
  assert.doesNotMatch(out, /javascript|&colon;|&#106;/i);
  assert.match(out, /href="https:\/\/ok\.example\/"/);
});

test('unquoted and slash-prefixed style attributes are cleaned too', () => {
  const out = sanitizeImportHtml(page('', '<p style=background:url(http://evil.example/a.png)>a</p><p/style="background:url(http://evil.example/b.png)">b</p>'));
  assert.doesNotMatch(out, /evil\.example/);
});
