/**
 * The PDF workspace's floating layer: the instance navigator, the scroll page indicator, the selected
 * mark's properties, the live selection overlay and the selection menu (moved verbatim from
 * PdfWorkspace).
 */

import React from 'react';
import type { ThemeStore } from '../../themeStore';
import { UserSettings } from '../../../types';
import { isReaction } from '../annotationModel';
import { InstanceNavigator } from '../InstanceNavigator';
import { SelectionPopover } from '../SelectionPopover';
import { LiveSelectionOverlay } from '../LiveSelectionOverlay';
import { MarkProperties } from '../MarkProperties';
import { ScrollPageIndicator } from '../ScrollPageIndicator';
import { copyText } from '../../MarksArchive';
import { formatQuoteRef } from '../../../utils/quoteRef';
import { NAVIGATOR_HEIGHT } from './docState';
import { pickTheme } from '../../../utils/markThemes';
import type { WorkspaceMarks, WorkspaceSelection, WorkspaceStatus, WorkspaceView } from './workspaceState';
import type { PdfToolStyles } from './usePdfToolStyles';
import type { TextMarking } from './useTextMarking';
import type { WorkspaceThemePicker } from './useWorkspaceKeys';
import type { MarkMutations } from './useMarkMutations';
import type { MarkGeometry } from './useMarkGeometry';
import type { WorkspaceExtras } from './useWorkspaceExtras';

export interface WorkspacePopoversProps {
  documentTitle: string;
  isDark: boolean;
  settings: UserSettings;
  themeStore: ThemeStore | undefined;
  styles: Pick<PdfToolStyles, 'activeThemeIds' | 'setTool' | 'toolColors'>;
  marking: Pick<TextMarking, 'applyTextMark' | 'createNoteForSelection' | 'createReactionForSelection'>;
  themePicker: Pick<WorkspaceThemePicker, 'chooseSelectionTheme' | 'createSelectionTheme'>;
  marks: Pick<WorkspaceMarks, 'annotations'>;
  mutations: Pick<MarkMutations, 'deleteAnnotation' | 'startEditing' | 'updateAnnotation'>;
  geometry: Pick<MarkGeometry, 'editing' | 'markRect' | 'popoverTopInset' | 'selectedMark'>;
  selection: Pick<WorkspaceSelection, 'pendingSelection' | 'selectionAnchor' | 'setSelectionAnchor' | 'setHoveredId' | 'setSelectedId'>;
  view: Pick<WorkspaceView, 'layoutSettled' | 'pageCount' | 'scrollRef'>;
  status: Pick<WorkspaceStatus, 'activeFocus' | 'setActiveFocus' | 'isLoaded'>;
  extras: Pick<WorkspaceExtras, 'markLinksFor' | 'scrollToAnnotation'>;
}

export const WorkspacePopovers: React.FC<WorkspacePopoversProps> = ({ documentTitle, isDark, settings, themeStore, styles, marking, themePicker, marks, mutations, geometry, selection, view, status, extras }) => {
  const { activeThemeIds, setTool, toolColors } = styles;
  const { applyTextMark, createNoteForSelection, createReactionForSelection } = marking;
  const { chooseSelectionTheme, createSelectionTheme } = themePicker;
  const { annotations } = marks;
  const { deleteAnnotation, startEditing, updateAnnotation } = mutations;
  const { editing, markRect, popoverTopInset, selectedMark } = geometry;
  const { pendingSelection, selectionAnchor, setSelectionAnchor, setHoveredId, setSelectedId } = selection;
  const { layoutSettled, pageCount, scrollRef } = view;
  const { activeFocus, setActiveFocus, isLoaded } = status;
  const { markLinksFor, scrollToAnnotation } = extras;
  return (
  <>
      {/* Stepping through the marks the reader came here to find. Reads from live annotation
          state, so marking or erasing while it is open changes the run under it. */}
      {activeFocus && isLoaded && layoutSettled && (
        <InstanceNavigator
          focus={activeFocus}
          annotations={annotations}
          // Brings the mark into view and raises it, without selecting it. Selecting opens the
          // properties strip, which is an editing gesture the reader did not ask for — stepping
          // through marks is reading, and what to change is their decision to make afterwards.
          onGoTo={(a) => {
            setHoveredId(a.id);
            return scrollToAnnotation(a);
          }}
          onClose={() => setActiveFocus(null)}
          isDark={isDark}
        />
      )}

      {/* The page number, beside the scrollbar, while the reader is scrolling. */}
      <ScrollPageIndicator containerRef={scrollRef} pageCount={pageCount} isDark={isDark} />

      {/* Properties for whatever is selected: colour, thickness, comment, delete. */}
      {selectedMark && markRect && !editing && (
        <MarkProperties
          mark={selectedMark}
          rect={markRect}
          settings={settings}
          isDark={isDark}
          // Colour and theme change together: a theme swatch carries its id along, and anything
          // else (a custom colour, a neutral, the free picker) carries `null` — leaving the mark's
          // OLD themeId in place after its colour visibly stopped matching that theme is exactly
          // the mismatch that made a retagged mark silently miscount on the cross-document dashboard.
          bottomInset={activeFocus ? NAVIGATOR_HEIGHT : 0}
          topInset={popoverTopInset}
          // A theme swatch toggles that theme on the mark (several themes per mark); see pickTheme.
          onColorChange={(color, themeId) => updateAnnotation(selectedMark.id, pickTheme(selectedMark.themeIds ?? [], themeId, color, settings.activeThemes))}
          onWeightChange={(weight) => updateAnnotation(selectedMark.id, { weight })}
          onStrokeStyleChange={(strokeStyle) => updateAnnotation(selectedMark.id, { strokeStyle })}
          onNoteStyleChange={(noteStyle) => updateAnnotation(selectedMark.id, { noteStyle })}
          onBracketSideChange={(bracketSide) => updateAnnotation(selectedMark.id, { bracketSide })}
          onTextSizeChange={(fontSize) => updateAnnotation(selectedMark.id, { fontSize })}
          onTextAlignChange={(align) => updateAnnotation(selectedMark.id, { align })}
          onTextFontChange={(font) => updateAnnotation(selectedMark.id, { font })}
          onTextBoldChange={(bold) => updateAnnotation(selectedMark.id, { bold })}
          onTextItalicChange={(italic) => updateAnnotation(selectedMark.id, { italic })}
          onEdit={() => startEditing(selectedMark.id)}
          onDelete={() => deleteAnnotation(selectedMark.id)}
          // Pressing anywhere that is not this strip, a mark or a menu puts it away. Leaving a
          // mark selected — and its strip floating over the page — after the reader had visibly
          // moved on was the single most persistent annoyance in the editor.
          onDismiss={() => setSelectedId(null)}
          onCopyQuote={selectedMark.quote ? () => copyText(formatQuoteRef(selectedMark.quote!, documentTitle, { kind: 'page', page: selectedMark.page })) : undefined}
          links={markLinksFor(selectedMark.id)}
        />
      )}

      <LiveSelectionOverlay />

      {/* The selection menu — mark the passage, or write a note about it. */}
      {!editing && (
        <SelectionPopover
          anchor={selectionAnchor}
          isDark={isDark}
          bottomInset={activeFocus ? NAVIGATOR_HEIGHT : 0}
          topInset={popoverTopInset}
          toolColors={toolColors}
          themes={settings.activeThemes}
          activeThemeIds={activeThemeIds}
          onThemeChange={chooseSelectionTheme}
          onCreateTheme={themeStore ? createSelectionTheme : undefined}
          onCopyQuote={
            pendingSelection?.length
              ? () =>
                  copyText(
                    formatQuoteRef(pendingSelection.map((g) => g.quote).join(' '), documentTitle, { kind: 'page', page: pendingSelection[0].page })
                  )
              : undefined
          }
          onMark={(kind) => {
            if (isReaction(kind)) {
              createReactionForSelection(kind);
            } else {
              if (pendingSelection?.length) applyTextMark(kind, pendingSelection);
              setSelectionAnchor(null);
              window.getSelection()?.removeAllRanges();
            }
            // The menu acts on THIS passage and hands the workspace back in its resting state.
            // Arming the tool here would leave the next drag marking something by accident, and
            // the reader who wants to keep highlighting can say so from the toolbar.
            setTool('select');
          }}
          onCreateNote={() => {
            createNoteForSelection();
            setTool('select');
          }}
          onMarkTerminology={() => {
            if (pendingSelection?.length) applyTextMark('terminology', pendingSelection);
            setSelectionAnchor(null);
            window.getSelection()?.removeAllRanges();
            setTool('select');
          }}
          terminologyColor={settings.terminologyColor}
          // Dismissing takes the MENU away and leaves the passage selected. It fires on any
          // press outside — including a press on a toolbar tool — and clearing the selection
          // there would pull the passage out from under the very action being reached for.
          onDismiss={() => setSelectionAnchor(null)}
          // The X button means "done with this passage" — clear the selection too, or the
          // global mouseup listener above would see it's still live and reopen this menu.
          onClose={() => {
            setSelectionAnchor(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}
  </>
  );
};
