/**
 * Thematic analysis reached from the sidebar rather than from a document.
 *
 * The panel itself is the same one the reader and the workspace show — see
 * `ThematicAnalysisView`. What is different here is that no book is open, so the panel opens on
 * its question instead of a button: read a book you have, or look one up by title and edition.
 */

import React from 'react';
import { X } from './icons';
import { ThematicAnalysisView } from './ThematicAnalysisView';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  /** Sends the reader to the upload screen, closing this on the way. */
  onAddDocument?: () => void;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({
  isOpen,
  onClose,
  isDark = false,
  onAddDocument
}) => {
  // Escape closes it, the same as every other dialog in the app.
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md max-h-[80vh] flex flex-col rounded-3xl shadow-2xl border overflow-hidden ${
          isDark ? 'bg-[#1b201d] border-stone-700 text-white' : 'bg-white border-stone-200 text-stone-900'
        }`}
      >
        <div className="flex justify-end px-3 pt-3 pb-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <ThematicAnalysisView
          onAddDocument={
            onAddDocument &&
            (() => {
              onClose();
              onAddDocument();
            })
          }
          className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-4"
        />
      </div>
    </div>
  );
};
