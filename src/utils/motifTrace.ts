/**
 * Cross-text motif tracing: every place an image or idea appears across the reader's documents.
 * A motif is a name and a few words that stand for it ("moon": moon, crescent, چاند). Each word
 * matches whole, any case, with its common plural and possessive endings, in Latin or Arabic
 * script. Pure, so it is tested; the server runs it over the library (`services/motifRoutes`).
 */

import { splitParagraphs, type ParagraphLayout } from './pastedText';

export interface MotifHit {
  /** Paragraph (text documents) or page minus one (PDFs), as `location` says. */
  paragraphIndex: number;
  start: number;
  end: number;
  /** The words as written. */
  match: string;
  /** About a sentence around the hit, on word boundaries, with ellipses where cut. */
  snippet: string;
}

export interface MotifDocResult {
  id: string;
  title: string;
  format: string;
  /** 'paragraph' for text documents, 'page' for PDFs (pages are stored one per paragraph). */
  location: 'paragraph' | 'page';
  hits: MotifHit[];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ARABIC = /[؀-ۿ]/;
const EDGE_BEFORE = '(?<![\\p{L}\\p{M}\\p{N}])';
const EDGE_AFTER = '(?![\\p{L}\\p{M}\\p{N}])';

/** The motif's words, tidied: trimmed, inner spaces collapsed, duplicates and blanks dropped. */
export function cleanTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of terms) {
    const clean = t.replace(/\s+/g, ' ').trim().slice(0, 80);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out.slice(0, 24);
}

/** One pattern for every term: whole words, plus plural/possessive endings. Null when there are none. */
export function motifPattern(terms: string[]): RegExp | null {
  const clean = cleanTerms(terms);
  if (!clean.length) return null;
  // Longest first, so "rose garden" wins over "rose" where both match.
  const parts = [...clean]
    .sort((a, b) => b.length - a.length)
    .map((t) => {
      const body = t.split(' ').map(escape).join('\\s+');
      const ending = ARABIC.test(t) ? '(?:وں|یں|ں|ے)?' : "(?:'s|’s|s|es)?";
      return `${body}${ending}`;
    });
  return new RegExp(`${EDGE_BEFORE}(?:${parts.join('|')})${EDGE_AFTER}`, 'giu');
}

/** About `radius` characters either side of a hit, cut at spaces. */
export function hitSnippet(text: string, start: number, end: number, radius = 70): string {
  let from = Math.max(0, start - radius);
  let to = Math.min(text.length, end + radius);
  if (from > 0) {
    const space = text.indexOf(' ', from);
    if (space !== -1 && space < start) from = space + 1;
  }
  if (to < text.length) {
    const space = text.lastIndexOf(' ', to);
    if (space > end) to = space;
  }
  const body = text.slice(from, to).replace(/\s+/g, ' ').trim();
  return `${from > 0 ? '… ' : ''}${body}${to < text.length ? ' …' : ''}`;
}

/** Every hit in a list of paragraphs, in reading order. */
export function traceParagraphs(paragraphs: string[], terms: string[], limit = 500): MotifHit[] {
  const pattern = motifPattern(terms);
  if (!pattern) return [];
  const hits: MotifHit[] = [];
  paragraphs.forEach((text, paragraphIndex) => {
    if (hits.length >= limit) return;
    for (const m of text.matchAll(pattern)) {
      const start = m.index!;
      const end = start + m[0].length;
      hits.push({ paragraphIndex, start, end, match: m[0], snippet: hitSnippet(text, start, end) });
      if (hits.length >= limit) break;
    }
  });
  return hits;
}

/**
 * A stored document's units as the reader counts them: paragraphs for text (`splitParagraphs`,
 * the rule marks anchor to), pages for a PDF (stored joined by blank lines, one per page, empty
 * pages kept so the numbers stay true).
 */
export function documentUnits(text: string, format: string, layout?: ParagraphLayout): { units: string[]; location: 'paragraph' | 'page' } {
  if (/^(pdf|html?)$/i.test(format)) return { units: text.split('\n\n'), location: 'page' };
  return { units: splitParagraphs(text, layout), location: 'paragraph' };
}

/** The traced words in one paragraph, for painting in the reader. */
export function paragraphHits(text: string, terms: string[]): { start: number; end: number }[] {
  const pattern = motifPattern(terms);
  if (!pattern) return [];
  return Array.from(text.matchAll(pattern), (m) => ({ start: m.index!, end: m.index! + m[0].length }));
}

/** A trace as Markdown, for an essay: the motif, then each document's passages with their places. */
export function traceMarkdown(name: string, terms: string[], results: MotifDocResult[]): string {
  const total = results.reduce((n, r) => n + r.hits.length, 0);
  const lines = [`# Motif: ${name}`, '', `Words traced: ${cleanTerms(terms).join(', ')}`, `${total} passages in ${results.length} documents`, ''];
  for (const r of results) {
    lines.push(`## ${r.title}`, '');
    for (const h of r.hits) {
      const where = r.location === 'page' ? `p. ${h.paragraphIndex + 1}` : `para. ${h.paragraphIndex + 1}`;
      lines.push(`> ${h.snippet}`, `> (${where})`, '');
    }
  }
  return lines.join('\n');
}
