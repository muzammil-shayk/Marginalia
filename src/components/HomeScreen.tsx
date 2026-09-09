/**
 * Marginalia — Curated Library & Knowledge Atelier
 *
 * A complete redesign embodying editorial minimalism, tactile physical interactions,
 * and high-density knowledge synthesis:
 * - "On the Desk" spotlight: physical-feeling active reading volume.
 * - "Knowledge Studio": interactive bento hub replacing repetitive stacked accordions
 *   with a unified Thematic Atlas, Terminologies, and AI Thematic Synthesis.
 * - "The Stacks" bookshelf: dual view modes (Visual Grid & Compact Bibliography),
 *   format filters, search with keyboard shortcut (/), and refined typography.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ChevronRight,
  LayoutGrid,
  List,
  Compass,
  ArrowUpDown,
  BookMarked
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { isAnnotatableFormat } from '../utils/annotatableFormats';
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
  onOpenLibraryDocument?: (doc: {
    id: string;
    title: string;
    text?: string;
    date: string;
    wordCount: number;
    format?: string;
    docId?: string;
  }) => void;
  onOpenStoredDocument?: (meta: StoredDocumentMeta, focus?: AnnotationFocus) => void;
  onContinueAnnotating?: () => void;
  canAnnotateActive?: boolean;
  onDocumentDeleted?: (id: string) => void;
  onDocumentRenamed?: (id: string, title: string) => void;
  refreshToken?: number;
}

const SPINE_COLOR = '#435c52';

function monogram(title: string): string {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase();
}

const formatBytes = (bytes: number) =>
  !bytes ? '—' : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * First-page cover renderer with subtle physical book spine shading.
 */
const DocumentCover: React.FC<{ doc: StoredDocumentMeta; className?: string }> = ({ doc, className = '' }) => {
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

  return (
    <div className={`relative h-full w-full overflow-hidden bg-stone-100 dark:bg-stone-900 ${className}`}>
      {src ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top bg-white select-none pointer-events-none"
        />
      ) : (
        <span
          className="absolute inset-0 flex items-center justify-center select-none"
          style={{ background: `linear-gradient(145deg, ${SPINE_COLOR} 0%, #2f423a 100%)` }}
        >
          <span className="font-serif text-[28px] md:text-[34px] font-bold text-white/95 tracking-tight">
            {monogram(doc.title)}
          </span>
        </span>
      )}
    </div>
  );
};

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
  const [failure, setFailure] = useState<string | null>(null);

  // Search & Filtering
  const [query, setQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | 'pdf' | 'epub' | 'docx' | 'txt'>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'title' | 'marks' | 'words'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Knowledge Studio tabs: overview (bento), themes, terminology, ai
  const [studioTab, setStudioTab] = useState<'overview' | 'themes' | 'terminology' | 'ai'>('overview');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Studio collapse state
  const isStudioCollapsed = Boolean(settings.collapsedHomeSections?.studio);
  const toggleStudioCollapsed = useCallback(() => {
    onUpdateSettings?.((prev) => ({
      ...prev,
      collapsedHomeSections: {
        ...prev.collapsedHomeSections,
        studio: !prev.collapsedHomeSections?.studio
      }
    }));
  }, [onUpdateSettings]);

  // Global keyboard shortcut '/' to focus search, and 'Escape' to clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (e.key === '/' && activeTag !== 'input' && activeTag !== 'textarea') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setQuery('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Metrics
  const totalWords = useMemo(() => stored.reduce((sum, d) => sum + (d.wordCount || 0), 0), [stored]);
  /**
   * Every mark in the library. Also what the Knowledge Studio badge counts.
   *
   * That badge used to add Key Concepts marks, terminology marks and AI themes together, which
   * counted marks under Questions and Metaphors not at all, counted a mark that is also a term
   * twice, and treated a machine's themes as though they were the reader's own marks. It read 9
   * for a library holding 5 marks.
   */
  const totalMarks = useMemo(() => stored.reduce((sum, d) => sum + (d.annotationCount || 0), 0), [stored]);

  // Themes
  const keyConceptsTheme = useMemo(
    () => settings.activeThemes.find((t) => t.name.trim().toLowerCase() === 'key concepts'),
    [settings.activeThemes]
  );
  const otherThemes = useMemo(
    () => settings.activeThemes.filter((t) => t.id !== keyConceptsTheme?.id),
    [settings.activeThemes, keyConceptsTheme]
  );

  const booksByTheme = useMemo(() => {
    const map = new Map<string, StoredDocumentMeta[]>();
    for (const theme of settings.activeThemes) {
      map.set(theme.id, stored.filter((d) => d.themeIds?.includes(theme.id)));
    }
    return map;
  }, [settings.activeThemes, stored]);

  // Terminologies
  const documentsWithTerminology = useMemo(
    () => stored.filter((d) => (d.terminologyCount ?? 0) > 0),
    [stored]
  );
  const terminologyMarks = useMemo(
    () => documentsWithTerminology.reduce((total, d) => total + d.terminologyCount, 0),
    [documentsWithTerminology]
  );

  // AI Themes
  const analysedDocuments = useMemo(
    () =>
      stored
        .filter((d) => d.analysis)
        .sort((a, b) => (b.analysis?.analysedAt ?? '').localeCompare(a.analysis?.analysedAt ?? '')),
    [stored]
  );
  const analysedThemeCount = useMemo(
    () => analysedDocuments.reduce((total, d) => total + (d.analysis?.themeCount ?? 0), 0),
    [analysedDocuments]
  );

  // Filter and sort visible documents
  const visible = useMemo(() => {
    let list = stored;
    const needle = query.trim().toLowerCase();

    if (needle) {
      list = list.filter(
        (d) => d.title.toLowerCase().includes(needle) || d.format.toLowerCase().includes(needle)
      );
    }

    if (formatFilter !== 'all') {
      list = list.filter((d) => d.format.toLowerCase() === formatFilter);
    }

    return [...list].sort((a, b) => {
      if (sortOrder === 'recent') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sortOrder === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortOrder === 'marks') {
        return (b.annotationCount || 0) - (a.annotationCount || 0);
      }
      if (sortOrder === 'words') {
        return (b.wordCount || 0) - (a.wordCount || 0);
      }
      return 0;
    });
  }, [stored, query, formatFilter, sortOrder]);

  const themesAreUntouched = useMemo(() => {
    const defaults = initialSettings.activeThemes;
    if (settings.activeThemes.length !== defaults.length) return false;
    return settings.activeThemes.every((t, i) => {
      const d = defaults[i];
      return d && t.id === d.id && t.name === d.name && t.color === d.color;
    });
  }, [settings.activeThemes]);

  const goToThemeSettings = () => {
    onNavigate('settings', 'push');
    window.setTimeout(() => {
      document.getElementById('settings-active-themes-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
  };

  const keyConceptsBooks = keyConceptsTheme ? booksByTheme.get(keyConceptsTheme.id) ?? [] : [];
  const keyConceptMarks = keyConceptsBooks.reduce(
    (total, doc) => total + (doc.themeCounts?.[keyConceptsTheme!.id] ?? 0),
    0
  );



  return (
    <main className="flex-1 w-full max-w-360 mx-auto px-5 md:px-8 lg:px-10 py-6 md:py-8 pb-28 md:pb-12">
      <ErrorDialog open={Boolean(failure)} message={failure ?? ''} onClose={() => setFailure(null)} />

      {/* ── MASTHEAD & TELEMETRY STRIP ──────────────────────────────────── */}
      <header className="app-drag flex flex-col gap-5 mb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-widest font-mono font-medium text-[#435c52] dark:text-emerald-400">
                Personal Atelier
              </span>
              <span className="text-stone-300 dark:text-stone-700">/</span>
              <span className="text-[11px] font-mono text-stone-400 dark:text-stone-500">
                Offline & Local
              </span>
            </div>
            <h1 className="font-serif text-[32px] md:text-[40px] font-bold tracking-tight text-stone-900 dark:text-stone-100 leading-tight mt-1">
              Library
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('upload', 'push')}
              className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-[#435c52] hover:bg-[#384e45] active:scale-[0.98] text-white text-[13px] font-medium shadow-xs transition-all duration-150 cursor-pointer"
            >
              <Upload className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
              <span>Add Document</span>
            </button>
          </div>
        </div>

        {/* Live Telemetry Capsule */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border text-[12px] ${
            isDark
              ? 'bg-[#151a17] border-stone-800 text-stone-300'
              : 'bg-[#faf9f6] border-stone-200/80 text-stone-600'
          }`}
        >
          <div className="flex flex-wrap items-center gap-4 md:gap-6 font-mono text-[11.5px] tabular-nums">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#435c52]" />
              <strong className="text-stone-900 dark:text-stone-100 font-semibold">{stored.length}</strong>
              <span className="text-stone-500">{stored.length === 1 ? 'volume' : 'volumes'}</span>
            </span>

            <span className="text-stone-300 dark:text-stone-700">·</span>

            <span className="flex items-center gap-1.5">
              <strong className="text-stone-900 dark:text-stone-100 font-semibold">
                {totalWords.toLocaleString()}
              </strong>
              <span className="text-stone-500">words</span>
            </span>

            <span className="text-stone-300 dark:text-stone-700">·</span>

            <span className="flex items-center gap-1.5">
              <strong className="text-stone-900 dark:text-stone-100 font-semibold">
                {totalMarks.toLocaleString()}
              </strong>
              <span className="text-stone-500">marks</span>
            </span>

            <span className="text-stone-300 dark:text-stone-700">·</span>

            <span className="flex items-center gap-1.5">
              <strong className="text-stone-900 dark:text-stone-100 font-semibold">
                {settings.activeThemes.length}
              </strong>
              <span className="text-stone-500">themes</span>
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-stone-400 font-mono">
            <span>Stored on this machine</span>
          </div>
        </div>
      </header>

      {/* ── "ON THE DESK" (CURRENTLY READING SPOTLIGHT) ────────────────── */}
      {hasActiveDoc && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          className={`relative mb-8 rounded-2xl border p-5 md:p-6 overflow-hidden ${
            isDark
              ? 'bg-linear-to-br from-[#1c221e] to-[#151917] border-stone-800'
              : 'bg-linear-to-br from-[#f6f5f0] to-[#eceae2] border-stone-300/70'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start md:items-center gap-4 min-w-0">
              {/* Miniature desk volume */}
              <div className="relative w-12 h-16 md:w-14 md:h-18 rounded-md shrink-0 shadow-sm border border-black/10 overflow-hidden bg-[#435c52] flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white/90" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold tracking-wider uppercase bg-[#435c52]/15 text-[#435c52] dark:text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    On The Desk
                  </span>
                </div>
                <h2 className="font-serif text-[18px] md:text-[22px] font-bold text-stone-900 dark:text-stone-50 truncate mt-1">
                  {activeDocument!.title || 'Uploaded Document'}
                </h2>
                <p className="text-[12px] text-stone-500 dark:text-stone-400 mt-0.5">
                  Pick up right where you left off in your reading workspace.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => onContinueAnnotating?.()}
                disabled={!canAnnotateActive}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#435c52] hover:bg-[#384e45] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-medium shadow-xs transition-all cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
                <span>Resume Reading</span>
              </button>
            </div>
          </div>
        </motion.section>
      )}

      {/* ── THE KNOWLEDGE STUDIO (REIMAGINED SYNTHESIS HUB) ────────────── */}
      <section
        className={`mb-10 rounded-2xl border transition-all duration-200 overflow-hidden ${
          isDark ? 'bg-[#161a18] border-stone-800/90' : 'bg-[#fcfbf9] border-stone-200/90'
        }`}
      >
        {/* Studio Top Control Strip */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b ${
            isDark ? 'border-stone-800/80 bg-[#191f1c]' : 'border-stone-200/70 bg-[#f7f5f0]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#435c52]/10 dark:bg-emerald-500/15 flex items-center justify-center text-[#435c52] dark:text-emerald-400">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-[15px] font-bold text-stone-900 dark:text-stone-100 leading-none">
                  Knowledge Studio
                </h2>
                <span className="font-mono text-[10.5px] px-1.5 py-0.2 rounded bg-stone-500/10 text-stone-600 dark:text-stone-400">
                  {totalMarks} {totalMarks === 1 ? 'mark' : 'marks'}
                  {analysedThemeCount > 0 && ` · ${analysedThemeCount} AI themes`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isStudioCollapsed && (
              <div
                role="tablist"
                className={`flex items-center p-0.5 rounded-lg border text-[11.5px] font-medium ${
                  isDark ? 'bg-[#121514] border-stone-800' : 'bg-white border-stone-200'
                }`}
              >
                {(
                  [
                    { id: 'overview', label: 'Overview' },
                    { id: 'themes', label: 'Themes' },
                    { id: 'terminology', label: 'Terminologies' },
                    { id: 'ai', label: 'AI Synthesis' }
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={studioTab === tab.id}
                    onClick={() => setStudioTab(tab.id)}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      studioTab === tab.id
                        ? 'bg-[#435c52] text-white shadow-2xs font-semibold'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={toggleStudioCollapsed}
              title={isStudioCollapsed ? 'Expand Studio' : 'Collapse Studio'}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isDark
                  ? 'border-stone-800 text-stone-400 hover:bg-stone-800'
                  : 'border-stone-200 text-stone-500 hover:bg-stone-100'
              }`}
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isStudioCollapsed ? '-rotate-90' : 'rotate-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Studio Content Body */}
        <AnimatePresence initial={false}>
          {!isStudioCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="p-5">
                {/* ── BENTO OVERVIEW MODE ── */}
                {studioTab === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Bento Card 1: Thematic Atlas */}
                    <div
                      className={`flex flex-col rounded-xl border p-4.5 ${
                        isDark ? 'bg-[#1b201d]/70 border-stone-800' : 'bg-white border-stone-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: keyConceptsTheme?.color || '#3b82f6' }}
                          />
                          <h3 className="font-serif text-[14px] font-bold text-stone-900 dark:text-stone-100">
                            Thematic Atlas
                          </h3>
                        </div>
                        <span className="font-mono text-[11px] text-stone-400 tabular-nums">
                          {keyConceptMarks} concepts
                        </span>
                      </div>

                      <p className="text-[12px] text-stone-500 dark:text-stone-400 leading-relaxed mb-3">
                        Key Concepts and color-coded topics tagged across your reading library.
                      </p>

                      {/* Theme List / Chips */}
                      <div className="flex-1 flex flex-col gap-1.5 min-h-27.5">
                        {keyConceptsBooks.length > 0 ? (
                          <div className="space-y-1">
                            <span className="text-[10.5px] uppercase tracking-wider font-mono font-medium text-stone-400">
                              Top Concept Volumes
                            </span>
                            {keyConceptsBooks.slice(0, 3).map((doc) => {
                              const conceptMarks = doc.themeCounts?.[keyConceptsTheme!.id] ?? 0;
                              return (
                                <button
                                  key={doc.id}
                                  type="button"
                                  onClick={() =>
                                    onOpenStoredDocument?.(doc, {
                                      kind: 'theme',
                                      themeId: keyConceptsTheme!.id,
                                      label: keyConceptsTheme!.name,
                                      color: keyConceptsTheme!.color
                                    })
                                  }
                                  className={`w-full flex items-center justify-between py-1.5 px-2 rounded-md text-left transition-colors cursor-pointer group ${
                                    isDark ? 'hover:bg-white/5' : 'hover:bg-stone-100'
                                  }`}
                                >
                                  <span className="font-serif text-[13px] text-stone-700 dark:text-stone-200 truncate group-hover:text-[#435c52] dark:group-hover:text-emerald-300">
                                    {doc.title}
                                  </span>
                                  {/* This book's Key Concepts marks — the number this card is
                                      about. It used to also show how many DIFFERENT themes the
                                      book carried, which says nothing about key concepts and
                                      read as a wrong count sitting next to a right one. */}
                                  <span className="font-mono text-[11px] tabular-nums shrink-0 ml-2 text-stone-500 dark:text-stone-400">
                                    {conceptMarks} {conceptMarks === 1 ? 'mark' : 'marks'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col justify-center items-center text-center p-3 rounded-lg bg-stone-500/5">
                            <Lightbulb className="w-5 h-5 text-stone-400 mb-1" />
                            <span className="text-[11.5px] text-stone-500">No key concepts tagged yet</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-stone-200/60 dark:border-stone-800/80 flex items-center justify-between text-[11.5px]">
                        <button
                          type="button"
                          onClick={() => setStudioTab('themes')}
                          className="font-semibold text-[#435c52] dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          View all {settings.activeThemes.length} themes →
                        </button>
                        {themesAreUntouched && (
                          <button
                            type="button"
                            onClick={goToThemeSettings}
                            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                          >
                            Customise
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bento Card 2: Terminologies */}
                    <div
                      className={`flex flex-col rounded-xl border p-4.5 ${
                        isDark ? 'bg-[#1b201d]/70 border-stone-800' : 'bg-white border-stone-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: settings.terminologyColor || '#ec4899' }}
                          />
                          <h3 className="font-serif text-[14px] font-bold text-stone-900 dark:text-stone-100">
                            Terminologies
                          </h3>
                        </div>
                        <span className="font-mono text-[11px] text-stone-400 tabular-nums">
                          {terminologyMarks} terms
                        </span>
                      </div>

                      <p className="text-[12px] text-stone-500 dark:text-stone-400 leading-relaxed mb-3">
                        Specialized vocabularies and terminology defined while annotating passages.
                      </p>

                      <div className="flex-1 flex flex-col gap-1.5 min-h-27.5">
                        {documentsWithTerminology.length > 0 ? (
                          <div className="space-y-1">
                            <span className="text-[10.5px] uppercase tracking-wider font-mono font-medium text-stone-400">
                              Books with terms
                            </span>
                            {documentsWithTerminology.slice(0, 3).map((doc) => (
                              <button
                                key={doc.id}
                                type="button"
                                onClick={() =>
                                  onOpenStoredDocument?.(doc, {
                                    kind: 'terminology',
                                    label: 'Terminology',
                                    color: settings.terminologyColor
                                  })
                                }
                                className={`w-full flex items-center justify-between py-1 px-2 rounded-md text-left transition-colors cursor-pointer group ${
                                  isDark ? 'hover:bg-white/5' : 'hover:bg-stone-100'
                                }`}
                              >
                                <span className="font-serif text-[13px] text-stone-700 dark:text-stone-200 truncate group-hover:text-[#435c52] dark:group-hover:text-emerald-300">
                                  {doc.title}
                                </span>
                                <span className="font-mono text-[11px] text-stone-400 tabular-nums shrink-0 ml-2">
                                  {doc.terminologyCount} terms
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col justify-center items-center text-center p-3 rounded-lg bg-stone-500/5">
                            <Tag className="w-5 h-5 text-stone-400 mb-1" />
                            <span className="text-[11.5px] text-stone-500">No terms defined yet</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-stone-200/60 dark:border-stone-800/80 flex items-center justify-between text-[11.5px]">
                        <button
                          type="button"
                          onClick={() => setStudioTab('terminology')}
                          className="font-semibold text-[#435c52] dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          All terminologies ({documentsWithTerminology.length}) →
                        </button>
                      </div>
                    </div>

                    {/* Bento Card 3: AI Thematic Synthesis */}
                    <div
                      className={`flex flex-col rounded-xl border p-4.5 ${
                        isDark ? 'bg-[#1b201d]/70 border-stone-800' : 'bg-white border-stone-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-[#435c52] dark:text-emerald-400" />
                          <h3 className="font-serif text-[14px] font-bold text-stone-900 dark:text-stone-100">
                            AI Synthesis
                          </h3>
                        </div>
                        <span className="font-mono text-[11px] text-stone-400 tabular-nums">
                          {analysedThemeCount} themes
                        </span>
                      </div>

                      <p className="text-[12px] text-stone-500 dark:text-stone-400 leading-relaxed mb-3">
                        Gemini deep analysis uncovering structural motifs and underlying arcs.
                      </p>

                      <div className="flex-1 flex flex-col gap-1.5 min-h-27.5">
                        {analysedDocuments.length > 0 ? (
                          <div className="space-y-1">
                            <span className="text-[10.5px] uppercase tracking-wider font-mono font-medium text-stone-400">
                              Analysed Texts
                            </span>
                            {analysedDocuments.slice(0, 2).map((doc) => (
                              <div
                                key={doc.id}
                                className={`p-2 rounded-lg border text-left ${
                                  isDark ? 'bg-white/2 border-stone-800' : 'bg-stone-50 border-stone-200/60'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-serif text-[12.5px] font-semibold text-stone-800 dark:text-stone-200 truncate">
                                    {doc.title}
                                  </span>
                                  <span className="font-mono text-[10.5px] text-stone-400 shrink-0">
                                    {doc.analysis?.themeCount} th.
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {doc.analysis?.primaryThemes.slice(0, 2).map((theme) => (
                                    <span
                                      key={theme}
                                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-500/10 text-stone-700 dark:text-stone-300 truncate max-w-35"
                                    >
                                      {theme}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col justify-center items-center text-center p-3 rounded-lg bg-stone-500/5">
                            <Sparkles className="w-5 h-5 text-stone-400 mb-1" />
                            <span className="text-[11.5px] text-stone-500">No books analysed yet</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-stone-200/60 dark:border-stone-800/80 flex items-center justify-between text-[11.5px]">
                        <button
                          type="button"
                          onClick={() => setStudioTab('ai')}
                          className="font-semibold text-[#435c52] dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          Deep insights ({analysedDocuments.length}) →
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── THEMES EXPANDED VIEW ── */}
                {studioTab === 'themes' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-[15px] font-bold text-stone-900 dark:text-stone-100">
                        All Active Themes & Key Concepts
                      </h3>
                      <button
                        type="button"
                        onClick={goToThemeSettings}
                        className="text-[12px] font-semibold text-[#435c52] dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Manage Theme Colors
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {settings.activeThemes.map((theme) => {
                        const books = booksByTheme.get(theme.id) ?? [];
                        const totalMarksForTheme = books.reduce(
                          (sum, b) => sum + (b.themeCounts?.[theme.id] ?? 0),
                          0
                        );
                        return (
                          <div
                            key={theme.id}
                            className={`p-3.5 rounded-xl border ${
                              isDark ? 'bg-[#1b201d]/60 border-stone-800' : 'bg-white border-stone-200/80'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="flex items-center gap-2">
                                <span
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: theme.color }}
                                />
                                <strong className="font-serif text-[13.5px] font-semibold text-stone-900 dark:text-stone-100">
                                  {theme.name}
                                </strong>
                              </span>
                              <span className="font-mono text-[11px] text-stone-400 tabular-nums">
                                {totalMarksForTheme} {totalMarksForTheme === 1 ? 'mark' : 'marks'}
                              </span>
                            </div>

                            {books.length > 0 ? (
                              <ul className="divide-y divide-stone-100 dark:divide-stone-800/60 mt-2">
                                {books.map((doc) => (
                                  <li key={doc.id}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenStoredDocument?.(doc, {
                                          kind: 'theme',
                                          themeId: theme.id,
                                          label: theme.name,
                                          color: theme.color
                                        })
                                      }
                                      className="w-full flex items-center justify-between py-1.5 text-left text-[12px] hover:text-[#435c52] dark:hover:text-emerald-300 transition-colors cursor-pointer group"
                                    >
                                      <span className="truncate pr-2 font-serif text-stone-700 dark:text-stone-300 group-hover:text-current">
                                        {doc.title}
                                      </span>
                                      <span className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums shrink-0 ml-2">
                                        {/* Marks under THIS theme. A book's total theme count
                                            belongs to the book, not to the theme card it is
                                            listed inside. */}
                                        <span className="text-stone-500 dark:text-stone-400">
                                          {doc.themeCounts?.[theme.id] ?? 0}{' '}
                                          {(doc.themeCounts?.[theme.id] ?? 0) === 1 ? 'mark' : 'marks'}
                                        </span>
                                        <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                                      </span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[11.5px] text-stone-400 italic mt-1">
                                No books marked with this theme yet.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── LEXICON EXPANDED VIEW ── */}
                {studioTab === 'terminology' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-[15px] font-bold text-stone-900 dark:text-stone-100">
                        Terminologies Across the Library
                      </h3>
                      <span className="font-mono text-[12px] text-stone-500 tabular-nums">
                        {terminologyMarks} terms in {documentsWithTerminology.length} books
                      </span>
                    </div>

                    {documentsWithTerminology.length === 0 ? (
                      <div className="py-8 text-center text-stone-500 text-[13px]">
                        No terminology marks captured yet. Select a word in any book and tag it as Terminology.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {documentsWithTerminology.map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() =>
                              onOpenStoredDocument?.(doc, {
                                kind: 'terminology',
                                label: 'Terminology',
                                color: settings.terminologyColor
                              })
                            }
                            className={`p-3.5 rounded-xl border text-left transition-all hover:-translate-y-0.5 cursor-pointer ${
                              isDark
                                ? 'bg-[#1b201d]/60 border-stone-800 hover:border-stone-700'
                                : 'bg-white border-stone-200/80 hover:border-stone-300 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="font-serif text-[14px] font-semibold text-stone-900 dark:text-stone-100 truncate pr-2">
                                {doc.title}
                              </h4>
                              <Tag className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            </div>
                            <div className="mt-2 flex items-center justify-between font-mono text-[11.5px]">
                              <span className="text-[#435c52] dark:text-emerald-400 font-medium">
                                {doc.terminologyCount} {doc.terminologyCount === 1 ? 'term' : 'terms'} marked
                              </span>
                              <span className="text-stone-400">Open terms →</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── AI SYNTHESIS EXPANDED VIEW ── */}
                {studioTab === 'ai' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-[15px] font-bold text-stone-900 dark:text-stone-100">
                        AI-Analyzed Works & Narrative Arc Motifs
                      </h3>
                      <span className="font-mono text-[12px] text-stone-500 tabular-nums">
                        {analysedDocuments.length} books analyzed
                      </span>
                    </div>

                    {analysedDocuments.length === 0 ? (
                      <div className="py-8 text-center text-stone-500 text-[13px]">
                        No books analysed yet. Open any book and launch AI Analysis from the sidebar or reader.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {analysedDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className={`p-4 rounded-xl border ${
                              isDark ? 'bg-[#1b201d]/60 border-stone-800' : 'bg-white border-stone-200/80'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="font-serif text-[15px] font-bold text-stone-900 dark:text-stone-100 truncate pr-2">
                                {doc.title}
                              </h4>
                              <span className="font-mono text-[11px] text-stone-400 shrink-0">
                                {new Date(doc.analysis?.analysedAt ?? '').toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>

                            <p className="font-mono text-[11.5px] text-[#435c52] dark:text-emerald-400 mt-1">
                              {doc.analysis?.themeCount} thematic motifs detected
                            </p>

                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {doc.analysis?.primaryThemes.map((theme) => (
                                <span
                                  key={theme}
                                  className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-500/10 text-stone-700 dark:text-stone-300"
                                >
                                  {theme}
                                </span>
                              ))}
                            </div>

                            <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800/70 flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => onOpenStoredDocument?.(doc)}
                                className="text-[12px] font-semibold text-[#435c52] dark:text-emerald-400 hover:underline cursor-pointer"
                              >
                                Open document →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── THE BOOKSHELF ("THE STACKS") ────────────────────────────────── */}
      <section id="shelf-section" className="space-y-5">
        {/* Shelf Control Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-[22px] font-bold text-stone-900 dark:text-stone-100">
              The Stacks
            </h2>
            <span className="font-mono text-[12px] text-stone-400 tabular-nums">
              ({visible.length})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Bar with '/' shortcut indicator */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stacks…"
                aria-label="Filter documents"
                className={`w-44 md:w-56 pl-8.5 pr-8 py-1.5 rounded-xl border text-[12.5px] transition-all focus:outline-none focus:ring-1 focus:ring-[#435c52] ${
                  isDark
                    ? 'bg-[#1b201d] border-stone-800 text-stone-100 placeholder-stone-600'
                    : 'bg-white border-stone-200 text-stone-900 placeholder-stone-400'
                }`}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none font-mono text-[10px] text-stone-400 border border-stone-300 dark:border-stone-700 px-1 rounded">
                /
              </span>
            </div>

            {/* Format Filter Chips */}
            <div
              className={`hidden sm:flex items-center p-0.5 rounded-xl border text-[11px] font-medium ${
                isDark ? 'bg-[#1b201d] border-stone-800' : 'bg-white border-stone-200'
              }`}
            >
              {(['all', 'pdf', 'epub', 'docx', 'txt'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormatFilter(fmt)}
                  className={`px-2.5 py-1 rounded-lg transition-all uppercase cursor-pointer ${
                    formatFilter === fmt
                      ? 'bg-[#435c52] text-white font-semibold'
                      : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>

            {/* Sort Selector */}
            <div
              className={`flex items-center rounded-xl border px-2 py-1 gap-1 text-[12px] ${
                isDark ? 'bg-[#1b201d] border-stone-800 text-stone-300' : 'bg-white border-stone-200 text-stone-700'
              }`}
            >
              <ArrowUpDown className="w-3 h-3 text-stone-400" />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                aria-label="Sort documents"
                className="bg-transparent border-none text-[12px] focus:outline-none cursor-pointer"
              >
                <option value="recent">Recent</option>
                <option value="title">Title</option>
                <option value="marks">Marks</option>
                <option value="words">Word Count</option>
              </select>
            </div>

            {/* View Mode Toggle (Grid / List) */}
            <div
              className={`flex items-center p-0.5 rounded-xl border ${
                isDark ? 'bg-[#1b201d] border-stone-800' : 'bg-white border-stone-200'
              }`}
            >
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Grid view"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[#435c52] text-white'
                    : 'text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="Bibliography list view"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[#435c52] text-white'
                    : 'text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Shelf Content */}
        {isLoadingLibrary && stored.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
            <p className="font-mono text-[12px] text-stone-500">Reading your local shelf…</p>
          </div>
        ) : stored.length === 0 ? (
          <button
            type="button"
            onClick={() => onNavigate('upload', 'push')}
            className={`w-full rounded-2xl border-2 border-dashed py-20 px-6 flex flex-col items-center gap-4 text-center transition-all cursor-pointer ${
              isDark
                ? 'border-stone-800 hover:border-stone-700 bg-[#1b201d]/30'
                : 'border-stone-300 hover:border-stone-400 bg-stone-50/50'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-[#435c52] text-white flex items-center justify-center shadow-sm">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif text-[22px] font-bold text-stone-900 dark:text-stone-100">
                Your shelf is empty
              </h3>
              <p className="text-[13px] text-stone-500 dark:text-stone-400 mt-1.5 max-w-md">
                Add a PDF, EPUB, DOCX, or text file. Everything stays local on your machine.
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#435c52] dark:text-emerald-400">
              Add your first document <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        ) : visible.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-center">
            <FileText className="w-6 h-6 text-stone-400" />
            <p className="font-serif text-[15px] text-stone-700 dark:text-stone-300">
              No documents match your filter
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setFormatFilter('all');
              }}
              className="font-mono text-[12px] font-semibold text-[#435c52] dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Reset filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* ── VISUAL SHELF GRID ── */
          <div
            id="stored-library"
            className="grid gap-5 items-stretch"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))' }}
          >
            {visible.map((doc, index) => {
              const isRenaming = renamingId === doc.id;
              const isConfirming = confirmingDeleteId === doc.id;
              const canOpen = isAnnotatableFormat(doc.format) && doc.originalBytes > 0;

              return (
                <motion.article
                  key={doc.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: Math.min(index, 8) * 0.02 }}
                  className={`group relative flex flex-col h-full rounded-2xl border overflow-hidden transition-all duration-150 hover:-translate-y-0.5 ${
                    isDark
                      ? 'bg-[#181d1a] border-stone-800 hover:border-stone-700 hover:shadow-lg hover:shadow-black/20'
                      : 'bg-white border-stone-200/90 hover:border-stone-300 hover:shadow-md hover:shadow-stone-200/40'
                  }`}
                >
                  {/* Book Cover Presentation */}
                  <button
                    type="button"
                    onClick={() => onOpenStoredDocument?.(doc)}
                    title={canOpen ? 'Open in annotating workspace' : 'Open'}
                    className="relative h-48 w-full cursor-pointer overflow-hidden bg-stone-100 dark:bg-stone-900 group shrink-0"
                  >
                    <DocumentCover doc={doc} />

                    {/* Format Pill */}
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] font-mono font-bold tracking-widest text-white uppercase">
                      {doc.format}
                    </span>

                    {/* Annotation Badge */}
                    {doc.annotationCount > 0 && (
                      <span
                        className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white text-[10.5px] font-mono tabular-nums"
                        title={`${doc.annotationCount} marks`}
                      >
                        <Highlighter className="w-2.5 h-2.5 text-emerald-400" />
                        {doc.annotationCount}
                      </span>
                    )}

                    {/* Subtle hover overlay */}
                    <span className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-colors" />
                  </button>

                  {/* Document Card Details */}
                  <div className="flex-1 flex flex-col p-3.5 justify-between gap-1.5 min-w-0">
                    <div className="space-y-1">
                      {isRenaming ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void commitRename(doc.id);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            className={`flex-1 min-w-0 px-2 py-1 rounded-lg border text-[13px] focus:outline-none focus:ring-1 focus:ring-[#435c52] ${
                              isDark
                                ? 'bg-[#121514] border-stone-700 text-stone-100'
                                : 'bg-white border-stone-300 text-stone-900'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => void commitRename(doc.id)}
                            disabled={busyId === doc.id}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingId(null)}
                            className="p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpenStoredDocument?.(doc)}
                            className="text-left cursor-pointer w-full"
                          >
                            <h3 className="font-serif text-[15px] font-bold leading-snug text-stone-900 dark:text-stone-100 line-clamp-2 min-h-10 group-hover:text-[#435c52] dark:group-hover:text-emerald-400 transition-colors">
                              {doc.title}
                            </h3>
                          </button>

                          <div className="font-mono text-[11px] text-stone-400 tabular-nums flex items-center justify-between mt-1">
                            <span>{doc.wordCount.toLocaleString()} words</span>
                            <span>{formatBytes(doc.originalBytes)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Action Dock */}
                    {!isRenaming && (
                      <div className="mt-auto pt-2 border-t border-stone-100 dark:border-stone-800/80">
                        {isConfirming ? (
                          <div className="space-y-1.5 py-1">
                            <p className="text-[11px] text-red-600 dark:text-red-400">
                              Delete permanently?
                            </p>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void commitDelete(doc.id)}
                                disabled={busyId === doc.id}
                                className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white text-[10.5px] font-semibold cursor-pointer"
                              >
                                {busyId === doc.id ? '…' : 'Delete'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmingDeleteId(null)}
                                className="px-2 py-0.5 rounded text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 text-[10.5px] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-[11px] opacity-80 group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-1">
                              {canOpen && (
                                <button
                                  type="button"
                                  onClick={() => onOpenStoredDocument?.(doc)}
                                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Annotate</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setRenamingId(doc.id);
                                  setDraftTitle(doc.title);
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                              >
                                <Type className="w-3 h-3" />
                                <span>Rename</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(doc.id)}
                              title="Delete document"
                              className="p-1 rounded text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        ) : (
          /* ── COMPACT BIBLIOGRAPHY LIST VIEW ── */
          <div
            id="stored-library"
            className={`rounded-2xl border overflow-hidden ${
              isDark ? 'bg-[#181d1a] border-stone-800' : 'bg-white border-stone-200/90'
            }`}
          >
            <div
              className={`grid grid-cols-12 gap-2 px-4 py-2.5 text-[11px] font-mono uppercase tracking-wider text-stone-400 border-b ${
                isDark ? 'border-stone-800 bg-[#141816]' : 'border-stone-200/70 bg-stone-50'
              }`}
            >
              <div className="col-span-6">Title</div>
              <div className="col-span-2">Format</div>
              <div className="col-span-2 text-right">Words & Marks</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            <div className="divide-y divide-stone-100 dark:divide-stone-800/80">
              {visible.map((doc) => (
                <div
                  key={doc.id}
                  className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-[13px] transition-colors ${
                    isDark ? 'hover:bg-white/2' : 'hover:bg-stone-50'
                  }`}
                >
                  <div className="col-span-6 flex items-center gap-3 min-w-0">
                    <BookMarked className="w-4 h-4 text-[#435c52] shrink-0" />
                    <button
                      type="button"
                      onClick={() => onOpenStoredDocument?.(doc)}
                      className="font-serif font-semibold text-stone-900 dark:text-stone-100 truncate hover:text-[#435c52] dark:hover:text-emerald-400 text-left cursor-pointer"
                    >
                      {doc.title}
                    </button>
                  </div>

                  <div className="col-span-2 font-mono text-[11px] text-stone-400 uppercase">
                    {doc.format}
                  </div>

                  <div className="col-span-2 text-right font-mono text-[11.5px] tabular-nums text-stone-500">
                    <span>{doc.wordCount.toLocaleString()}w</span>
                    {doc.annotationCount > 0 && (
                      <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                        · {doc.annotationCount}m
                      </span>
                    )}
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => onOpenStoredDocument?.(doc)}
                      className="px-2 py-1 rounded hover:bg-stone-200/60 dark:hover:bg-stone-800 text-[#435c52] dark:text-emerald-400 font-medium cursor-pointer"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(doc.id)}
                      className="p-1 rounded text-stone-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
};
