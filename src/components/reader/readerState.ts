/**
 * The text reader's own state, grouped by concern (moved verbatim from ReaderScreen).
 *
 * Each group is a plain object handed whole to the hooks and components that need it; they
 * destructure it at the top, so every value and setter keeps its own identity and nothing extra
 * re-renders (no React context; `Paragraph` stays memoised on its own props).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { analysePoem, type PoemAnalysis } from '../../utils/poetry';
import { DEFAULT_POETRY, PROSODY_THEMES } from '../PoetryView';
import { type TextSpreadHandle } from '../TextSpread';
import type { ThemeStore } from '../themeStore';
import { AnnotationFocus, PoetryPrefs, UserSettings } from '../../types';
import { ParagraphRange } from '../../utils/textFormatting';
import { splitParagraphs, type TextStyle } from '../../utils/pastedText';
import { fetchDocumentContent } from '../../utils/documentStorage';
import { useReadingProgress } from '../../hooks/useReadingProgress';
import { SelectionAnchor } from '../pdf/SelectionPopover';
import { NAVIGATOR_HEIGHT, FALLBACK_COLOR, TextTool, Tab, TAB_INDEXES } from './readerParts';
import { useKnownThemes } from '../../hooks/knownTheme';
import { toggleThemeId } from '../../utils/markThemes';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;
export type ReaderContent = { text: string; layout?: 'verbatim'; textStyles?: TextStyle[] };
/** A note being written that does not exist yet (made only on Save). */
export type NewNote = { ranges: ParagraphRange[]; quote: string; themeIds: string[]; color: string; paragraphOnly?: true };

/** The document: its stored text and layout, split into the paragraphs marks anchor to. */
export interface ReaderDoc {
  docId: string | undefined;
  content: ReaderContent | null;
  loadFailed: boolean;
  setLoadAttempt: SetState<number>;
  paragraphs: string[];
  stylesByPara: Map<number, TextStyle[]>;
  verbatim: boolean;
  displayTitle: string;
  displayAuthor: '';
  reportProgress: (position: number, total: number) => void;
}

/** The poetry view, kept per document with the settings. */
export interface ReaderPoetry {
  poetry: PoetryPrefs;
  setPoetry: (next: PoetryPrefs) => void;
  poem: PoemAnalysis | null;
  poetryOpen: boolean;
  setPoetryOpen: SetState<boolean>;
  missingProsody: { name: string; color: string }[];
  addProsodyThemes: () => void;
}

/** The themes new marks are filed under, and so their colour. */
export interface ReaderThemes {
  activeThemeIds: string[];
  activeThemeId: string | null;
  setActiveThemeId: (id: string | null) => void;
  toggleActiveTheme: (id: string) => void;
  activeColor: string;
  toolColors: { [k: string]: string };
  themeStripRef: React.RefObject<HTMLDivElement | null>;
  themeStore: ThemeStore | undefined;
}

/** The tabs, the side panel, margin notes and the focus navigator. */
export interface ReaderPanels {
  activeParagraphIndex: number | null;
  setActiveParagraphIndex: SetState<number | null>;
  showInlineNotes: boolean;
  setShowInlineNotes: SetState<boolean>;
  openPin: string | null;
  setOpenPin: SetState<string | null>;
  isPanelOpen: boolean;
  setIsPanelOpen: SetState<boolean>;
  selectedThemeFilter: string;
  setSelectedThemeFilter: SetState<string>;
  activeControlTab: Tab;
  slideDirection: number;
  handleSwitchTab: (newTab: Tab) => void;
  activeFocus: AnnotationFocus | null;
  setActiveFocus: SetState<AnnotationFocus | null>;
  /** Room kept at the foot of the window for the focus navigator. */
  bottomInset: number;
}

/** The armed tool, the hovered mark, and the live text selection with its menu's anchor. */
export interface ReaderSelection {
  tool: TextTool;
  setTool: SetState<TextTool>;
  hoveredId: string | null;
  setHoveredId: SetState<string | null>;
  pendingSelection: ParagraphRange[] | null;
  setPendingSelection: SetState<ParagraphRange[] | null>;
  selectionAnchor: SelectionAnchor | null;
  setSelectionAnchor: SetState<SelectionAnchor | null>;
}

/** The note editor's drafts. */
export interface ReaderEditor {
  editingId: string | null;
  setEditingId: SetState<string | null>;
  newNote: NewNote | null;
  setNewNote: SetState<NewNote | null>;
  draftText: string;
  setDraftText: SetState<string>;
  draftTitle: string;
  setDraftTitle: SetState<string>;
  draftQuote: string;
  setDraftQuote: SetState<string>;
}

export interface ReaderRefs {
  textRef: React.RefObject<HTMLElement | null>;
  headerRef: React.RefObject<HTMLElement | null>;
  controlBarRef: React.RefObject<HTMLDivElement | null>;
  /** The two-page spread's handle: made here, ahead of the hooks that turn its pages. */
  spreadHandle: React.RefObject<TextSpreadHandle | null>;
}

export interface UseReaderStateDeps {
  settings: UserSettings;
  docId: string | undefined;
  documentText: string | undefined;
  documentTitle: string | undefined;
  focus: AnnotationFocus | undefined;
  themeStore: ThemeStore | undefined;
  onUpdateSettings: ((update: (prev: UserSettings) => UserSettings) => void) | undefined;
}

export function useReaderState({ settings, docId, documentText, documentTitle, focus, themeStore, onUpdateSettings }: UseReaderStateDeps) {
  const reduceMotion = useReducedMotion();

  /**
   * The stored text with its layout and pasted formatting. Until it arrives a saved document shows
   * no paragraphs: split the default way first, a verbatim paste would put marks on the wrong lines.
   */
  const [content, setContent] = useState<ReaderContent | null>(null);
  /**
   * A failed fetch shows an error with Retry and no paragraphs, so nothing can be marked. Falling
   * back to the bare text would lose the layout and anchor marks to the wrong paragraphs.
   */
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    if (!docId) return;
    let live = true;
    setLoadFailed(false);
    void fetchDocumentContent(docId).then((c) => {
      if (!live) return;
      if (c) setContent(c);
      else setLoadFailed(true);
    });
    return () => {
      live = false;
    };
  }, [docId, loadAttempt]);
  const sourceText = docId ? content?.text : documentText;
  const verbatim = content?.layout === 'verbatim';
  // Paragraphs exactly as the marks' anchors count them (`splitParagraphs`, shared with the store).
  const paragraphs = useMemo(() => splitParagraphs(sourceText ?? '', content?.layout), [sourceText, content?.layout]);
  const stylesByPara = useMemo(() => {
    const map = new Map<number, TextStyle[]>();
    for (const st of content?.textStyles ?? []) (map.get(st.anchor.paragraphIndex) ?? map.set(st.anchor.paragraphIndex, []).get(st.anchor.paragraphIndex)!).push(st);
    return map;
  }, [content?.textStyles]);

  // ── Poetry view: per document, kept with the settings ──
  const poetry: PoetryPrefs = (docId && settings.poetry?.[docId]) || DEFAULT_POETRY;
  const [poetryOpen, setPoetryOpen] = useState(false);
  const setPoetry = (next: PoetryPrefs) => {
    if (!docId) return;
    onUpdateSettings?.((prev) => ({ ...prev, poetry: { ...prev.poetry, [docId]: next } }));
  };
  const poem = useMemo(() => (poetry.on ? analysePoem(paragraphs) : null), [poetry.on, paragraphs]);
  const missingProsody = PROSODY_THEMES.filter((p) => !settings.activeThemes.some((t) => t.name.toLowerCase() === p.name.toLowerCase()));
  const addProsodyThemes = () => {
    for (const p of missingProsody) themeStore?.create(p.name, p.color);
  };

  // How far through the text the reader has got: the last paragraph in view, of all of them.
  const reportProgress = useReadingProgress(docId);

  const displayTitle = documentTitle || (documentText ? 'Uploaded Document' : 'No Document Selected');
  // Documents carry no author field, so exports leave the author out rather than invent one.
  const displayAuthor = '';
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
  const [showInlineNotes, setShowInlineNotes] = useState(true);
  /** The note opened from a margin pin (narrow margin only). */
  const [openPin, setOpenPin] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  // On a phone the panel covers the page, so one left open while the window narrows is closed.
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 767.98px)');
    const onChange = () => phone.matches && setIsPanelOpen(false);
    phone.addEventListener('change', onChange);
    return () => phone.removeEventListener('change', onChange);
  }, []);
  const [selectedThemeFilter, setSelectedThemeFilter] = useState<string>('All');
  const [activeControlTab, setActiveControlTab] = useState<Tab>('notes');
  const [slideDirection, setSlideDirection] = useState<number>(1);
  const [activeFocus, setActiveFocus] = useState<AnnotationFocus | null>(focus ?? null);

  const handleSwitchTab = (newTab: Tab) => {
    if (newTab === activeControlTab) return;
    setSlideDirection(TAB_INDEXES[newTab] > TAB_INDEXES[activeControlTab] ? 1 : -1);
    setActiveControlTab(newTab);
  };

  /**
   * The theme new marks are filed under, and so their colour — the same "pick a colour by picking
   * a theme" mechanic as the PDF workspace's theme strip.
   */
  const [activeThemeIds, setActiveThemeIds] = useState<string[]>(() => (settings.activeThemes[0] ? [settings.activeThemes[0].id] : []));
  const activeThemeId = activeThemeIds[0] ?? null;
  const setActiveThemeId = useCallback((id: string | null) => setActiveThemeIds(id ? [id] : []), []);
  /** The selection menu's dots and the number keys over a selection toggle several themes. */
  const toggleActiveTheme = useCallback((id: string) => setActiveThemeIds((prev) => toggleThemeId(prev, id)), []);
  // Never a theme that is not in the list (see knownTheme.ts).
  useKnownThemes(activeThemeIds, setActiveThemeIds, settings.activeThemes);
  const themeColor = useCallback(
    (themeId: string | null): string => settings.activeThemes.find((t) => t.id === themeId)?.color || FALLBACK_COLOR,
    [settings.activeThemes]
  );
  const activeColor = themeColor(activeThemeId);
  const toolColors = useMemo(
    () =>
      Object.fromEntries(
        ['highlight', 'underline', 'strikeout', 'question', 'star', 'exclamation', 'note'].map((k) => [k, activeColor])
      ),
    [activeColor]
  );

  const [tool, setTool] = useState<TextTool>('select');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  /**
   * A note being written that does not exist yet. It is only made on Save, so cancelling (Escape,
   * Cancel) leaves nothing behind: no empty note, and no add-then-delete pair in the undo history.
   */
  const [newNote, setNewNote] = useState<NewNote | null>(null);
  const [draftText, setDraftText] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftQuote, setDraftQuote] = useState('');

  // Scrolls the "Tagging as" strip so the newly active theme is visible whenever it changes —
  // picking one from the popover or a number key should still bring it into view here.
  const themeStripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeThemeId) return;
    const el = themeStripRef.current?.querySelector<HTMLElement>(`[data-theme-id="${activeThemeId}"]`);
    el?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', inline: 'nearest', block: 'nearest' });
  }, [activeThemeId, reduceMotion]);

  const textRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const controlBarRef = useRef<HTMLDivElement>(null);
  const [pendingSelection, setPendingSelection] = useState<ParagraphRange[] | null>(null);
  const [selectionAnchor, setSelectionAnchor] = useState<SelectionAnchor | null>(null);
  const spreadHandle = useRef<TextSpreadHandle>(null);
  const bottomInset = activeFocus ? NAVIGATOR_HEIGHT : 0;

  const doc: ReaderDoc = { docId, content, loadFailed, setLoadAttempt, paragraphs, stylesByPara, verbatim, displayTitle, displayAuthor, reportProgress };
  const poetryView: ReaderPoetry = { poetry, setPoetry, poem, poetryOpen, setPoetryOpen, missingProsody, addProsodyThemes };
  const themes: ReaderThemes = { activeThemeIds, activeThemeId, setActiveThemeId, toggleActiveTheme, activeColor, toolColors, themeStripRef, themeStore };
  const panels: ReaderPanels = {
    activeParagraphIndex, setActiveParagraphIndex, showInlineNotes, setShowInlineNotes, openPin, setOpenPin, isPanelOpen, setIsPanelOpen,
    selectedThemeFilter, setSelectedThemeFilter, activeControlTab, slideDirection, handleSwitchTab, activeFocus, setActiveFocus, bottomInset
  };
  const selection: ReaderSelection = { tool, setTool, hoveredId, setHoveredId, pendingSelection, setPendingSelection, selectionAnchor, setSelectionAnchor };
  const editor: ReaderEditor = { editingId, setEditingId, newNote, setNewNote, draftText, setDraftText, draftTitle, setDraftTitle, draftQuote, setDraftQuote };
  const refs: ReaderRefs = { textRef, headerRef, controlBarRef, spreadHandle };
  return { reduceMotion, doc, poetry: poetryView, themes, panels, selection, editor, refs };
}
