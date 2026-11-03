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
