/**
 * Run with: npx tsx --test src/utils/marksExport.test.ts
 *
 * Markdown / JSON export of a document's marks and notes, JSON re-import, and the commonplace
 * book (marks grouped by theme, each cited essay-ready).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectExportMarks,
  marksToMarkdown,
  marksToJson,
  parseMarksJson,
  mergeImportedMarks,
  themesToAdd,
  commonplaceMarkdown,
  commonplaceText,
  isSafeColor,
  withSafeColors
} from './marksExport';
import type { Annotation as StoredEntry } from './documentStorage';

const themes = [
  { id: 't1', name: 'Memory', color: '#aa3300' },
  { id: 't2', name: 'Power', color: '#0055ff' }
];

const pdfMarks: StoredEntry[] = [
  { id: 'h1', page: 3, kind: 'highlight', color: '#ffd400', themeId: 't1', rects: [{ x: 0.1, y: 0.5, w: 0.3, h: 0.02 }], quote: 'All happy families are alike', text: 'Opening line', createdAt: '2026-10-01T09:00:00.000Z', links: ['a1'] },
  { id: 'a1', page: 1, kind: 'highlight', area: true, color: '#00ff00', themeId: 't2', rects: [{ x: 0.1, y: 0.1, w: 0.5, h: 0.4 }], text: 'The map', createdAt: '2026-10-02T09:00:00.000Z', links: ['h1'] },
  { id: 'i1', page: 2, kind: 'ink', color: '#000', themeId: null, points: [{ x: 0.2, y: 0.2 }], createdAt: '2026-10-03T09:00:00.000Z' },
  { id: 'h2', page: 3, kind: 'underline', color: '#123456', themeId: 'gone', rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.02 }], quote: 'each unhappy family', createdAt: '2026-10-04T09:00:00.000Z' }
];
const pdfDoc = { id: 'd1', title: 'Anna Karenina', author: 'Tolstoy', format: 'PDF' };

test('collectExportMarks: PDF marks in page order (top to bottom), with location, quote, note, theme, colour, times', () => {
  const out = collectExportMarks(pdfMarks, pdfDoc, themes);
  assert.deepEqual(out.map((m) => m.id), ['a1', 'i1', 'h2', 'h1']);
  const h1 = out.find((m) => m.id === 'h1')!;
  assert.deepEqual(h1.location, { kind: 'page', page: 3 });
  assert.equal(h1.quote, 'All happy families are alike');
  assert.equal(h1.note, 'Opening line');
  assert.equal(h1.theme, 'Memory');
  assert.equal(h1.color, '#ffd400');
  assert.equal(h1.createdAt, '2026-10-01T09:00:00.000Z');
  assert.deepEqual(h1.links, ['a1']);
  assert.equal(out.find((m) => m.id === 'a1')!.area, true);
  assert.equal(out.find((m) => m.id === 'h2')!.theme, 'Untitled', 'a deleted theme is shown as Untitled');
  assert.equal(out.find((m) => m.id === 'i1')!.theme, null);
});

const poem = ['Shall I compare thee to a summer\'s day?\nThou art more lovely and more temperate:', 'Rough winds do shake the darling buds of May,'];
const textMarks: StoredEntry[] = [
  { id: 'g1', kind: 'highlight', groupId: 'G', anchor: { paragraphIndex: 0, start: 0, end: poem[0].length }, themeId: 't1', color: '#ff0', quote: poem[0], createdAt: '2026-10-05T00:00:00.000Z' },
  { id: 'g2', kind: 'highlight', groupId: 'G', anchor: { paragraphIndex: 1, start: 0, end: 11 }, themeId: 't1', color: '#ff0', quote: 'Rough winds', createdAt: '2026-10-05T00:00:00.000Z' },
  // A 2.4-era note, no quote stored: the words come from the paragraph.
  { id: 'n1', kind: 'note', paragraphIndex: 1, start: 12, end: 27, title: 'Wind', content: 'Violence of nature', themeId: null, timestamp: 'Just now' }
];
const poemDoc = { id: 'd2', title: 'Sonnet 18', format: 'TXT', layout: 'verbatim' as const, paragraphs: poem };

test('collectExportMarks: text marks, one per group with joined quote, lines for a poem, legacy notes read', () => {
  const out = collectExportMarks(textMarks, poemDoc, themes);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].location, { kind: 'line', line: 1, endLine: 3 });
  assert.equal(out[0].quote, `${poem[0]}\nRough winds`);
  assert.equal(out[1].quote, 'do shake the da');
  assert.equal(out[1].note, 'Violence of nature');
  assert.equal(out[1].title, 'Wind');
  assert.deepEqual(out[1].location, { kind: 'line', line: 3 });
});

test('collectExportMarks: plain text documents cite the paragraph', () => {
  const out = collectExportMarks(textMarks, { ...poemDoc, layout: undefined }, themes);
  assert.deepEqual(out[0].location, { kind: 'paragraph', paragraph: 1 });
});

test('Markdown export: every mark with quote, place, theme, colour, note, times; area marks included; links named', () => {
  const md = marksToMarkdown(pdfMarks, pdfDoc, themes, { exportedAt: '2026-11-01T12:00:00.000Z' });
  assert.match(md, /^# Anna Karenina: marks and notes/);
  assert.match(md, /Tolstoy/);
  assert.match(md, /4 marks/);
  assert.match(md, /> All happy families are alike/);
  assert.match(md, /p\. 3/);
  assert.match(md, /Theme: Memory/);
  assert.match(md, /#ffd400/);
  assert.match(md, /Opening line/);
  assert.match(md, /2026-10-01/);
  assert.match(md, /Area highlight/);
  assert.match(md, /The map/);
  assert.match(md, /Linked to: 4/, 'h1 (entry 4) and a1 (entry 1) name each other by entry number');
  assert.match(md, /Linked to: 1/);
});

test('Markdown keeps a multi-line quote inside the blockquote', () => {
  const md = marksToMarkdown(textMarks, poemDoc, themes);
  assert.match(md, /> Shall I compare thee to a summer's day\?\n> Thou art more lovely/);
});

test('JSON export round-trips: re-import gives back exactly the stored marks (links included)', () => {
  const json = marksToJson(pdfMarks, pdfDoc, themes, { exportedAt: '2026-11-01T12:00:00.000Z' });
  const parsed = parseMarksJson(json);
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.annotations, pdfMarks);
  assert.deepEqual(parsed.document, { id: 'd1', title: 'Anna Karenina', author: 'Tolstoy', format: 'PDF' });
  const body = JSON.parse(json);
  assert.equal(body.format, 'marginalia-marks');
  assert.equal(body.version, 1);
  assert.equal(body.marks.length, 4, 'a readable copy rides along');
  assert.deepEqual(body.marks.find((m: { id: string }) => m.id === 'h1').links, ['a1']);
  assert.deepEqual(body.themes.map((t: { id: string }) => t.id), ['t1', 't2'], 'only the themes the marks use');
});

test('JSON round-trips text marks, legacy notes included', () => {
  const parsed = parseMarksJson(marksToJson(textMarks, poemDoc, themes));
  assert.ok(parsed.ok && JSON.stringify(parsed.annotations) === JSON.stringify(textMarks));
});

test('parseMarksJson refuses what it cannot trust, and drops entries without a string id', () => {
  assert.equal(parseMarksJson('not json').ok, false);
  assert.equal(parseMarksJson('{"format":"other","version":1,"annotations":[]}').ok, false);
  assert.equal(parseMarksJson('{"format":"marginalia-marks","version":99,"annotations":[]}').ok, false);
  assert.equal(parseMarksJson('{"format":"marginalia-marks","version":1}').ok, false);
  const p = parseMarksJson('{"format":"marginalia-marks","version":1,"annotations":[{"id":"a","kind":"star","page":1},{"id":3,"kind":"star","page":1},null,"x"]}');
  assert.ok(p.ok && p.annotations.length === 1 && p.annotations[0].id === 'a');
});

const wrap = (annotations: unknown, themes: unknown = []) =>
  JSON.stringify({ format: 'marginalia-marks', version: 1, themes, annotations });

test('parseMarksJson drops entries without a known kind', () => {
  const p = parseMarksJson(wrap([
    { id: 'a', kind: 'highlight', page: 1 },
    { id: 'b', page: 1 },
    { id: 'c', kind: 'explode', page: 1 },
    { id: 'd', kind: 7, page: 1 }
  ]));
  assert.ok(p.ok);
  if (p.ok) assert.deepEqual(p.annotations.map((e) => e.id), ['a']);
});

test('parseMarksJson needs a numeric page or a numeric text anchor', () => {
  const p = parseMarksJson(wrap([
    { id: 'pdf', kind: 'ink', page: 2 },
    { id: 'text', kind: 'bold', anchor: { paragraphIndex: 0, start: 1, end: 4 } },
    { id: 'legacy', kind: 'note', paragraphIndex: 3 },
    { id: 'none', kind: 'highlight' },
    { id: 'strPage', kind: 'highlight', page: '2' },
    { id: 'badAnchor', kind: 'highlight', anchor: { paragraphIndex: 0, start: '1', end: 4 } },
    { id: 'nanPage', kind: 'highlight', page: null }
  ]));
  assert.ok(p.ok);
  if (p.ok) assert.deepEqual(p.annotations.map((e) => e.id), ['pdf', 'text', 'legacy']);
});

test('parseMarksJson drops entries whose rects are not a list of {x,y,w,h} numbers', () => {
  const p = parseMarksJson(wrap([
    { id: 'ok', kind: 'highlight', page: 1, rects: [{ x: 0, y: 0, w: 0.1, h: 0.1 }] },
    { id: 'notList', kind: 'highlight', page: 1, rects: { x: 0 } },
    { id: 'badRect', kind: 'highlight', page: 1, rects: [{ x: 0, y: 0, w: '1', h: 0.1 }] },
    { id: 'nullRect', kind: 'highlight', page: 1, rects: [null] }
  ]));
  assert.ok(p.ok);
  if (p.ok) assert.deepEqual(p.annotations.map((e) => e.id), ['ok']);
});

test('parseMarksJson drops themes whose colour is not a hex colour', () => {
  const p = parseMarksJson(wrap([], [
    { id: 't1', name: 'A', color: '#aa3300' },
    { id: 't2', name: 'B', color: '#abc' },
    { id: 't3', name: 'C', color: 'red;background:url(x)' },
    { id: 't4', name: 'D', color: '#12345' }
  ]));
  assert.ok(p.ok);
  if (p.ok) assert.deepEqual(p.themes.map((t) => t.id), ['t1', 't2']);
});

test('parseMarksJson refuses an export with more than 20,000 marks', () => {
  const many = Array.from({ length: 20_001 }, (_, i) => ({ id: `m${i}`, kind: 'ink', page: 1 }));
  const p = parseMarksJson(wrap(many));
  assert.equal(p.ok, false);
  if (!p.ok) assert.match(p.error, /20,000/);
  assert.equal(parseMarksJson(wrap(many.slice(1))).ok, true, '20,000 is still fine');
});

test('mergeImportedMarks adds only marks not already there, and drops links to marks that do not exist', () => {
  const current: StoredEntry[] = [{ id: 'h1', page: 3 }];
  const imported: StoredEntry[] = [{ id: 'h1', page: 9 }, { id: 'x', page: 1, links: ['h1', 'nowhere'] }];
  const { annotations, added } = mergeImportedMarks(current, imported);
  assert.equal(added, 1);
  assert.deepEqual(annotations, [{ id: 'h1', page: 3 }, { id: 'x', page: 1, links: ['h1'] }]);
});

test('themesToAdd: imported themes missing locally (by id)', () => {
  assert.deepEqual(themesToAdd(themes, [themes[0], { id: 't9', name: 'New', color: '#000000' }]), [{ id: 't9', name: 'New', color: '#000000' }]);
});

test('commonplace book: grouped by theme in the reader\'s theme order, each mark cited essay-ready with its note', () => {
  const md = commonplaceMarkdown(pdfMarks, pdfDoc, themes);
  const memory = md.indexOf('## Memory');
  const power = md.indexOf('## Power');
  const untitled = md.indexOf('## Untitled');
  assert.ok(memory > 0 && power > memory && untitled > power, 'theme order, then deleted themes');
  assert.match(md, /"All happy families are alike" \(Anna Karenina, p\. 3\)/);
  assert.match(md, /Opening line/);
  assert.match(md, /\[Area highlight\] \(Anna Karenina, p\. 1\)/);
  assert.doesNotMatch(md, /i1|ink/i, 'a drawing with no words and no note is left out');
});

test('commonplace book: unthemed marks last, poems cite lines', () => {
  const md = commonplaceMarkdown(textMarks, poemDoc, themes);
  assert.ok(md.indexOf('## Memory') < md.indexOf('## No theme'));
  assert.match(md, /\(Sonnet 18, ll\. 1–3\)/);
  assert.match(md, /"do shake the da" \(Sonnet 18, l\. 3\)/);
  assert.match(md, /Violence of nature/);
});

test('commonplace plain text: same content without Markdown syntax', () => {
  const txt = commonplaceText(pdfMarks, pdfDoc, themes);
  assert.match(txt, /MEMORY/);
  assert.match(txt, /"All happy families are alike" \(Anna Karenina, p\. 3\)/);
  assert.doesNotMatch(txt, /^#/m);
});

// ── Import safety: colours, themes and sizes reach style strings ──────────────

test('parseMarksJson drops marks whose colour is not a plain colour (url(), ;, parentheses)', () => {
  const p = parseMarksJson(wrap([
    { id: 'hex', kind: 'highlight', page: 1, color: '#ffd400' },
    { id: 'short', kind: 'highlight', page: 1, color: '#abc' },
    { id: 'named', kind: 'highlight', page: 1, color: 'black' },
    { id: 'none', kind: 'highlight', page: 1 },
    { id: 'beacon', kind: 'highlight', page: 1, color: 'url(https://example.com/p.png)' },
    { id: 'gradient', kind: 'highlight', page: 1, color: 'red 50%), url(https://x/y)' },
    { id: 'semi', kind: 'highlight', page: 1, color: '#000;background:red' },
    { id: 'num', kind: 'highlight', page: 1, color: 7 }
  ]));
  assert.ok(p.ok);
  if (p.ok) assert.deepEqual(p.annotations.map((e) => e.id), ['hex', 'short', 'named', 'none']);
});

test('parseMarksJson drops marks whose themes are not short id strings', () => {
  const p = parseMarksJson(wrap([
    { id: 'ok', kind: 'star', page: 1, themeIds: ['t1', 't2'], themeId: 't1' },
    { id: 'old', kind: 'star', page: 1, themeId: null },
    { id: 'notList', kind: 'star', page: 1, themeIds: 't1' },
    { id: 'notStr', kind: 'star', page: 1, themeIds: [{ id: 't1' }] },
    { id: 'long', kind: 'star', page: 1, themeIds: ['x'.repeat(200)] },
    { id: 'badOld', kind: 'star', page: 1, themeId: 5 }
  ]));
  assert.ok(p.ok);
  if (p.ok) assert.deepEqual(p.annotations.map((e) => e.id), ['ok', 'old']);
});

test('parseMarksJson drops marks whose fontSize is not a page fraction', () => {
  const p = parseMarksJson(wrap([
    { id: 'ok', kind: 'text', page: 1, fontSize: 0.024 },
    { id: 'str', kind: 'text', page: 1, fontSize: '1px;background:url(x)' },
    { id: 'huge', kind: 'text', page: 1, fontSize: 5000 },
    { id: 'neg', kind: 'text', page: 1, fontSize: -1 }
  ]));
  assert.ok(p.ok);
  if (p.ok) assert.deepEqual(p.annotations.map((e) => e.id), ['ok']);
});

test('isSafeColor: hex and plain colour names only', () => {
  for (const c of ['#000', '#000f', '#a1b2c3', '#a1b2c3d4', 'black', 'transparent']) assert.equal(isSafeColor(c), true, c);
  for (const c of ['url(x)', 'rgb(0,0,0)', 'red;', '#12345', '', 'red blue', 'expression(alert(1))', 7, null]) assert.equal(isSafeColor(c), false, String(c));
});

test('withSafeColors: a mark with an unsafe colour keeps everything but the colour', () => {
  const out = withSafeColors([
    { id: 'a', kind: 'highlight', page: 1, color: 'url(https://x/p)', quote: 'q' },
    { id: 'b', kind: 'highlight', page: 1, color: '#fff' }
  ]);
  assert.deepEqual(out, [
    { id: 'a', kind: 'highlight', page: 1, quote: 'q' },
    { id: 'b', kind: 'highlight', page: 1, color: '#fff' }
  ]);
});

// ── Black it out: words under a black-out never leave in an export ────────────

const blackedOut: StoredEntry[] = [
  { id: 'bar', page: 1, kind: 'rect', color: '#000000', themeIds: [], box: { x: 0.1, y: 0.1, w: 0.4, h: 0.03 }, filled: true, blackout: true, quote: 'secret name' },
  { id: 'under', page: 1, kind: 'highlight', color: '#ffd400', themeIds: ['t1'], rects: [{ x: 0.2, y: 0.11, w: 0.2, h: 0.02 }], quote: 'secret name', text: 'my own note' },
  { id: 'clear', page: 1, kind: 'highlight', color: '#ffd400', themeIds: ['t1'], rects: [{ x: 0.1, y: 0.6, w: 0.2, h: 0.02 }], quote: 'open words' },
  { id: 'otherPage', page: 2, kind: 'highlight', color: '#ffd400', themeIds: ['t1'], rects: [{ x: 0.2, y: 0.11, w: 0.2, h: 0.02 }], quote: 'page two words' }
];

test('Markdown export leaves out the words of a black-out and of any mark touching one; other marks keep theirs', () => {
  const md = marksToMarkdown(blackedOut, pdfDoc, themes);
  assert.doesNotMatch(md, /secret name/);
  assert.match(md, /my own note/, 'the reader\'s own note stays');
  assert.match(md, /open words/);
  assert.match(md, /page two words/, 'a black-out on another page hides nothing here');
});

test('JSON export: neither the readable copy nor the stored marks carry words under a black-out', () => {
  const json = marksToJson(blackedOut, pdfDoc, themes);
  assert.doesNotMatch(json, /secret name/);
  const parsed = parseMarksJson(json);
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.annotations.map((a) => a.id), ['bar', 'under', 'clear', 'otherPage']);
  assert.equal(parsed.annotations.find((a) => a.id === 'under')!.text, 'my own note');
  assert.equal(parsed.annotations.find((a) => a.id === 'clear')!.quote, 'open words');
});

test('commonplace book (Markdown and text) leaves out words under a black-out', () => {
  for (const out of [commonplaceMarkdown(blackedOut, pdfDoc, themes), commonplaceText(blackedOut, pdfDoc, themes)]) {
    assert.doesNotMatch(out, /secret name/);
    assert.match(out, /my own note/);
    assert.match(out, /open words/);
  }
});

test('the stored marks given to an export are not changed', () => {
  marksToJson(blackedOut, pdfDoc, themes);
  assert.equal(blackedOut[1].quote, 'secret name');
});
