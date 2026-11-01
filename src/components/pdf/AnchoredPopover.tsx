/**
 * The one floating popover the annotation tools share: the selection menu, the mark properties
 * strip, and later the reader screen's text marks.
 *
 * It owns everything a popover over a page has to get right, so each caller only supplies its
 * buttons:
 * - placement: above the anchor by default (the next line stays readable), below near the top
 *   edge, clamped to the window, wrapping to more rows when the window is narrow;
 * - dismissal: any press outside it, or Escape (`useDismiss`);
 * - keyboard: Tab from outside moves into it, arrows move along it, Escape closes it and puts
 *   focus back where it was before entering, and so does closing it from one of its own buttons;
 * - look: one surface in light and dark, with an eased fade in and no movement.
 *
 * Opening never steals focus. The popover usually opens on a text selection, and taking focus
 * then would stop the reader extending that selection with Shift+Arrow.
 */

import React, { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useDismiss } from './useDismiss';
import { useAnchoredPanel, AnchorRect } from './useAnchoredPanel';
import { ANNOTATION_SURFACE, isTypingTarget, popoverTakesTab } from './workspaceKeys';

export type { AnchorRect } from './useAnchoredPanel';

export interface AnchoredPopoverProps {
  /** Viewport rectangle of what the popover describes; null closes it. */
  anchor: AnchorRect | null;
  /** Accessible name of the toolbar, e.g. "Mark the selection". */
  label: string;
  isDark?: boolean;
  /** Outside press or Escape. */
  onDismiss: () => void;
  /** Pixels at the top of the window that are off limits (the toolbar). */
  topInset?: number;
  /** Pixels at the foot of the window that are off limits (the instance navigator). */
  bottomInset?: number;
  /** Elements outside the popover that count as inside for dismissal (a mark's own handles). */
  ignoreSelector?: string;
  /** Anything that changes the popover's contents, so it is placed again. */
  measureKey?: unknown;
  /** Elements to stay off when the other side of the anchor is free (see `placePanel`). */
  avoidSelector?: string;
  /** Extra classes for the surface, e.g. its gap and padding. */
  className?: string;
  children: React.ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The surface every annotation popover shares. */
export const popoverSurfaceClass = (isDark: boolean) =>
  `fixed z-50 flex flex-wrap items-center w-max max-w-[calc(100vw-16px)] rounded-xl shadow-2xl border ${
    isDark ? 'bg-night-3 border-stone-700' : 'bg-white border-stone-200'
  }`;

/** A labelled text-and-icon action in a popover. */
export const popoverActionClass =
  'flex items-center gap-1.5 px-2.5 py-1.5 min-h-8 rounded-lg text-[12px] font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-nav-hover cursor-pointer';

/** A thin rule between groups. CSS cannot tell where a row wraps, so rules sit inside groups
 *  (see `PopoverGroup`) rather than between them. */
export const PopoverDivider: React.FC<{ isDark: boolean; className?: string }> = ({ isDark, className = '' }) => (
  <span aria-hidden className={`block w-px h-5 mx-0.5 shrink-0 ${isDark ? 'bg-stone-700' : 'bg-stone-200'} ${className}`} />
);

/** Controls that must stay on one row together when the popover wraps. */
export const PopoverGroup: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = '',
  children
}) => <div className={`flex items-center shrink-0 ${className}`}>{children}</div>;

export const AnchoredPopover: React.FC<AnchoredPopoverProps> = ({
  anchor,
  label,
  isDark = false,
  onDismiss,
  topInset = 0,
  bottomInset = 0,
  ignoreSelector,
  measureKey,
  avoidSelector,
  className = 'gap-0.5 p-1',
  children
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const open = Boolean(anchor);
  const reduceMotion = useReducedMotion();
  /** Where focus was before the reader moved into the popover, to give it back on the way out. */
  const returnTo = useRef<HTMLElement | null>(null);

  const restoreFocus = () => {
    const el = ref.current;
    if (el && !el.contains(document.activeElement)) return;
    const target = returnTo.current;
    returnTo.current = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
    else (document.activeElement as HTMLElement | null)?.blur();
  };

  useDismiss(ref, open, () => {
    restoreFocus();
    onDismiss();
  }, ignoreSelector);
  const panel = useAnchoredPanel(ref, anchor, [measureKey], bottomInset, topInset, avoidSelector);

  // Tab from the page itself (or from nowhere) steps into the popover, since it is what the
  // reader is working with right now; Tab elsewhere keeps its ordinary order (`popoverTakesTab`). Capture phase, so the browser's own Tab order
  // never moves first.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const el = ref.current;
      if (e.key !== 'Tab' || e.shiftKey || !el) return;
      const active = document.activeElement as HTMLElement | null;
      const onBody = !active || active === document.body;
      const takes = popoverTakesTab({
        onBody,
        inSurface: !onBody && Boolean(active.closest(ANNOTATION_SURFACE)),
        inPopover: !onBody && el.contains(active),
        typing: !onBody && isTypingTarget(active)
      });
      if (!takes) return;
      const first = el.querySelector<HTMLElement>(FOCUSABLE);
      if (!first) return;
      e.preventDefault();
      returnTo.current = active && active !== document.body ? active : null;
      first.focus();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  // Closing from inside (an action that ends the popover) hands focus back too, rather than
  // dropping it on <body> where the next Tab starts from the top of the window.
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    return () => {
      if (el?.contains(document.activeElement) || document.activeElement === document.body) {
        const target = returnTo.current;
        returnTo.current = null;
        if (target?.isConnected) target.focus({ preventScroll: true });
      }
    };
  }, [open]);

  // Arrows move along the toolbar; Home and End jump to its ends.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    if (isTypingTarget(e.target)) return;
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (at < 0 || items.length === 0) return;
    e.preventDefault();
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (at + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  };

  if (!anchor) return null;

  return (
    <motion.div
      ref={ref}
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      className={`${popoverSurfaceClass(isDark)} ${className}`}
      style={panel}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // Eased, no movement: the popover appears where it will stay.
      transition={{ duration: reduceMotion ? 0 : 0.14, ease: [0.23, 1, 0.32, 1] }}
      onKeyDown={onKeyDown}
      // Pressing anything here must not clear the selection it is about to act on, nor start a
      // drag on the page beneath.
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </motion.div>
  );
};
