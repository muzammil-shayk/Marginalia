/**
 * The library: everything stored on this computer, and the way back into it.
 *
 * Laid out as a grid that fills the window rather than a column down the middle. The previous
 * version put a narrow list in the centre of a wide screen, so a library of a dozen books left
 * two thirds of the page empty and showed four of them — the shape of the page said "there is
 * not much here" about a shelf that was actually full.
 *
 * Documents are read from disk rather than from this session's state. That distinction matters:
 * the list used to come from `sessionStorage`, which Electron clears on quit, so every document
 * vanished from the interface on restart even though the files were still there.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Upload,
  ArrowRight,
  FileText,
  Search,
  BookOpen,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  Type,
  Highlighter,
  Palette,
  Sparkles,
  Lightbulb,
  Tag,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { isAnnotatableFormat } from '../utils/annotatableFormats';
import { motion, AnimatePresence } from 'motion/react';
import { AnnotationFocus, Screen, TransitionType, UserSettings } from '../types';
import { initialSettings } from '../data/mockData';
import { documentThumbnail } from '../utils/documentThumbnail';
import {
  StoredDocumentMeta,
  deleteStoredDocument,
  listStoredDocuments,
  renameStoredDocument
} from '../utils/documentStorage';
import { ErrorDialog } from './ErrorDialog';

interface HomeScreenProps {
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  isDark?: boolean;
  settings: UserSettings;
  onUpdateSettings?: (updater: (prev: UserSettings) => UserSettings) => void;
  activeDocument?: { title: string; text: string } | null;
  /**
   * `text` is optional and `docId` new: document bodies live on disk now and are fetched by id
   * when one is opened, so the library holds only metadata until then.
   */
  uploadedLibrary?: Array<{
    id: string;
    title: string;
    text?: string;
    date: string;
    wordCount: number;
    format?: string;
    docId?: string;
  }>;
  onSelectDocumentForAnalysis?: (title: string, text: string, format?: string, docId?: string) => void;
  /** Reopens a stored document, fetching its text from disk first. */
  onOpenLibraryDocument?: (doc: {
    id: string;
    title: string;
    text?: string;
    date: string;
    wordCount: number;
    format?: string;
    docId?: string;
  }) => void;
  /** Opens a document straight from disk — a PDF lands in the viewer. */
  /**
   * Opens a stored document. The optional focus travels with it: tapping a book under Key
   * Concepts asks to see the key concepts IN that book, not merely to open it, and the workspace
   * turns that request into a navigator over the matching marks.
   */
  onOpenStoredDocument?: (meta: StoredDocumentMeta, focus?: AnnotationFocus) => void;
  /** Reopens the document already in hand, in the PDF editor. */
  onContinueAnnotating?: () => void;
  /** False when the open document has no PDF behind it and so cannot be annotated. */
  canAnnotateActive?: boolean;
  onDocumentDeleted?: (id: string) => void;
  onDocumentRenamed?: (id: string, title: string) => void;
  /** Bumped after an upload so a newly stored document appears without a manual reload. */
  refreshToken?: number;
}

/**
 * The colour of a document's spine: the app's own green.
 *
 * An earlier version picked a different hue per title so the shelf was easier to scan, but a
 * row of blues, purples and reds belonged to no part of the rest of the interface — the covers
 * were the loudest thing on a page whose whole palette is one muted green. The titles below
 * already tell the books apart; the covers only need to look like they come from here.
 */
const SPINE_COLOR = '#435c52';

/** The initials shown on a document's tile, standing in for a cover image we do not have. */
function monogram(title: string): string {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase();
}

const formatBytes = (bytes: number) =>
  !bytes ? '—' : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * The cover: the document's actual first page, rendered from the stored original.
 *
 * The monogram tile it replaces was a placeholder for artwork we did not have — but for the
 * formats the workspace can open we do have artwork, in the form of page one. It is kept as a
 * fallback for the formats with no page to render (DOCX, EPUB, pasted text) and for the moment
 * before the render lands, so a card never has a hole where its cover goes.
 */
const DocumentCover: React.FC<{ doc: StoredDocumentMeta }> = ({ doc }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    void documentThumbnail(doc).then((dataUrl) => {
      if (!cancelled) setSrc(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [doc.id, doc.updatedAt, doc.format, doc.originalBytes]);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        // Anchored to the top of the page rather than centred: a title page's title sits in its
        // upper half, and centring a tall page would crop it out of the card entirely.
        className="absolute inset-0 h-full w-full object-cover object-top bg-white"
      />
    );
  }

  return (
    <span
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${SPINE_COLOR} 0%, ${SPINE_COLOR}cc 100%)` }}
    >
      <span className="font-serif text-[34px] font-bold text-white/95 tracking-tight select-none">
        {monogram(doc.title)}
      </span>
    </span>
  );
};

/**
 * One of the Home screen's dashboard cards — Key Concepts, Terminologies, Themes — sharing one
 * header treatment (an icon badge tinted with the card's own accent colour, a summary that stays
 * visible even collapsed, and a chevron) so folding one shut is a single, predictable gesture
 * wherever it appears, rather than each card inventing its own affordance for it.
 */
const CollapsibleSection: React.FC<{
  icon: React.ElementType;
  accentColor: string;
  title: string;
  summary: string;
  isDark: boolean;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ icon: Icon, accentColor, title, summary, isDark, collapsed, onToggle, children }) => (
  <section
    className={`mb-4 rounded-2xl border overflow-hidden ${
      isDark ? 'bg-[#1b201d] border-stone-800' : 'bg-white border-stone-200/70'
    }`}
  >
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className={`w-full flex items-center gap-3 p-4 text-left cursor-pointer transition-colors ${
        isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-black/[0.015]'
      }`}
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${accentColor}1f` }}
      >
        <Icon className="w-4 h-4" style={{ color: accentColor }} />
      </span>
      <span className="flex-1 min-w-0">
        <h3 className="font-serif text-[15px] font-semibold text-stone-900 dark:text-white leading-tight">
          {title}
        </h3>
        <span className="text-[12px] text-stone-500 dark:text-stone-400">{summary}</span>
      </span>
      <ChevronDown
        className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${collapsed ? '' : 'rotate-180'}`}
      />
    </button>
    <AnimatePresence initial={false}>
      {!collapsed && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          style={{ overflow: 'hidden' }}
        >
          <div className={`px-4 pb-4 pt-1 border-t ${isDark ? 'border-stone-800/80' : 'border-stone-100'}`}>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </section>
);

/**
 * Motion vocabulary for the dashboard.
 *
 * One strong ease-out curve, used everywhere something enters or responds to a press. The stock
 * CSS easings are too weak to read as intentional, and mixing three curves across one screen is
 * what makes an interface feel assembled rather than designed.
 */
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

/**
 * One book in a dashboard section, with what that section knows about it alongside.
 *
 * A row is not one button. The title opens the book and each piece of data beside it can be its
 * own action — jump to those marks, step through that theme — so wrapping the lot in a single
 * `<button>` would nest interactive elements inside each other, which is invalid and leaves a
 * keyboard user with one stop where there are three actions. The row is a plain list item; the
 * things you can press are buttons.
 *
 * The chevron only appears on hover. An affordance on every row at rest is noise; absent when
 * nothing is pointing at it, present the moment something is, is the same information for free.
 */
const InsightRow: React.FC<{
  title: string;
  onOpen?: () => void;
  index?: number;
  children: React.ReactNode;
}> = ({ title, onOpen, index = 0, children }) => (
  <li
    className="group/row flex items-center gap-3 -mx-2 pl-2 pr-1 rounded-lg transition-colors duration-150 hover:bg-stone-500/[0.055] motion-safe:animate-[insight-row-in_260ms_var(--ease-out)_both]"
    style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
  >
    <button
      type="button"
      onClick={onOpen}
      title={`Open ${title}`}
      className="flex-1 min-w-0 flex items-center gap-1.5 py-2.5 text-left cursor-pointer rounded-md transition-transform duration-150 ease-out active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#435c52] dark:focus-visible:ring-emerald-400"
    >
      <span className="font-serif text-[14px] text-stone-800 dark:text-stone-200 truncate group-hover/row:text-stone-950 dark:group-hover/row:text-white transition-colors duration-150">
        {title}
      </span>
      <ChevronRight
        aria-hidden
        className="w-3.5 h-3.5 shrink-0 text-stone-400 opacity-0 -translate-x-1 group-hover/row:opacity-100 group-hover/row:translate-x-0 transition-[opacity,transform] duration-150 ease-out"
      />
    </button>
    <span className="shrink-0 flex items-center justify-end gap-1">{children}</span>
  </li>
);

/** The rows of one section: a list, hairline-separated rather than boxed one by one. */
const InsightList: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ul className="divide-y divide-stone-200/60 dark:divide-stone-800/70">{children}</ul>
);

/**
 * A count and its unit, right-aligned and tabular so the numbers form a column the eye runs down
 * instead of a ragged edge. The fixed minimum width is what keeps that column straight when the
 * counts are 1 and 12.
 */
const RowCount: React.FC<{ value: number; unit: string }> = ({ value, unit }) => (
  <span className="text-[11.5px] text-stone-500 dark:text-stone-500 tabular-nums min-w-[4.75rem] text-right pr-1">
    {value} {unit}
    {value === 1 ? '' : 's'}
  </span>
);

/**
 * A theme on a row: its colour, its name, its tally — and, where the caller gives it somewhere to
 * go, a press that opens the book already stepping through those marks.
 *
 * Squared rather than pill-shaped. A rounded-full chip reads as decoration; these are data, and
 * half of them are controls.
 */
const RowTag: React.FC<{
  label: string;
  color?: string;
  count?: number;
  onPress?: () => void;
}> = ({ label, color, count, onPress }) => {
  const body = (
    <>
      {color && (
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-[1px] shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="truncate">{label}</span>
      {count !== undefined && <span className="text-stone-500 tabular-nums">{count}</span>}
    </>
  );
  const shell =
    'inline-flex items-center gap-1.5 max-w-[12rem] px-1.5 py-0.5 rounded-[3px] text-[11px] font-medium bg-stone-500/[0.09] text-stone-700 dark:text-stone-300';

  if (!onPress) return <span className={shell}>{body}</span>;
  return (
    <button
      type="button"
      onClick={onPress}
      title={`Show ${label} in this book`}
      className={`${shell} cursor-pointer transition-[background-color,transform] duration-150 ease-out hover:bg-stone-500/[0.16] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#435c52] dark:focus-visible:ring-emerald-400`}
    >
      {body}
    </button>
  );
};

/**
 * What a section shows before it has anything to show.
 *
 * One italic sentence is not an empty state: it reports the absence and abandons the reader
 * there. Each of these names the single action that fills the section and offers it.
 */
const SectionEmpty: React.FC<{
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ children, actionLabel, onAction }) => (
  <div className="pt-3 pb-1 space-y-2.5">
    <p className="text-[12.5px] text-stone-500 dark:text-stone-400 leading-relaxed max-w-[52ch] text-pretty">
      {children}
    </p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="text-[12px] font-semibold text-[#435c52] dark:text-emerald-300 hover:underline underline-offset-4 cursor-pointer transition-transform duration-150 ease-out active:scale-[0.97]"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  isDark = false,
  settings,
  onUpdateSettings,
  activeDocument = null,
  onOpenStoredDocument,
  onContinueAnnotating,
  canAnnotateActive = false,
  onDocumentDeleted,
  onDocumentRenamed,
  refreshToken = 0
}) => {
  const hasActiveDoc = Boolean(activeDocument?.text?.trim());

  const [stored, setStored] = useState<StoredDocumentMeta[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** A rename or delete the store refused. Both used to fail into nothing at all. */
  const [failure, setFailure] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const refreshLibrary = useCallback(async () => {
    setIsLoadingLibrary(true);
    setStored(await listStoredDocuments());
    setIsLoadingLibrary(false);
  }, []);

  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary, refreshToken]);

  const commitRename = async (id: string) => {
    const title = draftTitle.trim();
    if (!title) {
      setRenamingId(null);
      return;
    }
    setBusyId(id);
    const updated = await renameStoredDocument(id, title);
    if (updated) {
      setStored((prev) => prev.map((d) => (d.id === id ? updated : d)));
      onDocumentRenamed?.(id, updated.title);
    } else {
      // Without this the card silently snapped back to its old name, which reads like the app
      // ignored the edit rather than like the write failed.
      setFailure('Could not rename that document. Its name on disk is unchanged.');
    }
    setBusyId(null);
    setRenamingId(null);
  };

  const commitDelete = async (id: string) => {
    setBusyId(id);
    if (await deleteStoredDocument(id)) {
      setStored((prev) => prev.filter((d) => d.id !== id));
      onDocumentDeleted?.(id);
    } else {
      setFailure('Could not delete that document. It is still in your library.');
    }
    setBusyId(null);
    setConfirmingDeleteId(null);
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return stored;
    return stored.filter((d) => d.title.toLowerCase().includes(needle) || d.format.toLowerCase().includes(needle));
  }, [stored, query]);

  const totalWords = useMemo(() => stored.reduce((sum, d) => sum + d.wordCount, 0), [stored]);
  const totalMarks = useMemo(() => stored.reduce((sum, d) => sum + (d.annotationCount || 0), 0), [stored]);

  /** Which books, across the whole library, are tagged with each theme — read straight off the
   *  same `listStoredDocuments()` call the shelf grid already makes, rather than fetching twice. */
  const booksByTheme = useMemo(() => {
    const map = new Map<string, StoredDocumentMeta[]>();
    for (const theme of settings.activeThemes) {
      map.set(theme.id, stored.filter((d) => d.themeIds?.includes(theme.id)));
    }
    return map;
  }, [settings.activeThemes, stored]);

  /**
   * "Key Concepts" gets its own banner rather than sitting inside the general Themes dashboard —
   * matched by name rather than by the default id, so the split still finds it if the reader ever
   * renames or recreates it. Everything else stays in the Themes list below.
   */
  const keyConceptsTheme = useMemo(
    () => settings.activeThemes.find((t) => t.name.trim().toLowerCase() === 'key concepts'),
    [settings.activeThemes]
  );
  const otherThemes = useMemo(
    () => settings.activeThemes.filter((t) => t.id !== keyConceptsTheme?.id),
    [settings.activeThemes, keyConceptsTheme]
  );

  /**
   * Every book carrying at least one mark under a theme the reader defined, with the themes it
   * carries and how many marks each holds. Key Concepts is excluded — it has its own card.
   *
   * Book-first rather than theme-first: the same data read the way the reader asks for it, which
   * is "what have I been filing in this book", not "which books touch Questions".
   */
  const booksWithUserThemes = useMemo(
    () =>
      stored
        .map((doc) => ({
          doc,
          themes: otherThemes
            .map((theme) => ({ ...theme, count: doc.themeCounts?.[theme.id] ?? 0 }))
            .filter((theme) => theme.count > 0)
            .sort((a, b) => b.count - a.count)
        }))
        .filter((entry) => entry.themes.length > 0),
    [stored, otherThemes]
  );

  /** Which books, across the whole library, carry at least one terminology mark. */
  const documentsWithTerminology = useMemo(
    () => stored.filter((d) => (d.terminologyCount ?? 0) > 0),
    [stored]
  );

  /** Every terminology mark in the library, for the section header's tally. */
  const terminologyMarks = useMemo(
    () => documentsWithTerminology.reduce((total, d) => total + d.terminologyCount, 0),
    [documentsWithTerminology]
  );

  /** Which books have a saved thematic analysis, most recently analysed first. */
  const analysedDocuments = useMemo(
    () =>
      stored
        .filter((d) => d.analysis)
        .sort((a, b) => (b.analysis?.analysedAt ?? '').localeCompare(a.analysis?.analysedAt ?? '')),
    [stored]
  );

  /** Every theme found across every analysed book, for the section header's tally. */
  const analysedThemeCount = useMemo(
    () => analysedDocuments.reduce((total, d) => total + (d.analysis?.themeCount ?? 0), 0),
    [analysedDocuments]
  );

  /** Persisted rather than session-local, so a section folded shut stays that way next launch —
   *  the same reasoning as every other reading preference in `UserSettings`. */
  const toggleHomeSection = useCallback(
    (key: string) => {
      onUpdateSettings?.((prev) => ({
        ...prev,
        collapsedHomeSections: { ...prev.collapsedHomeSections, [key]: !prev.collapsedHomeSections?.[key] }
      }));
    },
    [onUpdateSettings]
  );

  /** True only while the reader has never touched the three starter themes at all — id, name AND
   *  colour all still match what a fresh install ships with — so the callout disappears the
   *  moment any real customization happens, not just once it's explicitly dismissed. */
  const themesAreUntouched = useMemo(() => {
    const defaults = initialSettings.activeThemes;
    if (settings.activeThemes.length !== defaults.length) return false;
    return settings.activeThemes.every((t, i) => {
      const d = defaults[i];
      return d && t.id === d.id && t.name === d.name && t.color === d.color;
    });
  }, [settings.activeThemes]);
  const showThemeCta = themesAreUntouched && !settings.themeCtaDismissed;

  const goToThemeSettings = () => {
    onNavigate('settings', 'push');
    // A settings screen mounted this same tick has nothing to scroll to yet — this fires after
    // the transition most of the app already uses (`transition={{ duration: 0.3 }}`), not before.
    window.setTimeout(() => {
      document.getElementById('settings-active-themes-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
  };

  const card = (doc: StoredDocumentMeta, index: number) => {
    const isRenaming = renamingId === doc.id;
    const isConfirming = confirmingDeleteId === doc.id;
    const canOpen = isAnnotatableFormat(doc.format) && doc.originalBytes > 0;

    return (
      <motion.article
        key={doc.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        // Staggered only for the first screenful; beyond that the delay outlasts the scroll.
        transition={{ duration: 0.28, delay: Math.min(index, 11) * 0.025 }}
        // Capped so a shelf holding one or two books does not stretch them across the whole
        // window; `auto-fit` below does the rest, collapsing tracks nothing occupies so a row is
        // never left with a hole at the end of it.
        style={{ maxWidth: 420 }}
        className={`group relative flex w-full flex-col rounded-2xl border overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 ${
          isDark
            ? 'bg-[#1b201d] border-stone-800 hover:border-stone-700'
            : 'bg-white border-stone-200/80 hover:border-stone-300 shadow-xs'
        }`}
      >
        {/* The cover: the document's own first page, so the shelf can be scanned by sight rather
            than by reading a column of similar titles. */}
        <button
          type="button"
          onClick={() => onOpenStoredDocument?.(doc)}
          title={canOpen ? 'Open in the annotating workspace' : 'Open'}
          className="relative h-44 w-full cursor-pointer overflow-hidden bg-stone-100 dark:bg-stone-900"
        >
          <DocumentCover doc={doc} />
          {/* The badges sit on a page now rather than a solid colour, so each carries its own
              dark backing — white-on-white would otherwise be unreadable on a title page. */}
          <span className="absolute top-2.5 left-2.5 px-1.5 py-0.5 rounded-md bg-black/45 text-[10px] font-bold tracking-widest text-white uppercase">
            {doc.format}
          </span>
          {doc.annotationCount > 0 && (
            <span
              className="absolute top-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/45 text-white text-[10px] font-semibold tabular-nums"
              title={`${doc.annotationCount} mark${doc.annotationCount === 1 ? '' : 's'} on this document`}
            >
              <Highlighter className="w-2.5 h-2.5" />
              {doc.annotationCount}
            </span>
          )}
          <span className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </button>

        <div className="flex-1 flex flex-col p-3 gap-1.5 min-w-0">
          {isRenaming ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commitRename(doc.id);
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border text-[13px] focus:outline-none focus:ring-1 focus:ring-[#435c52] ${
                  isDark ? 'bg-[#121514] border-stone-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                }`}
              />
              <button
                type="button"
                onClick={() => void commitRename(doc.id)}
                disabled={busyId === doc.id}
                title="Save name"
                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setRenamingId(null)}
                title="Cancel"
                className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onOpenStoredDocument?.(doc)}
                className="text-left cursor-pointer min-w-0"
              >
                <h3 className="font-serif text-[15px] font-semibold leading-snug text-stone-900 dark:text-stone-100 line-clamp-2 group-hover:text-[#435c52] dark:group-hover:text-emerald-300 transition-colors">
                  {doc.title}
                </h3>
              </button>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                {doc.wordCount.toLocaleString()} words · {formatBytes(doc.originalBytes)}
                <br />
                {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
            </>
          )}

          {/* Actions sit at the foot of the card, revealed on hover so a shelf at rest is titles
              and covers rather than rows of buttons. */}
          {!isRenaming && (
            <div className="mt-auto pt-1.5">
              {isConfirming ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-red-700 dark:text-red-400 leading-snug">
                    Delete permanently from this computer?
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void commitDelete(doc.id)}
                      disabled={busyId === doc.id}
                      className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {busyId === doc.id ? '…' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(null)}
                      className="px-2.5 py-1 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 text-[11px] font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  {canOpen && (
                    <button
                      type="button"
                      onClick={() => onOpenStoredDocument?.(doc)}
                      title="Open in the annotating workspace"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 text-[11px] font-semibold cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      Annotate
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(doc.id);
                      setDraftTitle(doc.title);
                    }}
                    title="Change this document's name"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 text-[11px] font-semibold cursor-pointer"
                  >
                    <Type className="w-3 h-3" />
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(doc.id)}
                    title="Delete from this computer"
                    aria-label={`Delete ${doc.title}`}
                    className="ml-auto p-1 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.article>
    );
  };

  return (
    <main className="flex-1 w-full px-5 md:px-8 lg:px-10 py-6 md:py-8 pb-28 md:pb-10">
      <ErrorDialog open={Boolean(failure)} message={failure ?? ''} onClose={() => setFailure(null)} />

      {/* Masthead: what is here, and the two ways to act on it. */}
      <header className="app-drag flex flex-wrap items-end justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="font-serif text-[28px] md:text-[34px] font-bold tracking-tight text-stone-900 dark:text-white leading-none">
            Library
          </h1>
          <p className="mt-1.5 text-[12.5px] text-stone-500 dark:text-stone-400 tabular-nums">
            {stored.length === 0
              ? 'Nothing stored yet'
              : `${stored.length} document${stored.length === 1 ? '' : 's'} · ${totalWords.toLocaleString()} words${
                  totalMarks > 0 ? ` · ${totalMarks.toLocaleString()} marks` : ''
                } · all on this computer`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {stored.length > 0 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a document…"
                aria-label="Filter the library"
                className={`w-48 md:w-64 pl-8.5 pr-3 py-2 rounded-xl border text-[13px] transition-all focus:outline-none focus:ring-1 focus:ring-[#435c52] ${
                  isDark
                    ? 'bg-[#1b201d] border-stone-800 text-stone-100 placeholder-stone-600'
                    : 'bg-white border-stone-200 text-stone-900 placeholder-stone-400'
                }`}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => onNavigate('upload', 'push')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#435c52] hover:bg-[#374c43] text-white text-[13px] font-semibold transition-all active:scale-[0.97] cursor-pointer shadow-xs shrink-0"
          >
            <Upload className="w-4 h-4" />
            Add document
          </button>
        </div>
      </header>

      {/* First-run nudge: themes exist and already colour-code marks across every book, but that
          only means anything once the reader has actually chosen what each colour stands for. */}
      {showThemeCta && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          id="theme-setup-cta"
          className={`mb-6 rounded-2xl border p-4 md:p-5 flex flex-wrap items-center gap-4 ${
            isDark ? 'bg-[#232a26] border-[#3d5147]' : 'bg-[#eef2ee] border-[#c7d6c9]'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-[#435c52] text-white flex items-center justify-center shrink-0">
            <Palette className="w-4.5 h-4.5" />
          </div>
          <div className="flex-1 min-w-50">
            <h2 className="text-[14px] font-semibold text-stone-900 dark:text-white">
              Tag Your Themes
            </h2>
            <p className="text-[12.5px] text-stone-600 dark:text-stone-400 mt-0.5">
              Each colour tags a theme across every book — say what green means once, and every
              highlight, underline and note in that colour is filed under it from then on.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={goToThemeSettings}
              className="px-3.5 py-2 rounded-xl bg-[#435c52] hover:bg-[#374c43] text-white text-[12.5px] font-semibold transition-all active:scale-[0.97] cursor-pointer"
            >
              Set up theme colours
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings?.((prev) => ({ ...prev, themeCtaDismissed: true }))}
              title="Dismiss"
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* The document already in hand, across the full width — the one thing more likely to be
          wanted than anything on the shelf below it. */}
      {hasActiveDoc && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          id="active-document-section"
          className={`mb-7 rounded-2xl border p-5 md:p-6 flex flex-wrap items-center gap-5 ${
            isDark ? 'bg-[#1b201d] border-stone-800' : 'bg-[#f0eee9] border-stone-300/60'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-[#435c52] text-white flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-50">
            <span className="text-[10px] font-bold tracking-widest text-emerald-700 dark:text-emerald-400 uppercase">
              Currently open
            </span>
            <h2 className="font-serif text-[20px] md:text-[24px] font-bold tracking-tight text-stone-900 dark:text-white truncate mt-0.5">
              {activeDocument!.title || 'Uploaded document'}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              id="continue-annotating-btn"
              type="button"
              onClick={() => onContinueAnnotating?.()}
              disabled={!canAnnotateActive}
              title={canAnnotateActive ? 'Open this document in the annotating workspace' : 'This format has no pages to annotate'}
              className="bg-[#435c52] hover:bg-[#374c43] active:scale-[0.97] disabled:opacity-45 disabled:cursor-default text-white py-2.5 px-5 rounded-xl font-semibold text-[13px] transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
              Continue annotating
            </button>
          </div>
        </motion.section>
      )}

      {/* Key Concepts: split out of the general Themes dashboard into its own card, since it's
          the one every fresh install ships with and reaches for first — worth a glance on its
          own rather than buried as one row among however many other themes exist. */}
      {keyConceptsTheme && (() => {
        const books = booksByTheme.get(keyConceptsTheme.id) ?? [];
        const keyConceptMarks = books.reduce(
          (total, doc) => total + (doc.themeCounts?.[keyConceptsTheme.id] ?? 0),
          0
        );
        return (
          <CollapsibleSection
            icon={Lightbulb}
            accentColor={keyConceptsTheme.color}
            title="Key Concepts"
            summary={
              books.length === 0
                ? 'Nothing filed yet'
                : `${books.length} book${books.length === 1 ? '' : 's'} · ${keyConceptMarks} mark${keyConceptMarks === 1 ? '' : 's'}`
            }
            isDark={isDark}
            collapsed={Boolean(settings.collapsedHomeSections?.keyConcepts)}
            onToggle={() => toggleHomeSection('keyConcepts')}
          >
            {books.length === 0 ? (
              <SectionEmpty
                actionLabel={stored.length === 0 ? 'Add your first document' : undefined}
                onAction={stored.length === 0 ? () => onNavigate('upload', 'push') : undefined}
              >
                Nothing is filed under Key Concepts yet. Tag a passage with it while annotating and
                the book appears here, with how much of it you have marked.
              </SectionEmpty>
            ) : (
              <InsightList>
                {books.map((doc, i) => (
                  <InsightRow
                    key={doc.id}
                    index={i}
                    title={doc.title}
                    onOpen={() =>
                      onOpenStoredDocument?.(doc, {
                        kind: 'theme',
                        themeId: keyConceptsTheme.id,
                        label: keyConceptsTheme.name,
                        color: keyConceptsTheme.color
                      })
                    }
                  >
                    <RowCount value={doc.themeCounts?.[keyConceptsTheme.id] ?? 0} unit="mark" />
                  </InsightRow>
                ))}
              </InsightList>
            )}
          </CollapsibleSection>
        );
      })()}

      {/* Terminologies: which books have terms marked with the Terminology tool, all shown in the
          one colour set in Settings → Terminology — recolouring it there updates every term
          already marked, so this swatch is never stale. */}
      <CollapsibleSection
        icon={Tag}
        accentColor={settings.terminologyColor}
        title="Terminologies"
        summary={
          documentsWithTerminology.length === 0
            ? 'Nothing marked yet'
            : `${documentsWithTerminology.length} book${documentsWithTerminology.length === 1 ? '' : 's'} · ${terminologyMarks} term${terminologyMarks === 1 ? '' : 's'}`
        }
        isDark={isDark}
        collapsed={Boolean(settings.collapsedHomeSections?.terminologies)}
        onToggle={() => toggleHomeSection('terminologies')}
      >
        {documentsWithTerminology.length === 0 ? (
          <SectionEmpty>
            No terms marked yet. Select a word or phrase while annotating and choose Terminology,
            and every book you build a vocabulary in is listed here.
          </SectionEmpty>
        ) : (
          <InsightList>
            {documentsWithTerminology.map((doc, i) => (
              <InsightRow
                key={doc.id}
                index={i}
                title={doc.title}
                onOpen={() =>
                  onOpenStoredDocument?.(doc, {
                    kind: 'terminology',
                    label: 'Terminology',
                    color: settings.terminologyColor
                  })
                }
              >
                <RowCount value={doc.terminologyCount} unit="term" />
              </InsightRow>
            ))}
          </InsightList>
        )}
      </CollapsibleSection>

      {/* AI Themes: what Gemini found in each book that has been analysed. Saved with the document
          (see `StoredAnalysis`), so this costs nothing to show and a book never has to be
          analysed twice to be read again. */}
      <CollapsibleSection
        icon={Sparkles}
        accentColor="#435c52"
        title="AI Themes"
        summary={
          analysedDocuments.length === 0
            ? 'Nothing analysed yet'
            : `${analysedDocuments.length} book${analysedDocuments.length === 1 ? '' : 's'} · ${analysedThemeCount} theme${analysedThemeCount === 1 ? '' : 's'}`
        }
        isDark={isDark}
        collapsed={Boolean(settings.collapsedHomeSections?.aiThemes)}
        onToggle={() => toggleHomeSection('aiThemes')}
      >
        {analysedDocuments.length === 0 ? (
          <SectionEmpty
            actionLabel={stored.length === 0 ? 'Add your first document' : undefined}
            onAction={stored.length === 0 ? () => onNavigate('upload', 'push') : undefined}
          >
            No books analysed yet. Open one and press AI Analysis, or use AI Analysis in the
            sidebar. Nothing is sent anywhere until you press it, and what comes back is saved
            here, so a book is only ever analysed once.
          </SectionEmpty>
        ) : (
          <InsightList>
            {analysedDocuments.map((doc, i) => (
              <InsightRow
                key={doc.id}
                index={i}
                title={doc.title}
                onOpen={() => onOpenStoredDocument?.(doc)}
              >
                {/* Primary themes only. Every theme it found would be a wall of tags rather than
                    an answer to "what is this book about". */}
                {doc.analysis!.primaryThemes.length === 0 ? (
                  <span className="text-[11px] text-stone-400">No dominant theme</span>
                ) : (
                  doc.analysis!.primaryThemes.map((theme) => <RowTag key={theme} label={theme} />)
                )}
                <RowCount value={doc.analysis!.themeCount} unit="theme" />
              </InsightRow>
            ))}
          </InsightList>
        )}
      </CollapsibleSection>

      {/* User Themes: the reader's own colour-coding, read back by book rather than by theme.
          Grouping by theme answered "who touches Questions?"; the reader's actual question at a
          glance is "what have I been filing in this book, and how much of it". Key Concepts is
          split out into its own card above, so this covers everything else. */}
      {otherThemes.length > 0 && (
        <CollapsibleSection
          // Not Sparkles: AI Themes already owns that, and two identical icons on adjacent cards
          // read as the same kind of thing. The reader's own themes are the colour-coding they
          // chose, so the palette is the honest icon for them.
          icon={Palette}
          accentColor="#8a8578"
          title="User Themes"
          summary={
            booksWithUserThemes.length === 0
              ? `${otherThemes.length} theme${otherThemes.length === 1 ? '' : 's'}, none used yet`
              : `${booksWithUserThemes.length} book${booksWithUserThemes.length === 1 ? '' : 's'} across ${otherThemes.length} theme${otherThemes.length === 1 ? '' : 's'}`
          }
          isDark={isDark}
          collapsed={Boolean(settings.collapsedHomeSections?.themes)}
          onToggle={() => toggleHomeSection('themes')}
        >
          {booksWithUserThemes.length === 0 ? (
            <SectionEmpty actionLabel="Set up theme colours" onAction={() => onNavigate('settings', 'push')}>
              You have {otherThemes.length} theme{otherThemes.length === 1 ? '' : 's'} defined and
              nothing filed under {otherThemes.length === 1 ? 'it' : 'them'} yet. Pick a theme in the
              toolbar before marking a passage, and each book you tag shows up here with its tally.
            </SectionEmpty>
          ) : (
            <InsightList>
              {booksWithUserThemes.map(({ doc, themes }, i) => (
                <InsightRow
                  key={doc.id}
                  index={i}
                  title={doc.title}
                  onOpen={() => onOpenStoredDocument?.(doc)}
                >
                  {themes.map((theme) => (
                    <RowTag
                      key={theme.id}
                      label={theme.name}
                      color={theme.color}
                      count={theme.count}
                      onPress={() =>
                        onOpenStoredDocument?.(doc, {
                          kind: 'theme',
                          themeId: theme.id,
                          label: theme.name,
                          color: theme.color
                        })
                      }
                    />
                  ))}
                </InsightRow>
              ))}
            </InsightList>
          )}
        </CollapsibleSection>
      )}

      {/* The shelf. Tracks size themselves, so the same page is full on a laptop and on a wide
          display instead of stranding a narrow column in the middle of it. */}
      {isLoadingLibrary && stored.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
          <p className="text-[12px] text-stone-500">Reading your library…</p>
        </div>
      ) : stored.length === 0 ? (
        <button
          type="button"
          onClick={() => onNavigate('upload', 'push')}
          className={`w-full rounded-3xl border-2 border-dashed py-20 px-6 flex flex-col items-center gap-4 text-center transition-all cursor-pointer ${
            isDark
              ? 'border-stone-800 hover:border-stone-700 bg-[#1b201d]/40'
              : 'border-stone-300 hover:border-stone-400 bg-stone-50/60'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-[#435c52] text-white flex items-center justify-center">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif text-[20px] font-bold text-stone-900 dark:text-white">
              Your shelf is empty
            </h2>
            <p className="text-[13px] text-stone-500 dark:text-stone-400 mt-1.5 max-w-md">
              Add a PDF, an HTML book, a DOCX, an EPUB or plain text. Everything stays on this
              computer, and nothing is ever sent anywhere.
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#435c52] dark:text-emerald-300">
            Add your first document
            <ArrowRight className="w-4 h-4" />
          </span>
        </button>
      ) : visible.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-2 text-center">
          <FileText className="w-6 h-6 text-stone-400" />
          <p className="text-[13px] text-stone-500 dark:text-stone-400">
            Nothing matches “{query}”.
          </p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Clear the filter
          </button>
        </div>
      ) : (
        <section
          id="stored-library"
          className="grid gap-4 md:gap-5 items-start"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}
        >
          {visible.map(card)}
        </section>
      )}
    </main>
  );
};
