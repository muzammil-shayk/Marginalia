/**
 * Steps through every mark in this document that matches what the reader asked to see.
 *
 * Opened by tapping a book under Key Concepts or Terminologies on the library dashboard: the
 * question there is "where are they", and dropping someone at page one of a 400-page book does
 * not answer it. The list is derived from the workspace's live annotation state rather than a
 * snapshot taken on open, so marking a new passage while this is up extends the run immediately
 * and erasing one shortens it — the count stays honest while the reader works.
 *
 * Motion is deliberately thin. This appears once per visit, so it earns a 200ms entrance; the
 * previous/next buttons are pressed repeatedly, so they animate nothing but their own press
 * feedback. Anything more would be in the reader's way by the fourth press.
 */

import React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AnnotationFocus } from '../../types';
import { Annotation, annotationBounds } from './annotationModel';

/** Marks matching the focus, in reading order. Exported for its own test. */
export function matchingAnnotations(
  annotations: Annotation[],
  focus: AnnotationFocus
): Annotation[] {
  return annotations
    .filter((a) =>
      focus.kind === 'terminology' ? a.isTerminology === true : a.themeId === focus.themeId
    )
    // Reading order: down the page, not creation order — someone stepping through marks is
    // walking the book, and the order they were drawn in is meaningless to that.
    .sort((a, b) => a.page - b.page || (annotationBounds(a)?.y ?? 0) - (annotationBounds(b)?.y ?? 0));
}

interface InstanceNavigatorProps {
  focus: AnnotationFocus;
  annotations: Annotation[];
  /** Scrolls to a mark. Returns false when the page is not rendered yet, so the jump can retry. */
  onGoTo: (annotation: Annotation) => boolean | void;
  onClose: () => void;
  isDark?: boolean;
}

export const InstanceNavigator: React.FC<InstanceNavigatorProps> = ({
  focus,
  annotations,
  onGoTo,
  onClose,
  isDark = false
}) => {
  const matches = React.useMemo(
    () => matchingAnnotations(annotations, focus),
    [annotations, focus]
  );
  const [index, setIndex] = React.useState(0);
  const jumpedFor = React.useRef<string | null>(null);

  /**
   * Land on the first match. That jump IS the point of opening a book this way, so it retries
   * rather than being attempted once: the navigator mounts as soon as the marks load, which can
   * be before the page elements exist, and a silent miss left the reader at page one of a
   * 180-page book wondering what the pill was for.
   */
  const key = focus.kind === 'theme' ? focus.themeId : 'terminology';
  React.useEffect(() => {
    if (jumpedFor.current === key || matches.length === 0) return;

    let frame = 0;
    let attempts = 0;
    const attempt = () => {
      if (onGoTo(matches[0]) !== false) {
        jumpedFor.current = key;
        return;
      }
      // ~2s of frames. Past that the page genuinely is not coming, and retrying forever would
      // fight whatever the reader does next.
      if (++attempts < 120) frame = requestAnimationFrame(attempt);
    };
    setIndex(0);
    attempt();
    return () => cancelAnimationFrame(frame);
  }, [key, matches, onGoTo]);

  // A mark deleted out from under the cursor must not leave the counter reading "4 of 2".
  const safeIndex = matches.length === 0 ? 0 : Math.min(index, matches.length - 1);

  const step = (delta: number) => {
    if (matches.length === 0) return;
    const next = (safeIndex + delta + matches.length) % matches.length;
    setIndex(next);
    onGoTo(matches[next]);
  };

  return (
    <div
      role="group"
      aria-label={`${focus.label} in this document`}
      data-instance-navigator
      className={`absolute left-1/2 bottom-5 z-30 flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-full border shadow-lg backdrop-blur-sm ${
        isDark ? 'bg-[#1b201d]/95 border-stone-700' : 'bg-white/95 border-stone-200'
      }`}
      style={{
        transform: 'translateX(-50%)',
        animation: 'instance-navigator-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both'
      }}
    >
      <style>{`
        @keyframes instance-navigator-in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)   scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-instance-navigator] { animation: none !important; }
        }
      `}</style>

      <span
        aria-hidden
        className="w-2 h-2 rounded-[2px] shrink-0"
        style={{ backgroundColor: focus.color }}
      />
      <span className="text-[12px] font-medium text-stone-800 dark:text-stone-200 whitespace-nowrap">
        {focus.label}
      </span>
      <span className="text-[11.5px] text-stone-500 tabular-nums whitespace-nowrap ml-1">
        {matches.length === 0 ? 'none here' : `${safeIndex + 1} of ${matches.length}`}
      </span>

      <span className="w-px h-5 bg-stone-200 dark:bg-stone-700 mx-1" aria-hidden />

      <button
        type="button"
        onClick={() => step(-1)}
        disabled={matches.length === 0}
        aria-label={`Previous ${focus.label} mark`}
        className="p-1.5 rounded-full text-stone-500 hover:text-stone-900 dark:hover:text-white disabled:opacity-35 disabled:cursor-default cursor-pointer transition-[transform,color] duration-150 ease-out active:scale-[0.92]"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={matches.length === 0}
        aria-label={`Next ${focus.label} mark`}
        className="p-1.5 rounded-full text-stone-500 hover:text-stone-900 dark:hover:text-white disabled:opacity-35 disabled:cursor-default cursor-pointer transition-[transform,color] duration-150 ease-out active:scale-[0.92]"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Stop stepping through marks"
        className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer transition-[transform,color] duration-150 ease-out active:scale-[0.92]"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
