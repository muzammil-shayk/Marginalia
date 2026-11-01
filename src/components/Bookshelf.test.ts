/**
 * Run with: npx tsx --test src/components/Bookshelf.test.ts
 *
 * A spine title must fit inside its spine, never overflow. `fitSpineTitle` measures on a canvas;
 * here the canvas is stubbed with a fixed advance per character (half the font size), so every
 * returned line can be checked against the length it was given.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx = {
  font: '600 10px serif',
  measureText(text: string) {
    const size = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)![1]);
    return { width: text.length * size * 0.5 };
  },
};
(globalThis as { document?: unknown }).document = { createElement: () => ({ getContext: () => ctx }) };

const { fitSpineTitle } = await import('./Bookshelf');

const titles = [
  'Gilgamesh',
  'The Epic of Gilgamesh',
  'A very long title about the history of reading, marginalia and the people who wrote in books',
  'Supercalifragilisticexpialidociousness',
  'One',
];

test('no line is longer than the spine allows, and columns stay within the breadth', () => {
  for (const title of titles) {
    for (const breadth of [30, 34, 40, 52, 66]) {
      for (const length of [60, 120, 180, 240]) {
        const fit = fitSpineTitle(title, breadth, length, 'serif');
        assert.ok(fit, `${title} @ ${breadth}x${length}`);
        const advance = fit.size * 0.5;
        for (const line of fit.lines) {
          assert.ok(line.length * advance <= length, `"${line}" is ${line.length * advance}px, room ${length}px`);
        }
        assert.ok(fit.lines.length * fit.size * 1.08 <= breadth, `${fit.lines.length} columns at ${fit.size}px in ${breadth}px`);
      }
    }
  }
});

test('every spine cloth keeps its title and foot text at 4.5:1 or more', async () => {
  const { CLOTHS } = await import('./Bookshelf');
  const { contrast, parseHex } = await import('../utils/markFill');
  // The format label is drawn at 85% opacity; check it composited over the cloth too.
  const blend = (fg: number[], bg: number[], a: number) => fg.map((v, i) => Math.round(a * v + (1 - a) * bg[i])) as [number, number, number];
  for (const c of CLOTHS) {
    const ink = parseHex(c.ink)!;
    const base = parseHex(c.base)!;
    const band = parseHex(c.band)!;
    assert.ok(contrast(ink, base) >= 4.5, `${c.name} ink on base`);
    assert.ok(contrast(ink, band) >= 4.5, `${c.name} ink on band`);
    assert.ok(contrast(blend(ink, base, 0.85), base) >= 4.5, `${c.name} format label`);
  }
});

test('the cloth palette is one muted family: low chroma, close in lightness', async () => {
  const { CLOTHS } = await import('./Bookshelf');
  const { luminance, parseHex } = await import('../utils/markFill');
  const lums = CLOTHS.map((c) => luminance(parseHex(c.base)!));
  assert.ok(Math.max(...lums) - Math.min(...lums) < 0.3, 'lightness spread');
  for (const c of CLOTHS) {
    const rgb = parseHex(c.base)!;
    assert.ok((Math.max(...rgb) - Math.min(...rgb)) / 255 < 0.2, `${c.name} chroma`);
  }
});

test('progress reads "N% completed", and says nothing for a book never opened', async () => {
  const { progressLabel } = await import('./Bookshelf');
  assert.equal(progressLabel({ progressPercent: 42 }), '42% completed');
  assert.equal(progressLabel({ progressPercent: 0 }), '0% completed');
  assert.equal(progressLabel({ progressPercent: null }), '');
  assert.equal(progressLabel({}), '');
});

test('page one keeps a verbatim poem’s line breaks and stanza gaps; prose is one paragraph per line', async () => {
  const { pageParagraphs } = await import('./Bookshelf');
  const poem = '\n\nBecause I could not stop for Death –\n  He kindly stopped for me –\r\n\r\nWe slowly drove – He knew no haste\n';
  assert.deepEqual(pageParagraphs(poem, 'verbatim'), [
    'Because I could not stop for Death –\n  He kindly stopped for me –\n\nWe slowly drove – He knew no haste'
  ]);
  assert.deepEqual(pageParagraphs(poem), [
    'Because I could not stop for Death –',
    'He kindly stopped for me –',
    'We slowly drove – He knew no haste'
  ]);
  assert.deepEqual(pageParagraphs('   \n\n', 'verbatim'), []);
});
