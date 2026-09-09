import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Settings as SettingsIcon,
  BookOpen,
  StickyNote as StickyNoteIcon,
  Plus,
  Trash2,
  Edit3,
  Check,
  Highlighter,
  Underline,
  MessageSquare,
  Zap,
  Lightbulb,
  CheckCircle2,
  Sliders,
  Filter,
  Copy,
  Info,
  Download,
  Sparkles,
  X
} from './icons';
import { Screen, TransitionType, StickyNote, UserSettings } from '../types';
import { CustomFormat } from '../utils/documentExporter';
import { HoverTooltip } from './HoverTooltip';
import { ThematicAnalysisView } from './ThematicAnalysisView';
import {
  findParagraphElement,
  getSelectionCharacterOffsetWithin,
  renderHighlightedText,
  toggleFormatRange
} from '../utils/textFormatting';

import {
  exportToPDF,
  generateMarkdown,
  generatePlainText,
  downloadTextFile,
  getFilteredAnnotations,
  ExportOptions
} from '../utils/exportAnnotations';

interface ReaderScreenProps {
  settings: UserSettings;
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  isDark?: boolean;
  documentText?: string;
  documentTitle?: string;
  /** Id in the local document store. Absent for pasted text that was never saved, which is why
   *  the AI tab is hidden rather than disabled in that case — there is nothing for the server to
   *  read. */
  docId?: string;
  /** Notes for the active document, lifted to App so they survive navigating away and back. */
  notes: StickyNote[];
  onNotesChange: (updater: (prev: StickyNote[]) => StickyNote[]) => void;
  /** Inline bold/highlight/underline/circle marks for the active document. */
  formats: CustomFormat[];
  onFormatsChange: (updater: (prev: CustomFormat[]) => CustomFormat[]) => void;
}

const NAMED_NOTE_COLORS = ['yellow', 'purple', 'teal', 'rose'];
const PARA_TEXT_ID_PREFIX = 'reader-para-text-';

export const ReaderScreen: React.FC<ReaderScreenProps> = ({
  settings,
  onNavigate,
  isDark = false,
  documentText,
  documentTitle,
  docId,
  notes,
  onNotesChange,
  formats,
  onFormatsChange
}) => {
  // Derive paragraphs strictly from custom document text
  const displayParagraphs = React.useMemo(() => {
    if (documentText && documentText.trim()) {
      return documentText
        .split(/\n\n+/)
        .map((text, i) => text.trim())
        .filter(text => text.length > 0)
        .map((text, i) => ({ id: `custom-p${i}`, text }));
    }
    return [];
  }, [documentText]);

  const displayTitle = documentTitle || (documentText ? 'Uploaded Document' : 'No Document Selected');
  const displayAuthor = documentText ? 'User Uploaded Text' : '';
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
  const [showNotesDrawer, setShowNotesDrawer] = useState<boolean>(true);
  const [selectedThemeFilter, setSelectedThemeFilter] = useState<string>('All');

  const TAB_INDEXES: Record<'notes' | 'add' | 'export' | 'analysis', number> = {
    notes: 0,
    add: 1,
    export: 2,
    analysis: 3,
  };

  const [activeControlTab, setActiveControlTab] = useState<'notes' | 'add' | 'export' | 'analysis'>('notes');
  const [slideDirection, setSlideDirection] = useState<number>(1);

  const handleSwitchTab = (newTab: 'notes' | 'add' | 'export' | 'analysis') => {
    if (newTab === activeControlTab) return;
    const currentIdx = TAB_INDEXES[activeControlTab];
    const newIdx = TAB_INDEXES[newTab];
    setSlideDirection(newIdx > currentIdx ? 1 : -1);
    setActiveControlTab(newTab);
  };

  const tabVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 80 : -80,
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -80 : 80,
      opacity: 0,
      scale: 0.98,
    }),
  };
  /**
   * The theme new highlights, underlines and notes are stamped with — the same "pick a colour by
   * picking a theme" mechanic the PDF workspace uses (`PdfToolbar`'s theme strip / `activeThemeId`).
   */
  const [activeThemeId, setActiveThemeId] = useState<string | null>(settings.activeThemes[0]?.id ?? null);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
  const themeColor = (themeId: string | null): string =>
    settings.activeThemes.find((t) => t.id === themeId)?.color || '#8b5cf6';

  // Scrolls the "Tagging as" strip so the newly active theme is visible whenever it changes, not
  // just when the reader drags the strip themselves — picking a theme from the floating tooltip
  // should still bring it into view here.
  const themeStripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeThemeId) return;
    const el = themeStripRef.current?.querySelector<HTMLElement>(`[data-theme-id="${activeThemeId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [activeThemeId]);

  // Selection Popover State
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionRange, setSelectionRange] = useState<{ x: number; y: number } | null>(null);
  /** The exact character range the floating tooltip's actions apply to, computed alongside the plain selected text. */
  const [pendingSelection, setPendingSelection] = useState<{ paraIdx: number; start: number; end: number } | null>(null);
  const readerContentRef = useRef<HTMLDivElement>(null);

  // Note Modal state (for both creating & editing)
  const [isNoteModalOpen, setIsNoteModalOpen] = useState<boolean>(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteFormTitle, setNoteFormTitle] = useState<string>('');
  const [noteFormText, setNoteFormText] = useState<string>('');
  const [noteFormQuote, setNoteFormQuote] = useState<string>('');
  const [noteFormThemeId, setNoteFormThemeId] = useState<string | null>(null);
  const [targetParagraph, setTargetParagraph] = useState<number>(0);

  // Handle Text Selection for floating toolbar
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setSelectedText('');
        setSelectionRange(null);
        setPendingSelection(null);
        return;
      }

      const text = selection.toString().trim();
      if (text.length > 3) {
        const found = findParagraphElement(selection.anchorNode, PARA_TEXT_ID_PREFIX);
        const offsets = found ? getSelectionCharacterOffsetWithin(found.element) : null;
        if (!found || !offsets || offsets.start === offsets.end) {
          setPendingSelection(null);
          return;
        }
        setPendingSelection({ paraIdx: found.index, start: offsets.start, end: offsets.end });
        setSelectedText(text);
        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setSelectionRange({
            x: Math.max(16, rect.left + rect.width / 2),
            y: Math.max(10, rect.top - 10 + window.scrollY)
          });
        } catch {
          setSelectionRange(null);
        }
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Open modal to create manual note
  const handleOpenManualNote = (paraIndex: number = 0, quote: string = '') => {
    setEditingNoteId(null);
    setTargetParagraph(paraIndex);
    setNoteFormTitle('');
    setNoteFormText('');
    setNoteFormQuote(quote || selectedText);
    setNoteFormThemeId(activeThemeId);
    setIsNoteModalOpen(true);
    setSelectedText('');
    setSelectionRange(null);
    setPendingSelection(null);
  };

  // Open modal to edit existing note
  const handleEditNote = (note: StickyNote) => {
    setEditingNoteId(note.id);
    setTargetParagraph(note.paragraphIndex);
    setNoteFormTitle(note.title);
    setNoteFormText(note.content);
    setNoteFormQuote(note.quote || '');
    setNoteFormThemeId(note.themeId);
    setIsNoteModalOpen(true);
  };

  // Save (Create or Update) note form
  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteFormText.trim()) return;

    if (editingNoteId) {
      // Update existing
      onNotesChange((prev) =>
        prev.map((n) =>
          n.id === editingNoteId
            ? {
                ...n,
                paragraphIndex: targetParagraph,
                title: noteFormTitle.trim() || 'Reader Note',
                content: noteFormText.trim(),
                quote: noteFormQuote.trim() || undefined,
                color: themeColor(noteFormThemeId),
                themeId: noteFormThemeId,
              }
            : n
        )
      );
    } else {
      // Create new manual note
      const newNote: StickyNote = {
        id: `note-${Date.now()}`,
        paragraphIndex: targetParagraph,
        color: themeColor(noteFormThemeId),
        title: noteFormTitle.trim() || 'Reader Note',
        content: noteFormText.trim(),
        quote: noteFormQuote.trim() || undefined,
        author: settings.name,
        timestamp: 'Just now',
        themeId: noteFormThemeId
      };
      onNotesChange((prev) => [newNote, ...prev]);
    }

    setIsNoteModalOpen(false);
  };

  const handleDeleteNote = (id: string) => {
    onNotesChange((prev) => prev.filter((n) => n.id !== id));
  };

  /** Applies the currently active theme's colour to a highlight or underline over the pending selection. */
  const applyFormatToSelection = (type: 'highlight' | 'underline') => {
    if (!pendingSelection) return;
    const { paraIdx, start, end } = pendingSelection;
    onFormatsChange((prev) => toggleFormatRange(prev, paraIdx, start, end, type, themeColor(activeThemeId), activeThemeId));
    setSelectedText('');
    setSelectionRange(null);
    setPendingSelection(null);
  };

  /** Reassigns an existing note, highlight or underline to a different theme (and its colour). */
  const retagNote = (id: string, themeId: string) => {
    onNotesChange((prev) => prev.map((n) => (n.id === id ? { ...n, themeId, color: themeColor(themeId) } : n)));
  };

  // Notes as scoped by the Export tab's theme filter.
  const exportableNotes = getFilteredAnnotations(notes, selectedThemeFilter);

  // Named palette colors map to Tailwind classes; arbitrary hex colors (e.g. notes pinned
  // from the Analysis Inspection Panel's color picker) fall back to an inline style instead.
  const getNoteColorClass = (color: string) => {
    switch (color) {
      case 'yellow':
        return 'bg-[#fef9c3] dark:bg-[#3d381e] border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-100';
      case 'purple':
        return 'bg-[#f3e8ff] dark:bg-[#341d4c] border-purple-300 dark:border-purple-700/60 text-purple-950 dark:text-purple-100';
      case 'teal':
        return 'bg-[#ccfbf1] dark:bg-[#133d37] border-teal-300 dark:border-teal-700/60 text-teal-950 dark:text-teal-100';
      case 'rose':
        return 'bg-[#ffe4e6] dark:bg-[#431823] border-rose-300 dark:border-rose-700/60 text-rose-950 dark:text-rose-100';
      default:
        return '';
    }
  };

  const getNoteColorStyle = (color: string): React.CSSProperties | undefined => {
    if (NAMED_NOTE_COLORS.includes(color)) return undefined;
    return { backgroundColor: `${color}26`, borderColor: `${color}90`, color: 'inherit' };
  };

  return (
    <div
      ref={readerContentRef}
      className={`min-h-screen flex flex-col transition-colors ${
        isDark ? 'bg-[#121514] text-stone-100' : 'bg-[#f9f9f7] text-[#1c2321]'
      }`}
    >
      {/* Redesigned Floating Selection Glass Tooltip */}
      {selectedText && selectionRange && (
        <div
          className="absolute z-50 transform -translate-x-1/2 -translate-y-full mb-3 flex items-center gap-1 p-1 rounded-full bg-stone-900/95 text-white shadow-2xl backdrop-blur-xl border border-stone-700/80 text-[12px] animate-in fade-in zoom-in-95 duration-150 active:scale-[0.99]"
          style={{ left: `${selectionRange.x}px`, top: `${selectionRange.y}px` }}
        >
          {/* Which theme Highlight/Underline/Note below will file under — reachable here too, so
              switching themes doesn't mean leaving the passage to go find the strip above. */}
          {settings.activeThemes.length > 0 && (
            <>
              {settings.activeThemes.map((theme) => (
                <HoverTooltip key={theme.id} label={theme.name}>
                  <button
                    type="button"
                    onClick={() => setActiveThemeId(theme.id)}
                    className={`w-4 h-4 rounded-full border-2 shrink-0 transition-transform hover:scale-110 cursor-pointer ${
                      activeThemeId === theme.id ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: theme.color }}
                  />
                </HoverTooltip>
              ))}
              <span className="w-px h-3.5 bg-stone-700 mx-0.5" />
            </>
          )}

          <button
            type="button"
            onClick={() => applyFormatToSelection('highlight')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:bg-stone-800 text-stone-200 hover:text-white font-medium transition-all cursor-pointer"
            disabled={!pendingSelection}
          >
            <Highlighter className="w-3.5 h-3.5 shrink-0" style={{ color: themeColor(activeThemeId) }} />
            <span>Highlight</span>
          </button>

          <button
            type="button"
            onClick={() => applyFormatToSelection('underline')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:bg-stone-800 text-stone-200 hover:text-white font-medium transition-all cursor-pointer"
            disabled={!pendingSelection}
          >
            <Underline className="w-3.5 h-3.5 shrink-0" style={{ color: themeColor(activeThemeId) }} />
            <span>Underline</span>
          </button>

          <span className="w-px h-3.5 bg-stone-700 mx-0.5" />

          <button
            type="button"
            onClick={() => {
              handleSwitchTab('add');
              handleOpenManualNote(pendingSelection?.paraIdx ?? activeParagraphIndex ?? 0, selectedText);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:bg-stone-800 text-stone-200 hover:text-white font-medium transition-all cursor-pointer"
          >
            <StickyNoteIcon className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Note</span>
          </button>
        </div>
      )}

      {/* Theme picker — which theme new highlights, underlines and notes are stamped with, the
          same "colour is the theme" mechanic the PDF workspace uses. Scrolls horizontally with
          snap points rather than wrapping once there are more themes than fit in one line. */}
      <div
        ref={themeStripRef}
        className={`px-3 sm:px-6 py-1.5 border-b flex items-center gap-1.5 text-[11px] w-full max-w-full overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:thin] ${
          isDark ? 'bg-[#181c1a] border-stone-800/80' : 'bg-[#f2efe9] border-stone-200'
        }`}
      >
        <span className="font-semibold text-stone-500 dark:text-stone-400 shrink-0">Tagging as</span>
        {settings.activeThemes.map((theme) => (
          <button
            key={theme.id}
            data-theme-id={theme.id}
            type="button"
            onClick={() => setActiveThemeId(theme.id)}
            className={`px-2 py-0.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer shrink-0 snap-start ${
              activeThemeId === theme.id
                ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: theme.color }} />
            <span className="whitespace-nowrap">{theme.name}</span>
          </button>
        ))}
      </div>

      {/* Top Reader Navigation Bar */}
      <header className={`app-drag sticky top-0 z-40 px-3 sm:px-6 h-18 border-b flex items-center justify-between gap-2 backdrop-blur-md transition-colors w-full max-w-full overflow-hidden ${
        isDark ? 'bg-[#121514]/90 border-stone-800' : 'bg-[#f9f9f7]/90 border-stone-200/80'
      }`}>
        {/* Left: Back button and Title tightly grouped */}
        <div className="flex items-center gap-2 min-w-0 max-w-[65%] sm:max-w-md">
          <button
            id="reader-back-library-btn"
            type="button"
            onClick={() => onNavigate('home', 'push_back')}
            className="p-1.5 rounded-xl text-stone-700 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            title="Back to Library"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0 truncate">
            <h1 className="font-serif text-[16px] sm:text-[18px] font-bold truncate text-stone-900 dark:text-white leading-tight">
              {displayTitle}
            </h1>
            <p className="text-[11px] sm:text-[12px] text-stone-500 truncate leading-tight">
              {displayAuthor || 'Active Reading Session'}
            </p>
          </div>
        </div>

        {/* Top Right Quick Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">

          {/* Settings Button */}
          <button
            id="reader-top-settings-btn"
            type="button"
            onClick={() => onNavigate('settings', 'push')}
            className="p-1.5 sm:p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            aria-label="Settings"
          >
            <span className="sr-only">Settings</span>
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Reader Control Bar: Icons First, Active Tab Expands to Pill */}
      <div className={`px-3 sm:px-6 py-2 border-b flex items-center justify-between gap-2 text-[12px] w-full max-w-full overflow-x-auto hide-scrollbar ${
        isDark ? 'bg-[#181c1a] border-stone-800/80' : 'bg-[#f2efe9] border-stone-200'
      }`}>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Notes Toggle Pill */}
          <button
            type="button"
            onClick={() => {
              handleSwitchTab('notes');
              setShowNotesDrawer(!showNotesDrawer);
            }}
            className={`flex items-center gap-1.5 transition-all duration-200 cursor-pointer shrink-0 ${
              activeControlTab === 'notes'
                ? 'bg-[#435c52] text-white px-3 py-1.5 rounded-xl font-semibold shadow-xs animate-in fade-in zoom-in-95'
                : 'p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-stone-700 dark:text-stone-300'
            }`}
            title={`Sticky Notes (${notes.length})`}
          >
            <StickyNoteIcon className="w-4 h-4" />
            {activeControlTab === 'notes' && (
              <span className="whitespace-nowrap animate-in fade-in duration-150">
                Notes ({notes.length})
              </span>
            )}
          </button>

          {/* Add Manual Note Pill */}
          <button
            type="button"
            onClick={() => {
              handleSwitchTab('add');
              handleOpenManualNote(activeParagraphIndex || 0);
            }}
            className={`flex items-center gap-1.5 transition-all duration-200 cursor-pointer shrink-0 ${
              activeControlTab === 'add'
                ? 'bg-[#435c52] text-white px-3 py-1.5 rounded-xl font-semibold shadow-xs animate-in fade-in zoom-in-95'
                : 'p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-stone-700 dark:text-stone-300'
            }`}
            title="Add Manual Note"
          >
            <Plus className="w-4 h-4" />
            {activeControlTab === 'add' && (
              <span className="whitespace-nowrap animate-in fade-in duration-150">
                Add Note
              </span>
            )}
          </button>

          {/* Export Notes Pill */}
          <button
            id="reader-bar-export-btn"
            type="button"
            onClick={() => {
              handleSwitchTab('export');
            }}
            className={`flex items-center gap-1.5 transition-all duration-200 cursor-pointer shrink-0 ${
              activeControlTab === 'export'
                ? 'bg-[#435c52] text-white px-3 py-1.5 rounded-xl font-semibold shadow-xs animate-in fade-in zoom-in-95'
                : 'p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-stone-700 dark:text-stone-300'
            }`}
            title="Export Notes"
          >
            <Download className="w-4 h-4" />
            {activeControlTab === 'export' && (
              <span className="whitespace-nowrap animate-in fade-in duration-150">
                Export Notes
              </span>
            )}
          </button>

          {/* Thematic Analysis Pill — only for documents the server has a copy of. */}
          {docId && (
            <button
              type="button"
              onClick={() => handleSwitchTab('analysis')}
              className={`flex items-center gap-1.5 transition-all duration-200 cursor-pointer shrink-0 ${
                activeControlTab === 'analysis'
                  ? 'bg-[#435c52] text-white px-3 py-1.5 rounded-xl font-semibold shadow-xs animate-in fade-in zoom-in-95'
                  : 'p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-stone-700 dark:text-stone-300'
              }`}
              title="AI Thematic Analysis"
            >
              <Sparkles className="w-4 h-4" />
              {activeControlTab === 'analysis' && (
                <span className="whitespace-nowrap animate-in fade-in duration-150">
                  AI Analysis
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Reader View Body */}
      <div className="flex-1 flex max-w-6xl mx-auto w-full overflow-hidden">
        {/* Main Reading Text Column */}
        <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-6 space-y-6 pb-8">
          <AnimatePresence mode="wait" custom={slideDirection}>
            {/* TAB 1: READING PASSAGES & MARGIN NOTES */}
            {activeControlTab === 'notes' && (
              <motion.div
                key="notes-tab"
                custom={slideDirection}
                variants={tabVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                {/* Centered Document / Book Heading */}
                <div 
                  className={`text-center flex flex-col items-center justify-center space-y-2 ${
                    displayParagraphs.length === 0 
                      ? 'min-h-[60vh]' 
                      : 'border-b pb-6 border-stone-200 dark:border-stone-800'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 flex-wrap text-[11px]">
                    <span className="font-mono font-bold text-[#435c52] dark:text-[#8baaa0] tracking-widest uppercase">
                      {'DOCUMENT'}
                    </span>
                    <span className="text-stone-300 dark:text-stone-700">•</span>
                    <span className="text-stone-500 dark:text-stone-400 italic">
                      Select text to annotate manually or with AI
                    </span>
                  </div>
                  <h2 className="font-serif text-[26px] sm:text-[32px] font-bold leading-tight text-stone-900 dark:text-white">
                    {displayTitle}
                  </h2>
                  {displayAuthor && (
                    <p className="text-[13px] text-stone-500 dark:text-stone-400">
                      {displayAuthor}
                    </p>
                  )}
                </div>

                {displayParagraphs.map((para, idx) => {
                  const notesForThisPara = notes.filter((n) => n.paragraphIndex === idx);
                  const formatsForThisPara = formats.filter((f) => f.paragraphIndex === idx);
                  const noteAnchors = notesForThisPara
                    .filter((n) => n.start !== undefined && n.end !== undefined)
                    .map((n) => ({ id: n.id, start: n.start, end: n.end }));

                  return (
                    <div
                      key={para.id}
                      id={`reader-para-${idx}`}
                      onClick={() => setActiveParagraphIndex(idx)}
                      className={`relative group rounded-xl p-2.5 -mx-2.5 transition-all ${
                        activeParagraphIndex === idx
                          ? 'bg-amber-500/5 ring-1 ring-amber-500/30'
                          : 'hover:bg-black/2 dark:hover:bg-white/2'
                      }`}
                    >
                      {/* Paragraph Text */}
                      <p
                        id={`${PARA_TEXT_ID_PREFIX}${idx}`}
                        className="leading-relaxed text-stone-800 dark:text-stone-200"
                        style={{
                          fontFamily: settings.typography.includes('Newsreader')
                            ? 'Newsreader, Georgia, serif'
                            : settings.typography.includes('Sans')
                              ? 'Plus Jakarta Sans, sans-serif'
                              : 'Literata, Georgia, serif',
                          fontSize: `${settings.fontSize}px`,
                          lineHeight: '1.75'
                        }}
                      >
                        {renderHighlightedText(para.text, formatsForThisPara, noteAnchors, hoveredNoteId, themeColor(activeThemeId))}
                      </p>

                      {/* Paragraph Action Toolbar */}
                      <div className="mt-2 flex items-center justify-between opacity-75 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSwitchTab('add');
                              handleOpenManualNote(idx);
                            }}
                            className="text-[11px] font-medium text-stone-600 dark:text-stone-400 hover:text-[#435c52] dark:hover:text-[#98bbae] flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-[#435c52]" />
                            <span>Manual Note</span>
                          </button>
                        </div>

                        {notesForThisPara.length > 0 && (
                          <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/60 px-2 py-0.5 rounded-full">
                            {notesForThisPara.length} {notesForThisPara.length === 1 ? 'annotation' : 'annotations'}
                          </span>
                        )}
                      </div>

                      {/* Inline Sticky Notes pinned to this paragraph */}
                      {showNotesDrawer && notesForThisPara.length > 0 && (
                        <div className="mt-3 space-y-2.5 pl-3 border-l-2 border-[#435c52]/40">
                          {notesForThisPara.map((note) => (
                            <div
                              key={note.id}
                              id={`sticky-note-${note.id}`}
                              onMouseEnter={() => setHoveredNoteId(note.id)}
                              onMouseLeave={() => setHoveredNoteId((prev) => (prev === note.id ? null : prev))}
                              className={`p-3.5 rounded-xl border shadow-xs transition-all ${getNoteColorClass(note.color) || 'text-stone-900 dark:text-stone-100'}`}
                              style={getNoteColorStyle(note.color)}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <StickyNoteIcon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                                  <h4 className="font-semibold text-[13px] tracking-tight">
                                    {note.title}
                                  </h4>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {/* Retag: click a theme's dot to re-file this note under it. */}
                                  <div className="flex items-center gap-1">
                                    {settings.activeThemes.map((theme) => (
                                      <HoverTooltip key={theme.id} label={theme.name}>
                                        <button
                                          type="button"
                                          onClick={() => retagNote(note.id, theme.id)}
                                          className={`w-2.5 h-2.5 rounded-full shrink-0 cursor-pointer transition-transform ${
                                            note.themeId === theme.id
                                              ? 'ring-2 ring-offset-1 ring-stone-900 dark:ring-white scale-110'
                                              : 'opacity-50 hover:opacity-90'
                                          }`}
                                          style={{ backgroundColor: theme.color }}
                                        />
                                      </HoverTooltip>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleEditNote(note);
                                      handleSwitchTab('add');
                                    }}
                                    className="p-0.5 text-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer"
                                    title="Edit note"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNote(note.id)}
                                    className="p-0.5 text-stone-500 hover:text-red-600 transition-colors cursor-pointer"
                                    title="Delete note"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {note.quote && (
                                <div className="text-[11px] italic opacity-80 border-l-2 border-current pl-2 my-1.5 leading-snug">
                                  &ldquo;{note.quote}&rdquo;
                                </div>
                              )}

                              <p className="text-[12px] leading-relaxed mb-2 font-normal">
                                {note.content}
                              </p>

                              <div className="flex items-center justify-between text-[10px] opacity-75 pt-1 border-t border-black/10 dark:border-white/10">
                                <span className="font-medium flex items-center gap-1">
                                  {note.author}
                                </span>
                                <span>{note.timestamp}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}

            {/* TAB 2: INLINE ADD / EDIT STICKY NOTE WORKSPACE */}
            {activeControlTab === 'add' && (
              <motion.div
                key="add-tab"
                custom={slideDirection}
                variants={tabVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="py-2 space-y-4"
              >
                <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
                  <div className="flex items-center gap-2">
                    <StickyNoteIcon className="w-5 h-5 text-[#435c52]" />
                    <h3 className="font-serif font-bold text-[17px] text-stone-900 dark:text-white">
                      {editingNoteId ? 'Edit Sticky Note' : 'Add Manual Sticky Note'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSwitchTab('notes')}
                    className="text-[12px] font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Reading</span>
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    handleSaveNote(e);
                    handleSwitchTab('notes');
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-[12px] font-semibold text-stone-500 dark:text-stone-400 block mb-1">
                      Note Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Hierarchical Modularity or Key Reflection"
                      value={noteFormTitle}
                      onChange={(e) => setNoteFormTitle(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-[13px] border focus:outline-none focus:ring-1 focus:ring-[#435c52] ${
                        isDark ? 'bg-[#151917] border-stone-700 text-white' : 'bg-stone-50 border-stone-300 text-stone-900'
                      }`}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-[12px] font-semibold text-stone-500 dark:text-stone-400 block mb-1">
                      Theme — also sets this note's colour
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {settings.activeThemes.map((theme) => (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setNoteFormThemeId(theme.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                            noteFormThemeId === theme.id
                              ? 'bg-[#435c52] text-white shadow-xs'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: theme.color }}
                          />
                          <span>{theme.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] font-semibold text-stone-500 dark:text-stone-400 block mb-1">
                      Quoted Excerpt (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Selected or reference quote..."
                      value={noteFormQuote}
                      onChange={(e) => setNoteFormQuote(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-[12px] border italic focus:outline-none focus:ring-1 focus:ring-[#435c52] ${
                        isDark ? 'bg-[#151917] border-stone-700 text-stone-300' : 'bg-stone-50 border-stone-300 text-stone-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-[12px] font-semibold text-stone-500 dark:text-stone-400 block mb-1">
                      Annotation / Reflection
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Write your note, critique, or synthesis..."
                      value={noteFormText}
                      onChange={(e) => setNoteFormText(e.target.value)}
                      className={`w-full p-3 rounded-xl text-[13px] leading-relaxed resize-none border focus:outline-none focus:ring-1 focus:ring-[#435c52] ${
                        isDark ? 'bg-[#151917] border-stone-700 text-white' : 'bg-stone-50 border-stone-300 text-stone-900'
                      }`}
                      required
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => handleSwitchTab('notes')}
                      className="px-4 py-2 rounded-xl text-[13px] font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#435c52] hover:bg-[#374c43] text-white font-medium text-[13px] transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>{editingNoteId ? 'Update Note' : 'Pin Note to Margin'}</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* TAB 4: INLINE EXPORT WORKSPACE */}
            {activeControlTab === 'export' && (
              <motion.div
                key="export-tab"
                custom={slideDirection}
                variants={tabVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="py-2 space-y-5"
              >
                <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-stone-800">
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-[#435c52]" />
                    <h3 className="font-serif font-bold text-[17px] text-stone-900 dark:text-white">
                      Export Annotations
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSwitchTab('notes')}
                    className="text-[12px] font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Reading</span>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-stone-100 dark:bg-stone-800/60 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-[14px] text-stone-900 dark:text-white">
                        {displayTitle}
                      </h4>
                      <p className="text-[12px] text-stone-500">
                        {exportableNotes.length} of {notes.length} annotations match the filters below
                      </p>
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#435c52] text-white">
                      {exportableNotes.length} Notes
                    </span>
                  </div>

                  {/* Filter Controls */}
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {[{ id: 'All', name: 'All' }, ...settings.activeThemes].map((theme) => (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setSelectedThemeFilter(theme.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                            selectedThemeFilter === theme.id
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
                          }`}
                        >
                          {theme.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      disabled={exportableNotes.length === 0}
                      onClick={() => {
                        const opts: ExportOptions = {
                          bookTitle: displayTitle,
                          bookAuthor: displayAuthor,
                          themeFilter: selectedThemeFilter,
          themes: settings.activeThemes,
                          format: 'pdf',
                          includeQuotes: true
                        };
                        exportToPDF(exportableNotes, opts);
                      }}
                      className="p-4 rounded-2xl border border-stone-200 dark:border-stone-700 hover:border-[#435c52] dark:hover:border-emerald-500 text-left space-y-2 transition-all cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-stone-200 dark:disabled:hover:border-stone-700"
                    >
                      <Download className="w-5 h-5 text-[#435c52] group-hover:scale-110 transition-transform" />
                      <div>
                        <div className="font-bold text-[13px]">Download PDF</div>
                        <div className="text-[11px] text-stone-500">Printable document</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={exportableNotes.length === 0}
                      onClick={() => {
                        const opts: ExportOptions = {
                          bookTitle: displayTitle,
                          bookAuthor: displayAuthor,
                          themeFilter: selectedThemeFilter,
          themes: settings.activeThemes,
                          format: 'markdown',
                          includeQuotes: true
                        };
                        const content = generateMarkdown(exportableNotes, opts);
                        downloadTextFile(content, `${displayTitle}-annotations.md`, 'text/markdown');
                      }}
                      className="p-4 rounded-2xl border border-stone-200 dark:border-stone-700 hover:border-[#435c52] dark:hover:border-emerald-500 text-left space-y-2 transition-all cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-stone-200 dark:disabled:hover:border-stone-700"
                    >
                      <Download className="w-5 h-5 text-[#435c52] group-hover:scale-110 transition-transform" />
                      <div>
                        <div className="font-bold text-[13px]">Markdown (.md)</div>
                        <div className="text-[11px] text-stone-500">For Obsidian / Notion</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={exportableNotes.length === 0}
                      onClick={() => {
                        const opts: ExportOptions = {
                          bookTitle: displayTitle,
                          bookAuthor: displayAuthor,
                          themeFilter: selectedThemeFilter,
          themes: settings.activeThemes,
                          format: 'txt',
                          includeQuotes: true
                        };
                        const content = generatePlainText(exportableNotes, opts);
                        downloadTextFile(content, `${displayTitle}-annotations.txt`, 'text/plain');
                      }}
                      className="p-4 rounded-2xl border border-stone-200 dark:border-stone-700 hover:border-[#435c52] dark:hover:border-emerald-500 text-left space-y-2 transition-all cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-stone-200 dark:disabled:hover:border-stone-700"
                    >
                      <Download className="w-5 h-5 text-[#435c52] group-hover:scale-110 transition-transform" />
                      <div>
                        <div className="font-bold text-[13px]">Plain Text (.txt)</div>
                        <div className="text-[11px] text-stone-500">Universal text file</div>
                      </div>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 4: AI THEMATIC ANALYSIS */}
            {activeControlTab === 'analysis' && docId && (
              <motion.div
                key="analysis-tab"
                custom={slideDirection}
                variants={tabVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <ThematicAnalysisView
                  docId={docId}
                  documentTitle={displayTitle}
                  className="space-y-4"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};
