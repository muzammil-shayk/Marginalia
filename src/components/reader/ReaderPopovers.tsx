/**
 * The reader's floating layer: the instance navigator, the selected mark's properties, the marks
 * archive's dialogs and the selection menu (moved verbatim from ReaderScreen).
 */

import React from 'react';
import { UserSettings } from '../../types';
import type { PlainTextAnnotations } from '../../hooks/usePlainTextAnnotations';
import { type TextMarkKind } from '../../utils/textMarks';
import { SelectionPopover } from '../pdf/SelectionPopover';
import { MarkProperties } from '../pdf/MarkProperties';
import { InstanceNavigator } from '../pdf/InstanceNavigator';
import { pickTheme } from '../../utils/markThemes';
import { isReactionKind } from './readerParts';
import type { ReaderPanels, ReaderSelection, ReaderThemes } from './readerState';
import type { ReaderMarkViews } from './useReaderMarkViews';
import type { ReaderMarking } from './useReaderMarking';
import type { ReaderMarkUi } from './useReaderMarkUi';
import type { ReaderLayout } from './useReaderLayout';
import type { ReaderExtras } from './useReaderExtras';

export interface ReaderPopoversProps {
  settings: UserSettings;
  isDark: boolean;
  annotations: PlainTextAnnotations;
  popoverTopInset: number;
  selectionInView: boolean;
  themes: Pick<ReaderThemes, 'activeThemeIds' | 'toggleActiveTheme' | 'toolColors' | 'themeStore'>;
  panels: Pick<ReaderPanels, 'activeControlTab' | 'activeFocus' | 'setActiveFocus' | 'bottomInset'>;
  selection: Pick<ReaderSelection, 'pendingSelection' | 'selectionAnchor' | 'setSelectionAnchor' | 'setHoveredId' | 'setTool'>;
  markViews: Pick<ReaderMarkViews, 'editorOpen' | 'selectedView' | 'views'>;
  marking: Pick<ReaderMarking, 'applyMark' | 'createNoteForSelection' | 'createReactionForSelection' | 'deleteMark' | 'dropSelection' | 'startEditing'>;
  markUi: Pick<ReaderMarkUi, 'markRect' | 'scrollToMark'>;
  layout: Pick<ReaderLayout, 'placementContext'>;
  extras: Pick<ReaderExtras, 'archive' | 'copyQuoteOf' | 'copySelectionQuote' | 'markLinksFor'>;
}

export const ReaderPopovers: React.FC<ReaderPopoversProps> = ({ settings, isDark, annotations, popoverTopInset, selectionInView, themes, panels, selection, markViews, marking, markUi, layout, extras }) => {
  const { activeThemeIds, toggleActiveTheme, toolColors, themeStore } = themes;
  const { activeControlTab, activeFocus, setActiveFocus, bottomInset } = panels;
  const { pendingSelection, selectionAnchor, setSelectionAnchor, setHoveredId, setTool } = selection;
  const { editorOpen, selectedView, views } = markViews;
  const { applyMark, createNoteForSelection, createReactionForSelection, deleteMark, dropSelection, startEditing } = marking;
  const { markRect, scrollToMark } = markUi;
  const { placementContext } = layout;
  const { archive, copyQuoteOf, copySelectionQuote, markLinksFor } = extras;
  const { clearSelection, updateMarks } = annotations;
  return (
  <>
      {/* Stepping through the marks the reader came here to find (opened from the library). */}
      {activeFocus && annotations.isLoaded && (
        <div className="fixed inset-x-0 bottom-0 max-md:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] h-0 z-30">
          <InstanceNavigator
            focus={activeFocus}
            annotations={views}
            onGoTo={(a) => {
              setHoveredId(a.id);
              return scrollToMark(a.id);
            }}
            onClose={() => setActiveFocus(null)}
            isDark={isDark}
            locationLabel={(a) => `¶${a.page}`}
          />
        </div>
      )}

      {/* Properties for the selected mark: colour, weight, line style, note style, comment, delete. */}
      {selectedView && markRect && !editorOpen && (
        <MarkProperties
          mark={selectedView}
          rect={markRect}
          settings={settings}
          isDark={isDark}
          bottomInset={bottomInset}
          topInset={popoverTopInset}
          placementContext={placementContext}
          onColorChange={(color, themeId) => updateMarks([selectedView.id], pickTheme(selectedView.themeIds ?? [], themeId, color, settings.activeThemes))}
          onWeightChange={(weight) => updateMarks([selectedView.id], { weight })}
          onStrokeStyleChange={(strokeStyle) => updateMarks([selectedView.id], { strokeStyle })}
          onNoteStyleChange={(noteStyle) => updateMarks([selectedView.id], { noteStyle })}
          onTextSizeChange={(fontSize) => updateMarks([selectedView.id], { fontSize })}
          // Brackets and text boxes do not exist on text documents; their controls never show.
          onBracketSideChange={() => {}}
          onTextAlignChange={() => {}}
          onTextFontChange={() => {}}
          onTextBoldChange={() => {}}
          onTextItalicChange={() => {}}
          onEdit={() => startEditing(selectedView.id)}
          onDelete={() => deleteMark(selectedView.id)}
          onDismiss={clearSelection}
          onCopyQuote={selectedView.quote ? () => copyQuoteOf(selectedView.id, selectedView.quote!) : undefined}
          links={markLinksFor(selectedView.id)}
        />
      )}

      {archive.ui}

      {/* The selection menu — mark the passage, or write a note about it. */}
      {!editorOpen && activeControlTab === 'notes' && (
        <SelectionPopover
          anchor={selectionInView ? selectionAnchor : null}
          isDark={isDark}
          topInset={popoverTopInset}
          bottomInset={bottomInset}
          toolColors={toolColors}
          themes={settings.activeThemes}
          activeThemeIds={activeThemeIds}
          onThemeChange={toggleActiveTheme}
          onCreateTheme={themeStore?.create}
          onCopyQuote={pendingSelection?.length ? () => copySelectionQuote(pendingSelection) : undefined}
          onMark={(kind) => {
            if (isReactionKind(kind as TextMarkKind)) createReactionForSelection(kind as TextMarkKind);
            else {
              if (pendingSelection?.length) applyMark(kind as 'highlight' | 'underline' | 'strikeout', pendingSelection);
              dropSelection();
            }
            setTool('select');
          }}
          onCreateNote={() => {
            createNoteForSelection();
            setTool('select');
          }}
          onMarkTerminology={() => {
            if (pendingSelection?.length) applyMark('terminology', pendingSelection);
            dropSelection();
            setTool('select');
          }}
          terminologyColor={settings.terminologyColor}
          onDismiss={() => setSelectionAnchor(null)}
          // Never over the text or a note card: the margin, above, below, the nav, or a gap.
          avoidSelector="[data-note-card]"
          placementContext={placementContext}
          onClose={dropSelection}
        />
      )}
  </>
  );
};
