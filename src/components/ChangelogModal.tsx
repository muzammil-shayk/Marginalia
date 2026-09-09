/**
 * Changelog modal for Marginalia.
 *
 * Displays on first launch after an update has been installed, and can also be
 * reopened from Settings. Follows the editorial minimalist-ui and apple-design
 * principles: warm monochrome palette, bespoke typography (serif title, mono badge,
 * clean sans body), spot pastel category tags, and fluid spring animations.
 */

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, ArrowRight, Sparkles } from './icons';
import {
  CHANGELOG_RELEASES,
  getLatestRelease,
  type ChangelogCategory,
  type ReleaseNote
} from '../data/changelog';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  initialVersion?: string;
}

const CATEGORY_STYLES: Record<
  ChangelogCategory,
  { label: string; badgeClass: string }
> = {
  feature: {
    label: 'Feature',
    badgeClass:
      'bg-emerald-50 text-emerald-800 border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50'
  },
  improvement: {
    label: 'Improvement',
    badgeClass:
      'bg-sky-50 text-sky-800 border-sky-200/70 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/50'
  },
  fix: {
    label: 'Fix',
    badgeClass:
      'bg-amber-50 text-amber-800 border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50'
  }
};

export const ChangelogModal: React.FC<ChangelogModalProps> = ({
  isOpen,
  onClose,
  isDark = false,
  initialVersion
}) => {
  const [selectedVersion, setSelectedVersion] = useState<string>(() => {
    return initialVersion || getLatestRelease().version;
  });

  useEffect(() => {
    if (isOpen) {
      if (initialVersion) {
        setSelectedVersion(initialVersion.replace(/^v/, ''));
      } else {
        setSelectedVersion(getLatestRelease().version);
      }
    }
  }, [isOpen, initialVersion]);

  // Keyboard dismiss (Escape)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const activeRelease: ReleaseNote =
    CHANGELOG_RELEASES.find((r) => r.version === selectedVersion) || getLatestRelease();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="changelog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/60 backdrop-blur-xs"
          onClick={onClose}
        >
          <motion.div
            key="changelog-panel"
            role="dialog"
            aria-modal="true"
            aria-label="What's New in Marginalia"
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl border overflow-hidden shadow-2xl ${
              isDark
                ? 'bg-[#171b19] border-stone-800 text-stone-100'
                : 'bg-[#faf9f6] border-stone-200/90 text-stone-900'
            }`}
          >
            {/* Header */}
            <div className="relative px-6 pt-6 pb-4 border-b border-stone-200/80 dark:border-stone-800/80 shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider uppercase text-stone-500 dark:text-stone-400">
                      <Sparkles className="w-3.5 h-3.5 text-[#52796f] dark:text-[#74a89b]" />
                      What's New
                    </span>
                    <span className="text-stone-300 dark:text-stone-700 font-mono text-[11px]">/</span>
                    <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded-md bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                      v{activeRelease.version}
                    </span>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400">
                      {activeRelease.date}
                    </span>
                  </div>
                  <h2 className="font-serif text-2xl sm:text-[26px] font-normal tracking-tight text-stone-900 dark:text-stone-50 leading-snug">
                    {activeRelease.title}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors active:scale-95 cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Version Selector Tabs (if multiple releases exist) */}
              {CHANGELOG_RELEASES.length > 1 && (
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-stone-200/60 dark:border-stone-800/60">
                  <span className="text-[11px] text-stone-500 font-medium">Releases:</span>
                  <div className="flex items-center gap-1.5">
                    {CHANGELOG_RELEASES.map((rel) => {
                      const isActive = rel.version === activeRelease.version;
                      return (
                        <button
                          key={rel.version}
                          type="button"
                          onClick={() => setSelectedVersion(rel.version)}
                          className={`px-2.5 py-1 rounded-lg font-mono text-[11.5px] transition-all cursor-pointer ${
                            isActive
                              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-semibold shadow-xs'
                              : 'bg-stone-200/60 dark:bg-stone-800/70 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
                          }`}
                        >
                          v{rel.version}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Summary Paragraph */}
              <p className="text-[13.5px] leading-relaxed text-stone-600 dark:text-stone-300 font-sans">
                {activeRelease.summary}
              </p>

              {/* Categorized Highlight Cards */}
              <div className="space-y-3">
                <h3 className="text-[11px] font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
                  Highlights & Changes
                </h3>

                <div className="grid grid-cols-1 gap-2.5">
                  {activeRelease.highlights.map((item, idx) => {
                    const meta = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.feature;
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border transition-all ${
                          isDark
                            ? 'bg-[#1d2220]/70 border-stone-800/80 hover:border-stone-700/80'
                            : 'bg-white/85 border-stone-200/80 hover:border-stone-300/90 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-medium border uppercase tracking-wider ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                          <span className="text-[13.5px] font-semibold text-stone-900 dark:text-stone-100">
                            {item.title}
                          </span>
                        </div>
                        <p className="text-[12.5px] text-stone-600 dark:text-stone-300/90 leading-relaxed pl-0.5">
                          {item.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Dock */}
            <div className="px-6 py-4 border-t border-stone-200/80 dark:border-stone-800/80 flex items-center justify-between bg-stone-100/60 dark:bg-[#151817] shrink-0">
              <div className="hidden sm:flex items-center gap-2 text-[11.5px] text-stone-500 dark:text-stone-400">
                <span>Press</span>
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-stone-300/90 dark:border-stone-700 bg-stone-200/70 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300">
                  ESC
                </kbd>
                <span>to close</span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 text-[13px] font-medium transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 shadow-xs ml-auto"
              >
                <span>Continue to Marginalia</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

