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
  /**
   * The single colour every terminology mark is drawn in, everywhere one appears.
   *
   * Unlike a theme's colour, this is never baked into the mark itself — `isTerminology` marks are
   * always rendered and exported by looking this setting up live, so changing it here instantly
   * recolours every terminology mark ever made, old and new alike, with no per-mark migration.
   */
  terminologyColor: string;
  /** Which of the Home screen's collapsible sections (Key Concepts, Terminologies, Themes) the
   *  reader has folded shut. Absent or false means expanded, so a fresh install shows everything. */
  collapsedHomeSections?: Record<string, boolean>;
  /** Whether the desktop sidebar is collapsed to icons-only. */
  sidebarCollapsed?: boolean;
}

/**
 * One theme Gemini found while reading a document, and how central it judged it to be.
 *
 * `prominence` is a closed set rather than free text because the analysis panel sorts and colours
 * by it; the response schema in `src/services/analyzer.ts` pins the same three values server-side
 * so a model that improvises a fourth is rejected before it reaches here.
 */
export interface ThemeItem {
  themeName: string;
  description: string;
  prominence: 'Primary' | 'Secondary' | 'Recurring Motif';
  evidence: string[];
}

/** The whole result of one thematic analysis run over a stored PDF. */
export interface ThematicAnalysisResult {
  bookTitle: string;
  executiveSummary: string;
  themes: ThemeItem[];
  narrativeArc: string;
}

/**
 * What the reader asked to be shown when they opened a document from the library dashboard.
 *
 * Tapping a book under Key Concepts means "show me the key concepts in this book", not merely
 * "open this book" — so the request travels with the navigation and the workspace turns it into a
 * navigator over the matching marks. Carries its own label so the navigator can name what it is
 * stepping through without knowing where the request came from.
 */
export type AnnotationFocus =
  | { kind: 'theme'; themeId: string; label: string; color: string }
  | { kind: 'terminology'; label: string; color: string };
