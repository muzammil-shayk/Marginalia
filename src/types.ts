export type Screen =
  | 'home'
  | 'settings'
  | 'upload'
  | 'reader'
  /** The PDF viewer and annotation editor. */
  | 'workspace';

export type TransitionType = 'push' | 'push_back' | 'slide_up' | 'none';

export interface Book {
  id: string;
  title: string;
  author: string;
  chapter?: string;
  currentPage?: number;
  totalPages?: number;
  progressPercent?: number;
  category: string;
  tagText: string;
  annotationsCount?: number;
  isNew?: boolean;
  coverGradient: string;
  coverImage?: string;
}

export interface StickyNote {
  id: string;
  paragraphIndex: number;
  /** Named palette color ('yellow' | 'purple' | 'teal' | 'rose') or an arbitrary hex string. */
  color: string;
  title: string;
  content: string;
  author: string;
  timestamp: string;
  /** References `UserSettings.activeThemes[].id`, or `null` when untagged. An id rather than a
   *  name so renaming a theme in Settings never orphans a note tagged with it. */
  themeId: string | null;
  quote?: string;
  /** Character offsets within the paragraph text, for notes anchored to a precise selection. */
  start?: number;
  end?: number;
}

/**
 * Preferences for this installation, stored on the machine.
 *
 * No account fields: Marginalia runs entirely on the user's own computer with nothing behind it,
 * so `name` is simply what signs their notes. Where documents are stored is NOT here — that lives
 * on disk with the store itself, so the app can find the library before preferences are loaded.
 */
export interface UserSettings {
  /** Signs the reader's annotations and notes. */
  name: string;
  typography: string;
  fontSize: number;
  darkMode: boolean;
  /** Emphasises a distraction-free reading layout. */
  readerMode: boolean;
  activeThemes: { id: string; name: string; color: string }[];
  /**
   * The reader's own colours, offered everywhere a colour is chosen.
   *
   * Separate from `activeThemes` because the two mean different things: a theme is a category a
   * mark is FILED under, while these are just ink. Someone marking up a manuscript wants their
   * own greens and greys to hand without inventing a theme to justify each one.
   */
  customColors?: string[];
  /** Dismisses the Home screen's first-run callout prompting the reader to assign theme colours. */
  themeCtaDismissed?: boolean;
}
