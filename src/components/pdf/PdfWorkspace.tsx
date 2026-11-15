/**
 * The PDF workspace: our own viewer and annotation editor, with the notes panel beside it.
 *
 * Built on pdf.js directly rather than on a viewer library, because owning the annotation model
 * is what makes the rest possible — marks carry their theme, hovering a note can light up exactly
 * the passage it refers to, and the AI's extracted themes can become highlights without asking a
 * third party's permission.
 */

import React, { useMemo } from 'react';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import { Loader2, ArrowLeft, Check } from '../icons';
import type { ThemeStore } from '../themeStore';
import { AnnotationFocus, Screen, TransitionType, UserSettings } from '../../types';
import { pageToolFor } from './annotationModel';
import { BlackoutExportDialog } from './workspace/BlackoutExportDialog';
import { ErrorDialog } from '../ErrorDialog';
import { usePdfToolStyles } from './workspace/usePdfToolStyles';
import { useWorkspaceState } from './workspace/workspaceState';
import { useMarkGeometry } from './workspace/useMarkGeometry';
import { usePageEdits } from './workspace/usePageEdits';
import { useWorkspaceExtras } from './workspace/useWorkspaceExtras';
import { usePdfNavigation } from './workspace/usePdfNavigation';
import { useWorkspaceKeys } from './workspace/useWorkspaceKeys';
import { useTextMarking } from './workspace/useTextMarking';
import { useMarkMutations } from './workspace/useMarkMutations';
import { usePdfDocument } from './workspace/usePdfDocument';
import { WorkspaceDialogs } from './workspace/WorkspaceDialogs';
import { WorkspacePopovers } from './workspace/WorkspacePopovers';
import { WorkspaceBody } from './workspace/WorkspaceBody';
import { WorkspaceToolbar } from './workspace/WorkspaceToolbar';

// pdf.js parses off the main thread. Resolving the worker through `import.meta.url` lets the
// bundler fingerprint and ship it, which is what makes this work offline in the packaged app —
// a CDN worker URL would leave the viewer dead with no network.
GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();


interface PdfWorkspaceProps {
  docId: string;
  /**
   * What the reader asked to be shown, when they opened this document by tapping a book on the
   * library dashboard rather than opening it outright. Turns into the navigator at the foot of
   * the page. See `AnnotationFocus`.
   */
  focus?: AnnotationFocus;
  /**
   * True when the reader asked to carry on with this book (Continue annotating), false when they
   * opened it fresh from the library. Only the PAGE is affected: zoom and single/spread view are
   * preferences about how a book is displayed and are restored either way, while the page is a
   * position in it, and someone opening a book has not asked to be put back where they stopped.
   */
  resumeReading?: boolean;
  documentTitle: string;
  settings: UserSettings;
  isDark?: boolean;
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  /** Focus mode: header and toolbar step away (App owns it; F and Escape). */
  focusMode?: boolean;
  onToggleFocus?: () => void;
  /** Themes, for the selection menu's "+ New theme". */
  themeStore?: ThemeStore;
  /** Adds the themes a marks import brought with it. */
  onAddThemes?: (themes: UserSettings['activeThemes']) => void;
  /** Opened from a motif trace: the page to show first (1-based). */
  jumpToPage?: number;
}

export const PdfWorkspace: React.FC<PdfWorkspaceProps> = ({
  docId,
  documentTitle,
  focus,
  resumeReading = false,
  settings,
  isDark = false,
  onNavigate,
  focusMode = false,
  onToggleFocus,
  themeStore,
  onAddThemes,
  jumpToPage
}) => {
  // State grouped by concern (marks, selection, view, status); each hook takes and returns groups.
  const { marks, selection, view, status } = useWorkspaceState(docId, focus);
  const styles = usePdfToolStyles({ settings });
  const { tool, maskMode, toolWeights, toolStrokeStyles } = styles;
  // The page acts as the mask's mode (words, box, freehand); the toolbar keeps showing Black it out.
  const pageTool = pageToolFor(tool, maskMode);
  const pageToolWeights = useMemo(() => ({ ...toolWeights, maskPen: toolWeights.mask }), [toolWeights]);
  const pageToolStrokeStyles = useMemo(() => ({ ...toolStrokeStyles, maskPen: toolStrokeStyles.mask }), [toolStrokeStyles]);

  const { saver, zoomTouchedRef } = usePdfDocument({ docId, settings, marks, view, status });
  const mutations = useMarkMutations({ settings, marks, selection });
  const marking = useTextMarking({ settings, styles, marks, selection, scrollRef: view.scrollRef, startEditingId: mutations.startEditingId });
  const themePicker = useWorkspaceKeys({ settings, themeStore, styles, marks, selection, mutations, marking });
  const nav = usePdfNavigation({ tool, docId, jumpToPage, resumeReading, zoomTouchedRef, view });
  const extras = useWorkspaceExtras({ docId, documentTitle, isDark, onAddThemes, saver, settings, marks, selection, view, status, nav });
  const pageEdits = usePageEdits({ docId, goToPage: nav.goToPage, saver, marks, view, status });
  const geometry = useMarkGeometry({ focusMode, marks, selection, view });
  const { saveState, failure, setFailure } = status;
  const { archive, askRedact, setAskRedact, exportPdf, blackoutPages } = extras;

  return (
    <div
      className={`flex flex-col h-screen max-h-screen min-h-0 overflow-hidden ${
        isDark ? 'bg-night' : 'bg-paper'
      }`}
    >
      <header
        hidden={focusMode}
        // `app-drag`: the desktop build has no system title bar, so this header is what the
        // window is moved by. Its own buttons opt out — see `.app-drag` in index.css.
        className={`app-drag flex items-center gap-3 px-4 py-2.5 border-b shrink-0 ${
          isDark ? 'bg-night-2 border-stone-800' : 'bg-white border-stone-200'
        }`}
      >
        <button
          type="button"
          onClick={() => onNavigate('home', 'push_back')}
          title="Back to My Collections"
          aria-label="Back to My Collections"
          className="p-1.5 rounded-lg text-muted hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="title-hand text-[22px] text-stone-900 dark:text-paper truncate flex-1 min-w-0">
          {documentTitle}
        </h1>
        <span className="text-[11px] text-muted flex items-center gap-1 shrink-0 w-20 justify-end">
          {saveState === 'saving' && (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving…
            </>
          )}
          {saveState === 'saved' && (
            <>
              <Check className="w-3 h-3 text-gold" />
              Saved
            </>
          )}
        </span>
      </header>

      <WorkspaceToolbar settings={settings} isDark={isDark} focusMode={focusMode} onToggleFocus={onToggleFocus} zoomTouchedRef={zoomTouchedRef} styles={styles} marking={marking} marks={marks} selection={selection} view={view} status={status} nav={nav} extras={extras} pageEdits={pageEdits} />

      <WorkspaceBody settings={settings} isDark={isDark} styles={styles} pageTools={{ tool: pageTool, toolStrokeStyles: pageToolStrokeStyles, toolWeights: pageToolWeights }} marks={marks} mutations={mutations} geometry={geometry} selection={selection} view={view} status={status} nav={nav} extras={extras} pageEdits={pageEdits} />

      <ErrorDialog open={Boolean(failure)} message={failure ?? ''} onClose={() => setFailure(null)} />
      {archive.ui}

      <WorkspacePopovers documentTitle={documentTitle} isDark={isDark} settings={settings} themeStore={themeStore} styles={styles} marking={marking} themePicker={themePicker} marks={marks} mutations={mutations} geometry={geometry} selection={selection} view={view} status={status} extras={extras} />

      <WorkspaceDialogs isDark={isDark} mutations={mutations} geometry={geometry} selection={selection} view={view} pageEdits={pageEdits} />
      <BlackoutExportDialog open={askRedact} pages={blackoutPages} isDark={isDark} onRedact={() => void exportPdf(true)} onKeep={() => void exportPdf(false)} onCancel={() => setAskRedact(false)} />
    </div>
  );
};
