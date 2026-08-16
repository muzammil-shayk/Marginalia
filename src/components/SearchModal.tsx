import React, { useState } from 'react';
import { Search, X, BookOpen, Sparkles, FileText, ArrowRight } from 'lucide-react';
import { Screen, TransitionType } from '../types';
interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  isDark?: boolean;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  isDark = false
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/60 backdrop-blur-xs">
      <div className={`w-full max-w-md rounded-3xl p-5 shadow-2xl border ${
        isDark ? 'bg-[#1b201d] border-stone-700 text-white' : 'bg-white border-stone-200 text-stone-900'
      }`}>
        <div className="flex items-center gap-3 pb-3 border-b border-stone-200 dark:border-stone-800">
          <Search className="w-5 h-5 text-stone-400" />
          <input
            type="text"
            placeholder="Search themes, books, notes, or passages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-[14px] focus:outline-none placeholder-stone-400"
            autoFocus
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick navigation */}
        <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
          <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
            Quick Navigation
          </div>

          <div
            onClick={() => {
              onClose();
              onNavigate('reader', 'push');
            }}
            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-[#435c52]" />
              <div>
                <p className="text-[13px] font-medium">Active Reading Session</p>
                <p className="text-[11px] text-stone-400">Open active document text</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400" />
          </div>

          <div
            onClick={() => {
              onClose();
              onNavigate('analysis', 'push');
            }}
            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <div>
                <p className="text-[13px] font-medium">Thematic Analysis Screen</p>
                <p className="text-[11px] text-stone-400">AI Synthesis</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400" />
          </div>

          <div
            onClick={() => {
              onClose();
              onNavigate('upload', 'push');
            }}
            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-[13px] font-medium">Upload & Analyze New Document</p>
                <p className="text-[11px] text-stone-400">PDF, EPUB, TXT, DOCX</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400" />
          </div>
        </div>
      </div>
    </div>
  );
};
