/**
 * The thematic analysis panel: in the reader, in the PDF workspace, and on its own from the
 * sidebar.
 *
 * Analysis is on demand and never automatic: it is the one action in Marginalia that sends
 * anything off this machine, so it happens when the reader presses the button and not before.
 * The panel says so plainly rather than burying it, and says how long the wait is, because a
 * silent minute reads as a hang.
 *
 * Two ways to read a book, one result layout:
 *
 *   - The book itself. Its actual text, or the page images of a scan. Slow and expensive — a
 *     39-page PDF is around 77,000 input tokens — but it is the only reading that is actually
 *     about the copy in your hands.
 *   - The web, by title. What critics and study guides say about a named edition, for a book you
 *     have not got. Around 80 tokens of prompt plus whatever the search pulls in, so roughly a
 *     thousandth of the cost, and second-hand by nature.
 *
 * Opened from a document, the first is preselected. Opened on its own it asks which, because
 * neither is the obvious default when no book is in front of you.
 */

import React from 'react';
import {
  Sparkles,
  Loader2,
  RotateCcw,
  Globe,
  BookOpen,
  Search,
  Upload,
  FileText,
  ChevronRight
} from 'lucide-react';
import { useThematicAnalysis } from '../hooks/useThematicAnalysis';
import { ErrorDialog } from './ErrorDialog';
import {
  fetchBookMetadata,
  listStoredDocuments,
  StoredDocumentMeta
} from '../utils/documentStorage';
import { guessBookFields } from '../utils/bookTitle';
import { ThemeItem } from '../types';

/** Prominence is a closed set, so each value gets its own chip rather than one neutral tag. */
const PROMINENCE_STYLES: Record<ThemeItem['prominence'], string> = {
  Primary: 'bg-[#435c52]/12 text-[#435c52] dark:bg-emerald-400/15 dark:text-emerald-300',
  Secondary: 'bg-amber-500/12 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  'Recurring Motif': 'bg-stone-500/12 text-stone-600 dark:bg-stone-400/15 dark:text-stone-300'
};

const MODE_TAB =
  'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[11.5px] font-semibold border-b-2 transition-colors cursor-pointer';

const FIELD =
  'w-full px-3 py-2 rounded-xl text-[12.5px] bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-[#435c52] dark:focus:border-emerald-500';

const FIELD_LABEL = 'text-[10.5px] font-semibold tracking-wider uppercase text-stone-500';

const PRIMARY_BUTTON =
  'w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#435c52] text-white text-[13px] font-semibold hover:bg-[#3a5048] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors';

interface ThematicAnalysisViewProps {
  /**
   * The document to read, when the panel was opened from one. Its PDF is analysed if it has one,
   * its text if not. Absent when the panel was opened on its own, in which case the reader picks
   * a book from the library instead.
   */
  docId?: string;
  documentTitle?: string;
  /** Takes the reader to the upload screen, when there is somewhere to send them. */
  onAddDocument?: () => void;
  /** Container classes, so the same panel works in the workspace's fixed side strip, the reader's
   *  centred column and a modal without any of them having to wrap it in another scroller. */
  className?: string;
}

export const ThematicAnalysisView: React.FC<ThematicAnalysisViewProps> = ({
  docId,
  documentTitle,
  onAddDocument,
  className = 'flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4'
}) => {
  const {
    analyzeDocument,
    analyzeBookFromWeb,
    loadSavedAnalysis,
    clearAnalysis,
    retry,
    dismissError,
    loading,
    analysis,
    analysedAt,
    source,
    error
  } = useThematicAnalysis();
  // Null until the reader chooses, which only happens when no document was passed in.
  const [mode, setMode] = React.useState<'document' | 'web' | null>(docId ? 'document' : null);
  const [library, setLibrary] = React.useState<StoredDocumentMeta[] | null>(null);
  const [pickedId, setPickedId] = React.useState(docId ?? '');
  const [pickedTitle, setPickedTitle] = React.useState(documentTitle ?? '');

  /**
   * The lookup form starts filled in from whichever book is in hand, unpicked out of the name it
   * was stored under — see `guessBookFields`. Someone reading a scan whose text Gemini cannot make
   * sense of should be one click from the web lookup, not retyping a title they are looking at.
   *
   * `edited` stops the prefill from overwriting anything typed: after the first keystroke the
   * fields belong to the reader, even if they then pick a different book from the list.
   */
  const [fields, setFields] = React.useState(() => guessBookFields(documentTitle ?? ''));
  /** A ref, not state: nothing renders differently once the reader types, and the metadata fetch
   *  below has to read the CURRENT value when it lands rather than the one it closed over. */
  const editedRef = React.useRef(false);
  const { title, author, edition } = fields;
  const setField = (key: 'title' | 'author' | 'edition') => (value: string) => {
    editedRef.current = true;
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * A book that has been analysed before opens on that result rather than on a button. Running it
   * again is one press away, but it should be a decision rather than the only option — the whole
   * point of saving it was not paying twice for the same answer.
   */
  React.useEffect(() => {
    if (!pickedId) return;
    clearAnalysis();
    void loadSavedAnalysis(pickedId);
  }, [pickedId, clearAnalysis, loadSavedAnalysis]);

  React.useEffect(() => {
    if (editedRef.current) return;
    const guessed = guessBookFields(pickedTitle);
    setFields(guessed);
    if (!pickedId) return;
    // The PDF's own metadata beats anything unpicked from a filename, so it replaces the guess
    // wherever it has something to say — unless the reader started typing while it was in flight.
    void fetchBookMetadata(pickedId).then(({ title: embeddedTitle, author: embeddedAuthor }) => {
      if (editedRef.current || (!embeddedTitle && !embeddedAuthor)) return;
      setFields({
        title: embeddedTitle || guessed.title,
        author: embeddedAuthor || guessed.author,
        edition: guessed.edition
      });
    });
  }, [pickedTitle, pickedId]);

  // Only when the reader actually asks for the library, and only once.
  React.useEffect(() => {
    if (mode !== 'document' || docId || library) return;
    void listStoredDocuments().then(setLibrary);
  }, [mode, docId, library]);

  const handleWebSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) void analyzeBookFromWeb(title.trim(), author.trim(), edition.trim());
  };

  return (
    <div className={className}>
      <header className="space-y-1">
        <h2 className="font-serif text-[17px] font-bold text-stone-900 dark:text-white leading-tight">
          Thematic analysis
        </h2>
        <p className="text-[11.5px] text-stone-500 dark:text-stone-400 leading-relaxed">
          The only feature that sends anything off your machine, and only when you press the
          button. Any copy uploaded for the reading is deleted as soon as it returns.
        </p>
      </header>

      {/* Asked once, when the panel was opened without a book in front of the reader. */}
      {mode === null ? (
        <div className="space-y-2.5">
          <p className="text-[12px] text-stone-600 dark:text-stone-400 leading-relaxed">
            Which book, and how should it be read?
          </p>
          <button
            type="button"
            onClick={() => setMode('document')}
            className="w-full flex items-start gap-3 p-3 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-[#435c52] dark:hover:border-emerald-500 text-left transition-colors cursor-pointer group"
          >
            <Upload className="w-4 h-4 mt-0.5 shrink-0 text-[#435c52] dark:text-emerald-400" />
            <span className="flex-1 min-w-0 space-y-0.5">
              <span className="block font-serif text-[13.5px] font-semibold text-stone-900 dark:text-white">
                A book you have
              </span>
              <span className="block text-[11.5px] text-stone-500 dark:text-stone-400 leading-relaxed">
                Reads the actual file — a scan's page images as well as ordinary text. Slower, and
                the only reading that is about your copy.
              </span>
            </span>
            <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-stone-300 group-hover:text-[#435c52] dark:group-hover:text-emerald-400" />
          </button>
          <button
            type="button"
            onClick={() => setMode('web')}
            className="w-full flex items-start gap-3 p-3 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-[#435c52] dark:hover:border-emerald-500 text-left transition-colors cursor-pointer group"
          >
            <Globe className="w-4 h-4 mt-0.5 shrink-0 text-[#435c52] dark:text-emerald-400" />
            <span className="flex-1 min-w-0 space-y-0.5">
              <span className="block font-serif text-[13.5px] font-semibold text-stone-900 dark:text-white">
                A book by title and edition
              </span>
              <span className="block text-[11.5px] text-stone-500 dark:text-stone-400 leading-relaxed">
                Searches the web for what critics and study guides say. Near-instant and far
                cheaper, but second-hand rather than read from the text.
              </span>
            </span>
            <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-stone-300 group-hover:text-[#435c52] dark:group-hover:text-emerald-400" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex border-b border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setMode('document')}
              className={`${MODE_TAB} ${
                mode === 'document'
                  ? 'border-[#435c52] text-[#435c52] dark:border-emerald-400 dark:text-emerald-300'
                  : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              {docId ? 'This document' : 'A book you have'}
            </button>
            <button
              type="button"
              onClick={() => setMode('web')}
              className={`${MODE_TAB} ${
                mode === 'web'
                  ? 'border-[#435c52] text-[#435c52] dark:border-emerald-400 dark:text-emerald-300'
                  : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              By title
            </button>
          </div>

          {mode === 'document' ? (
            <div className="space-y-2.5">
              {docId ? (
                <p className="text-[11.5px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  Reads {documentTitle} itself — a scanned book's page images just as well as
                  ordinary text.
                </p>
              ) : (
                <>
                  <span className={FIELD_LABEL}>Choose a book</span>
                  {library === null ? (
                    <p className="text-[11.5px] text-stone-500 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Reading your library…
                    </p>
                  ) : library.length === 0 ? (
                    <p className="text-[11.5px] text-stone-500 dark:text-stone-400 leading-relaxed">
                      Your library is empty. Add a document first, or look one up by title instead.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {library.map((meta) => (
                        <button
                          key={meta.id}
                          type="button"
                          onClick={() => {
                            setPickedId(meta.id);
                            setPickedTitle(meta.title);
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                            pickedId === meta.id
                              ? 'border-[#435c52] bg-[#435c52]/6 dark:border-emerald-500 dark:bg-emerald-500/10'
                              : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-[12px] font-medium text-stone-900 dark:text-stone-100 truncate">
                              {meta.title}
                            </span>
                            <span className="block text-[10.5px] text-stone-500 tabular-nums">
                              {meta.format.toUpperCase()} · {meta.wordCount.toLocaleString()} words
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {onAddDocument && (
                    <button
                      type="button"
                      onClick={onAddDocument}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-[11.5px] font-medium text-stone-600 dark:text-stone-400 hover:border-[#435c52] dark:hover:border-emerald-500 cursor-pointer transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Add a book to the library
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => pickedId && void analyzeDocument(pickedId)}
                disabled={loading || !pickedId}
                className={PRIMARY_BUTTON}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : analysis && source === 'document' ? (
                  <RotateCcw className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {loading
                  ? 'Reading…'
                  : analysis && source === 'document'
                    ? 'Analyse again'
                    : docId
                      ? 'Analyse this document'
                      : pickedTitle
                        ? `Analyse ${pickedTitle.slice(0, 28)}${pickedTitle.length > 28 ? '…' : ''}`
                        : 'Analyse the chosen book'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleWebSubmit} className="space-y-2.5">
              <p className="text-[11.5px] text-stone-500 dark:text-stone-400 leading-relaxed">
                Searches the web for a book and reports what critics and study guides say about it.
              </p>
              <label className="block space-y-1">
                <span className={FIELD_LABEL}>Book title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setField('title')(e.target.value)}
                  placeholder="The Great Gatsby"
                  required
                  className={FIELD}
                />
              </label>
              <label className="block space-y-1">
                <span className={FIELD_LABEL}>
                  Author <span className="font-normal normal-case tracking-normal">(optional)</span>
                </span>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setField('author')(e.target.value)}
                  placeholder="F. Scott Fitzgerald"
                  className={FIELD}
                />
              </label>
              <label className="block space-y-1">
                <span className={FIELD_LABEL}>
                  Edition{' '}
                  <span className="font-normal normal-case tracking-normal">(optional)</span>
                </span>
                <input
                  type="text"
                  value={edition}
                  onChange={(e) => setField('edition')(e.target.value)}
                  placeholder="Stephen Mitchell translation, 2004"
                  className={FIELD}
                />
                <span className="block text-[10.5px] text-stone-400 leading-relaxed">
                  Worth naming for a translation or an abridgement — they do not all carry the same
                  themes.
                </span>
              </label>
              <button type="submit" disabled={loading || !title.trim()} className={PRIMARY_BUTTON}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {loading ? 'Searching…' : 'Search and analyse'}
              </button>
            </form>
          )}
        </>
      )}

      {loading && (
        <p className="text-[11.5px] text-stone-500 dark:text-stone-400 text-center leading-relaxed">
          {mode === 'web'
            ? 'Searching and reading what it finds.'
            : 'Reading the pages and drawing out the themes. A long or scanned book can take a couple of minutes.'}
        </p>
      )}

      {/* A failed run blocks: it is the whole reason the reader pressed the button, and a banner
          under a scrolled panel is a failure nobody reads. Retry only when it could work. */}
      <ErrorDialog
        open={Boolean(error)}
        title={mode === 'web' ? 'Lookup failed' : 'Analysis failed'}
        message={error?.message ?? ''}
        onClose={dismissError}
        onRetry={
          error?.retryable
            ? () => {
                dismissError();
                retry();
              }
            : undefined
        }
      />

      {analysis && !loading && (
        <div className="space-y-5">
          <section className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-stone-500">
              {source === 'web' ? (
                <>
                  <Globe className="w-3 h-3" />
                  From web sources, not the book itself
                </>
              ) : (
                <>
                  <BookOpen className="w-3 h-3" />
                  Read from the document itself
                </>
              )}
            </div>
            <h3 className="font-serif text-[15px] font-semibold text-stone-900 dark:text-white leading-snug">
              {analysis.bookTitle}
            </h3>
            {analysedAt && (
              <p className="text-[10.5px] text-stone-400 tabular-nums">
                Analysed{' '}
                {new Date(analysedAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
            )}
            <p className="text-[12.5px] text-stone-700 dark:text-stone-300 leading-relaxed">
              {analysis.executiveSummary}
            </p>
          </section>

          <section className="space-y-2.5">
            <h4 className="text-[10.5px] font-semibold tracking-wider uppercase text-stone-500">
              Themes
            </h4>
            {analysis.themes.map((theme) => (
              <article
                key={theme.themeName}
                className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/40 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h5 className="font-serif text-[13.5px] font-semibold text-stone-900 dark:text-white leading-snug">
                    {theme.themeName}
                  </h5>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9.5px] font-bold tracking-wider uppercase ${
                      PROMINENCE_STYLES[theme.prominence] ?? PROMINENCE_STYLES['Recurring Motif']
                    }`}
                  >
                    {theme.prominence}
                  </span>
                </div>
                <p className="text-[12px] text-stone-600 dark:text-stone-400 leading-relaxed">
                  {theme.description}
                </p>
                {theme.evidence.length > 0 && (
                  <ul className="space-y-1 pl-3">
                    {theme.evidence.map((item, i) => (
                      <li
                        key={i}
                        className="text-[11.5px] text-stone-500 dark:text-stone-400 leading-relaxed list-disc marker:text-[#435c52] dark:marker:text-emerald-400"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </section>

          {analysis.narrativeArc && (
            <section className="space-y-1.5">
              <h4 className="text-[10.5px] font-semibold tracking-wider uppercase text-stone-500">
                Narrative arc
              </h4>
              <p className="text-[12.5px] text-stone-700 dark:text-stone-300 leading-relaxed">
                {analysis.narrativeArc}
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
