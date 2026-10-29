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
