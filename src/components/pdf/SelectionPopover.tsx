/**
 * The menu that appears next to a text selection.
 *
 * This is the fastest path from "I want to mark this" to a mark: select, then choose. It also
 * carries the only way to create a sticky note ABOUT a passage — the note is placed beside the
 * text and remembers which passage it belongs to, which is what lets hovering it light the
 * passage back up.
 *
 * Rendered in the shared `AnchoredPopover`: above the selection by default so the next line stays
 * readable, below near the top edge, clamped to the window and wrapped onto two rows on a narrow
 * one (themes on the first, actions on the second). Every action names its shortcut.
 */

import React from 'react';
import { Highlighter, Underline, Strikethrough, StickyNote, Tag, X } from '../icons';
import { AnnotationKind, REACTION_KINDS, reactionChar } from './annotationModel';
import { UserSettings } from '../../types';
import { HoverTooltip } from '../HoverTooltip';
import { AnchoredPopover, PopoverDivider, PopoverGroup, popoverActionClass, PanelContext } from './AnchoredPopover';
import { DARK_SWATCH_RING, isInkOnDark } from './StyleControls';
import { TOOL_HOTKEYS, themeShortcut, withShortcut } from './workspaceKeys';

export interface SelectionAnchor {
  /** Viewport position of the selection, used to place the menu. */
  left: number;
  top: number;
  bottom: number;
}

export interface SelectionPopoverProps {
  anchor: SelectionAnchor | null;
  isDark?: boolean;
  /** Pixels at the top of the window this menu must stay clear of — the toolbar. */
  topInset?: number;
  /** Pixels at the foot of the window this menu must stay clear of — the instance navigator. */
  bottomInset?: number;
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
  /** Elements the menu should not cover when the other side of the selection is free. */
  avoidSelector?: string;
  /** Glyphs to keep clear and free places to use (the reader's; see `placePanel`). */
  placementContext?: () => PanelContext;
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
 * style applied to it. Icon-only, unlike the marks above: the accessible name carries the name,
 * but the button itself shows only the symbol.
 */
const REACTION_LABELS: Record<string, string> = {
  question: 'Question mark',
  star: 'Asterisk',
  exclamation: 'Exclamation mark'
};

/**
 * The theme dots: which theme the next mark is filed under. Exported for the reader screen.
 * Each dot is named for screen readers and teaches its number key.
 */
export const ThemeDots: React.FC<{
  themes: UserSettings['activeThemes'];
  activeThemeId: string | null;
  onThemeChange: (id: string) => void;
}> = ({ themes, activeThemeId, onThemeChange }) => (
  <>
    {themes.map((theme, i) => {
      const name = withShortcut(theme.name, themeShortcut(i));
      return (
        <HoverTooltip key={theme.id} label={name}>
          <button
            type="button"
            onClick={() => onThemeChange(theme.id)}
            aria-label={`Theme: ${name}`}
            aria-pressed={activeThemeId === theme.id}
            aria-keyshortcuts={themeShortcut(i)}
            // A 20px dot inside a 28px target: easy to hit, still reads as a dot.
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full cursor-pointer group/dot"
          >
            <span
              className={`w-5 h-5 rounded-full border-2 transition-transform duration-150 ease-out group-hover/dot:scale-110 ${
                activeThemeId === theme.id ? 'border-stone-800 dark:border-white' : 'border-transparent'
              } ${isInkOnDark(theme.color) ? DARK_SWATCH_RING : ''}`}
              style={{ backgroundColor: theme.color }}
            />
          </button>
        </HoverTooltip>
      );
    })}
  </>
);

/** A square icon-only action: 32px, the popover's tap target. */
const iconAction =
  'flex items-center justify-center w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-nav-hover cursor-pointer';

export const SelectionPopover: React.FC<SelectionPopoverProps> = ({
  anchor,
  isDark = false,
  topInset = 0,
  bottomInset = 0,
  toolColors,
  themes,
  activeThemeId,
  onThemeChange,
  onMark,
  onCreateNote,
  onMarkTerminology,
  terminologyColor,
  onDismiss,
  avoidSelector,
  placementContext,
  onClose
}) => {
  // A near-black tool colour would vanish on the dark pill, so its icon turns cream there.
  const glyph = (color: string) => (isDark && isInkOnDark(color) ? 'var(--color-paper)' : color);

  return (
    <AnchoredPopover
      anchor={anchor}
      label="Mark the selection"
      isDark={isDark}
      onDismiss={onDismiss}
      topInset={topInset}
      bottomInset={bottomInset}
      measureKey={themes.length}
      avoidSelector={avoidSelector}
      placementContext={placementContext}
      className="gap-x-0.5 gap-y-1 p-1"
    >
      {themes.length > 0 && (
        // Below 640px the dots and the close button take the first row and the actions the
        // second, so nothing runs off the edge. Row two: 4 tools 128 + reactions 106 + Sticky
        // note 110 = 344 of 366 at 390px; under 360px the note drops its label (266 of 296 at 320).
        <PopoverGroup className="max-sm:basis-[calc(100%-2.25rem)]">
          <ThemeDots themes={themes} activeThemeId={activeThemeId} onThemeChange={onThemeChange} />
          <PopoverDivider isDark={isDark} className="max-sm:hidden" />
        </PopoverGroup>
      )}

      {/* The four marks are icons with drawn tooltips (the PDF toolbar's own glyphs), which keeps
          the menu about 480px wide on a desktop instead of running to the window edge. */}
      <PopoverGroup className="max-sm:order-2">
        {ACTIONS.map(({ kind, label, icon: Icon }) => {
          const name = withShortcut(label, TOOL_HOTKEYS[kind]);
          return (
            <HoverTooltip key={kind} label={name}>
              <button
                type="button"
                onClick={() => onMark(kind)}
                aria-label={name}
                aria-keyshortcuts={TOOL_HOTKEYS[kind]}
                className={iconAction}
              >
                <Icon className="w-4 h-4" style={{ color: glyph(toolColors[kind]) }} />
              </button>
            </HoverTooltip>
          );
        })}

        <HoverTooltip label="Mark as a terminology term">
          <button type="button" onClick={onMarkTerminology} aria-label="Mark as a terminology term" className={iconAction}>
            <Tag className="w-4 h-4" style={{ color: glyph(terminologyColor) }} />
          </button>
        </HoverTooltip>
      </PopoverGroup>

      <PopoverGroup className="max-sm:order-2">
        <PopoverDivider isDark={isDark} />
        {REACTION_KINDS.map((kind) => (
          <HoverTooltip key={kind} label={REACTION_LABELS[kind]}>
            <button type="button" onClick={() => onMark(kind)} aria-label={REACTION_LABELS[kind]} className={iconAction}>
              <span
                aria-hidden
                className="text-[16px] font-extrabold leading-none"
                style={{ color: glyph(toolColors[kind]) }}
              >
                {reactionChar(kind)}
              </span>
            </button>
          </HoverTooltip>
        ))}
      </PopoverGroup>

      {/* The rule before the note travels with it, so no rule is ever left at a row's end. */}
      <PopoverGroup className="max-sm:order-2">
        <PopoverDivider isDark={isDark} />
        <HoverTooltip label={withShortcut('Write a sticky note about this passage', TOOL_HOTKEYS.note)}>
          <button
            type="button"
            onClick={onCreateNote}
            aria-label={withShortcut('Sticky note', TOOL_HOTKEYS.note)}
            aria-keyshortcuts={TOOL_HOTKEYS.note}
            className={`${popoverActionClass} max-[359px]:px-2`}
          >
            <StickyNote className="w-3.5 h-3.5" style={{ color: glyph(toolColors.note) }} />
            <span className="max-[359px]:hidden">Sticky note</span>
          </button>
        </HoverTooltip>
      </PopoverGroup>

      <PopoverGroup className="max-sm:order-1">
        <button
          type="button"
          onClick={onClose}
          title="Dismiss"
          aria-label="Dismiss"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted dark:text-paper/70 hover:text-stone-700 dark:hover:text-paper cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </PopoverGroup>
    </AnchoredPopover>
  );
};
