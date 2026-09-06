/**
 * Character-range text formatting: selecting a run of characters within a paragraph and
 * marking it bold, highlighted, underlined or circled.
 *
 * Ported from the analysis-only `DocumentInspectionPanel`, where this was originally built
 * to sit alongside an AI theme-matching overlay (a `remove-*` format family existed solely to
 * let a reader negate the AI's own automatic tint on a sub-span). With AI analysis removed,
 * there is no automatic tint left to negate, so that overlay and those negation types are
 * dropped here — this module is the plain, manual-only remainder, shared by every reading
 * surface (`ReaderScreen` today) that needs selection-scoped formatting.
 */

import React from 'react';
import { CustomFormat } from './documentExporter';

/** Ids only have to be unique within one document's format list. */
export function newFormatId(): string {
  return `fmt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return Math.max(a.start, b.start) < Math.min(a.end, b.end);
}

/**
 * Computes the {start, end} character offsets of the live browser selection within `element`,
 * measured in plain-text characters from the start of the element's own text content.
 */
export function getSelectionCharacterOffsetWithin(element: HTMLElement): { start: number; end: number } {
  let start = 0;
  let end = 0;
  const doc = element.ownerDocument || document;
  const win = doc.defaultView || window;
  if (typeof win.getSelection !== 'undefined') {
    const sel = win.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(element);
      preCaretRange.setEnd(range.startContainer, range.startOffset);
      start = preCaretRange.toString().length;
      end = start + range.toString().length;
    }
  }
  return { start, end };
}

/** Re-selects a previously-computed character range within `element`, e.g. so a second toolbar tap can stack another format on the same selection. */
export function restoreSelectionCharacterOffset(element: HTMLElement, start: number, end: number): void {
  const doc = element.ownerDocument || document;
  const win = doc.defaultView || window;
  if (typeof win.getSelection === 'undefined') return;
  const sel = win.getSelection();
  if (!sel) return;

  let charCount = 0;
  let startNode: Node | null = null;
  let endNode: Node | null = null;
  let startOffset = 0;
  let endOffset = 0;

  function traverseNodes(node: Node) {
    if (node.nodeType === 3) {
      const nextCharCount = charCount + (node.nodeValue?.length || 0);
      if (!startNode && start >= charCount && start <= nextCharCount) {
        startNode = node;
        startOffset = start - charCount;
      }
      if (!endNode && end >= charCount && end <= nextCharCount) {
        endNode = node;
        endOffset = end - charCount;
      }
      charCount = nextCharCount;
    } else if (node.nodeType === 1 && node.childNodes) {
      for (let i = 0; i < node.childNodes.length; i++) traverseNodes(node.childNodes[i]);
    }
  }

  traverseNodes(element);

  if (startNode && endNode) {
    const range = doc.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

/** Walks up from `node` to find the nearest ancestor whose id starts with `idPrefix`, returning it plus the paragraph index encoded in the rest of that id. */
export function findParagraphElement(
  node: Node | null,
  idPrefix: string
): { element: HTMLElement; index: number } | null {
  let current = node;
  while (current && current !== document.body) {
    if (current instanceof HTMLElement && current.id && current.id.startsWith(idPrefix)) {
      return { element: current, index: parseInt(current.id.slice(idPrefix.length), 10) };
    }
    current = current.parentNode;
  }
  return null;
}

/** "Does this exact sub-span already have unbroken coverage" check, used by `toggleFormatRange` to decide whether toggling a format should add or remove it. */
function isRangeFullyCoveredByType(
  existing: CustomFormat[],
  paragraphIndex: number,
  start: number,
  end: number,
  type: CustomFormat['type']
): boolean {
  const overlapping = existing
    .filter((cf) => cf.paragraphIndex === paragraphIndex && cf.type === type && rangesOverlap(cf, { start, end }))
    .sort((a, b) => a.start - b.start);
  let cursor = start;
  let fullyCovered = overlapping.length > 0;
  for (const iv of overlapping) {
    if (iv.start > cursor) {
      fullyCovered = false;
      break;
    }
    cursor = Math.max(cursor, iv.end);
    if (cursor >= end) break;
  }
  if (cursor < end) fullyCovered = false;
  return fullyCovered;
}

/**
 * Toggles a bold/highlight/underline/circle format over [start, end) of one paragraph.
 *
 * If the selection is already fully covered by existing same-type format(s), those formats are
 * split so only the exact selected sub-span is un-formatted — any part of an existing format
 * outside the selection is preserved. Otherwise the selection (merged with any formats it
 * partially overlaps) is (re-)applied with `color`/`themeId`.
 */
export function toggleFormatRange(
  existing: CustomFormat[],
  paragraphIndex: number,
  start: number,
  end: number,
  type: CustomFormat['type'],
  color: string | undefined,
  themeId: string | null,
  thickness?: number
): CustomFormat[] {
  const untouched = existing.filter((cf) => !(cf.paragraphIndex === paragraphIndex && cf.type === type));
  const sameType = existing.filter((cf) => cf.paragraphIndex === paragraphIndex && cf.type === type);
  const overlapping = sameType.filter((cf) => rangesOverlap(cf, { start, end }));
  const nonOverlapping = sameType.filter((cf) => !overlapping.includes(cf));

  const fullyCovered = isRangeFullyCoveredByType(existing, paragraphIndex, start, end, type);

  if (fullyCovered) {
    // Remove: split each overlapping format around [start, end), keeping only the leftover
    // pieces that fall outside the toggled-off span.
    const remainder: CustomFormat[] = [];
    overlapping.forEach((cf) => {
      if (cf.start < start) remainder.push({ ...cf, end: Math.min(cf.end, start) });
      if (cf.end > end) remainder.push({ ...cf, start: Math.max(cf.start, end) });
    });
    return [...untouched, ...nonOverlapping, ...remainder];
  }

  // Apply: merge the new range with anything it already overlaps into one interval, using the
  // freshly-chosen color/theme, instead of leaving stacked/duplicate formats.
  let mergedStart = start;
  let mergedEnd = end;
  overlapping.forEach((cf) => {
    mergedStart = Math.min(mergedStart, cf.start);
    mergedEnd = Math.max(mergedEnd, cf.end);
  });
  return [
    ...untouched,
    ...nonOverlapping,
    { id: newFormatId(), paragraphIndex, start: mergedStart, end: mergedEnd, type, color, thickness, themeId }
  ];
}

interface CharStyle {
  type: Set<CustomFormat['type']>;
  highlightColor?: string;
  underlineColor?: string;
  circleColor?: string;
  circleThickness?: number;
  annoIds: Set<string>;
}

/** Minimal shape `renderHighlightedText` needs to draw a span's char-range highlight — deliberately not tied to `StickyNote` or any one annotation type. */
export interface SpanAnchor {
  id?: string;
  start?: number;
  end?: number;
}

/** Builds the per-character style map a paragraph renders from, given its own custom bold/highlight/underline/circle spans. */
export function buildCharStyles(paraText: string, customFormats: CustomFormat[]): CharStyle[] {
  const charStyles: CharStyle[] = Array.from({ length: paraText.length }, () => ({ type: new Set(), annoIds: new Set() }));

  customFormats.forEach((cf) => {
    for (let i = Math.max(0, cf.start); i < cf.end && i < paraText.length; i++) {
      if (cf.type === 'bold') {
        charStyles[i].type.add('bold');
      } else if (cf.type === 'highlight') {
        charStyles[i].type.add('highlight');
        charStyles[i].highlightColor = cf.color;
      } else if (cf.type === 'underline') {
        charStyles[i].type.add('underline');
        charStyles[i].underlineColor = cf.color;
      } else if (cf.type === 'circle') {
        charStyles[i].type.add('circle');
        charStyles[i].circleColor = cf.color;
        charStyles[i].circleThickness = cf.thickness;
      }
    }
  });

  return charStyles;
}

/** Renders `paraText` as a run of `<mark>` spans reflecting its custom formats and any annotation anchors (e.g. sticky notes) that point into it. */
export function renderHighlightedText(
  paraText: string,
  customFormats: CustomFormat[] = [],
  annotations: SpanAnchor[] = [],
  hoveredAnnotationId: string | null = null,
  defaultColor = '#8b5cf6'
): React.ReactNode {
  const charStyles = buildCharStyles(paraText, customFormats);

  annotations.forEach((a) => {
    if (a.id && a.start !== undefined && a.end !== undefined) {
      for (let i = Math.max(0, a.start); i < a.end && i < paraText.length; i++) {
        charStyles[i].annoIds.add(a.id);
      }
    }
  });

  const nodes: React.ReactNode[] = [];
  let currentGroup = '';

  const getStyleStr = (cs: CharStyle) =>
    `${cs.type.has('bold') ? 'b' : ''}-${cs.type.has('highlight') ? cs.highlightColor : ''}-${cs.type.has('underline') ? cs.underlineColor : ''}-${cs.type.has('circle') ? `${cs.circleColor}:${cs.circleThickness}` : ''}-${Array.from(cs.annoIds).join(',')}`;

  const renderSpan = (text: string, styleInfo: CharStyle, key: number, start: number, end: number) => {
    if (styleInfo.type.size === 0 && styleInfo.annoIds.size === 0) return text;

    let bg = 'transparent';
    let fw = 'inherit';
    if (styleInfo.type.has('bold')) fw = 'bold';
    if (styleInfo.type.has('highlight')) bg = `${styleInfo.highlightColor || defaultColor}35`;

    const hasUnderline = styleInfo.type.has('underline');
    const underlineColor = styleInfo.underlineColor || defaultColor;

    const isHoveredAnno = hoveredAnnotationId !== null && styleInfo.annoIds.has(hoveredAnnotationId);
    if (isHoveredAnno) {
      bg = '#fde047';
      fw = 'bold';
    }

    const isCircled = styleInfo.type.has('circle');
    const cls = isCircled ? 'inline-block' : isHoveredAnno ? 'px-1.5 rounded shadow-2xs' : 'px-0.5 rounded-sm';

    const firstAnnoId = Array.from(styleInfo.annoIds)[0];
    const matchingAnno = firstAnnoId ? annotations.find((a) => a.id === firstAnnoId) : null;
    const isAnchor = matchingAnno && start <= matchingAnno.start! && end > matchingAnno.start!;
    const spanId = isAnchor ? `anno-span-${firstAnnoId}` : undefined;

    return (
      <mark
        id={spanId}
        key={`span-${key}`}
        className={`transition-all inline select-text ${cls}`}
        style={{
          backgroundColor: bg,
          textDecoration: hasUnderline ? 'underline' : 'none',
          textDecorationColor: hasUnderline ? underlineColor : 'transparent',
          textDecorationThickness: '2px',
          textUnderlineOffset: '5px',
          color: 'inherit',
          fontWeight: fw,
          ...(isCircled
            ? {
                border: `${styleInfo.circleThickness || 2}px solid ${styleInfo.circleColor || defaultColor}`,
                borderRadius: '50% / 30%',
                padding: '0.05em 0.4em',
                margin: '0 -0.15em'
              }
            : {})
        }}
      >
        {text}
      </mark>
    );
  };

  let currentStyleStr = charStyles.length > 0 ? getStyleStr(charStyles[0]) : '';

  charStyles.forEach((cs, i) => {
    const sStr = getStyleStr(cs);
    if (i === 0) {
      currentGroup += paraText[i];
    } else if (sStr === currentStyleStr) {
      currentGroup += paraText[i];
    } else {
      const groupStart = i - currentGroup.length;
      nodes.push(renderSpan(currentGroup, charStyles[i - 1], nodes.length, groupStart, i));
      currentGroup = paraText[i];
      currentStyleStr = sStr;
    }
  });

  if (currentGroup.length > 0) {
    const groupStart = paraText.length - currentGroup.length;
    nodes.push(renderSpan(currentGroup, charStyles[charStyles.length - 1], nodes.length, groupStart, paraText.length));
  }

  return nodes.length > 0 ? nodes : paraText;
}
