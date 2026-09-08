/**
 * The menu that appears next to a text selection.
 *
 * This is the fastest path from "I want to mark this" to a mark: select, then choose. It also
 * carries the only way to create a sticky note ABOUT a passage — the note is placed beside the
 * text and remembers which passage it belongs to, which is what lets hovering it light the
 * passage back up.
 *
 * Positioned in viewport coordinates from the selection's own rectangle, and flipped above the
 * selection when there is no room below, so it never sits off-screen.
 */

import React, { useRef } from 'react';
import { Highlighter, Underline, Strikethrough, StickyNote, Tag, X } from 'lucide-react';
import { AnnotationKind, REACTION_KINDS, reactionChar } from './annotationModel';
import { UserSettings } from '../../types';
import { HoverTooltip } from '../HoverTooltip';
import { useDismiss } from './useDismiss';
import { useAnchoredPanel } from './useAnchoredPanel';

export interface SelectionAnchor {
  /** Viewport position of the selection, used to place the menu. */
  left: number;
  top: number;
  bottom: number;
}

interface SelectionPopoverProps {
  anchor: SelectionAnchor | null;
  isDark?: boolean;
  /** Colour each text tool will use, so the menu shows what it is about to do. */
  toolColors: Record<string, string>;
  themes: UserSettings['activeThemes'];
  activeThemeId: string | null;
  /** Switches which theme every action below files under — same effect as the toolbar's own
   *  theme strip, just reachable without leaving the passage the reader is about to mark. */
  onThemeChange: (id: string) => void;
  onMark: (kind: AnnotationKind) => void;
  onCreateNote: () => void;
  /** Marks the selection as a terminology term — always in `terminologyColor`, set in
   *  Settings → Terminology rather than chosen per-mark. */
  onMarkTerminology: () => void;
  terminologyColor: string;
  onDismiss: () => void;
  /**
   * The X button specifically. Unlike `onDismiss` (outside click / Escape, which must leave the
   * selection intact for whatever the reader is reaching for next), pressing X means "I'm done
   * with this passage" — so it also clears the selection, the same as Mark and Sticky note do.
   * Without that, the global mouseup listener that re-opens this menu on an active selection would
   * see the selection was never cleared and pop the menu right back open.
   */
  onClose: () => void;
}

const ACTIONS: { kind: AnnotationKind; label: string; icon: React.ElementType }[] = [
  { kind: 'highlight', label: 'Highlight', icon: Highlighter },
  { kind: 'underline', label: 'Underline', icon: Underline },
  { kind: 'strikeout', label: 'Strikeout', icon: Strikethrough }
];

/**
 * Question mark, asterisk and exclamation mark — a one-tap reaction to a passage rather than a
 * style applied to it. Icon-only, unlike the marks above: `title` still carries the name for a
 * hover tooltip and for screen readers, but the button itself shows only the symbol.
 */
const REACTION_LABELS: Record<string, string> = {
  question: 'Question mark',
  star: 'Asterisk',
  exclamation: 'Exclamation mark'
};

export const SelectionPopover: React.FC<SelectionPopoverProps> = ({
  anchor,
  isDark = false,
  toolColors,
  themes,
  activeThemeId,
  onThemeChange,
  onMark,
  onCreateNote,
  onMarkTerminology,
  terminologyColor,
  onDismiss,
  onClose
}) => {
  const ref = useRef<HTMLDivElement>(null);
  // Any press outside, or Escape, takes the menu away — the same rule every floating surface in
  // the workspace follows. The hook is called before the early return so it is never conditional.
  useDismiss(ref, Boolean(anchor), onDismiss);
  const panel = useAnchoredPanel(ref, anchor);

  if (!anchor) return null;

  return (
    <div
      ref={ref}
      className={`fixed z-50 flex items-center gap-0.5 p-1 rounded-xl shadow-2xl border ${
        isDark ? 'bg-[#1b201d] border-stone-700' : 'bg-white border-stone-200'
      }`}
      style={panel}
      // Pressing anything here must not clear the selection it is about to act on.
      onMouseDown={(e) => e.preventDefault()}
    >
      {themes.length > 0 && (
        <>
          {themes.map((theme) => (
            <HoverTooltip key={theme.id} label={theme.name}>
              <button
                type="button"
                onClick={() => onThemeChange(theme.id)}
                className={`w-5 h-5 rounded-full border-2 shrink-0 transition-transform hover:scale-110 cursor-pointer ${
                  activeThemeId === theme.id ? 'border-stone-800 dark:border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: theme.color }}
              />
            </HoverTooltip>
          ))}
          <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-stone-700' : 'bg-stone-200'}`} />
        </>
      )}

      {ACTIONS.map(({ kind, label, icon: Icon }) => (
        <button
          key={kind}
          type="button"
          onClick={() => onMark(kind)}
          title={label}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
        >
          <Icon className="w-3.5 h-3.5" style={{ color: toolColors[kind] }} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}

      <button
        type="button"
        onClick={onMarkTerminology}
        title="Mark as a terminology term"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
      >
        <Tag className="w-3.5 h-3.5" style={{ color: terminologyColor }} />
        <span className="hidden sm:inline">Terminology</span>
      </button>

      <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-stone-700' : 'bg-stone-200'}`} />

      {REACTION_KINDS.map((kind) => (
        <button
          key={kind}
          type="button"
          onClick={() => onMark(kind)}
          title={REACTION_LABELS[kind]}
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
        >
          <span
            className="text-[16px] font-extrabold leading-none"
            style={{ color: toolColors[kind] }}
          >
            {reactionChar(kind)}
          </span>
        </button>
      ))}

      <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-stone-700' : 'bg-stone-200'}`} />

      <button
        type="button"
        onClick={onCreateNote}
        title="Write a sticky note about this passage"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
      >
        <StickyNote className="w-3.5 h-3.5" style={{ color: toolColors.note }} />
        <span>Sticky note</span>
      </button>

      <button
        type="button"
        onClick={onClose}
        title="Dismiss"
        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
