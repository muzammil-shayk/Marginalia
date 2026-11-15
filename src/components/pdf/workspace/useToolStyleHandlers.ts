/**
 * The toolbar's per-tool style handlers: each sets the style for the next mark and restyles the
 * selected one straight away (moved verbatim from useTextMarking).
 */

import { useCallback } from 'react';
import { Annotation, AnnotationKind, BracketSide, FractionRect, NoteStyle, StrokeStyle, TextAlign, TextFont } from '../annotationModel';
import type { WorkspaceMarks, WorkspaceSelection } from './workspaceState';
import type { PdfToolStyles } from './usePdfToolStyles';

/**
 * Identifies the mark a given selection would produce, so tapping the same tool twice removes
 * the one it just made instead of stacking a duplicate on top.
 *
 * Keyed on kind, page and the covered text, plus the position of the first rectangle — the text
 * alone is not enough, because the same phrase can appear twice on a page.
 */
export function matchesSelection(a: Annotation, group: { page: number; rects: FractionRect[]; quote: string }, kind: AnnotationKind): boolean {
  return (
    a.kind === kind &&
    a.page === group.page &&
    a.quote === group.quote &&
    Math.abs((a.rects?.[0]?.x ?? -1) - group.rects[0].x) < 0.004 &&
    Math.abs((a.rects?.[0]?.y ?? -1) - group.rects[0].y) < 0.004
  );
}

export interface UseToolStyleHandlersDeps {
  styles: Pick<PdfToolStyles, 'setBracketSide' | 'setNoteStyle' | 'setTextAlign' | 'setTextBold' | 'setTextFont' | 'setTextItalic' | 'setTextSize' | 'setToolColor' | 'setToolStrokeStyle' | 'setToolWeight'>;
  marks: Pick<WorkspaceMarks, 'setAnnotations'>;
  selection: Pick<WorkspaceSelection, 'pendingSelection' | 'selectedId'>;
}

export function useToolStyleHandlers(deps: UseToolStyleHandlersDeps) {
  const { setBracketSide, setNoteStyle, setTextAlign, setTextBold, setTextFont, setTextItalic, setTextSize, setToolColor, setToolStrokeStyle, setToolWeight } = deps.styles;
  const { setAnnotations } = deps.marks;
  const { pendingSelection, selectedId } = deps.selection;

  /**
   * Changing a tool's colour recolours what is already marked, rather than only affecting the
   * next mark.
   *
   * Picking a new colour with something selected reads as "make this that colour" — having to
   * choose the colour and then re-apply the tool was an extra step for the obvious intent. It
   * updates the selected mark, and any mark covering the current text selection.
   */
  const handleToolColorChange = useCallback(
    (which: string, color: string) => {
      setToolColor(which, color);
      setAnnotations((prev) => {
        const selected = prev.find((a) => a.id === selectedId);
        return prev.map((a) => {
          // The mark that is picked out — but only when the chip belongs to ITS kind. Changing
          // the pen's colour while a highlight happens to be selected should not repaint the
          // highlight.
          if (a.id === selectedId && a.kind === which) return { ...a, color };
          // Siblings from the same selection: a passage crossing a page break is several marks,
          // and recolouring only one of them would look like a bug.
          if (selected?.quote && a.kind === which && selected.kind === which && a.quote === selected.quote) {
            return { ...a, color };
          }
          if (
            a.kind === which &&
            pendingSelection?.some((g) => matchesSelection(a, g, which as AnnotationKind))
          ) {
            return { ...a, color };
          }
          return a;
        });
      });
    },
    [setToolColor, selectedId, pendingSelection]
  );

  /** Thickness behaves the same way: it re-strokes the selected mark straight away. */
  const handleToolWeightChange = useCallback(
    (which: string, weight: number) => {
      setToolWeight(which, weight);
      setAnnotations((prev) =>
        prev.map((a) => (a.id === selectedId && a.kind === which ? { ...a, weight } : a))
      );
    },
    [setToolWeight, selectedId, setAnnotations]
  );

  /** Dash pattern, likewise: set it for the tool, and re-dash whatever is selected. */
  const handleToolStrokeStyleChange = useCallback(
    (which: string, strokeStyle: StrokeStyle) => {
      setToolStrokeStyle(which, strokeStyle);
      setAnnotations((prev) =>
        prev.map((a) => (a.id === selectedId && a.kind === which ? { ...a, strokeStyle } : a))
      );
    },
    [setToolStrokeStyle, selectedId, setAnnotations]
  );

  const handleNoteStyleChange = useCallback(
    (style: NoteStyle) => {
      setNoteStyle(style);
      setAnnotations((prev) =>
        prev.map((a) => (a.id === selectedId && a.kind === 'note' ? { ...a, noteStyle: style } : a))
      );
    },
    [selectedId, setAnnotations]
  );

  const handleBracketSideChange = useCallback(
    (side: BracketSide) => {
      setBracketSide(side);
      setAnnotations((prev) =>
        prev.map((a) => (a.id === selectedId && a.kind === 'bracket' ? { ...a, bracketSide: side } : a))
      );
    },
    [selectedId, setAnnotations]
  );

  const handleTextSizeChange = useCallback(
    (fontSize: number) => {
      setTextSize(fontSize);
      setAnnotations((prev) =>
        prev.map((a) => (a.id === selectedId && a.kind === 'text' ? { ...a, fontSize } : a))
      );
    },
    [selectedId, setAnnotations]
  );

  const handleTextAlignChange = useCallback(
    (align: TextAlign) => {
      setTextAlign(align);
      setAnnotations((prev) =>
        prev.map((a) => (a.id === selectedId && a.kind === 'text' ? { ...a, align } : a))
      );
    },
    [selectedId, setAnnotations]
  );

  /**
   * Typeface, bold and italic all behave the same way: they set what the next text box will use,
   * and restyle the selected one straight away.
   */
  const handleTextFontChange = useCallback(
    (font: TextFont) => {
      setTextFont(font);
      setAnnotations((prev) =>
        prev.map((a) => (a.id === selectedId && a.kind === 'text' ? { ...a, font } : a))
      );
    },
    [selectedId, setAnnotations]
  );

  const handleTextBoldChange = useCallback(
    (bold: boolean) => {
      setTextBold(bold);
      setAnnotations((prev) =>
        prev.map((a) => (a.id === selectedId && a.kind === 'text' ? { ...a, bold } : a))
      );
    },
    [selectedId, setAnnotations]
  );

  const handleTextItalicChange = useCallback(
    (italic: boolean) => {
      setTextItalic(italic);
      setAnnotations((prev) =>
        prev.map((a) => (a.id === selectedId && a.kind === 'text' ? { ...a, italic } : a))
      );
    },
    [selectedId, setAnnotations]
  );

  return { handleBracketSideChange, handleNoteStyleChange, handleTextAlignChange, handleTextBoldChange, handleTextFontChange, handleTextItalicChange, handleTextSizeChange, handleToolColorChange, handleToolStrokeStyleChange, handleToolWeightChange };
}
