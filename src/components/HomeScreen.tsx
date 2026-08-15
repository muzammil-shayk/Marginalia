import React from 'react';
import { BookOpen, Upload, Clipboard, Sparkles, ArrowRight, BookMarked } from 'lucide-react';
import { Screen, TransitionType } from '../types';
import { libraryBooks, currentBook } from '../data/mockData';

interface HomeScreenProps {
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  isDark?: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  isDark = false
}) => {
  return (
    <main className="flex-1 px-5 py-4 pb-20 max-w-md mx-auto w-full space-y-6">
      {/* Section 1: Continue Reading Card */}
      <section
        id="continue-reading-section"
        className={`rounded-2xl p-5 border transition-all ${
          isDark
            ? 'bg-[#1b201d] border-stone-800 text-stone-100 shadow-md'
            : 'bg-[#f0eee9] border-stone-300/40 text-stone-900 shadow-xs'
        }`}
      >
        <div className="flex items-start justify-between mb-2">
          <span className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
            CONTINUE READING
          </span>
          <div className="bg-[#435c52] p-2 rounded-lg text-white shadow-xs">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        <h2 className="font-serif text-[24px] font-semibold leading-tight mb-2 text-stone-900 dark:text-white">
          {currentBook.title}
        </h2>
        <p className="text-[14px] text-stone-600 dark:text-stone-300 mb-5 leading-snug">
          {currentBook.chapter}
        </p>

        {/* Reading Progress */}
        <div className="space-y-1.5 mb-5">
          <div className="flex justify-between text-[12px] font-medium text-stone-500 dark:text-stone-400">
            <span>Page {currentBook.currentPage} of {currentBook.totalPages}</span>
            <span>{currentBook.progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full bg-stone-300 dark:bg-stone-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#435c52] rounded-full transition-all duration-500"
              style={{ width: `${currentBook.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Resume Reading Button */}
        <button
          id="resume-reading-btn"
          type="button"
          onClick={() => onNavigate('reader', 'push')}
          className="w-full bg-[#435c52] hover:bg-[#374c43] active:scale-[0.99] text-white py-3.5 px-4 rounded-xl font-medium text-[15px] transition-all shadow-xs flex items-center justify-center cursor-pointer"
        >
          Resume Reading
        </button>
      </section>

      {/* Section 2: Quick Action Buttons */}
      <section id="quick-actions-section" className="grid grid-cols-2 gap-3.5">
        <button
          id="upload-document-btn"
          type="button"
          onClick={() => onNavigate('upload', 'slide_up')}
          className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all cursor-pointer ${
            isDark
              ? 'bg-[#1b201d] border-stone-800 text-stone-200 hover:bg-[#232a26]'
              : 'bg-white border-stone-200/70 text-stone-800 hover:bg-stone-50 shadow-xs'
          }`}
        >
          <Upload className="w-5 h-5 text-stone-600 dark:text-stone-300 mb-2" />
          <span className="text-[13px] font-medium">Upload Document</span>
        </button>

        <button
          id="paste-text-btn"
          type="button"
          onClick={() => onNavigate('upload', 'slide_up')}
          className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all cursor-pointer ${
            isDark
              ? 'bg-[#1b201d] border-stone-800 text-stone-200 hover:bg-[#232a26]'
              : 'bg-white border-stone-200/70 text-stone-800 hover:bg-stone-50 shadow-xs'
          }`}
        >
          <Clipboard className="w-5 h-5 text-stone-600 dark:text-stone-300 mb-2" />
          <span className="text-[13px] font-medium">Paste Text</span>
        </button>
      </section>

      {/* Section 3: Recent Insights (Targets xpath: body/main[1]/section[3]/div[2]) */}
      <section id="recent-insights-section" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-[19px] font-semibold text-stone-900 dark:text-white">
            Recent Insights
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('analysis', 'push')}
            className="text-[12px] font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-300 cursor-pointer"
          >
            View All
          </button>
        </div>

        {/* div[2] of section[3]: clicking triggers Thematic Analysis */}
        <div
          id="recent-insights-cards-container"
          onClick={() => onNavigate('analysis', 'none')}
          className="grid grid-cols-2 gap-3 cursor-pointer select-none"
        >
          {/* Card 1: Purple Insight */}
          <div className="bg-[#ede7fa] dark:bg-[#2a2438] p-4 rounded-2xl border border-purple-200/60 dark:border-purple-900/40 flex flex-col justify-between hover:shadow-sm transition-all">
            <div>
              <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 mb-2">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[12px] font-semibold truncate">Metaphors of Illness</span>
              </div>
              <p className="text-[11px] text-stone-700 dark:text-stone-300 line-clamp-3 leading-snug">
                Recurring thematic links between architectural decay...
              </p>
            </div>
            <div className="flex items-center justify-between mt-3 pt-1">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-200/70 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200">
                12 Mentions
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-purple-700 dark:text-purple-300" />
            </div>
          </div>

          {/* Card 2: Neutral Insight */}
          <div className="bg-[#eaebe7] dark:bg-[#222724] p-4 rounded-2xl border border-stone-300/40 dark:border-stone-800 flex flex-col justify-between hover:shadow-sm transition-all">
            <div>
              <div className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300 mb-2">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[12px] font-semibold truncate">Borders & Bou...</span>
              </div>
              <p className="text-[11px] text-stone-600 dark:text-stone-400 line-clamp-3 leading-snug">
                Spatial limitation device for narrati...
              </p>
            </div>
            <div className="flex items-center justify-between mt-3 pt-1">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-300/60 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                8 Mentions
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Library Highlights */}
      <section id="library-highlights-section" className="space-y-3">
        <h3 className="font-serif text-[19px] font-semibold text-stone-900 dark:text-white">
          Library Highlights
        </h3>

        <div className="space-y-3">
          {/* Article 1: Phenomenology of Perception */}
          <article
            id="book-phenomenology-perception"
            onClick={() => onNavigate('reader', 'push')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 hover:shadow-xs ${
              isDark
                ? 'bg-[#1b201d] border-stone-800 hover:bg-[#232a26]'
                : 'bg-white border-stone-200/70 hover:bg-stone-50'
            }`}
          >
            {/* Book Cover Thumbnail */}
            <div className="w-16 h-20 rounded-lg overflow-hidden bg-gradient-to-b from-sky-200 via-slate-200 to-blue-200 shrink-0 shadow-xs flex flex-col justify-between p-1.5 border border-black/5">
              <span className="text-[7px] font-bold text-stone-600 uppercase tracking-tighter">THE DISTANT TIDES</span>
              <div className="h-4 bg-sky-300/50 rounded-xs" />
              <span className="text-[6px] text-stone-500">ELLEN FIELD</span>
            </div>

            {/* Book Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-serif text-[16px] font-semibold text-stone-900 dark:text-white leading-tight mb-1">
                Phenomenology of Perception
              </h4>
              <p className="text-[12px] text-stone-500 dark:text-stone-400 mb-2.5">
                Maurice Merleau-Ponty
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#435c52] text-white tracking-wider">
                  PHILOSOPHY
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 tracking-wider">
                  NEW
                </span>
              </div>
            </div>
          </article>

          {/* Article 2: The Poetics of Space */}
          <article
            id="book-poetics-of-space"
            onClick={() => onNavigate('reader', 'push')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 hover:shadow-xs ${
              isDark
                ? 'bg-[#1b201d] border-stone-800 hover:bg-[#232a26]'
                : 'bg-white border-stone-200/70 hover:bg-stone-50'
            }`}
          >
            {/* Book Cover Thumbnail */}
            <div className="w-16 h-20 rounded-lg overflow-hidden bg-gradient-to-b from-stone-200 via-amber-100 to-emerald-100 shrink-0 shadow-xs flex flex-col justify-between p-1.5 border border-black/5">
              <span className="text-[7px] font-bold text-stone-600 uppercase tracking-tighter">FLORA & SPACE</span>
              <div className="h-4 bg-emerald-200/40 rounded-xs" />
              <span className="text-[6px] text-stone-500">SERENITY STONES</span>
            </div>

            {/* Book Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-serif text-[16px] font-semibold text-stone-900 dark:text-white leading-tight mb-1">
                The Poetics of Space
              </h4>
              <p className="text-[12px] text-stone-500 dark:text-stone-400 mb-2.5">
                Gaston Bachelard
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#435c52] text-white tracking-wider">
                  ARCHITECTURE
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 tracking-wider">
                  ANNOTATIONS: 14
                </span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
};
