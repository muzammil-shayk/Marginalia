/**
 * Where a mark sits, in the words a reader cites it with, and the "copy quote" citation:
 * `"quote" (Title, p. N)` for a PDF, `l. N` / `ll. N–M` for a poem (pasted text kept verbatim,
 * where every stanza line is a line), `para. N` for other text documents.
 * Shared by the copy-quote action and the exports, so both cite a mark the same way.
 */

import type { ParagraphLayout } from './pastedText';

export type MarkLocation =
  | { kind: 'page'; page: number }
  | { kind: 'line'; line: number; endLine?: number }
  | { kind: 'paragraph'; paragraph: number };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 1-based line number of `offset` in paragraph `paragraphIndex`, counting lines of every paragraph before it. */
export function lineNumberAt(paragraphs: string[], paragraphIndex: number, offset: number): number {
  let line = 1;
  for (let i = 0; i < paragraphIndex && i < paragraphs.length; i++) line += paragraphs[i].split('\n').length;
  const text = paragraphs[paragraphIndex] ?? '';
  for (let i = 0; i < Math.min(offset, text.length); i++) if (text[i] === '\n') line++;
  return line;
}

/**
 * A stored mark's location: `page` on a PDF mark, `anchor` on a text mark (as stored). Lines only
 * when the document is verbatim and its paragraphs are given. Null when the mark carries neither.
 */
export function markLocation(
  mark: { id: string; [key: string]: unknown },
  ctx: { paragraphs?: string[]; layout?: ParagraphLayout } = {}
): MarkLocation | null {
  if (isNum(mark.page)) return { kind: 'page', page: mark.page };
  const a = mark.anchor as { paragraphIndex?: unknown; start?: unknown; end?: unknown } | undefined;
  const index = isNum(mark.paragraphIndex) ? mark.paragraphIndex : a && isNum(a.paragraphIndex) ? a.paragraphIndex : null;
  if (index === null) return null;
  if (ctx.layout === 'verbatim' && ctx.paragraphs) {
    const start = a && isNum(a.start) ? a.start : 0;
    const end = a && isNum(a.end) ? a.end : start;
    const line = lineNumberAt(ctx.paragraphs, index, start);
    const endLine = lineNumberAt(ctx.paragraphs, index, Math.max(start, end - 1));
    return endLine > line ? { kind: 'line', line, endLine } : { kind: 'line', line };
  }
  return { kind: 'paragraph', paragraph: index + 1 };
}

export function locationLabel(loc: MarkLocation): string {
  if (loc.kind === 'page') return `p. ${loc.page}`;
  if (loc.kind === 'paragraph') return `para. ${loc.paragraph}`;
  return loc.endLine && loc.endLine > loc.line ? `ll. ${loc.line}–${loc.endLine}` : `l. ${loc.line}`;
}

/** The quote on one line: whitespace collapsed, line breaks shown as ` / `. */
export function cleanQuote(quote: string): string {
  return quote
    .trim()
    .split(/\s*\n\s*/)
    .map((line) => line.replace(/\s+/g, ' '))
    .join(' / ');
}

/** `"quote" (Title, p. N)`; `"quote" (Title)` when the location is unknown. */
export function formatQuoteRef(quote: string, title: string, loc: MarkLocation | null): string {
  return `"${cleanQuote(quote)}" (${title}${loc ? `, ${locationLabel(loc)}` : ''})`;
}
