export type Screen = 
  | 'home'
  | 'analysis'
  | 'settings'
  | 'upload'
  | 'reader';

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
  themeTag?: string;
  quote?: string;
  isAiGenerated?: boolean;
  rationale?: string;
  confidence?: number;
  /** Character offsets within the paragraph text, for notes anchored to a precise selection. */
  start?: number;
  end?: number;
}

export interface AISuggestion {
  title: string;
  themeTag: string;
  quote?: string;
  content: string;
  color: 'yellow' | 'purple' | 'teal' | 'rose';
  confidence?: number;
  rationale?: string;
}

export interface ThemeInsight {
  id: string;
  title: string;
  description: string;
  confidence: number;
  confidenceLabel: string;
  mentions: number;
  selected?: boolean;
  color: string;
  excerpts?: string[];
  keyQuote?: string;
  matchedParagraphIndices?: number[];
}

export interface MetaphorPattern {
  name: string;
  percentage: number;
  colorClass: string;
}

export interface UserSettings {
  name: string;
  email: string;
  subscription: string;
  typography: string;
  fontSize: number;
  darkMode: boolean;
  readerMode: boolean;
  activeThemes: { id: string; name: string; color: string }[];
}
