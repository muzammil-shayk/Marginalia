/**
 * The PDF workspace's toolbar row (inside focus mode's sliding chrome), the Find bar and focus mode's
 * exit (moved verbatim from PdfWorkspace).
 */

import React from 'react';
import { StickyNote } from '../../icons';
import { FocusChrome, FocusExit, FOCUS_HOTKEY } from '../../FocusMode';
import { HoverTooltip } from '../../HoverTooltip';
import { CollapseIcon, Maximize2, Minimize2, Redo2, Search, Undo2 } from '../../icons';
import { COLLAPSE_HOTKEY } from '../../reader/useReaderCollapse';
import type { PdfCollapse } from './PdfCollapsed';
import { FindBar, FIND_SHORTCUT } from '../../FindBar';
import { UserSettings } from '../../../types';
import { PdfToolbar, TOOL_GROUPS } from '../PdfToolbar';
import { FindScanNote, OcrDocumentMenu } from '../OcrControls';
import { FocusPalette, type PaletteTool } from '../../FocusPalette';
import type { PaletteSpot } from '../../paletteSpot';
import { TOOL_HOTKEYS } from '../workspaceKeys';
import type { PdfTool } from '../annotationModel';
import { archiveRows } from '../../MarksArchive';
import { classPackHasBlackouts } from '../../../utils/classPack';
import type { WorkspaceMarks, WorkspaceSelection, WorkspaceStatus, WorkspaceView } from './workspaceState';
import type { PdfToolStyles } from './usePdfToolStyles';
import type { TextMarking } from './useTextMarking';
import type { PdfNavigation } from './usePdfNavigation';
import type { WorkspaceExtras } from './useWorkspaceExtras';
import type { PageEdits } from './usePageEdits';

export interface WorkspaceToolbarProps {
  docId?: string;
  settings: UserSettings;
  isDark: boolean;
  focusMode: boolean;
  onToggleFocus: (() => void) | undefined;
  onFocusPaletteChange?: (spot: PaletteSpot) => void;
  zoomTouchedRef: React.RefObject<boolean>;
  styles: Pick<PdfToolStyles, 'maskMode' | 'setMaskMode' | 'activeThemeId' | 'setActiveThemeId' | 'bracketSide' | 'noteStyle' | 'textAlign' | 'textBold' | 'textFont' | 'textItalic' | 'textSize' | 'tool' | 'toolColors' | 'toolStrokeStyles' | 'toolWeights'>;
  marking: Pick<TextMarking, 'handleBracketSideChange' | 'handleNoteStyleChange' | 'handleTextAlignChange' | 'handleTextBoldChange' | 'handleTextFontChange' | 'handleTextItalicChange' | 'handleTextSizeChange' | 'handleToolColorChange' | 'handleToolStrokeStyleChange' | 'handleToolTap' | 'handleToolWeightChange'>;
  marks: Pick<WorkspaceMarks, 'annotations' | 'canUndo' | 'canRedo' | 'undo' | 'redo'>;
  selection: Pick<WorkspaceSelection, 'openSubmenuFor' | 'setOpenSubmenuFor' | 'submenuClosedAt' | 'pendingSelection' | 'selectedId'>;
  view: Pick<WorkspaceView, 'currentPage' | 'pageCount' | 'scale' | 'setScale' | 'viewMode'>;
  status: Pick<WorkspaceStatus, 'isExporting' | 'isPanelOpen' | 'setIsPanelOpen'>;
  nav: Pick<PdfNavigation, 'fitPage' | 'fitWidth' | 'goToPage' | 'handleViewModeChange'>;
  extras: Pick<WorkspaceExtras, 'archive' | 'find' | 'handleExport' | 'unreadScans'>;
  pageEdits: Pick<PageEdits, 'isDeletingPage' | 'isInsertingPage' | 'setInsertPageMenuOpen'>;
  collapse: Pick<PdfCollapse, 'on' | 'toggle'>;
}

/** Focus mode's floating tools (FocusPalette): the marking and drawing tools, grouped as on the toolbar. */
const PALETTE_TOOLS: PdfTool[][] = [['select', 'highlight', 'underline'], ['ink', 'inkArrow', 'arrow', 'rect', 'ellipse', 'note'], ['erase']];
const TOOL_BY_ID = new Map(TOOL_GROUPS.flat().map((t) => [t.id, t]));

export const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({ docId, settings, isDark, focusMode, onToggleFocus, onFocusPaletteChange, zoomTouchedRef, styles, marking, marks, selection, view, status, nav, extras, pageEdits, collapse }) => {
  const { maskMode, setMaskMode, activeThemeId, setActiveThemeId, bracketSide, noteStyle, textAlign, textBold, textFont, textItalic, textSize, tool, toolColors, toolStrokeStyles, toolWeights } = styles;
  const { handleBracketSideChange, handleNoteStyleChange, handleTextAlignChange, handleTextBoldChange, handleTextFontChange, handleTextItalicChange, handleTextSizeChange, handleToolColorChange, handleToolStrokeStyleChange, handleToolTap, handleToolWeightChange } = marking;
  const { annotations, canUndo, canRedo, undo, redo } = marks;
  const { openSubmenuFor, setOpenSubmenuFor, submenuClosedAt, pendingSelection, selectedId } = selection;
  const { currentPage, pageCount, scale, setScale, viewMode } = view;
  const { isExporting, isPanelOpen, setIsPanelOpen } = status;
  const { fitPage, fitWidth, goToPage, handleViewModeChange } = nav;
  const { archive, find, handleExport } = extras;
  const { isDeletingPage, isInsertingPage, setInsertPageMenuOpen } = pageEdits;
  return (
  <>
      <FocusChrome focus={focusMode} selecting={Boolean(pendingSelection?.length || selectedId)}>
      <PdfToolbar
        // The expanded sidebar takes 220px off this row, which is what forced the tools together.
        // With it collapsed there is room to breathe, so the tools get their ordinary spacing back
        // rather than staying cramped for a constraint that is no longer there.
        compact={!settings.sidebarCollapsed}
        panelControls={
          <>
            {docId && <OcrDocumentMenu docId={docId} isDark={isDark} />}
            <HoverTooltip label={collapse.on ? `Show everything (${COLLAPSE_HOTKEY})` : `Collapse to marks (${COLLAPSE_HOTKEY})`}>
              <button
                type="button"
                onClick={collapse.toggle}
                aria-label="Collapse to marks"
                aria-keyshortcuts={COLLAPSE_HOTKEY}
                aria-pressed={collapse.on}
                className={`p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer ${collapse.on ? 'text-gold dark:text-gold' : 'text-muted'}`}
              >
                <CollapseIcon className="w-4 h-4" weight={collapse.on ? 'bold' : 'regular'} />
              </button>
            </HoverTooltip>
            <button
              type="button"
              onClick={find.open ? find.close : find.openFind}
              title={`Find in document (${FIND_SHORTCUT})`}
              aria-label="Find in document"
              aria-pressed={find.open}
              className={`p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer ${find.open ? 'text-gold dark:text-gold' : 'text-muted'}`}
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              title={isPanelOpen ? 'Hide marks panel' : 'Show marks panel'}
              aria-label={isPanelOpen ? 'Hide marks panel' : 'Show marks panel'}
              // One glyph, not two. The note and the panel chevron said the same thing twice, and
              // read as two controls crammed into one button. Open state is carried by weight and
              // colour, the same way every other tool in this row shows it.
              className={`p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer transition-[background-color,transform] duration-150 ease-out active:scale-[0.94] ${
                isPanelOpen
                  ? 'text-gold dark:text-gold'
                  : 'text-muted'
              }`}
            >
              <StickyNote
                className="w-4 h-4"
                weight={isPanelOpen ? 'fill' : 'regular'}
              />
            </button>
            {onToggleFocus && (
              <HoverTooltip label={focusMode ? `Leave focus mode (${FOCUS_HOTKEY} or Esc)` : `Focus mode (${FOCUS_HOTKEY})`}>
                <button
                  type="button"
                  onClick={onToggleFocus}
                  aria-label={focusMode ? `Leave focus mode (${FOCUS_HOTKEY})` : `Focus mode (${FOCUS_HOTKEY})`}
                  aria-keyshortcuts={FOCUS_HOTKEY}
                  aria-pressed={focusMode}
                  className={`p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer ${focusMode ? 'text-gold dark:text-gold' : 'text-muted'}`}
                >
                  {focusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </HoverTooltip>
            )}
          </>
        }
        tool={tool}
        onToolChange={handleToolTap}
        hasSelection={Boolean(pendingSelection?.length)}
        settings={settings}
        activeThemeId={activeThemeId}
        onThemeChange={setActiveThemeId}
        toolColors={toolColors}
        onToolColorChange={handleToolColorChange}
        toolWeights={toolWeights}
        onToolWeightChange={handleToolWeightChange}
        toolStrokeStyles={toolStrokeStyles}
        onToolStrokeStyleChange={handleToolStrokeStyleChange}
        noteStyle={noteStyle}
        onNoteStyleChange={handleNoteStyleChange}
        bracketSide={bracketSide}
        maskMode={maskMode}
        onMaskModeChange={setMaskMode}
        onBracketSideChange={handleBracketSideChange}
        textSize={textSize}
        onTextSizeChange={handleTextSizeChange}
        textAlign={textAlign}
        onTextAlignChange={handleTextAlignChange}
        textFont={textFont}
        onTextFontChange={handleTextFontChange}
        textBold={textBold}
        onTextBoldChange={handleTextBoldChange}
        textItalic={textItalic}
        onTextItalicChange={handleTextItalicChange}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo && !isInsertingPage && !isDeletingPage}
        canRedo={canRedo && !isInsertingPage && !isDeletingPage}
        openSubmenuFor={openSubmenuFor}
        onSubmenuOpened={() => setOpenSubmenuFor(null)}
        onSubmenuOpenChange={(id, open) => {
          if (!open) submenuClosedAt.current = { tool: id, at: performance.now() };
        }}
        scale={scale}
        onScaleChange={(next) => {
          zoomTouchedRef.current = true;
          setScale(next);
        }}
        onFitWidth={() => void fitWidth()}
        onFitPage={() => void fitPage()}
        currentPage={currentPage}
        pageCount={pageCount}
        onGoToPage={goToPage}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onInsertPage={() => setInsertPageMenuOpen(true)}
        markCount={annotations.length}
        onExport={() => void handleExport()}
        isExporting={isExporting}
        archiveRows={archiveRows(archive, annotations.length, classPackHasBlackouts(annotations))}
        isDark={isDark}
      />
      {find.open && (
        <div className={`shrink-0 px-3 py-1.5 border-b ${isDark ? 'bg-night-2 border-stone-800' : 'bg-white border-stone-200'}`}>
          <FindBar find={find} isDark={isDark} note={docId && <FindScanNote docId={docId} unread={extras.unreadScans} hits={find.hits.length} pages={view.pageCount} query={find.query} />} />
        </div>
      )}
      </FocusChrome>
      {focusMode && onToggleFocus && <FocusExit onExit={onToggleFocus} isDark={isDark} />}
      {focusMode && (
        <FocusPalette
          isDark={isDark}
          spot={settings.focusPalette}
          onSpotChange={(spot) => onFocusPaletteChange?.(spot)}
          groups={[
            ...PALETTE_TOOLS.map((ids) =>
              ids.map((id): PaletteTool => {
                const t = TOOL_BY_ID.get(id)!;
                return { id, label: t.label, icon: t.icon, hotkey: TOOL_HOTKEYS[id], active: tool === id, color: id === 'select' || id === 'erase' ? undefined : toolColors[id], onClick: () => {
                    handleToolTap(id);
                    // Arming a tool opens its options under the toolbar's chip; in focus mode that chip is out of sight.
                    setOpenSubmenuFor(null);
                  } };
              })
            ),
            [
              { id: 'undo', label: 'Undo', icon: Undo2, disabled: !canUndo, onClick: undo },
              { id: 'redo', label: 'Redo', icon: Redo2, disabled: !canRedo, onClick: redo }
            ]
          ]}
        />
      )}
  </>
  );
};
