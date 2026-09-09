/**
 * Run with: npx tsx --test src/utils/bookTitle.test.ts
 *
 * Cases are real filenames from a real library, which is the only reason to trust a heuristic
 * like this one at all.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessBookFields } from './bookTitle';

test('author - title (year) - source', () => {
  assert.deepEqual(
    guessBookFields('Spencer, Johnson _ Blanchard, Kenneth - Who Moved My Cheese_ (2011) - libgen.li'),
    { title: 'Who Moved My Cheese', author: 'Spencer, Johnson; Blanchard, Kenneth', edition: '2011' }
  );
});

test('title (author, dates) (mirrors)', () => {
  assert.deepEqual(
    guessBookFields(
      'Ex libris confessions of a common reader (Fadiman, Anne, 1953-) (z-library.sk, 1lib.sk, z-lib.sk)'
    ),
    { title: 'Ex libris confessions of a common reader', author: 'Fadiman, Anne', edition: '' }
  );
});

test('a plain title is left alone', () => {
  assert.deepEqual(guessBookFields('Gilgamesh'), { title: 'Gilgamesh', author: '', edition: '' });
  assert.deepEqual(guessBookFields('kulliyat iqbal urdu'), {
    title: 'kulliyat iqbal urdu',
    author: '',
    edition: ''
  });
});

test('a real subtitle is not mistaken for an author or a source', () => {
  assert.deepEqual(guessBookFields('Dune - Book One'), {
    title: 'Dune - Book One',
    author: '',
    edition: ''
  });
  assert.deepEqual(guessBookFields('Gilgamesh: A New English Version'), {
    title: 'Gilgamesh: A New English Version',
    author: '',
    edition: ''
  });
});
