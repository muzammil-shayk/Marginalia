import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  Settings as SettingsIcon, 
  BookOpen, 
  StickyNote as StickyNoteIcon, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  Highlighter, 
  MessageSquare,
  Bot,
  Zap,
  Lightbulb,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Filter,
  Copy,
  Info,
  Download
} from 'lucide-react';
import { Screen, TransitionType, StickyNote, AISuggestion, UserSettings } from '../types';
import { currentBook, sampleReaderParagraphs, initialStickyNotes } from '../data/mockData';
import { ExportModal } from './ExportModal';

interface ReaderScreenProps {
  settings: UserSettings;
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  isDark?: boolean;
}

export const ReaderScreen: React.FC<ReaderScreenProps> = ({
  settings,
  onNavigate,
  isDark = false
}) => {
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>(initialStickyNotes);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
  const [showNotesDrawer, setShowNotesDrawer] = useState<boolean>(true);
  const [selectedThemeFilter, setSelectedThemeFilter] = useState<string>('All');
  const [highlightedParagraphs, setHighlightedParagraphs] = useState<number[]>([2, 3]);
  
  // Selection Popover State
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionRange, setSelectionRange] = useState<{ x: number; y: number } | null>(null);
  const readerContentRef = useRef<HTMLDivElement>(null);

  // Note Modal state (for both creating & editing)
  const [isNoteModalOpen, setIsNoteModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteFormTitle, setNoteFormTitle] = useState<string>('');
  const [noteFormText, setNoteFormText] = useState<string>('');
  const [noteFormQuote, setNoteFormQuote] = useState<string>('');
  const [noteFormColor, setNoteFormColor] = useState<'yellow' | 'purple' | 'teal' | 'rose'>('yellow');
  const [noteFormTheme, setNoteFormTheme] = useState<string>('Hierarchical Systems');
  const [targetParagraph, setTargetParagraph] = useState<number>(0);
  const [isNoteAiGenerated, setIsNoteAiGenerated] = useState<boolean>(false);

  // AI-Assisted Suggestions Drawer / Panel
  const [isAiPanelOpen, setIsAiPanelOpen] = useState<boolean>(false);
  const [aiFocusMode, setAiFocusMode] = useState<'thematic' | 'metaphor' | 'critique' | 'summary'>('thematic');
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [aiTargetParagraph, setAiTargetParagraph] = useState<number>(0);
  const [aiSource, setAiSource] = useState<string>('');

  // Handle Text Selection for floating toolbar
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setSelectedText('');
        setSelectionRange(null);
        return;
      }

      const text = selection.toString().trim();
      if (text.length > 3) {
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

  // Request AI Suggestions from Gemini Flash
  const fetchAiSuggestions = async (paraIdx: number, customText?: string, mode: 'thematic' | 'metaphor' | 'critique' | 'summary' = aiFocusMode) => {
    setIsLoadingAi(true);
    setIsAiPanelOpen(true);
    setAiTargetParagraph(paraIdx);
    
    const textToAnalyze = customText || sampleReaderParagraphs[paraIdx]?.text || sampleReaderParagraphs.map(p => p.text).join('\n\n');
    const surroundingContext = sampleReaderParagraphs.map((p, i) => `[Para ${i+1}] ${p.text}`).join('\n\n');

    try {
      const res = await fetch('/api/gemini/suggest-annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToAnalyze,
          context: surroundingContext,
          mode,
          activeThemes: settings.activeThemes.map(t => t.name)
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      setAiSuggestions(data.suggestions || []);
      setAiSource(data.source || 'gemini-flash');
    } catch (err) {
      console.warn('AI suggestions call fallback:', err);
      // Clean fallback if offline or unexpected error
      setAiSuggestions([
        {
          title: 'Intermediate Stable Sub-assemblies',
          themeTag: 'Hierarchical Systems',
          quote: textToAnalyze.slice(0, 110) + '...',
          content: 'Modular decomposition allows complex systems to evolve much faster by protecting intermediate progress from catastrophic degradation.',
          color: 'yellow',
          confidence: 0.95,
          rationale: 'Core systems dynamics insight directly from Herbert Simon\'s theorem.'
        },
        {
          title: 'Watchmaker Allegory (Hora & Tempus)',
          themeTag: 'Evolutionary Adaptation',
          quote: textToAnalyze.slice(0, 90) + '...',
          content: 'Hora represents hierarchical modularity which survives disruptions, whereas Tempus represents monolithic fragility.',
          color: 'purple',
          confidence: 0.91,
          rationale: 'Unpacks the systemic allegory of biological and cognitive fitness.'
        }
      ]);
      setAiSource('mock-fallback');
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Open modal to create manual note
  const handleOpenManualNote = (paraIndex: number = 0, quote: string = '') => {
    setEditingNoteId(null);
    setTargetParagraph(paraIndex);
    setNoteFormTitle('');
    setNoteFormText('');
    setNoteFormQuote(quote || selectedText);
    setNoteFormColor('yellow');
    setNoteFormTheme(settings.activeThemes[0]?.name || 'Hierarchical Systems');
    setIsNoteAiGenerated(false);
    setIsNoteModalOpen(true);
    setSelectedText('');
    setSelectionRange(null);
  };

  // Open modal to edit existing note
  const handleEditNote = (note: StickyNote) => {
    setEditingNoteId(note.id);
    setTargetParagraph(note.paragraphIndex);
    setNoteFormTitle(note.title);
    setNoteFormText(note.content);
    setNoteFormQuote(note.quote || '');
    setNoteFormColor(note.color);
    setNoteFormTheme(note.themeTag || 'Hierarchical Systems');
    setIsNoteAiGenerated(Boolean(note.isAiGenerated));
    setIsNoteModalOpen(true);
  };

  // Accept and Pin an AI suggestion directly to margin notes
  const handlePinAiSuggestion = (suggestion: AISuggestion) => {
    const newNote: StickyNote = {
      id: `ai-note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      paragraphIndex: aiTargetParagraph,
      color: suggestion.color,
      title: suggestion.title,
      content: suggestion.content,
      author: 'Gemini Flash AI',
      timestamp: 'Just now',
      themeTag: suggestion.themeTag,
      quote: suggestion.quote,
      isAiGenerated: true,
      confidence: suggestion.confidence,
      rationale: suggestion.rationale
    };

    setStickyNotes((prev) => [newNote, ...prev]);
    // Remove from unpinned suggestions
    setAiSuggestions((prev) => prev.filter((s) => s.title !== suggestion.title));
  };

  // Customize an AI suggestion before pinning
  const handleCustomizeAiSuggestion = (suggestion: AISuggestion) => {
    setEditingNoteId(null);
    setTargetParagraph(aiTargetParagraph);
    setNoteFormTitle(suggestion.title);
    setNoteFormText(suggestion.content);
    setNoteFormQuote(suggestion.quote || '');
    setNoteFormColor(suggestion.color);
    setNoteFormTheme(suggestion.themeTag);
    setIsNoteAiGenerated(true);
    setIsNoteModalOpen(true);
  };

  // Save (Create or Update) note form
  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteFormText.trim()) return;

    if (editingNoteId) {
      // Update existing
      setStickyNotes((prev) =>
        prev.map((n) =>
          n.id === editingNoteId
            ? {
                ...n,
                paragraphIndex: targetParagraph,
                title: noteFormTitle.trim() || 'Reader Note',
                content: noteFormText.trim(),
                quote: noteFormQuote.trim() || undefined,
                color: noteFormColor,
                themeTag: noteFormTheme,
              }
            : n
        )
      );
    } else {
      // Create new manual note
      const newNote: StickyNote = {
        id: `note-${Date.now()}`,
        paragraphIndex: targetParagraph,
        color: noteFormColor,
        title: noteFormTitle.trim() || 'Reader Note',
        content: noteFormText.trim(),
        quote: noteFormQuote.trim() || undefined,
        author: isNoteAiGenerated ? 'Gemini Flash AI (Edited)' : settings.name,
        timestamp: 'Just now',
        themeTag: noteFormTheme,
        isAiGenerated: isNoteAiGenerated
      };
      setStickyNotes((prev) => [newNote, ...prev]);
    }

    setIsNoteModalOpen(false);
  };

  const handleDeleteNote = (id: string) => {
    setStickyNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const toggleHighlight = (idx: number) => {
    setHighlightedParagraphs((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const filteredNotes = selectedThemeFilter === 'All'
    ? stickyNotes
    : stickyNotes.filter((n) => n.themeTag === selectedThemeFilter);

  const getNoteColorClass = (color: StickyNote['color']) => {
    switch (color) {
      case 'yellow':
        return 'bg-[#fef9c3] dark:bg-[#3d381e] border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-100';
      case 'purple':
        return 'bg-[#f3e8ff] dark:bg-[#341d4c] border-purple-300 dark:border-purple-700/60 text-purple-950 dark:text-purple-100';
      case 'teal':
        return 'bg-[#ccfbf1] dark:bg-[#133d37] border-teal-300 dark:border-teal-700/60 text-teal-950 dark:text-teal-100';
      case 'rose':
        return 'bg-[#ffe4e6] dark:bg-[#431823] border-rose-300 dark:border-rose-700/60 text-rose-950 dark:text-rose-100';
    }
  };

  return (
    <div
      ref={readerContentRef}
      className={`min-h-screen flex flex-col transition-colors ${
        isDark ? 'bg-[#121514] text-stone-100' : 'bg-[#f9f9f7] text-[#1c2321]'
      }`}
    >
      {/* Floating Selection Toolbar for manual & AI annotations */}
      {selectedText && selectionRange && (
        <div
          className="absolute z-50 transform -translate-x-1/2 -translate-y-full mb-2 flex items-center gap-1.5 p-1.5 rounded-2xl bg-stone-900/90 text-white shadow-xl backdrop-blur-md border border-stone-700 text-[12px] animate-in fade-in zoom-in-95 duration-150"
          style={{ left: `${selectionRange.x}px`, top: `${selectionRange.y}px` }}
        >
          {/* Manual Annotation Trigger */}
          <button
            type="button"
            onClick={() => handleOpenManualNote(activeParagraphIndex || 0, selectedText)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-white/20 font-medium transition-colors cursor-pointer"
          >
            <StickyNoteIcon className="w-3.5 h-3.5 text-amber-300" />
            <span>Manual Note</span>
          </button>

          {/* AI-Assisted Annotation Trigger */}
          <button
            type="button"
            onClick={() => fetchAiSuggestions(activeParagraphIndex || 0, selectedText, 'thematic')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-[#435c52] hover:from-emerald-500 hover:to-[#4e6b5f] text-white font-semibold transition-all cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span>AI Suggest (Flash)</span>
          </button>

          {/* Export button in selection toolbar */}
          <button
            type="button"
            onClick={() => {
              setIsExportModalOpen(true);
              setSelectedText('');
              setSelectionRange(null);
            }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl hover:bg-white/20 text-stone-200 hover:text-white font-medium transition-colors cursor-pointer"
            title="Export annotations"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (activeParagraphIndex !== null) toggleHighlight(activeParagraphIndex);
              setSelectedText('');
              setSelectionRange(null);
            }}
            className="p-1.5 rounded-xl hover:bg-white/20 text-stone-300 hover:text-white transition-colors"
            title="Highlight selection"
          >
            <Highlighter className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Reader Navigation Bar */}
      <header className={`sticky top-0 z-40 px-4 py-3 border-b flex items-center justify-between backdrop-blur-md transition-colors ${
        isDark ? 'bg-[#121514]/90 border-stone-800' : 'bg-[#f9f9f7]/90 border-stone-200/80'
      }`}>
        <div className="flex items-center gap-2">
          {/* Library Button (xpath: //button[contains(., 'Library')]) */}
          <button
            id="reader-back-library-btn"
            type="button"
            onClick={() => onNavigate('home', 'push_back')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium text-stone-700 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Library</span>
          </button>
        </div>

        {/* Title center */}
        <div className="text-center truncate px-2 max-w-[200px]">
          <h1 className="font-serif text-[14px] font-bold truncate text-stone-900 dark:text-white">
            {currentBook.title}
          </h1>
          <p className="text-[10px] text-stone-500 truncate">
            {currentBook.chapter}
          </p>
        </div>

        {/* Top Right Quick Actions */}
        <div className="flex items-center gap-1.5">
          {/* Export Annotations Button */}
          <button
            id="reader-top-export-btn"
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-200/80 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-[12px] font-semibold transition-colors cursor-pointer shadow-2xs"
            title="Export annotations as PDF, Markdown, or Plain Text"
          >
            <Download className="w-3.5 h-3.5 text-stone-600 dark:text-stone-300" />
            <span>Export</span>
          </button>

          {/* AI-Assisted Suggestion Trigger */}
          <button
            id="reader-top-ai-btn"
            type="button"
            onClick={() => fetchAiSuggestions(activeParagraphIndex || 0)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 hover:bg-emerald-200 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-200 text-[12px] font-semibold transition-colors cursor-pointer shadow-2xs"
            title="Generate AI-Assisted Annotations with Gemini Flash"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>AI Suggest</span>
          </button>

          {/* Analysis Button (xpath: //button[contains(., 'Analysis')]) */}
          <button
            id="reader-top-analysis-btn"
            type="button"
            onClick={() => onNavigate('analysis', 'push')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-100 dark:bg-purple-950/70 hover:bg-purple-200 dark:hover:bg-purple-900 text-purple-900 dark:text-purple-200 text-[12px] font-semibold transition-colors cursor-pointer shadow-2xs"
          >
            <span>Analysis</span>
          </button>

          {/* Settings Button (xpath: //button[contains(., 'Settings')]) */}
          <button
            id="reader-top-settings-btn"
            type="button"
            onClick={() => onNavigate('settings', 'push')}
            className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Settings"
          >
            <span className="sr-only">Settings</span>
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Reader Control Bar: Notes toggle, Filter, and AI Suggestions trigger */}
      <div className={`px-4 sm:px-6 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 text-[12px] ${
        isDark ? 'bg-[#181c1a] border-stone-800/80' : 'bg-[#f2efe9] border-stone-200'
      }`}>
        <div className="flex items-center gap-2">
          {/* Toggle Sticky Notes Drawer */}
          <button
            type="button"
            onClick={() => setShowNotesDrawer(!showNotesDrawer)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              showNotesDrawer
                ? 'bg-[#435c52] text-white'
                : 'bg-black/5 dark:bg-white/5 text-stone-700 dark:text-stone-300'
            }`}
          >
            <StickyNoteIcon className="w-3.5 h-3.5" />
            <span>Sticky Notes ({stickyNotes.length})</span>
          </button>

          {/* Manual Add Note Button */}
          <button
            type="button"
            onClick={() => handleOpenManualNote(activeParagraphIndex || 0)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 text-stone-700 dark:text-stone-300 font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Manual Note</span>
          </button>

          {/* AI-Assisted Suggestions Trigger */}
          <button
            type="button"
            onClick={() => fetchAiSuggestions(activeParagraphIndex || 0)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 font-medium border border-emerald-500/30 transition-colors cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>AI Suggestions (Gemini Flash)</span>
          </button>

          {/* Export Notes Trigger */}
          <button
            id="reader-bar-export-btn"
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 text-stone-700 dark:text-stone-300 font-medium transition-colors cursor-pointer"
            title="Export annotations as PDF, Markdown, or text"
          >
            <Download className="w-3.5 h-3.5 text-[#435c52] dark:text-emerald-400" />
            <span>Export Notes</span>
          </button>
        </div>

        {/* Theme Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-stone-500 font-medium">Filter:</span>
          <select
            value={selectedThemeFilter}
            onChange={(e) => setSelectedThemeFilter(e.target.value)}
            className="text-[11px] font-medium bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-md px-2 py-0.5 text-stone-800 dark:text-stone-200 focus:outline-none"
          >
            <option value="All">All Themes</option>
            {settings.activeThemes.map((t) => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
          <span className="text-[11px] text-stone-400 hidden sm:inline">|</span>
          <div className="text-[11px] text-stone-500 font-medium hidden sm:inline">
            Page 142 / 320 • 44%
          </div>
        </div>
      </div>

      {/* Main Reader View Body */}
      <div className="flex-1 flex max-w-6xl mx-auto w-full">
        {/* Main Reading Text Column */}
        <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-6 space-y-6 pb-28">
          {/* Book Heading */}
          <div className="border-b pb-4 border-stone-200 dark:border-stone-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#435c52] dark:text-[#8baaa0] tracking-wider uppercase block mb-1">
                {currentBook.category}
              </span>
              <span className="text-[11px] text-stone-400">
                Select text to annotate manually or with AI
              </span>
            </div>
            <h2 className="font-serif text-[28px] font-bold leading-tight mb-1 text-stone-900 dark:text-white">
              Nearly Decomposable Systems
            </h2>
            <p className="text-[13px] text-stone-500 dark:text-stone-400">
              By {currentBook.author} • The Sciences of the Artificial
            </p>
          </div>

          {/* Reader Paragraphs with Inline Margin Notes */}
          <div className="space-y-6">
            {sampleReaderParagraphs.map((para, idx) => {
              const notesForThisPara = filteredNotes.filter((n) => n.paragraphIndex === idx);
              const isHighlighted = highlightedParagraphs.includes(idx);

              return (
                <div
                  key={para.id}
                  id={`reader-para-${idx}`}
                  onClick={() => setActiveParagraphIndex(idx)}
                  className={`relative group rounded-xl p-2.5 -mx-2.5 transition-all ${
                    activeParagraphIndex === idx
                      ? 'bg-amber-500/5 ring-1 ring-amber-500/30'
                      : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                  }`}
                >
                  {/* Paragraph Text */}
                  <p
                    className={`leading-relaxed text-stone-800 dark:text-stone-200 transition-all ${
                      isHighlighted ? 'bg-amber-100/60 dark:bg-amber-950/40 rounded-md px-1.5 py-0.5' : ''
                    }`}
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
                    {para.text}
                  </p>

                  {/* Paragraph Action Toolbar (Manual & AI Triggers) */}
                  <div className="mt-2 flex items-center justify-between opacity-75 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-3">
                      {/* Manual Note Trigger */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenManualNote(idx);
                        }}
                        className="text-[11px] font-medium text-stone-600 dark:text-stone-400 hover:text-[#435c52] dark:hover:text-[#98bbae] flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-[#435c52]" />
                        <span>Manual Note</span>
                      </button>

                      {/* AI-Assisted Suggestion for this specific paragraph */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchAiSuggestions(idx, para.text);
                        }}
                        className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-500" />
                        <span>AI Suggestion (Gemini)</span>
                      </button>

                      {/* Highlight Toggle */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleHighlight(idx);
                        }}
                        className="text-[11px] font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Highlighter className="w-3 h-3" />
                        <span>{isHighlighted ? 'Unhighlight' : 'Highlight'}</span>
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
                          className={`p-3.5 rounded-xl border shadow-xs transition-all ${getNoteColorClass(note.color)}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5">
                              {note.isAiGenerated ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-600 text-white shrink-0">
                                  <Sparkles className="w-2.5 h-2.5" /> AI
                                </span>
                              ) : (
                                <StickyNoteIcon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                              )}
                              <h4 className="font-semibold text-[13px] tracking-tight">
                                {note.title}
                              </h4>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {note.themeTag && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10">
                                  {note.themeTag}
                                </span>
                              )}
                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => handleEditNote(note)}
                                className="p-0.5 text-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer"
                                title="Edit note"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              {/* Delete Button */}
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
                              {note.isAiGenerated && <Bot className="w-3 h-3 text-emerald-600" />}
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
          </div>
        </main>

        {/* AI-Assisted Suggestions Side Panel (Desktop & Tablet collapsible) */}
        {isAiPanelOpen && (
          <>
            {/* Desktop / Large Screen Side Panel */}
            <aside className="w-80 border-l border-stone-200 dark:border-stone-800 p-4 space-y-4 hidden lg:block overflow-y-auto max-h-[calc(100vh-120px)] sticky top-16">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-serif font-bold text-[14px]">Gemini Flash Suggestions</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAiPanelOpen(false)}
                  className="text-stone-400 hover:text-stone-700 dark:hover:text-white text-[13px] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* AI Focus Filter Tabs */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-stone-200/70 dark:bg-stone-800 rounded-xl text-[11px] font-medium">
                {(['thematic', 'metaphor', 'critique', 'summary'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setAiFocusMode(m);
                      fetchAiSuggestions(aiTargetParagraph, undefined, m);
                    }}
                    className={`py-1 px-1.5 rounded-lg capitalize transition-colors cursor-pointer ${
                      aiFocusMode === m
                        ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs font-semibold'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Loading Indicator */}
              {isLoadingAi ? (
                <div className="py-8 text-center space-y-3">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#435c52]" />
                  <p className="text-[12px] text-stone-500 font-medium">
                    Analyzing passage with Gemini Flash...
                  </p>
                </div>
              ) : aiSuggestions.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-stone-500 space-y-2">
                  <Info className="w-5 h-5 mx-auto text-stone-400" />
                  <p>No new suggestions. Click &quot;AI Suggest&quot; on any passage to analyze with Gemini Flash.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <span>{aiSuggestions.length} Suggestions</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Gemini 3.7 Flash
                    </span>
                  </div>

                  {aiSuggestions.map((sug, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border shadow-xs transition-all space-y-2 ${getNoteColorClass(sug.color)}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-bold text-[13px] leading-snug">{sug.title}</h4>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 shrink-0">
                          {sug.themeTag}
                        </span>
                      </div>

                      {sug.quote && (
                        <p className="text-[11px] italic opacity-80 border-l-2 border-current pl-2 leading-snug line-clamp-2">
                          &ldquo;{sug.quote}&rdquo;
                        </p>
                      )}

                      <p className="text-[12px] leading-relaxed font-normal">
                        {sug.content}
                      </p>

                      {sug.rationale && (
                        <p className="text-[10px] opacity-75 bg-black/5 dark:bg-white/5 p-1.5 rounded-md">
                          💡 {sug.rationale}
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleCustomizeAiSuggestion(sug)}
                          className="text-[11px] font-medium px-2 py-1 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
                        >
                          Customize
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePinAiSuggestion(sug)}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#435c52] hover:bg-[#374c43] text-white transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Pin to Margin</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </aside>

            {/* Mobile Bottom Sheet / Modal for AI Suggestions */}
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 lg:hidden">
              <div
                className={`w-full max-w-lg max-h-[80vh] flex flex-col rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden transition-all ${
                  isDark ? 'bg-[#1b201d] border-stone-700 text-white' : 'bg-white border-stone-200 text-stone-900'
                }`}
              >
                <div className="p-4 border-b flex items-center justify-between border-stone-200 dark:border-stone-800">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <h3 className="font-serif font-bold text-[15px]">Gemini Flash AI Suggestions</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAiPanelOpen(false)}
                    className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {/* Mobile Filter Tabs */}
                <div className="p-3 border-b border-stone-100 dark:border-stone-800/60 grid grid-cols-4 gap-1 text-[11px]">
                  {(['thematic', 'metaphor', 'critique', 'summary'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setAiFocusMode(m);
                        fetchAiSuggestions(aiTargetParagraph, undefined, m);
                      }}
                      className={`py-1.5 rounded-lg capitalize text-center transition-all ${
                        aiFocusMode === m
                          ? 'bg-[#435c52] text-white font-semibold shadow-xs'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {/* Mobile Suggestions Content */}
                <div className="p-4 overflow-y-auto space-y-3 flex-1">
                  {isLoadingAi ? (
                    <div className="py-8 text-center space-y-3">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#435c52]" />
                      <p className="text-[12px] text-stone-500">Generating AI annotations...</p>
                    </div>
                  ) : aiSuggestions.length === 0 ? (
                    <div className="py-6 text-center text-[12px] text-stone-500">
                      No suggestions yet. Select an excerpt and click AI Suggest.
                    </div>
                  ) : (
                    aiSuggestions.map((sug, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-2xl border space-y-2 ${getNoteColorClass(sug.color)}`}
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="font-bold text-[13px]">{sug.title}</h4>
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10">
                            {sug.themeTag}
                          </span>
                        </div>
                        {sug.quote && (
                          <p className="text-[11px] italic opacity-80 border-l-2 border-current pl-2">
                            &ldquo;{sug.quote}&rdquo;
                          </p>
                        )}
                        <p className="text-[12px]">{sug.content}</p>
                        {sug.rationale && (
                          <p className="text-[10px] opacity-75 bg-black/5 dark:bg-white/5 p-1.5 rounded-md">
                            💡 {sug.rationale}
                          </p>
                        )}
                        <div className="pt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAiPanelOpen(false);
                              handleCustomizeAiSuggestion(sug);
                            }}
                            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10"
                          >
                            Customize
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handlePinAiSuggestion(sug);
                              setIsAiPanelOpen(false);
                            }}
                            className="text-[11px] font-semibold px-3 py-1 rounded-lg bg-[#435c52] text-white flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Pin Note</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Reader Bottom Action Bar & Navigation */}
      <footer className={`fixed bottom-0 left-0 right-0 z-40 border-t px-6 py-3 backdrop-blur-lg transition-colors ${
        isDark ? 'bg-[#121514]/95 border-stone-800' : 'bg-[#f9f9f7]/95 border-stone-200'
      }`}>
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          {/* Library Button (xpath: //button[contains(., 'Library')]) */}
          <button
            id="reader-bottom-library-btn"
            type="button"
            onClick={() => onNavigate('home', 'push_back')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-stone-200/70 hover:bg-stone-300/80 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium text-[13px] transition-all cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>Library</span>
          </button>

          {/* AI Suggestions Drawer Button for Mobile/Tablet */}
          <button
            id="reader-bottom-ai-btn"
            type="button"
            onClick={() => {
              setIsAiPanelOpen(true);
              fetchAiSuggestions(activeParagraphIndex || 0);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-[13px] transition-all cursor-pointer shadow-xs lg:hidden"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Notes</span>
          </button>

          {/* Analysis Button (xpath: //button[contains(., 'Analysis')]) */}
          <button
            id="reader-bottom-analysis-btn"
            type="button"
            onClick={() => onNavigate('analysis', 'push')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#435c52] hover:bg-[#374c43] text-white font-medium text-[13px] transition-all cursor-pointer shadow-xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>Analysis</span>
          </button>

          {/* Export Button in mobile footer */}
          <button
            id="reader-bottom-export-btn"
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center justify-center p-2.5 rounded-xl bg-stone-200/70 hover:bg-stone-300/80 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 transition-all cursor-pointer"
            aria-label="Export annotations"
            title="Export annotations"
          >
            <Download className="w-4 h-4" />
            <span className="sr-only">Export</span>
          </button>

          {/* Settings Button (xpath: //button[contains(., 'Settings')]) */}
          <button
            id="reader-bottom-settings-btn"
            type="button"
            onClick={() => onNavigate('settings', 'push')}
            className="flex items-center justify-center p-2.5 rounded-xl bg-stone-200/70 hover:bg-stone-300/80 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 transition-all cursor-pointer"
            aria-label="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="sr-only">Settings</span>
          </button>
        </div>
      </footer>

      {/* Manual / Customized Sticky Note Modal Dialog */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border ${
            isDark ? 'bg-[#1b201d] border-stone-700 text-white' : 'bg-white border-stone-200 text-stone-900'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {isNoteAiGenerated ? (
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                ) : (
                  <StickyNoteIcon className="w-4 h-4 text-[#435c52]" />
                )}
                <h3 className="font-serif font-bold text-[17px]">
                  {editingNoteId ? 'Edit Sticky Note' : isNoteAiGenerated ? 'AI Annotation Editor' : 'Add Manual Sticky Note'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNoteModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-4">
              {/* Note Title */}
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

              {/* Theme Tag Selection */}
              <div>
                <label className="text-[12px] font-semibold text-stone-500 dark:text-stone-400 block mb-1">
                  Theme Tag
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {settings.activeThemes.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setNoteFormTheme(theme.name)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                        noteFormTheme === theme.name
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

              {/* Sticky Color Picker */}
              <div>
                <label className="text-[12px] font-semibold text-stone-500 dark:text-stone-400 block mb-1">
                  Sticky Color
                </label>
                <div className="flex items-center gap-3">
                  {(['yellow', 'purple', 'teal', 'rose'] as const).map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNoteFormColor(color)}
                      className={`w-7 h-7 rounded-full transition-transform border ${
                        color === 'yellow'
                          ? 'bg-amber-200 border-amber-400'
                          : color === 'purple'
                            ? 'bg-purple-200 border-purple-400'
                            : color === 'teal'
                              ? 'bg-teal-200 border-teal-400'
                              : 'bg-rose-200 border-rose-400'
                      } ${noteFormColor === color ? 'scale-125 ring-2 ring-stone-900 dark:ring-white' : 'opacity-70'}`}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Quoted Text Excerpt (optional) */}
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

              {/* Note Content */}
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

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#435c52] hover:bg-[#374c43] text-white font-medium text-[13px] transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingNoteId ? 'Update Note' : 'Pin Note'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Export Annotations Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        notes={stickyNotes}
        settings={settings}
        bookTitle={currentBook.title}
        bookAuthor={currentBook.author}
        bookChapter={currentBook.chapter}
        isDark={isDark}
      />
    </div>
  );
};
