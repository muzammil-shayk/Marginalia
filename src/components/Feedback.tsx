/**
 * "Send feedback": the sidebar item, and the occasional prompt (from the 5th launch; "Later"
 * brings it back 15 launches on, "Don't ask again" ends it). Both open a pre-filled email in the
 * reader's own mail app (`utils/feedback`); Marginalia sends nothing itself.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Feedback as FeedbackIcon, X } from './icons';
import { answerFeedbackPrompt, desktopBridge, getFeedbackDue } from '../utils/documentStorage';
import { feedbackMailto } from '../utils/feedback';
import { CURRENT_APP_VERSION } from '../data/changelog';

/** Opens the feedback email and records that it was sent, so the prompt stops. */
export async function sendFeedback(): Promise<void> {
  let platform: string | undefined;
  try {
    platform = (await desktopBridge()?.getAppInfo())?.platform;
  } catch {
    /* the email simply says less */
  }
  // The shell's window-open handler hands this one address, and no other mailto:, to the mail app (main.cjs).
  window.open(feedbackMailto({ version: CURRENT_APP_VERSION, platform }), '_blank', 'noopener');
  void answerFeedbackPrompt('sent');
}

/**
 * The prompt: a small card at the bottom corner, never over a reading screen's first seconds
 * (shown 20 s after launch) and never while another dialog is open.
 */
export const FeedbackPrompt: React.FC<{ blocked: boolean; isDark: boolean }> = ({ blocked, isDark }) => {
  const [due, setDue] = useState(false);
  const [ready, setReady] = useState(false);
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let live = true;
    void getFeedbackDue().then((d) => live && setDue(d));
    const t = window.setTimeout(() => live && setReady(true), 20_000);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, []);
  const open = due && ready && !blocked;
  useEffect(() => {
    if (open) firstRef.current?.focus({ preventScroll: true });
  }, [open]);
  if (!open) return null;

  const answer = (a: 'later' | 'never') => {
    setDue(false);
    void answerFeedbackPrompt(a);
  };
  return (
    <div
      role="dialog"
      aria-labelledby="feedback-prompt-title"
      className={`ink-card fixed z-[55] bottom-4 right-4 max-md:bottom-[calc(5rem+env(safe-area-inset-bottom))] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border p-4 shadow-2xl motion-safe:animate-[panel-in_220ms_var(--ease-out)] ${
        isDark ? 'bg-night-3 border-stone-700 text-paper' : 'bg-white border-stone-200 text-stone-900'
      }`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') answer('later');
      }}
    >
      <div className="flex items-start gap-3">
        <FeedbackIcon className="w-5 h-5 text-gold shrink-0 mt-1" />
        <div className="flex-1 min-w-0 space-y-1">
          <h2 id="feedback-prompt-title" className="title-hand text-[22px] leading-tight">
            How is Marginalia working for you?
          </h2>
          <p className="text-[13px] text-muted leading-snug">
            A line or two about what helps and what gets in the way shapes the next version. It opens an email you can read before sending.
          </p>
        </div>
        <button type="button" onClick={() => answer('later')} aria-label="Ask me later" className="p-1 -m-1 rounded-lg text-muted hover:text-stone-900 dark:hover:text-paper cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => answer('never')} className="text-[12px] text-muted hover:underline cursor-pointer mr-auto">
          Don’t ask again
        </button>
        <button
          type="button"
          onClick={() => answer('later')}
          className={`px-4 py-2 rounded-full caps text-[12px] border cursor-pointer ${isDark ? 'border-stone-700 hover:bg-nav-hover' : 'border-stone-300 hover:bg-stone-100'}`}
        >
          Later
        </button>
        <button
          ref={firstRef}
          type="button"
          onClick={() => {
            setDue(false);
            void sendFeedback();
          }}
          className="px-4 py-2 rounded-full caps text-[12px] bg-accent hover:bg-accent-hover text-on-accent cursor-pointer"
        >
          Send feedback
        </button>
      </div>
    </div>
  );
};
