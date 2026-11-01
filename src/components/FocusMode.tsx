/**
 * Focus mode: the page alone. Navigation, headers and toolbars step away; the toolbar slides back
 * while text is selected or a mark is chosen, while the pointer rests at the top edge, or while
 * keyboard focus is inside it. F toggles it, Escape leaves it (see App).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Minimize2 } from './icons';
import { HoverTooltip } from './HoverTooltip';

export const FOCUS_HOTKEY = 'F';

/** Whether the toolbar shows: always outside focus mode; inside it, only when called for. */
export function chromeShown(o: { focus: boolean; selecting: boolean; nearTop: boolean; focusWithin: boolean }): boolean {
  return !o.focus || o.selecting || o.nearTop || o.focusWithin;
}

/**
 * Holds a toolbar. Outside focus mode it is layout-transparent (`display: contents`), so sticky
 * bars inside keep working; in focus mode it pins the bar to the top, out of view until called.
 */
export const FocusChrome: React.FC<{ focus: boolean; selecting: boolean; children: React.ReactNode }> = ({
  focus,
  selecting,
  children
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [nearTop, setNearTop] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const shown = chromeShown({ focus, selecting, nearTop, focusWithin });
  useEffect(() => {
    if (!focus) return setNearTop(false);
    // Called by the top 24px; kept while the pointer is over the bar it called.
    const onMove = (e: PointerEvent) => {
      const limit = ref.current && ref.current.dataset.shown === 'true' ? ref.current.getBoundingClientRect().bottom : 24;
      setNearTop(e.pointerType === 'mouse' && e.clientY <= limit);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [focus]);
  if (!focus) return <div className="contents">{children}</div>;
  return (
    <div
      ref={ref}
      data-shown={shown}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
      }}
      className={`focus-chrome fixed inset-x-0 top-0 z-40 ${shown ? '' : 'pointer-events-none'}`}
    >
      {children}
    </div>
  );
};

/** The way out, in the top-right corner, beside the page rather than over it. */
export const FocusExit: React.FC<{ onExit: () => void; isDark: boolean }> = ({ onExit, isDark }) => (
  <HoverTooltip label={`Leave focus mode (${FOCUS_HOTKEY} or Esc)`}>
    <button
      type="button"
      onClick={onExit}
      aria-label={`Leave focus mode (${FOCUS_HOTKEY} or Escape)`}
      className={`fixed top-3 right-4 z-30 p-2 rounded-full cursor-pointer text-muted transition-colors ${
        isDark ? 'hover:bg-white/10 hover:text-paper' : 'hover:bg-black/5 hover:text-ink'
      }`}
    >
      <Minimize2 className="w-4 h-4" />
    </button>
  </HoverTooltip>
);
