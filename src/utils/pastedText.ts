/**
 * Pasted custom text that keeps its layout (poems: line breaks, indentation, stanza gaps) and,
 * when the clipboard carried HTML, bold / italic / underline.
 *
 * Text marks anchor to `{ paragraphIndex, start, end }` in the stored text split into paragraphs,
 * so the split rule is part of the stored format. The reader's original rule trims each
 * paragraph, which drops a first-line indent; changing it would move every mark on existing
 * documents. So documents stored with `layout: 'verbatim'` use a second rule that keeps leading
 * indentation, and every other document keeps the original one. Both live here, in
 * `splitParagraphs`, so the reader and the store cannot drift apart.
 *
 * Pure, no DOM: the server converts pasted HTML (after `sanitizeImportHtml`) when it stores it.
 */

export type ParagraphLayout = 'verbatim' | undefined;

export type TextStyleKind = 'bold' | 'italic' | 'underline';

/** Base formatting of pasted text, anchored like a text mark. Not a mark: not listed, not undoable. */
export interface TextStyle {
  anchor: { paragraphIndex: number; start: number; end: number };
  style: TextStyleKind;
}

/**
 * The document's paragraphs, exactly as marks count them.
 * Default (every document stored before 2.5.0, and uploads): split on blank lines, each trimmed.
 * `verbatim` (pasted custom text): split on lines that are empty or whitespace-only; leading
 * indentation kept, trailing spaces dropped.
 */
export function splitParagraphs(text: string, layout?: ParagraphLayout): string[] {
  if (!text || !text.trim()) return [];
  if (layout !== 'verbatim') {
    return text
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }
  return text
    .split(/\n(?:[ \t]*\n)+/)
    .map((p) =>
      p
        .split('\n')
        .map((line) => line.replace(/[ \t]+$/, ''))
        .join('\n')
        .replace(/^\n+|\n+$/g, '')
    )
    .filter((p) => p.trim().length > 0);
}

/** Plain pasted text in the `verbatim` layout: what `splitParagraphs(…, 'verbatim')` reads back unchanged. */
export function pastedTextLayout(text: string): string {
  const unified = text.replace(/\r\n?/g, '\n').replace(/ /g, ' ');
  return normalise(unified, []).text;
}

type Range = { start: number; end: number; style: TextStyleKind };

/**
 * Drops trailing spaces on each line, empties whitespace-only lines, keeps at most one blank
 * line between paragraphs and none at either end. Style ranges are moved with the text.
 */
function normalise(s: string, ranges: Range[]): { text: string; ranges: Range[] } {
  const keep = new Array<boolean>(s.length).fill(true);
  let lineStart = 0;
  for (let i = 0; i <= s.length; i++) {
    if (i < s.length && s[i] !== '\n') continue;
    for (let j = i - 1; j >= lineStart && (s[j] === ' ' || s[j] === '\t'); j--) keep[j] = false;
    lineStart = i + 1;
  }
  // Newline runs (counting only kept characters): none at the start or end, at most two between.
  let run: number[] = [];
  let seenText = false;
  const endRun = (atEnd: boolean) => {
    const allowed = !seenText || atEnd ? 0 : 2;
    run.slice(allowed).forEach((k) => (keep[k] = false));
    run = [];
  };
  for (let i = 0; i < s.length; i++) {
    if (!keep[i]) continue;
    if (s[i] === '\n') {
      run.push(i);
      continue;
    }
    if (run.length) endRun(false);
    seenText = true;
  }
  endRun(true);

  // map[i] = index in the output of the first kept character at or after i.
  const map = new Array<number>(s.length + 1);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    map[i] = out.length;
    if (keep[i]) out += s[i];
  }
  map[s.length] = out.length;
  const moved = ranges
    .map((r) => ({ ...r, start: map[r.start], end: map[r.end] }))
    .filter((r) => r.end > r.start);
  return { text: out, ranges: moved };
}

const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'dd', 'dl', 'dt', 'fieldset', 'figcaption', 'figure',
  'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p',
  'pre', 'section', 'table', 'tr', 'ul'
]);
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

interface Frame {
  tag: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  pre?: boolean;
}

/** What one opening tag says about formatting, from its name and its inline `style`. */
function frameFor(tag: string, attrs: string): Frame {
  const frame: Frame = { tag };
  if (tag === 'b' || tag === 'strong') frame.bold = true;
  if (tag === 'i' || tag === 'em' || tag === 'cite') frame.italic = true;
  if (tag === 'u' || tag === 'ins') frame.underline = true;
  if (tag === 'pre') frame.pre = true;
  const style = /\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
  const css = (style?.[2] ?? style?.[3] ?? '').toLowerCase();
  const weight = /font-weight\s*:\s*([a-z0-9]+)/.exec(css)?.[1];
  if (weight) frame.bold = weight === 'bold' || weight === 'bolder' || Number(weight) >= 600;
  const fontStyle = /font-style\s*:\s*([a-z]+)/.exec(css)?.[1];
  if (fontStyle) frame.italic = fontStyle === 'italic' || fontStyle === 'oblique';
  const decoration = /text-decoration(?:-line)?\s*:\s*([^;]+)/.exec(css)?.[1];
  if (decoration) frame.underline = decoration.includes('underline');
  if (/white-space\s*:\s*pre/.test(css)) frame.pre = true;
  return frame;
}

const active = (stack: Frame[], key: keyof Omit<Frame, 'tag'>): boolean => {
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i][key] !== undefined) return stack[i][key]!;
  return false;
};

/**
 * Pasted HTML in the `verbatim` layout, plus its bold/italic/underline as `TextStyle`s.
 * Expects `sanitizeImportHtml` output on the server; it only ever reads text and formatting.
 */
export function pastedHtmlLayout(html: string): { text: string; styles: TextStyle[] } {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(head|script|style|template|title)\b[\s\S]*?<\/\1\s*>/gi, '');
  const token = /<(\/?)([a-z][a-z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|([^<]+|<)/gi;
  const stack: Frame[] = [];
  const ranges: Range[] = [];
  let out = '';

  const breakLine = (count: 1 | 2) => {
    const trailing = /\n*$/.exec(out)![0].length;
    if (out.length && trailing < count) out += '\n'.repeat(count - trailing);
  };
  const addStyle = (style: TextStyleKind, start: number, end: number) => {
    let last: Range | undefined;
    for (let i = ranges.length - 1; i >= 0 && !last; i--) if (ranges[i].style === style) last = ranges[i];
    if (last && last.end === start) last.end = end;
    else ranges.push({ style, start, end });
  };

  for (let m = token.exec(cleaned); m; m = token.exec(cleaned)) {
    const [, closing, rawTag, attrs, text] = m;
    if (text !== undefined) {
      const pre = active(stack, 'pre');
      let piece = pre ? text.replace(/\r\n?/g, '\n') : text.replace(/[ \t\n\r\f]+/g, ' ');
      if (!pre && (out === '' || out.endsWith('\n'))) piece = piece.replace(/^ /, '');
      if (!pre && out.endsWith(' ')) piece = piece.replace(/^ /, '');
      piece = decodeEntities(piece).replace(/ /g, ' ');
      if (!piece) continue;
      const start = out.length;
      out += piece;
      for (const style of ['bold', 'italic', 'underline'] as const) if (active(stack, style)) addStyle(style, start, out.length);
      continue;
    }
    const tag = rawTag.toLowerCase();
    if (BLOCK_TAGS.has(tag)) breakLine(2);
    // A div reads as one more line, not a new paragraph: web poems put each line in one.
    else if (tag === 'div' && !closing) breakLine(1);
    if (tag === 'br' && !closing) out += '\n';
    if (closing) {
      const at = stack.map((f) => f.tag).lastIndexOf(tag);
      if (at >= 0) stack.length = at;
      if (tag === 'div') breakLine(1);
    } else if (!VOID_TAGS.has(tag) && !attrs.trimEnd().endsWith('/')) {
      stack.push(frameFor(tag, attrs));
    }
  }

  const normalised = normalise(out, ranges);
  return { text: normalised.text, styles: toParagraphStyles(normalised.text, normalised.ranges) };
}

/** Absolute ranges over normalised text, as per-paragraph anchors (paragraphs are `\n\n`-separated). */
function toParagraphStyles(text: string, ranges: Range[]): TextStyle[] {
  const bounds: Array<[number, number]> = [];
  let start = 0;
  for (const para of text.split('\n\n')) {
    bounds.push([start, start + para.length]);
    start += para.length + 2;
  }
  const styles: TextStyle[] = [];
  for (const r of ranges) {
    bounds.forEach(([from, to], paragraphIndex) => {
      const s = Math.max(r.start, from);
      const e = Math.min(r.end, to);
      if (e > s) styles.push({ style: r.style, anchor: { paragraphIndex, start: s - from, end: e - from } });
    });
  }
  return styles;
}
