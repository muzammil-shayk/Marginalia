/**
 * Run with: npx tsx --test src/utils/markFill.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast, FILL_TARGETS, markFill, READER_GROUNDS, solveMarkFill } from './markFill';

// The default themes, the terminology blue, the legacy palette names' colours, plus black and white.
const COLOURS = ['#52796f', '#5e60ce', '#d97706', '#0ea5e9', '#d4a017', '#a855f7', '#14b8a6', '#f43f5e', '#c89b3c', '#000000', '#ffffff'];

test('every theme colour reads as a mark in both themes, at rest and on hover', () => {
  for (const isDark of [false, true]) {
    const ground = isDark ? READER_GROUNDS.night : READER_GROUNDS.paper;
    const text = isDark ? READER_GROUNDS.textDark : READER_GROUNDS.textLight;
    for (const state of ['rest', 'hover'] as const) {
      for (const hex of COLOURS) {
        const fill = solveMarkFill(hex, isDark, state)!;
        const vsGround = contrast(fill.composite, ground);
        const vsText = contrast(fill.composite, text);
        assert.ok(vsText >= 4.5, `${hex} ${isDark ? 'dark' : 'light'} ${state}: text ${vsText.toFixed(2)}`);
        // White on paper cannot get far from paper; everything else reaches its target.
        if (!(hex === '#ffffff' && !isDark)) {
          const goal = FILL_TARGETS[isDark ? 'dark' : 'light'][state] - 0.02;
          assert.ok(vsGround >= goal, `${hex} ${isDark ? 'dark' : 'light'} ${state}: ground ${vsGround.toFixed(2)}`);
        }
      }
    }
  }
});

test('dark mode is stronger than the old flat 22% fill', () => {
  const old = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return READER_GROUNDS.night.map((v, i) => v + (c[i] - v) * 0.22) as [number, number, number];
  };
  for (const hex of ['#52796f', '#5e60ce', '#d97706']) {
    const now = contrast(solveMarkFill(hex, true)!.composite, READER_GROUNDS.night);
    assert.ok(now > contrast(old(hex), READER_GROUNDS.night) + 0.3, hex);
  }
});

test('hover is stronger than rest, and the CSS keeps the theme hue', () => {
  for (const hex of COLOURS.slice(0, 4)) {
    for (const isDark of [false, true]) {
      assert.ok(solveMarkFill(hex, isDark, 'hover')!.alpha >= solveMarkFill(hex, isDark, 'rest')!.alpha);
    }
  }
  assert.match(markFill('#52796f', false), /^rgb\(82 121 111 \/ 0\.\d+\)$/);
  assert.match(markFill('not-a-colour', true), /^color-mix/);
});

test('dark reader selection (index.css): stone-200 on gold 35% over night keeps 4.5:1', () => {
  const { night, textDark } = READER_GROUNDS;
  const gold = [233, 185, 73];
  const fill = night.map((v, i) => v + (gold[i] - v) * 0.35) as [number, number, number];
  assert.ok(contrast(textDark, fill) >= 4.5, `got ${contrast(textDark, fill).toFixed(2)}`);
});
