/**
 * Poetry-aware reading: line and couplet numbers, and where the rhymes fall. Pure, so it is
 * tested; the reader paints the results with the CSS Custom Highlight API, which adds nothing to
 * the paragraphs' text or the offsets marks count.
 *
 * A stanza is a paragraph (`splitParagraphs`), a line is a non-empty line inside it, and a couplet
 * is each pair of lines in a stanza, counted on through the poem. Rhyme: the last word of each
 * line, grouped into a rhyme scheme (A, B, …) per stanza by the sound from its last vowel on.
 */

export interface PoemLine {
  paragraphIndex: number;
  /** Character offsets of the line in its paragraph, `end` exclusive, indentation excluded. */
  start: number;
  end: number;
  /** 1-based through the whole document. */
  lineNo: number;
  /** 1-based couplet this line belongs to, through the whole document. */
  coupletNo: number;
  /** 0 for the first line of its couplet, 1 for the second. */
  coupletLine: 0 | 1;
  /** Rhyme-scheme letter within its stanza, when its line ends rhyme with another's. */
  rhyme?: string;
}

export interface PoemSpan {
  paragraphIndex: number;
  start: number;
  end: number;
}

export interface PoemAnalysis {
  lines: PoemLine[];
  spans: PoemSpan[];
}

interface Word {
  start: number;
  end: number;
  key: string;
}

const WORD = /[\p{L}\p{M}\p{N}'’]+/gu;
/** Combining marks never change a rhyme. */
const MARKS = /\p{M}/gu;
const LATIN_VOWEL = /[aeiouyàáâäèéêëìíîïòóôöùúûü]/;

const keyOf = (w: string) => w.normalize('NFC').toLowerCase().replace(MARKS, '').replace(/[’']/g, '');

function wordsOf(text: string, from: number, to: number): Word[] {
  const out: Word[] = [];
  const slice = text.slice(from, to);
  for (const m of slice.matchAll(WORD)) {
    const key = keyOf(m[0]);
    if (key) out.push({ start: from + m.index!, end: from + m.index! + m[0].length, key });
  }
  return out;
}

/** The lines of one paragraph, with offsets, skipping empty ones and leading indentation. */
function linesOf(text: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let at = 0;
  for (const raw of text.split('\n')) {
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (body) out.push({ start: at + lead, end: at + lead + body.length });
    at += raw.length + 1;
  }
  return out;
}

/** The sound a Latin-script word rhymes on: from its last vowel group to the end. */
export function rhymeTail(word: string): string {
  const w = keyOf(word).replace(/[^\p{L}\p{N}]/gu, '');
  if (!/[a-zà-ü]/.test(w)) return w.slice(-2);
  let i = w.length - 1;
  while (i >= 0 && !LATIN_VOWEL.test(w[i])) i--;
  while (i > 0 && LATIN_VOWEL.test(w[i - 1])) i--;
  return i < 0 ? w : w.slice(i);
}

export function analysePoem(paragraphs: string[]): PoemAnalysis {
  const lines: PoemLine[] = [];
  const words = new Map<PoemLine, Word[]>();
  let lineNo = 0;
  let coupletNo = 0;
  paragraphs.forEach((text, paragraphIndex) => {
    linesOf(text).forEach((l, i) => {
      if (i % 2 === 0) coupletNo++;
      const line: PoemLine = { paragraphIndex, ...l, lineNo: ++lineNo, coupletNo, coupletLine: (i % 2) as 0 | 1 };
      lines.push(line);
      words.set(line, wordsOf(text, l.start, l.end));
    });
  });

  const spans: PoemSpan[] = [];
  // A rhyme scheme per stanza, from each line's last word.
  const byStanza = new Map<number, PoemLine[]>();
  for (const l of lines) (byStanza.get(l.paragraphIndex) ?? byStanza.set(l.paragraphIndex, []).get(l.paragraphIndex)!).push(l);
  for (const stanza of byStanza.values()) {
    const tails = stanza.map((l) => {
      const ws = words.get(l)!;
      const w = ws[ws.length - 1];
      return w ? { w, tail: rhymeTail(paragraphs[l.paragraphIndex].slice(w.start, w.end)) } : null;
    });
    const counts = new Map<string, number>();
    for (const t of tails) if (t && t.tail.length >= 2) counts.set(t.tail, (counts.get(t.tail) ?? 0) + 1);
    const letters = new Map<string, string>();
    stanza.forEach((l, i) => {
      const t = tails[i];
      if (!t || (counts.get(t.tail) ?? 0) < 2) return;
      if (!letters.has(t.tail)) letters.set(t.tail, String.fromCharCode(65 + letters.size));
      l.rhyme = letters.get(t.tail);
      const text = paragraphs[l.paragraphIndex].slice(t.w.start, t.w.end);
      spans.push({ paragraphIndex: l.paragraphIndex, start: t.w.start + Math.max(0, tailOffset(text, t.tail.length)), end: t.w.end });
    });
  }
  return { lines, spans };
}

/**
 * Where, in a word as written, its last `n` letters (as compared, marks removed) begin. Walks
 * back over the written word so diacritics inside the ending stay inside the span.
 */
function tailOffset(written: string, n: number): number {
  let seen = 0;
  for (let i = written.length - 1; i >= 0; i--) {
    const ch = written[i];
    if (!keyOf(ch)) continue;
    seen++;
    if (seen === n) return i;
  }
  return 0;
}
