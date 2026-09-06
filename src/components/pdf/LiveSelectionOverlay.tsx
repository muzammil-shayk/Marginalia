/**
 * A clean, per-line tint drawn over the reader's OWN in-progress text selection.
 *
 * pdf.js lays out one span per text run — often per word, and in justified text each with its own
 * stretched gap to the next — so the browser's native `::selection` background (painted per span)
 * shows as a broken row of tiles with the inter-word gaps left uncovered, instead of one straight
 * bar per line. `pdfTextLayer.css` makes that native background transparent; this component draws
 * the real one, built from the exact same `mergeRectsIntoLines` pass a finished highlight uses —
 * so what the reader sees while dragging is what they get once they let go.
 *
 * Positioned in `fixed` viewport coordinates straight from `Range.getClientRects()`, so it needs no
 * page-fraction conversion and stays correct through a resize or a mid-drag scroll.
 */

import React, { useEffect, useState } from 'react';
import { mergeRectsIntoLines } from './annotationModel';

export const LiveSelectionOverlay: React.FC = () => {
  const [rects, setRects] = useState<DOMRect[]>([]);

  useEffect(() => {
    const update = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setRects((prev) => (prev.length ? [] : prev));
        return;
      }
      const range = selection.getRangeAt(0);
      // Only a selection made in the PDF's own text layer gets this treatment — anything else
      // (a label, a dialog, the sidebar) keeps the browser's ordinary selection colour.
      const node = range.commonAncestorContainer;
      const el = node instanceof Element ? node : node.parentElement;
      if (!el?.closest('.marginalia-text-layer')) {
        setRects((prev) => (prev.length ? [] : prev));
        return;
      }
      const raw = Array.from(range.getClientRects()).filter((r) => r.width > 0.5 && r.height > 0.5);
      setRects(mergeRectsIntoLines(raw));
    };

    update();
    document.addEventListener('selectionchange', update);
    // Scroll doesn't bubble, so catching it from a descendant scroll container needs capture.
    document.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, []);

  if (!rects.length) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      {rects.map((rect, index) => (
        <div
          key={index}
          style={{
            position: 'fixed',
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            background: 'rgb(120 113 108 / 0.3)',
            borderRadius: 2
          }}
        />
      ))}
    </div>
  );
};
