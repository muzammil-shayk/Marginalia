/**
 * Text selection into marks: applying text marks, notes and reactions about a selection, and the
 * toolbar's tool taps (moved verbatim from PdfWorkspace). The one entry point for callers; the
 * per-tool style handlers live in useToolStyleHandlers and selection capture in useSelectionCapture.
 */

import React, { useCallback } from 'react';
import { UserSettings } from '../../../types';
import { Annotation, AnnotationKind, DEFAULT_NOTE_SIZE, FractionRect, DEFAULT_TEXT_SIZE, PdfTool, isTextAnchored, newAnnotationId } from '../annotationModel';
import { NEUTRAL_COLORS } from '../PdfToolbar';
import { commitOpenThemeField, type CreatedTheme } from '../themeField';
import { blackoutMarks, planTextMarks } from '../textMarking';
import { addThemeId } from '../../../utils/markThemes';
import type { WorkspaceMarks, WorkspaceSelection } from './workspaceState';
import type { PdfToolStyles } from './usePdfToolStyles';
import { useToolStyleHandlers } from './useToolStyleHandlers';
import { useSelectionCapture } from './useSelectionCapture';

export interface UseTextMarkingDeps {
  settings: UserSettings;
  /** The tool styles (also read by useToolStyleHandlers and useSelectionCapture, which get the same
   * groups); in Black it out's `words` mode a selection made with it armed is blacked out. */
  styles: Pick<PdfToolStyles, 'maskMode' | 'activeThemeIds' | 'setBracketSide' | 'setNoteStyle' | 'setTextAlign' | 'setTextBold' | 'setTextFont' | 'setTextItalic' | 'setTextSize' | 'setTool' | 'setToolColor' | 'setToolStrokeStyle' | 'setToolWeight' | 'tool' | 'toolColors' | 'toolWeights'>;
  marks: Pick<WorkspaceMarks, 'annotations' | 'setAnnotations'>;
  selection: Pick<WorkspaceSelection, 'pendingSelection' | 'setPendingSelection' | 'selectedId' | 'setSelectedId' | 'setSelectionAnchor' | 'setOpenSubmenuFor' | 'submenuClosedAt'>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  startEditingId: (id: string, text: string) => void;
}

export function useTextMarking(deps: UseTextMarkingDeps) {
  const { settings, scrollRef, startEditingId } = deps;
  const { maskMode, activeThemeIds, setTool, tool, toolColors, toolWeights } = deps.styles;
  const { annotations, setAnnotations } = deps.marks;
  const { pendingSelection, setPendingSelection, setSelectedId, setSelectionAnchor, setOpenSubmenuFor, submenuClosedAt } = deps.selection;

  const styleHandlers = useToolStyleHandlers({ styles: deps.styles, marks: deps.marks, selection: deps.selection });

  /**
   * Applies a text mark to a selection, skipping any part of it that already carries one.
   *
   * Never toggles. Reaching for the highlighter over an already-highlighted sentence means "this
   * should be highlighted", and having that silently delete the highlight was the most alarming
   * thing the editor did. A mark is removed deliberately, from its own properties strip.
   */
  const applyTextMark = useCallback(
    (
      tool: PdfTool,
      groups: { page: number; rects: FractionRect[]; quote: string }[],
      colorOverride?: string,
      /** A theme just made in the selection menu's open "+ New theme" field (see themeField.ts). */
      themeOverride?: CreatedTheme | null
    ) => {
      // Every active theme; a theme just made in the menu's "+ New theme" field joins them.
      const themeIds = themeOverride ? addThemeId(activeThemeIds, themeOverride.id) : activeThemeIds;
      // `terminology` is a toolbar tool, not a stored kind (see PdfTool) — it produces an ordinary
      // highlight flagged `isTerminology`, coloured from the live setting rather than a tool
      // colour, so it is exempt from recolouring here even if one were ever passed.
      const isTerminology = tool === 'terminology';
      const kind: AnnotationKind = isTerminology ? 'highlight' : (tool as AnnotationKind);
      // One per page not already marked this way, or the chosen themes added to the mark already
      // on those words (textMarking.ts, tested).
      const { created: additions, tagged } = planTextMarks(annotations, groups, {
        kind,
        isTerminology,
        themeIds,
        color: isTerminology ? settings.terminologyColor : colorOverride ?? themeOverride?.color ?? toolColors[kind] ?? NEUTRAL_COLORS[0],
        weight: toolWeights[kind],
        author: settings.name
      });

      // Every page of the selection was already marked this way. Nothing to add, and nothing to
      // undo either — the reader is looking at the mark they were about to make.
      if (additions.length === 0 && tagged.length === 0) {
        setPendingSelection(null);
        return;
      }
      setAnnotations((prev) => [
        ...prev.map((a) => {
          const t = tagged.find((x) => x.id === a.id);
          return t ? { ...a, themeIds: t.themeIds, ...(t.color && { color: t.color }) } : a;
        }),
        ...additions
      ]);

      /*
        The new mark becomes the selected one.

        This is what makes changing colour afterwards work at all. Applying a mark clears the text
        selection, and the trailing mouseup then clears `pendingSelection` — so without this there
        was nothing left for a colour change to act on, and picking a colour appeared to do
        nothing. Selecting the mark also means a second toolbar tap cannot silently undo it, since
        there is no live selection left to toggle against.
      */
      setSelectedId(additions[0]?.id ?? tagged[0].id);
      setPendingSelection(null);
    },
    [annotations, toolColors, activeThemeIds, settings.name, settings.terminologyColor, toolWeights, setAnnotations]
  );

  const { unreadable } = useSelectionCapture({ settings, styles: deps.styles, marks: deps.marks, selection: deps.selection, scrollRef, applyTextMark });

  /**
   * Writes a sticky note about the selected passage.
   *
   * The note is placed to the RIGHT of the passage where there is usually margin, dropping below
   * it when the page is too narrow — a note laid on top of the text it discusses would hide the
   * thing it refers to. The passage itself is stored on the note so hovering can light it back up.
   */
  const createNoteForSelection = useCallback(() => {
    const groups = pendingSelection;
    if (!groups?.length) return;
    const group = groups[0];
    const bounds = {
      x: Math.min(...group.rects.map((r) => r.x)),
      y: Math.min(...group.rects.map((r) => r.y)),
      right: Math.max(...group.rects.map((r) => r.x + r.w)),
      bottom: Math.max(...group.rects.map((r) => r.y + r.h))
    };

    const { w, h } = DEFAULT_NOTE_SIZE;
    const fitsBeside = bounds.right + 0.02 + w <= 1;
    const box = {
      x: fitsBeside ? bounds.right + 0.02 : Math.min(bounds.x, 1 - w),
      y: Math.min(fitsBeside ? bounds.y : bounds.bottom + 0.015, 1 - h),
      w,
      h
    };

    const note: Annotation = {
      id: newAnnotationId(),
      page: group.page,
      kind: 'note',
      color: toolColors.note ?? NEUTRAL_COLORS[0],
      themeIds: activeThemeIds,
      box,
      anchorRects: group.rects,
      quote: group.quote,
      text: '',
      author: settings.name,
      createdAt: new Date().toISOString()
    };
    setAnnotations((prev) => [...prev, note]);
    setSelectionAnchor(null);
    window.getSelection()?.removeAllRanges();
    startEditingId(note.id, '');
  }, [pendingSelection, toolColors, activeThemeIds, settings.name]);

  /**
   * Stamps a question mark, asterisk or exclamation mark next to the start of the selected
   * passage.
   *
   * Placed like a note is — its own `box`, sized from `fontSize` — rather than tinted across every
   * line the way highlight/underline/strikeout are, since the point is a reaction to a moment in
   * the text, not a claim about which words it covers. That's also what makes it draggable,
   * resizable and recolourable afterward through the same controls a note or text box uses.
   */
  const createReactionForSelection = useCallback(
    (kind: AnnotationKind) => {
      const groups = pendingSelection;
      if (!groups?.length) return;
      const group = groups[0];
      const first = group.rects[0];
      const fontSize = DEFAULT_TEXT_SIZE;
      // A little larger than the glyph itself, for a comfortable click/drag target, and — since
      // `w` reads against PAGE WIDTH while `h` reads against the taller PAGE HEIGHT — `w` needs
      // the bigger multiplier or a "round" badge on a portrait page comes out visibly an oval.
      const h = fontSize * 1.35;
      const w = h * 1.3;
      const box = {
        x: Math.max(0, first.x - w - 0.008),
        y: Math.min(Math.max(0, first.y + first.h / 2 - h / 2), 1 - h),
        w,
        h
      };

      const reaction: Annotation = {
        id: newAnnotationId(),
        page: group.page,
        kind,
        color: toolColors[kind] ?? NEUTRAL_COLORS[0],
        themeIds: activeThemeIds,
        box,
        fontSize,
        anchorRects: group.rects,
        quote: group.quote,
        author: settings.name,
        createdAt: new Date().toISOString()
      };
      setAnnotations((prev) => [...prev, reaction]);
      setSelectedId(reaction.id);
      setSelectionAnchor(null);
      window.getSelection()?.removeAllRanges();
    },
    [pendingSelection, toolColors, activeThemeIds, settings.name]
  );

  /**
   * A tool button was tapped.
   *
   * When text is already selected and the tool is a text one, the tap acts on that selection
   * immediately — which is the "select first, then choose what to do with it" order. The tool also
   * becomes active, so the next selection is marked without a second tap.
   */
  const handleToolTap = useCallback(
    (next: PdfTool) => {
      /*
        Two orders of operation, and they mean different things.

        Selecting a passage FIRST and then reaching for a tool is a one-off action on that
        passage: mark this, and be done. So the mark is made and the workspace drops straight
        back to Select, ready for the next passage — leaving the highlighter armed would mean
        the reader's next drag silently highlighted something they only meant to read.

        Choosing the tool FIRST and then selecting is the opposite intent: the reader is settling
        in to highlight several passages in a row, and the tool stays armed until they change it.
      */
      // Black it out (Words) over a passage already selected: blacked out at once, as a highlight would be.
      if (next === 'mask' && maskMode === 'words' && pendingSelection?.length) {
        const bars = blackoutMarks(pendingSelection, { color: toolColors.mask ?? '#000000', author: settings.name });
        setAnnotations((prev) => [...prev, ...bars]);
        if (bars[0]) setSelectedId(bars[0].id);
        setPendingSelection(null);
        setSelectionAnchor(null);
        window.getSelection()?.removeAllRanges();
        setOpenSubmenuFor(null);
        return;
      }
      const actsOnSelection = isTextAnchored(next) && Boolean(pendingSelection?.length);
      if (actsOnSelection) {
        // A name typed in the menu's "+ New theme" field becomes the theme of this mark.
        applyTextMark(next, pendingSelection!, undefined, commitOpenThemeField());
        setTool('select');
        setSelectionAnchor(null);
        setOpenSubmenuFor(null);
        return;
      }

      /*
        Tapping the tool you are already holding shows and hides its options. It does NOT put the
        tool down: picking a tool both arms it and opens its colour and thickness controls, and
        the reader's next thought is usually "chosen — now get this panel out of my way".
        Disarming there would mean the gesture for dismissing a panel silently disarmed the
        highlighter mid-passage. Escape is what puts a tool down.

        The panel closes itself the moment this button is pressed, since a press outside it
        dismisses it. So closing is simply declining to ask for it back.
      */
      if (next === tool && next !== 'select') {
        const justClosed =
          submenuClosedAt.current?.tool === next &&
          performance.now() - submenuClosedAt.current.at < 350;
        // Cleared either way, so a panel dismissed by pressing the PAGE cannot swallow the next
        // tap on the tool itself.
        submenuClosedAt.current = null;
        if (justClosed) return;
        setOpenSubmenuFor(next);
        return;
      }

      setTool(next);
      // Picking up a tool opens its options with it. Colour and thickness are chosen far more
      // often at the moment of switching tools than at any other time, and requiring a second
      // click on a chip the size of a grain of rice to reach them was a tax on the common case.
      // Select, Erase and Terminology have nothing to configure — a terminology mark's colour is
      // the single setting in Settings → Terminology, not a per-tool choice.
      setOpenSubmenuFor(next === 'select' || next === 'erase' || next === 'terminology' ? null : next);
    },
    [pendingSelection, applyTextMark, tool, maskMode, toolColors, settings.name]
  );

  return { applyTextMark, createNoteForSelection, createReactionForSelection, handleToolTap, unreadable, ...styleHandlers };
}

export type TextMarking = ReturnType<typeof useTextMarking>;
