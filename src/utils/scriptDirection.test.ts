/**
 * Run with: npx tsx --test src/utils/scriptDirection.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasRtlText, isArabicScript, paragraphTypeface, textDirection } from './scriptDirection';

test('direction follows the first letter, skipping digits and punctuation', () => {
  assert.equal(textDirection('دل ہی تو ہے نہ سنگ و خشت'), 'rtl');
  assert.equal(textDirection('“1.” دل'), 'rtl');
  assert.equal(textDirection('שלום'), 'rtl');
  assert.equal(textDirection('Hamlet: دل'), 'ltr');
  assert.equal(textDirection('123 …'), 'ltr');
  assert.equal(textDirection(''), 'ltr');
});

test('Arabic script means most letters are Arabic script; Hebrew is not', () => {
  assert.equal(isArabicScript('ہزاروں خواہشیں ایسی'), true);
  assert.equal(isArabicScript('A line with one word دل'), false);
  assert.equal(isArabicScript('שלום'), false);
  assert.equal(isArabicScript('...'), false);
});

test('any right-to-left passage is found', () => {
  assert.equal(hasRtlText(['plain', undefined, 'still plain']), false);
  assert.equal(hasRtlText(['plain', 'غالب']), true);
});

test('Urdu gets Nastaliq with tall lines by default, Naskh when chosen, Latin is unchanged', () => {
  const urdu = paragraphTypeface('ہزاروں خواہشیں', 'Literata');
  assert.equal(urdu.dir, 'rtl');
  assert.match(urdu.fontFamily, /^'Noto Nastaliq Urdu'/);
  assert.equal(urdu.lineHeight, '2.4');
  assert.match(paragraphTypeface('ہزاروں', 'Literata', 'naskh').fontFamily, /Naskh/);
  assert.deepEqual(paragraphTypeface('To be', 'Literata'), { dir: 'ltr', fontFamily: 'Literata', lineHeight: '1.75' });
  assert.equal(paragraphTypeface('שלום', 'Literata').dir, 'rtl');
});
