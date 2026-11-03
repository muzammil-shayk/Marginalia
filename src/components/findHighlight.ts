/**
 * Find in document, on the page: turns hits (offsets into a unit's text, from
 * `utils/findInDocument`) into DOM Ranges, painted with the CSS Custom Highlight API so no markup
 * is added to the reader's paragraphs or the PDF text layer.
 *
 * A unit is a paragraph (reader) or a page's text layer (PDF). Its text is read back from the DOM
 * (`<br>` counts as a space, as the PDF page strings join lines), and a hit is matched by its
 * ORDINAL within the unit: the k-th hit in the stored text is the k-th hit on the page, so a small
 * difference between the two strings never paints the wrong words.
 */

export interface TextPiece {
  /** Characters this piece adds to the unit's text. */
  length: number;
  /** A text node, or null for a synthetic piece (the space a `<br>` stands for). */
  node: Text | null;
}

export interface NodeOffset {
  node: Text;
  offset: number;
}

/**
 * Where `start` and `end` (exclusive) fall among the pieces. A boundary on a synthetic piece moves
 * to the nearest real node. Null when the span is out of range or covers no text node.
 */
export function locateSpan(pieces: TextPiece[], start: number, end: number): { start: NodeOffset; end: NodeOffset } | null {
  if (start < 0 || end <= start) return null;
  let at = 0;
  let from: NodeOffset | null = null;
  let to: NodeOffset | null = null;
  let lastReal: NodeOffset | null = null;
  for (const p of pieces) {
    const next = at + p.length;
    if (p.node) {
      if (!from && start < next) from = { node: p.node, offset: Math.max(0, start - at) };
      if (from && end <= next) {
        to = { node: p.node, offset: Math.max(0, end - at) };
        break;
      }
      lastReal = { node: p.node, offset: p.length };
    } else if (from && end <= next) {
      to = lastReal;
      break;
    }
    at = next;
  }
  if (!from) return null;
  if (!to) to = end <= at ? lastReal : null;
  return to ? { start: from, end: to } : null;
}

/** The unit's text pieces in reading order. */
export function readPieces(root: Element): TextPiece[] {
  const pieces: TextPiece[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n as Text;
      if (t.data.length) pieces.push({ length: t.data.length, node: t });
    } else if ((n as Element).tagName === 'BR') {
      pieces.push({ length: 1, node: null });
    }
  }
  return pieces;
}

export const piecesText = (pieces: TextPiece[]) => pieces.map((p) => (p.node ? p.node.data : ' ')).join('');

export function rangeFor(pieces: TextPiece[], start: number, end: number): Range | null {
  const span = locateSpan(pieces, start, end);
  const first = pieces.find((p) => p.node)?.node;
  if (!span || !first) return null;
  const range = first.ownerDocument.createRange();
  range.setStart(span.start.node, span.start.offset);
  range.setEnd(span.end.node, span.end.offset);
  return range;
}

type HighlightRegistry = { set: (name: string, h: unknown) => void; delete: (name: string) => void };
const registry = (): HighlightRegistry | null =>
  typeof CSS !== 'undefined' && 'highlights' in CSS ? (CSS as unknown as { highlights: HighlightRegistry }).highlights : null;

/** Paints every hit, and the current one on top. Empty lists clear the paint. */
export function paintFindHits(all: Range[], current: Range | null): void {
  const reg = registry();
  const H = (globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
  if (!reg || !H) return;
  if (all.length) reg.set('find-hit', new H(...all));
  else reg.delete('find-hit');
  if (current) reg.set('find-current', new H(current));
  else reg.delete('find-current');
}

/** Paints ranges under a named highlight (poem-radif, poem-rhyme, motif-hit). An empty list clears it. */
export function paintHighlight(name: string, ranges: Range[]): void {
  const reg = registry();
  const H = (globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
  if (!reg || !H) return;
  if (ranges.length) reg.set(name, new H(...ranges));
  else reg.delete(name);
}
