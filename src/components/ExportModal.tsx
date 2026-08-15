import React, { useState } from 'react';
import { 
  Download, 
  FileText, 
  FileCode, 
  File, 
  Copy, 
  Check, 
  X, 
  Sparkles, 
  StickyNote as StickyNoteIcon, 
  Filter, 
  Sliders, 
  Eye, 
  BookOpen
} from 'lucide-react';
import { StickyNote, UserSettings } from '../types';
import { 
  exportToPDF, 
  generateMarkdown, 
  generatePlainText, 
  downloadTextFile, 
  getFilteredAnnotations,
  ExportOptions 
} from '../utils/exportAnnotations';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: StickyNote[];
  settings: UserSettings;
  bookTitle: string;
  bookAuthor: string;
  bookChapter?: string;
  isDark?: boolean;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  notes,
  settings,
  bookTitle,
  bookAuthor,
  bookChapter,
  isDark = false,
}) => {
  const [format, setFormat] = useState<'pdf' | 'markdown' | 'txt'>('pdf');
  const [filterType, setFilterType] = useState<'all' | 'manual' | 'ai'>('all');
  const [themeFilter, setThemeFilter] = useState<string>('All');
  const [includeQuotes, setIncludeQuotes] = useState<boolean>(true);
  const [includeAiDetails, setIncludeAiDetails] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'options' | 'preview'>('options');

  if (!isOpen) return null;

  const filteredNotes = getFilteredAnnotations(notes, filterType, themeFilter);
  const manualCount = filteredNotes.filter((n) => !n.isAiGenerated).length;
  const aiCount = filteredNotes.filter((n) => n.isAiGenerated).length;

  const exportOptions: ExportOptions = {
    bookTitle,
    bookAuthor,
    bookChapter,
    filterType,
    themeFilter,
    format,
    includeQuotes,
    includeAiDetails,
  };

  const handleDownload = () => {
    setIsExporting(true);
    try {
      if (format === 'pdf') {
        exportToPDF(filteredNotes, exportOptions);
      } else if (format === 'markdown') {
        const content = generateMarkdown(filteredNotes, exportOptions);
        downloadTextFile(content, `marginalia-notes-${sanitizeName(bookTitle)}.md`, 'text/markdown');
      } else {
        const content = generatePlainText(filteredNotes, exportOptions);
        downloadTextFile(content, `marginalia-notes-${sanitizeName(bookTitle)}.txt`, 'text/plain');
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setTimeout(() => setIsExporting(false), 600);
    }
  };

  const handleCopyClipboard = () => {
    const content = format === 'markdown' 
      ? generateMarkdown(filteredNotes, exportOptions)
      : generatePlainText(filteredNotes, exportOptions);
    
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sanitizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/gi, '-').slice(0, 25);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all ${
          isDark ? 'bg-[#1b201d] border-stone-700 text-white' : 'bg-white border-stone-200 text-stone-900'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#435c52]/15 text-[#435c52] dark:text-[#8baaa0] flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-[18px] font-bold">Export Annotations</h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {bookTitle} • {filteredNotes.length} notes selected
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs (Options vs Live Preview) */}
        <div className="px-6 pt-3 flex items-center gap-2 border-b border-stone-100 dark:border-stone-800/60 text-[12px]">
          <button
            type="button"
            onClick={() => setActiveTab('options')}
            className={`pb-2.5 px-2 font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'options'
                ? 'border-[#435c52] text-[#435c52] dark:text-emerald-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Export Configuration</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 px-2 font-semibold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'preview'
                ? 'border-[#435c52] text-[#435c52] dark:text-emerald-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Live Preview ({filteredNotes.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-[13px]">
          {activeTab === 'options' ? (
            <>
              {/* Format Chooser */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase block">
                  Select Export Format
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {/* PDF option */}
                  <button
                    type="button"
                    onClick={() => setFormat('pdf')}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      format === 'pdf'
                        ? 'border-[#435c52] bg-[#435c52]/10 ring-1 ring-[#435c52]'
                        : 'border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/40 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      {format === 'pdf' && <Check className="w-4 h-4 text-[#435c52] dark:text-emerald-400" />}
                    </div>
                    <span className="font-semibold text-stone-900 dark:text-white block">PDF Document</span>
                    <span className="text-[10px] text-stone-500">Formatted pages with cards & badges</span>
                  </button>

                  {/* Markdown option */}
                  <button
                    type="button"
                    onClick={() => setFormat('markdown')}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      format === 'markdown'
                        ? 'border-[#435c52] bg-[#435c52]/10 ring-1 ring-[#435c52]'
                        : 'border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/40 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <FileCode className="w-4 h-4" />
                      </div>
                      {format === 'markdown' && <Check className="w-4 h-4 text-[#435c52] dark:text-emerald-400" />}
                    </div>
                    <span className="font-semibold text-stone-900 dark:text-white block">Markdown (.md)</span>
                    <span className="text-[10px] text-stone-500">Structured headers & blockquotes</span>
                  </button>

                  {/* Text file option */}
                  <button
                    type="button"
                    onClick={() => setFormat('txt')}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      format === 'txt'
                        ? 'border-[#435c52] bg-[#435c52]/10 ring-1 ring-[#435c52]'
                        : 'border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/40 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <File className="w-4 h-4" />
                      </div>
                      {format === 'txt' && <Check className="w-4 h-4 text-[#435c52] dark:text-emerald-400" />}
                    </div>
                    <span className="font-semibold text-stone-900 dark:text-white block">Plain Text (.txt)</span>
                    <span className="text-[10px] text-stone-500">Universal ASCII format</span>
                  </button>
                </div>
              </div>

              {/* Annotation Type Filter */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase block">
                  Annotation Scope
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className={`py-2 px-3 rounded-xl border text-center font-medium text-[12px] transition-all cursor-pointer ${
                      filterType === 'all'
                        ? 'bg-[#435c52] text-white border-[#435c52] shadow-xs'
                        : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    All Notes ({notes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('manual')}
                    className={`py-2 px-3 rounded-xl border text-center font-medium text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      filterType === 'manual'
                        ? 'bg-[#435c52] text-white border-[#435c52] shadow-xs'
                        : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <StickyNoteIcon className="w-3.5 h-3.5 text-amber-500" />
                    <span>Manual ({notes.filter(n => !n.isAiGenerated).length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('ai')}
                    className={`py-2 px-3 rounded-xl border text-center font-medium text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      filterType === 'ai'
                        ? 'bg-[#435c52] text-white border-[#435c52] shadow-xs'
                        : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    <span>AI Only ({notes.filter(n => n.isAiGenerated).length})</span>
                  </button>
                </div>
              </div>

              {/* Theme Filter Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase block">
                  Filter By Theme Tag
                </label>
                <select
                  value={themeFilter}
                  onChange={(e) => setThemeFilter(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-[#435c52] ${
                    isDark ? 'bg-[#151917] border-stone-700 text-white' : 'bg-stone-50 border-stone-300 text-stone-900'
                  }`}
                >
                  <option value="All">All Themes ({notes.length} total notes)</option>
                  {settings.activeThemes.map((t) => {
                    const count = notes.filter(n => n.themeTag === t.name).length;
                    return (
                      <option key={t.id} value={t.name}>
                        {t.name} ({count} notes)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Additional Options */}
              <div className="space-y-2.5 pt-2 border-t border-stone-200 dark:border-stone-800">
                <label className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase block">
                  Content Inclusion Options
                </label>
                
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeQuotes}
                    onChange={(e) => setIncludeQuotes(e.target.checked)}
                    className="w-4 h-4 rounded text-[#435c52] focus:ring-[#435c52] accent-[#435c52]"
                  />
                  <span className="text-[13px] text-stone-700 dark:text-stone-300">
                    Include highlighted document passage excerpts
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeAiDetails}
                    onChange={(e) => setIncludeAiDetails(e.target.checked)}
                    className="w-4 h-4 rounded text-[#435c52] focus:ring-[#435c52] accent-[#435c52]"
                  />
                  <span className="text-[13px] text-stone-700 dark:text-stone-300">
                    Include AI confidence scores and rationale details
                  </span>
                </label>
              </div>
            </>
          ) : (
            /* Live Preview Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-stone-500">
                <span>PREVIEWING {filteredNotes.length} ANNOTATION(S)</span>
                <span>{manualCount} Manual • {aiCount} AI-Assisted</span>
              </div>

              {filteredNotes.length === 0 ? (
                <div className="py-12 text-center text-stone-400">
                  No annotations match the current filters.
                </div>
              ) : (
                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                  {filteredNotes.map((note, idx) => (
                    <div
                      key={note.id}
                      className="p-3.5 rounded-2xl border bg-stone-50/80 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-stone-900 dark:text-white text-[13px]">
                          {idx + 1}. {note.title}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            note.isAiGenerated
                              ? 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-300'
                              : 'bg-amber-600/15 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {note.isAiGenerated ? '✨ AI-Assisted' : '✍️ Manual'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-stone-500">
                        <span>{note.themeTag}</span>
                        <span>•</span>
                        <span>{note.timestamp}</span>
                      </div>

                      {includeQuotes && note.quote && (
                        <p className="text-[12px] italic text-stone-600 dark:text-stone-300 bg-stone-200/50 dark:bg-stone-900/60 p-2 rounded-lg border-l-2 border-[#435c52]">
                          &ldquo;{note.quote}&rdquo;
                        </p>
                      )}

                      <p className="text-[12px] text-stone-700 dark:text-stone-300">
                        {note.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Copy to Clipboard (for MD and TXT) */}
            <button
              type="button"
              onClick={handleCopyClipboard}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 text-[12px] font-medium transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-stone-500 hover:text-stone-800 dark:hover:text-white text-[12px] font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              id="confirm-export-download-btn"
              type="button"
              onClick={handleDownload}
              disabled={filteredNotes.length === 0 || isExporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#435c52] hover:bg-[#374c43] text-white font-semibold text-[13px] shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>
                {isExporting ? 'Exporting...' : `Export as ${format.toUpperCase()}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
