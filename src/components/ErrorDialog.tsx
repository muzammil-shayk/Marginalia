/**
 * The app's one error dialog.
 *
 * Errors used to appear as inline banners tucked into whichever screen produced them, which is
 * fine for a validation hint and wrong for a failure the reader has to act on — a banner above
 * the fold of a scrolled page is a failure nobody sees. This blocks instead, states what happened
 * in a sentence someone can act on, and offers only the actions that make sense:
 *
 *   - `onRetry` given: **Dismiss** and **Retry**, for failures that clear on their own — a rate
 *     limit, an overloaded model, a dropped connection.
 *   - `onRetry` absent: **OK**, for everything that will fail identically until something changes.
 */

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorDialogProps {
  open: boolean;
  /** A short noun phrase for what failed, e.g. "Analysis failed". */
  title?: string;
  message: string;
  onClose: () => void;
  /** Supplied only when trying again could plausibly work. Adds the Retry button. */
  onRetry?: () => void;
}

export const ErrorDialog: React.FC<ErrorDialogProps> = ({
  open,
  title = 'Something went wrong',
  message,
  onClose,
  onRetry
}) => {
  const primaryRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    // Focus the safe action, so Enter dismisses rather than silently repeating a failed request.
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-dialog-title"
        aria-describedby="error-dialog-message"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl p-5 shadow-2xl border space-y-4 bg-white border-stone-200 text-stone-900 dark:bg-[#1b201d] dark:border-stone-700 dark:text-white"
      >
        <div className="flex gap-3">
          <span className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center bg-red-500/12 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4.5 h-4.5" />
          </span>
          <div className="flex-1 min-w-0 space-y-1">
            <h2
              id="error-dialog-title"
              className="font-serif text-[15px] font-bold leading-snug text-stone-900 dark:text-white"
            >
              {title}
            </h2>
            <p
              id="error-dialog-message"
              className="text-[12.5px] text-stone-600 dark:text-stone-400 leading-relaxed"
            >
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            ref={primaryRef}
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-[12.5px] font-semibold cursor-pointer transition-colors ${
              onRetry
                ? 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                : 'bg-[#435c52] text-white hover:bg-[#3a5048]'
            }`}
          >
            {onRetry ? 'Dismiss' : 'OK'}
          </button>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#435c52] text-white text-[12.5px] font-semibold hover:bg-[#3a5048] cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
