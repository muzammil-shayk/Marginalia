/**
 * Run with: npx tsx --test src/utils/ocrWords.test.ts
 *
 * Fixtures are real tesseract.js 7 output (blocks), trimmed to a few lines: an English page of a
 * scanned book (image 1080 x 1677, eng+urd) and a page in another script (image 1464 x 2076)
 * read by an older version.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidOcrPage, ocrPageText, ocrSpans, ocrWordsFromBlocks, type OcrBlock, type OcrWord } from './ocrWords';

const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });
const word = (text: string, b: ReturnType<typeof box>) => ({ text, bbox: b });

const english: OcrBlock[] = [
  {
    paragraphs: [
      {
        is_ltr: 1,
        lines: [
          { text: 'Farrar, Straus and Giroux\n', words: [word('Farrar,', box(402, 214, 480, 238)), word('Straus', box(493, 215, 564, 234)), word('and', box(576, 215, 617, 234)), word('Giroux', box(629, 215, 710, 235))] },
          { text: '19 Union\n', words: [word('19', box(313, 254, 336, 272)), word('Union', box(350, 253, 420, 272))] }
        ]
      }
    ]
  }
];

const urdu: OcrBlock[] = [
  {
    paragraphs: [
      {
        is_ltr: 0,
        lines: [{ text: 'پائّیے ںا\n', words: [word('پائّیے', box(667, 92, 788, 142)), word('ںا', box(618, 93, 664, 133))] }]
      }
    ]
  }
];

const round = (n: number) => Math.round(n * 10000) / 10000;

test('words become page fractions, numbered by line, in reading order', () => {
  const words = ocrWordsFromBlocks(english, 1080, 1677);
  assert.equal(words.length, 6);
  assert.deepEqual(
    words.map((w) => [w.text, w.line, round(w.x), round(w.y), round(w.w), round(w.h)]),
    [
      ['Farrar,', 0, round(402 / 1080), round(214 / 1677), round(78 / 1080), round(24 / 1677)],
      ['Straus', 0, round(493 / 1080), round(215 / 1677), round(71 / 1080), round(19 / 1677)],
      ['and', 0, round(576 / 1080), round(215 / 1677), round(41 / 1080), round(19 / 1677)],
      ['Giroux', 0, round(629 / 1080), round(215 / 1677), round(81 / 1080), round(20 / 1677)],
      ['19', 1, round(313 / 1080), round(254 / 1677), round(23 / 1080), round(18 / 1677)],
      ['Union', 1, round(350 / 1080), round(253 / 1677), round(70 / 1080), round(19 / 1677)]
    ]
  );
  assert.ok(words.every((w) => !w.rtl));
});

test('a line in another script keeps tesseract\'s order, as plain words: nothing is marked right to left', () => {
  const words = ocrWordsFromBlocks(urdu, 1464, 2076);
  assert.deepEqual(words.map((w) => w.text), ['پائّیے', 'ںا']);
  assert.ok(words.every((w) => !('rtl' in w)));
  assert.ok(words[0].x > words[1].x);
});

test('blank words and empty boxes are dropped; line numbers run on across paragraphs and blocks', () => {
  const words = ocrWordsFromBlocks(
    [
      { paragraphs: [{ is_ltr: 1, lines: [{ text: 'a\n', words: [word(' ', box(0, 0, 5, 5)), word('a', box(10, 10, 20, 20)), word('b', box(30, 10, 30, 20))] }] }] },
      { paragraphs: [{ is_ltr: 1, lines: [{ text: 'c\n', words: [word('c', box(10, 40, 20, 50))] }] }] }
    ],
    100,
    100
  );
  assert.deepEqual(words.map((w) => [w.text, w.line]), [['a', 0], ['c', 1]]);
});

test('spans fit each word to its box: font size from the height, stretched to the width', () => {
  const words: OcrWord[] = [
    { text: 'and', x: 0.1, y: 0.2, w: 0.1, h: 0.02, line: 0 },
    { text: 'so', x: 0.25, y: 0.2, w: 0.05, h: 0.02, line: 0 },
    { text: 'on', x: 0.1, y: 0.3, w: 0.05, h: 0.02, line: 1 }
  ];
  // A fake measure: 10px per character at font size 20.
  const spans = ocrSpans(words, 1000, 1000, (text, size) => (text.length * size) / 2);
  assert.deepEqual(spans, [
    // Between words of a line a space, so the quote has its spaces; none at a line's end.
    { text: 'and ', left: 100, top: 200, fontSize: 20, scaleX: 100 / 30 },
    { text: 'so', left: 250, top: 200, fontSize: 20, scaleX: 50 / 20 },
    { text: 'on', left: 100, top: 300, fontSize: 20, scaleX: 50 / 20 }
  ]);
});

test('a word an older version saved as right to left lays out as a plain span', () => {
  const spans = ocrSpans([{ text: 'ںا', x: 0.5, y: 0.1, w: 0.05, h: 0.02, line: 0, rtl: true }], 1000, 1000, () => 10);
  assert.deepEqual(spans, [{ text: 'ںا', left: 500, top: 100, fontSize: 20, scaleX: 5 }]);
});

test('a saved OCR page is accepted only in the expected shape', () => {
  const good = { words: [{ text: 'and', x: 0.1, y: 0.2, w: 0.1, h: 0.02, line: 0 }], langs: 'eng+urd', createdAt: '2026-11-20T10:00:00.000Z' };
  assert.equal(isValidOcrPage(good), true);
  assert.equal(isValidOcrPage({ ...good, words: [] }), true);
  assert.equal(isValidOcrPage({ ...good, words: [{ ...good.words[0], rtl: true }] }), true);
  assert.equal(isValidOcrPage(null), false);
  assert.equal(isValidOcrPage({ ...good, words: 'x' }), false);
  assert.equal(isValidOcrPage({ ...good, words: [{ ...good.words[0], x: 1.5 }] }), false);
  assert.equal(isValidOcrPage({ ...good, words: [{ ...good.words[0], y: Number.NaN }] }), false);
  assert.equal(isValidOcrPage({ ...good, words: [{ ...good.words[0], text: 'x'.repeat(201) }] }), false);
  assert.equal(isValidOcrPage({ ...good, words: [{ ...good.words[0], line: -1 }] }), false);
  assert.equal(isValidOcrPage({ ...good, words: [{ ...good.words[0], rtl: 'yes' }] }), false);
  assert.equal(isValidOcrPage({ ...good, words: Array.from({ length: 20001 }, () => good.words[0]) }), false);
  assert.equal(isValidOcrPage({ ...good, langs: 5 }), false);
});

test('bidi marks tesseract wraps words in (RLM, LRM, embeddings) are dropped from the text', () => {
  const words = ocrWordsFromBlocks(
    [{ paragraphs: [{ is_ltr: 0, lines: [{ text: '‏کو‎ Td\n', words: [word('‏کو‎', box(10, 10, 40, 30)), word('‫Td‬', box(50, 10, 70, 30)), word('‏', box(80, 10, 90, 30))] }] }] }],
    100,
    100
  );
  assert.deepEqual(words.map((w) => w.text), ['کو', 'Td']);
});

test("a page's OCR text for Find reads as its layer does: spaces between words, a space at each line end", () => {
  const words: OcrWord[] = [
    { text: 'old', x: 0.1, y: 0.1, w: 0.1, h: 0.02, line: 0 },
    { text: 'lantern', x: 0.3, y: 0.1, w: 0.1, h: 0.02, line: 0 },
    { text: 'glowed', x: 0.1, y: 0.2, w: 0.1, h: 0.02, line: 1 }
  ];
  assert.equal(ocrPageText(words), 'old lantern glowed ');
  assert.equal(ocrPageText([]), '');
});
