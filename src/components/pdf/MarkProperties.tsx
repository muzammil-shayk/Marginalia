/**
 * The properties strip for the mark that is currently selected.
 *
 * Draw a shape and it stays selected with its own controls floating beside it, so its colour,
 * thickness and dash pattern can be changed after the fact rather than only before. It works on
 * marks made in an earlier session too — click one, and the same strip appears.
 *
 * Every control here is the same component the main toolbar uses (see `StyleControls`), so a mark
 * can be restyled in exactly the vocabulary it was drawn in.
 *
 * Rendered in the shared `AnchoredPopover`: above the mark by default, below it near the top edge,
 * clamped to the window and wrapped onto more rows on a narrow one. It closes the moment the reader
 * presses anywhere else, or Escape, because a strip that outlives the selection it describes is
 * worse than no strip. Delete or Backspace removes the mark (handled by the workspace).
 */

import React from 'react';
import { Trash2, Pencil } from '../icons';
import {
  Annotation,
  BracketSide,
  NoteStyle,
  StrokeStyle,
  TextAlign,
  TextFont,
  isReaction,
  isStroked,
  isTextAnchored
} from './annotationModel';
import { UserSettings } from '../../types';
import {
  AlignPicker,
  BracketSidePicker,
  EmphasisPicker,
  FontPicker,
  ColorPalette,
  Divider,
  NoteStylePicker,
  StrokeStylePicker,
  TextSizePicker,
  WeightPicker
} from './StyleControls';
import { AnchoredPopover, PanelContext } from './AnchoredPopover';
import { withShortcut } from './workspaceKeys';

/** How the Delete key is named on this platform, for the delete button's tooltip. */
const DELETE_KEY =
  typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)
    ? '⌫'
    : 'Delete';

interface MarkPropertiesProps {
  mark: Annotation;
  /** Viewport rectangle of the mark, used to place the strip. */
  rect: { left: number; top: number; right: number; bottom: number };
  /** Pixels at the foot of the window this strip must stay clear of — the instance navigator. */
  bottomInset?: number;
  /** Pixels at the top of the window this strip must stay clear of — the toolbar. */
  topInset?: number;
  /** Glyphs to keep clear and free places to use (the reader's; see `placePanel`). */
  placementContext?: () => PanelContext;
  settings: UserSettings;
  isDark?: boolean;
  onColorChange: (color: string, themeId: string | null) => void;
  onWeightChange: (weight: number) => void;
  onStrokeStyleChange: (style: StrokeStyle) => void;
  onNoteStyleChange: (style: NoteStyle) => void;
  onBracketSideChange: (side: BracketSide) => void;
  onTextSizeChange: (size: number) => void;
  onTextAlignChange: (align: TextAlign) => void;
  onTextFontChange: (font: TextFont) => void;
  onTextBoldChange: (bold: boolean) => void;
  onTextItalicChange: (italic: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Clears the selection, which is what takes this strip off the screen. */
  onDismiss: () => void;
}

export const MarkProperties: React.FC<MarkPropertiesProps> = ({
  mark,
  rect,
  bottomInset = 0,
  topInset = 0,
  placementContext,
  settings,
  isDark = false,
  onColorChange,
  onWeightChange,
  onStrokeStyleChange,
  onNoteStyleChange,
  onBracketSideChange,
  onTextSizeChange,
  onTextAlignChange,
  onTextFontChange,
  onTextBoldChange,
  onTextItalicChange,
  onEdit,
  onDelete,
  onDismiss
}) => {

  // Highlights fill rather than stroke, so they have no thickness or dash pattern to set.
  const showsStroke = isStroked(mark.kind);
  const showsText = mark.kind === 'note' || mark.kind === 'text' || isTextAnchored(mark.kind);
  // A reaction is just a glyph — no font, alignment or emphasis to set, only how big it reads.
  const showsSize = mark.kind === 'text' || isReaction(mark.kind);

  // The strip is always "open" while a mark is selected, so dismissal here means deselecting.
  // Presses on the mark's own handles out on the page count as inside, or grabbing a handle would
  // deselect the mark at the very moment the reader took hold of it. The kind decides which
  // controls show, so it is what re-places the strip.
  return (
    <AnchoredPopover
      anchor={rect}
      label={`${mark.isTerminology ? 'Terminology' : mark.kind} mark properties`}
      isDark={isDark}
      onDismiss={onDismiss}
      ignoreSelector="[data-mark-ui]"
      topInset={topInset}
      bottomInset={bottomInset}
      measureKey={mark.kind}
      // Off the reader's note cards when the other side of the mark is free.
      avoidSelector="[data-note-card]"
      placementContext={placementContext}
      className="flex-nowrap gap-1 p-1.5"
    >
      {/* One row at every width: on a phone the style controls scroll sideways (edges fade)
          rather than stacking a second row over the text being styled. Comment and delete stay
          pinned at the end, always in reach. */}
      <div className="hide-scrollbar flex flex-nowrap items-center gap-1 min-w-0 flex-1 overflow-x-auto">
      {/* The kind is in the toolbar's name; on a phone its label gives way to the controls. */}
      <span className="caps caps-sm text-muted dark:text-paper/70 px-1 capitalize max-sm:hidden">
        {mark.isTerminology ? 'Terminology' : mark.kind}
      </span>

      <Divider isDark={isDark} className="max-sm:hidden" />

      {mark.isTerminology ? (
        // Its colour is the live Settings → Terminology setting, not a per-mark choice — offering
        // a palette here would change `mark.color` for nothing, since rendering and export both
        // ignore it in favour of that setting.
        <span className="text-[10.5px] text-muted px-1 italic whitespace-nowrap">
          Colour set in Settings → Terminology
        </span>
      ) : (
        <ColorPalette
          color={mark.color}
          themes={settings.activeThemes}
          customColors={settings.customColors}
          onChange={onColorChange}
        />
      )}

      {showsStroke && (
        <>
          <Divider isDark={isDark} />
          <WeightPicker weight={mark.weight} color={mark.color} onChange={onWeightChange} swatchScale={620} />
          <Divider isDark={isDark} />
          <StrokeStylePicker value={mark.strokeStyle} color={mark.color} onChange={onStrokeStyleChange} />
        </>
      )}

      {mark.kind === 'note' && (
        <>
          <Divider isDark={isDark} />
          <NoteStylePicker value={mark.noteStyle} color={mark.color} onChange={onNoteStyleChange} />
        </>
      )}

      {mark.kind === 'bracket' && (
        <>
          <Divider isDark={isDark} />
          <BracketSidePicker value={mark.bracketSide} onChange={onBracketSideChange} />
        </>
      )}

      {mark.kind === 'text' && (
        <>
          <Divider isDark={isDark} />
          <FontPicker value={mark.font} onChange={onTextFontChange} />
          <Divider isDark={isDark} />
          <EmphasisPicker
            bold={mark.bold}
            italic={mark.italic}
            onBoldChange={onTextBoldChange}
            onItalicChange={onTextItalicChange}
          />
        </>
      )}

      {showsSize && (
        <>
          <Divider isDark={isDark} />
          <TextSizePicker value={mark.fontSize} color={mark.color} onChange={onTextSizeChange} />
        </>
      )}

      {mark.kind === 'text' && (
        <>
          <Divider isDark={isDark} />
          <AlignPicker value={mark.align} color={mark.color} onChange={onTextAlignChange} />
        </>
      )}

      </div>

      <Divider isDark={isDark} />

      {showsText && (
        <button
          type="button"
          onClick={onEdit}
          title="Write a comment on this mark"
          aria-label="Write a comment on this mark"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted dark:text-paper/70 hover:text-stone-800 dark:hover:text-paper hover:bg-stone-100 dark:hover:bg-nav-hover cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        title={withShortcut('Delete this mark', DELETE_KEY)}
        aria-label="Delete this mark"
        aria-keyshortcuts="Delete Backspace"
        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted dark:text-paper/70 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </AnchoredPopover>
  );
};
