
/**
 * A selection clipped to one container (2.8.0).
 *
 * `Selection.toString()` is everything between the two ends in document order, so a drag that
 * starts just left of a line, over the sidebar or the toolbar, used to save the menu labels at the
 * front of the quote — and they went on into the marks panel, search, exports and the
 * commonplace book. Clipping to a PDF page's text layer keeps only that page's words (and boxes).
 */

/** The part of `range` inside `root`, or null when the selection does not reach it. */
export function clippedRange(range: Range, root: Element): Range | null {
  if (!range.intersectsNode(root)) return null;
  const clip = root.ownerDocument.createRange();
  clip.selectNodeContents(root);
  // The selection's own ends where they fall inside the root; otherwise the root's edges.
  if (root.contains(range.startContainer)) clip.setStart(range.startContainer, range.startOffset);
  if (root.contains(range.endContainer)) clip.setEnd(range.endContainer, range.endOffset);
  return clip.collapsed ? null : clip;
}

/** One text node's selected part and the box it is drawn in (viewport pixels). */
export interface TextFragment {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Glyphs a PDF gives no Unicode for come through as C0 control characters; tab and newline stay. */
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/**
 * A quote in reading order from a selection's fragments, given in document order.
 *
 * Consecutive fragments on the same line are one line, joined to the next line by a space; every
 * line keeps document order, so two columns side by side are never interleaved.
 */
export function quoteFromFragments(fragments: TextFragment[]): string {
  const lines: TextFragment[][] = [];
  for (const f of fragments) {
    const line = lines[lines.length - 1];
    const mid = f.y + f.h / 2;
    const onLine = line?.some((o) => mid >= o.y && mid <= o.y + o.h);
    if (line && onLine) line.push(f);
    else lines.push([f]);
  }
  return lines
    .map((line) => line.map((f) => f.text.replace(CONTROL, '')).join(''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The selected part of each text node in `range`, in document order, with its element's box. */
export function rangeFragments(range: Range): TextFragment[] {
  const root = range.commonAncestorContainer;
  const walker = (root.ownerDocument ?? (root as Document)).createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: TextFragment[] = [];
  for (let n = root.nodeType === Node.TEXT_NODE ? root : walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text;
    if (!range.intersectsNode(node)) continue;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.data.length;
    const box = node.parentElement?.getBoundingClientRect();
    if (!box || end <= start) continue;
    out.push({ text: node.data.slice(start, end), x: box.left, y: box.top, w: box.width, h: box.height });
    if (n === root) break;
  }
  return out;
}

/**
 * The page where a drag selected characters but no readable text (a PDF font with no letter map),
 * when it selected nothing readable anywhere, so the reader is told rather than left with no mark.
 * Pages with no text at all (`noText`) are read by OCR on the press instead (PdfPage). Pure.
 */
export function unreadableSelectionPage(pages: { page: number; quote: string; rects: number; noText: boolean }[]): number | null {
  if (pages.some((p) => p.quote && p.rects > 0)) return null;
  return pages.find((p) => !p.quote && p.rects > 0 && !p.noText)?.page ?? null;
}
