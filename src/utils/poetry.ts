/**
 * Poetry-aware reading: line and couplet (sher) numbers, and where the radif and the rhyme
 * (qafiya) fall. Pure, so it is tested; the reader paints the results with the CSS Custom
 * Highlight API, which adds nothing to the paragraphs' text or the offsets marks count.
 *
 * A stanza is a paragraph (`splitParagraphs`), a line is a non-empty line inside it, and a sher is
 * each pair of lines in a stanza, counted on through the poem.
 *
 * Radif: the word or words every sher's second line ends on (and the opening sher's first line,
 * the matla). Found as the longest run of final words the second lines share. Rhyme: in a ghazal,
 * the word just before the radif; in any other poem, the last word of each line, grouped into a
 * rhyme scheme (A, B, …) per stanza by the sound from its last vowel on.
 */

export interface PoemLine {
  paragraphIndex: number;
  /** Character offsets of the line in its paragraph, `end` exclusive, indentation excluded. */
  start: number;
  end: number;
  /** 1-based through the whole document. */
  lineNo: number;
  /** 1-based sher this line belongs to, through the whole document. */
  sherNo: number;
  /** 0 for the first line of its sher, 1 for the second. */
  sherLine: 0 | 1;
  /** Rhyme-scheme letter within its stanza, when its line ends rhyme with another's. */
  rhyme?: string;
}

export interface PoemSpan {
  paragraphIndex: number;
  start: number;
  end: number;
  kind: 'radif' | 'rhyme';
}

export interface PoemAnalysis {
  lines: PoemLine[];
  /** The radif as written in the first line that carries it, or null when the poem has none. */
  radif: string | null;
  spans: PoemSpan[];
}

interface Word {
  start: number;
  end: number;
  key: string;
}

const WORD = /[\p{L}\p{M}\p{N}'’]+/gu;
/** Arabic short vowels and other marks that never change a rhyme. */
const MARKS = /[ً-ٰٟۖ-ۭ\p{M}]/gu;
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

/** Number of final words all lists share (compared by key). */
function sharedTail(lists: Word[][]): number {
  if (lists.length === 0) return 0;
  const min = Math.min(...lists.map((l) => l.length));
  let n = 0;
  while (n < min) {
    const k = lists[0][lists[0].length - 1 - n].key;
    if (!lists.every((l) => l[l.length - 1 - n].key === k)) break;
    n++;
  }
  return n;
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

/** Longest ending (in characters) every word shares, at least one letter. */
function commonEnding(words: string[]): number {
  if (words.length < 2) return 0;
  const min = Math.min(...words.map((w) => w.length));
  let n = 0;
  while (n < min && words.every((w) => w[w.length - 1 - n] === words[0][words[0].length - 1 - n])) n++;
  return n;
}

export function analysePoem(paragraphs: string[]): PoemAnalysis {
  const lines: PoemLine[] = [];
  const words = new Map<PoemLine, Word[]>();
  let lineNo = 0;
  let sherNo = 0;
  paragraphs.forEach((text, paragraphIndex) => {
    linesOf(text).forEach((l, i) => {
      if (i % 2 === 0) sherNo++;
      const line: PoemLine = { paragraphIndex, ...l, lineNo: ++lineNo, sherNo, sherLine: (i % 2) as 0 | 1 };
      lines.push(line);
      words.set(line, wordsOf(text, l.start, l.end));
    });
  });

  const spans: PoemSpan[] = [];
  const seconds = lines.filter((l) => l.sherLine === 1 && words.get(l)!.length > 0);
  // A radif needs at least three shers to be told from a chance repetition.
  const radifWords = seconds.length >= 3 ? sharedTail(seconds.map((l) => words.get(l)!)) : 0;
  // A radif that is a whole line is a refrain, not a radif: some word must be left for the rhyme.
  const radifOk = radifWords > 0 && seconds.every((l) => words.get(l)!.length > radifWords);

  if (radifOk) {
    const matla = lines[0]?.sherLine === 0 && lines[1]?.sherLine === 1 ? lines[0] : null;
    const carriers = [...seconds];
    // The matla's first line rhymes too, when it ends on the same radif.
    if (matla && words.get(matla)!.length > radifWords && sharedTail([words.get(matla)!, words.get(seconds[0])!]) >= radifWords) carriers.unshift(matla);
    const qafiya: { line: PoemLine; word: Word }[] = [];
    for (const l of carriers) {
      const ws = words.get(l)!;
      const first = ws[ws.length - radifWords];
      const last = ws[ws.length - 1];
      spans.push({ paragraphIndex: l.paragraphIndex, start: first.start, end: last.end, kind: 'radif' });
      qafiya.push({ line: l, word: ws[ws.length - radifWords - 1] });
    }
    const ending = commonEnding(qafiya.map((q) => q.word.key));
    for (const { line, word } of qafiya) {
      // The shared ending only, when there is one; else the whole qafiya word.
      const text = paragraphs[line.paragraphIndex].slice(word.start, word.end);
      const start = ending > 0 ? word.start + Math.max(0, tailOffset(text, ending)) : word.start;
      spans.push({ paragraphIndex: line.paragraphIndex, start, end: word.end, kind: 'rhyme' });
    }
    spans.sort((a, b) => a.paragraphIndex - b.paragraphIndex || a.start - b.start);
    const firstRadif = spans.find((s) => s.kind === 'radif')!;
    return { lines, radif: paragraphs[firstRadif.paragraphIndex].slice(firstRadif.start, firstRadif.end), spans };
  }

  // No radif: a rhyme scheme per stanza, from each line's last word.
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
      spans.push({ paragraphIndex: l.paragraphIndex, start: t.w.start + Math.max(0, tailOffset(text, t.tail.length)), end: t.w.end, kind: 'rhyme' });
    });
  }
  return { lines, radif: null, spans };
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

/** Western digits, or Urdu ones (۱۲۳) for a poem in Arabic script. */
export function poemNumber(n: number, arabic: boolean): string {
  return arabic ? String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]) : String(n);
}
