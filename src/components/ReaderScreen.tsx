import React from 'react';
import { paragraphTypeface } from '../utils/scriptDirection';
import type { ThemeStore } from './themeStore';
import {
  AnnotationFocus,
  ReaderJump,
  Screen,
  TransitionType,
  UserSettings
} from '../types';
import type { PlainTextAnnotations } from '../hooks/usePlainTextAnnotations';

import {
  EMPTY_MARKS,
  EMPTY_STYLES,
  EMPTY_NOTES,
  Paragraph
} from './reader/readerParts';
import { useReaderExtras } from './reader/useReaderExtras';
import { useReaderLayout } from './reader/useReaderLayout';
import { useReaderMarkUi } from './reader/useReaderMarkUi';
import { useReaderSelectionKeys } from './reader/useReaderSelectionKeys';
import { useReaderMarking } from './reader/useReaderMarking';
import { useReaderMarkViews } from './reader/useReaderMarkViews';
import { ReaderNoteEditor } from './reader/ReaderNoteEditor';
import { ReaderPopovers } from './reader/ReaderPopovers';
import { ReaderBody } from './reader/ReaderBody';
import { ReaderControlBar } from './reader/ReaderControlBar';
import { ReaderHeader } from './reader/ReaderHeader';
import { useReaderState } from './reader/readerState';

interface ReaderScreenProps {
  settings: UserSettings;
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  isDark?: boolean;
  documentText?: string;
  documentTitle?: string;
  /** Id in the local document store. Absent only for text from an old session that was never saved. */
  docId?: string;
  /** The document's marks, lifted to App so they survive navigating away and back. */
  annotations: PlainTextAnnotations;
  /** Focus mode: chrome hidden, the page alone (App owns it; F and Escape). */
  focusMode?: boolean;
  onToggleFocus?: () => void;
  /** Themes, for the selection menu's "+ New theme". */
  themeStore?: ThemeStore;
  /** Saves the two-page spread choice with the settings (on disk). */
  onSpreadChange?: (on: boolean) => void;
  /** Adds the themes a marks import brought with it. */
  onAddThemes?: (themes: UserSettings['activeThemes']) => void;
  /** Opened from the library to step through one theme's (or terminology's) marks. */
  focus?: AnnotationFocus;
  /** Opened from a motif trace: the passage to show and the words to paint. */
  jump?: ReaderJump;
  /** Saves reader preferences kept per document (the poetry view). */
  onUpdateSettings?: (update: (prev: UserSettings) => UserSettings) => void;
}


export const ReaderScreen: React.FC<ReaderScreenProps> = ({
  settings,
  onNavigate,
  isDark = false,
  documentText,
  documentTitle,
  docId,
  annotations,
  focus,
  focusMode = false,
  onToggleFocus,
  themeStore,
  onSpreadChange,
  onAddThemes,
  jump,
  onUpdateSettings
}) => {
  // State grouped by concern (doc, poetry, themes, panels, selection, editor, refs); each hook
  // takes and returns groups.
  const state = useReaderState({ settings, docId, documentText, documentTitle, focus, themeStore, onUpdateSettings });
  const { reduceMotion, doc, poetry: poetryView, themes, panels, selection, editor, refs } = state;
  const markViews = useReaderMarkViews({ settings, annotations, doc, selection, editor });
  const marking = useReaderMarking({ settings, textRef: refs.textRef, annotations, doc, themes, selection, editor, views: markViews });
  useReaderSelectionKeys({ settings, textRef: refs.textRef, annotations, marking, views: markViews, themes, selection });
  const markUi = useReaderMarkUi({ reduceMotion, annotations, marking, panels, selection, refs });
  const layout = useReaderLayout({ settings, onSpreadChange, annotations, doc, poetry: poetryView, views: markViews, panels, refs });
  const extras = useReaderExtras({ settings, isDark, reduceMotion, jump, onAddThemes, annotations, doc, views: markViews, panels, refs, markUi, layout });

  const { paragraphs, content, loadFailed, setLoadAttempt, displayTitle, verbatim, stylesByPara } = doc;
  const { poetry } = poetryView;
  const { activeParagraphIndex, openPin, bottomInset } = panels;
  const { selectionAnchor } = selection;
  const { controlBarRef, headerRef } = refs;
  const { paraData, selByPara, hovByPara } = markViews;
  const { paragraphFont, marginMode } = layout;
  const { clock } = marking;
  const { paragraphActions } = markUi;

  // Popovers stay below the sticky header and control bar.
  // In focus mode the bar slides over the page when called, so menus keep clear of where it lands.
  const popoverTopInset = focusMode
    ? (controlBarRef.current?.offsetHeight ?? 0)
    : (controlBarRef.current?.getBoundingClientRect().bottom ?? headerRef.current?.getBoundingClientRect().bottom ?? 0);
  // A passage scrolled wholly out from under the control bar takes its menu with it (it comes
  // back on scrolling back); a menu pinned to the edge would act on words the reader can't see.
  const selectionInView =
    !!selectionAnchor && selectionAnchor.bottom > popoverTopInset && selectionAnchor.top < window.innerHeight - bottomInset;
  const titleBlock = (
    <div
      id="reader-title-block"
      className={`text-center flex flex-col items-center justify-center space-y-2 ${
        paragraphs.length === 0 ? 'min-h-[60vh]' : 'border-b pb-6 border-stone-200 dark:border-stone-800'
      }`}
    >
      <div className="flex items-center justify-center gap-2 flex-wrap text-[11px]">
        <span className="caps text-gold">DOCUMENT</span>
        <span className="text-stone-300 dark:text-stone-700">•</span>
        <span className="text-muted italic">Select text to mark it, or write a note</span>
      </div>
      <h2 className="title-hand text-balance text-[36px] sm:text-[44px] text-stone-900 dark:text-paper">
        {displayTitle}
      </h2>
      {loadFailed && !content && (
        <div role="alert" className="pt-4 flex flex-col items-center gap-3">
          <p className="text-[14px] text-muted">This document could not be loaded, so it can’t be marked yet.</p>
          <button
            type="button"
            onClick={() => setLoadAttempt((n) => n + 1)}
            className="rounded-full caps px-5 py-2.5 text-[12px] bg-accent hover:bg-accent-hover text-on-accent transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
  const paragraphNodes = paragraphs.map((text, idx) => {
    const notes = paraData.notes.get(idx) ?? EMPTY_NOTES;
    const face = paragraphTypeface(text, paragraphFont, settings.arabicScript);
    return (
      <Paragraph
        key={idx}
        idx={idx}
        text={text}
        marks={paraData.marks.get(idx) ?? EMPTY_MARKS}
        glyphHeads={paraData.glyphs.get(idx) ?? ''}
        themes={settings.activeThemes}
        notes={notes}
        selKey={selByPara.get(idx) ?? ''}
        hovKey={hovByPara.get(idx) ?? ''}
        isActive={activeParagraphIndex === idx}
        isDark={isDark}
        margin={marginMode}
        verbatim={verbatim || poetry.on}
        styles={stylesByPara.get(idx) ?? EMPTY_STYLES}
        openPin={openPin && notes.some((n) => n.mark.id === openPin) ? openPin : ''}
        terminologyColor={settings.terminologyColor}
        fontFamily={face.fontFamily}
        dir={face.dir}
        lineHeight={face.lineHeight}
        fontSize={settings.fontSize}
        clock={notes.length ? clock : 0}
        actions={paragraphActions}
      />
    );
  });

  return (
    <div className={`min-h-screen flex flex-col transition-colors ${isDark ? 'bg-night text-stone-100' : 'bg-paper text-ink'}`}>
      <ReaderHeader activeThemeId={themes.activeThemeId} displayTitle={displayTitle} focusMode={focusMode} headerRef={headerRef} isDark={isDark} onNavigate={onNavigate} setActiveThemeId={themes.setActiveThemeId} settings={settings} themeStripRef={themes.themeStripRef} />

      <ReaderControlBar settings={settings} isDark={isDark} focusMode={focusMode} onToggleFocus={onToggleFocus} annotations={annotations} doc={doc} themes={themes} panels={panels} poetryView={poetryView} selection={selection} refs={refs} markViews={markViews} marking={marking} layout={layout} extras={extras} />

      <ReaderBody settings={settings} isDark={isDark} reduceMotion={reduceMotion} annotations={annotations} page={{ titleBlock, paragraphNodes }} doc={doc} poetryView={poetryView} panels={panels} selection={selection} refs={refs} markViews={markViews} marking={marking} markUi={markUi} layout={layout} extras={extras} />

      <ReaderPopovers settings={settings} isDark={isDark} annotations={annotations} popoverTopInset={popoverTopInset} selectionInView={selectionInView} themes={themes} panels={panels} selection={selection} markViews={markViews} marking={marking} markUi={markUi} layout={layout} extras={extras} />

      <ReaderNoteEditor isDark={isDark} editor={editor} markViews={markViews} marking={marking} />
    </div>
  );
};
