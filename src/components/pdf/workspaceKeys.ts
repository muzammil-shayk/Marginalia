/**
 * Single-key shortcuts for the annotation workspace, as pure data and one pure resolver.
 *
 * Kept free of React and the DOM so the mapping can be tested, and so the reader screen can map
 * the same keys to the same intents later. The workspace decides what each intent does.
 */

import type { PdfTool } from './annotationModel';

/** One letter per tool. Only tools that exist get a letter; the rest stay mouse-only. */
export const TOOL_HOTKEYS: Partial<Record<PdfTool, string>> = {
  select: 'V',
  highlight: 'H',
  underline: 'U',
  strikeout: 'S',
  note: 'N',
  ink: 'P',
  erase: 'E'
};

const TOOL_BY_LETTER: Record<string, PdfTool> = Object.fromEntries(
  Object.entries(TOOL_HOTKEYS).map(([tool, letter]) => [letter!.toLowerCase(), tool as PdfTool])
);

export type WorkspaceKeyAction =
  | { type: 'tool'; tool: PdfTool }
  /** 0-based index into the reader's active themes. */
  | { type: 'theme'; index: number }
  | { type: 'delete' }
  | { type: 'escape' }
  | { type: 'undo' }
  | { type: 'redo' };

export interface KeyLike {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

/** Maps a keydown to what it means in the workspace, or null when the key is not ours. */
export function resolveWorkspaceKey(e: KeyLike): WorkspaceKeyAction | null {
  if (e.key === 'Escape') return { type: 'escape' };

  const key = e.key.toLowerCase();
  if (e.metaKey || e.ctrlKey) {
    if (e.altKey) return null;
    // Shift+Cmd+Z is redo on macOS; Ctrl+Y is the Windows spelling of the same thing.
    if (key === 'z') return e.shiftKey ? { type: 'redo' } : { type: 'undo' };
    if (key === 'y' && !e.shiftKey) return { type: 'redo' };
    return null;
  }
  // Single keys only: Shift or Alt with a letter belongs to the OS and to text entry.
  if (e.altKey || e.shiftKey) return null;

  if (e.key === 'Delete' || e.key === 'Backspace') return { type: 'delete' };
  if (/^[1-9]$/.test(e.key)) return { type: 'theme', index: Number(e.key) - 1 };
  const tool = TOOL_BY_LETTER[key];
  return tool ? { type: 'tool', tool } : null;
}

/** True when keys typed here are text, so no shortcut may act on them. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || typeof (el as HTMLElement).tagName !== 'string') return false;
  const node = el as HTMLElement;
  if (node.isContentEditable) return true;
  if (node.tagName === 'TEXTAREA' || node.tagName === 'SELECT') return true;
  if (node.tagName !== 'INPUT') return false;
  // Buttons, checkboxes and the like take no typing; a colour well opens its own picker.
  const type = ((node as HTMLInputElement).type || 'text').toLowerCase();
  return !['button', 'checkbox', 'radio', 'range', 'color', 'submit', 'reset', 'file', 'image'].includes(type);
}

/** "Highlight (H)", for tooltips and accessible names that teach the shortcut. */
export function withShortcut(label: string, shortcut: string | undefined): string {
  return shortcut ? `${label} (${shortcut})` : label;
}

/** The key that applies theme `index` (0-based), or undefined past the ninth theme. */
export function themeShortcut(index: number): string | undefined {
  return index >= 0 && index < 9 ? String(index + 1) : undefined;
}

/** Marks the element holding the document's pages or text: Tab from inside it may enter a popover. */
export const ANNOTATION_SURFACE = '[data-annotation-surface]';

/**
 * Whether Tab should step into an open annotation popover. Only from nowhere (`<body>`) or from
 * the document itself: a popover stays open while a mark is selected, and grabbing Tab from the
 * toolbar or the notes panel would trap keyboard users there, with Escape (which deselects) the
 * only way out.
 */
export function popoverTakesTab(focus: { onBody: boolean; inSurface: boolean; inPopover: boolean; typing: boolean }): boolean {
  return !focus.inPopover && !focus.typing && (focus.onBody || focus.inSurface);
}
