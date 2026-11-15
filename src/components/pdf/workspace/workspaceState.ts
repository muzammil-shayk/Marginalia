/**
 * The PDF workspace's own state, grouped by concern (moved verbatim from PdfWorkspace).
 *
 * Each group is a plain object handed whole to the hooks and components that need it; they
 * destructure it at the top, so every value and setter keeps its own identity and nothing extra
 * re-renders (no React context, no memoised wrapper whose identity would have to be managed).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useReadingProgress } from '../../../hooks/useReadingProgress';
import { gateWhileBusy } from '../../../hooks/debouncedSaver';
import { AnnotationFocus } from '../../../types';
import { Annotation, FractionRect } from '../annotationModel';
import { useAnnotationHistory } from '../useAnnotationHistory';
import { SelectionAnchor } from '../SelectionPopover';
import { originalDocumentUrl, type PdfViewMode } from '../../../utils/documentStorage';
import { DEFAULT_ZOOM } from './docState';

export type SetState<T> = React.Dispatch<React.SetStateAction<T>>;
export type PendingSelection = { page: number; rects: FractionRect[]; quote: string }[] | null;
export type SaveState = 'idle' | 'saving' | 'saved';

/** The marks, behind an undo history; every change is ignored while a page insert/delete runs. */
export interface WorkspaceMarks {
  annotations: Annotation[];
  setAnnotations: (next: Annotation[] | ((prev: Annotation[]) => Annotation[])) => void;
  resetAnnotations: (next: Annotation[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  pageOpBusyRef: React.RefObject<boolean>;
}

/** What is selected, hovered and being edited, and the selection menu's state. */
export interface WorkspaceSelection {
  selectedId: string | null;
  setSelectedId: SetState<string | null>;
  hoveredId: string | null;
  setHoveredId: SetState<string | null>;
  editingId: string | null;
  setEditingId: SetState<string | null>;
  draftText: string;
  setDraftText: SetState<string>;
  pendingSelection: PendingSelection;
  setPendingSelection: SetState<PendingSelection>;
  selectionAnchor: SelectionAnchor | null;
  setSelectionAnchor: SetState<SelectionAnchor | null>;
  openSubmenuFor: string | null;
  setOpenSubmenuFor: SetState<string | null>;
  submenuClosedAt: React.RefObject<{ tool: string; at: number } | null>;
}

/** The loaded PDF and how it is shown: page, zoom, single/spread/grid. */
export interface WorkspaceView {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  pdf: PDFDocumentProxy | null;
  setPdf: SetState<PDFDocumentProxy | null>;
  pageCount: number;
  scale: number;
  setScale: SetState<number>;
  viewMode: PdfViewMode;
  setViewMode: SetState<PdfViewMode>;
  currentPage: number;
  setCurrentPage: SetState<number>;
  fittedRef: React.RefObject<string | null>;
  restoredPageRef: React.RefObject<string | null>;
  layoutSettled: boolean;
  setLayoutSettled: SetState<boolean>;
}

/** Loading, saving, exporting, failures, the file URL, and which side panels are showing. */
export interface WorkspaceStatus {
  fileUrl: string;
  setFileVersion: SetState<number>;
  loadError: string | null;
  setLoadError: SetState<string | null>;
  failure: string | null;
  setFailure: SetState<string | null>;
  saveState: SaveState;
  setSaveState: SetState<SaveState>;
  isExporting: boolean;
  setIsExporting: SetState<boolean>;
  isLoaded: boolean;
  setIsLoaded: SetState<boolean>;
  isPanelOpen: boolean;
  setIsPanelOpen: SetState<boolean>;
  activeFocus: AnnotationFocus | null;
  setActiveFocus: SetState<AnnotationFocus | null>;
}

export function useWorkspaceState(docId: string, focus: AnnotationFocus | undefined) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const pageCount = pdf?.numPages ?? 0;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scale, setScale] = useState(DEFAULT_ZOOM);
  /** Single page per row, or two side by side like an open book. */
  const [viewMode, setViewMode] = useState<PdfViewMode>('single');
  /** Guards the one-time fit, so re-rendering never overrides a zoom the reader chose. */
  const fittedRef = useRef<string | null>(null);
  /** Guards the one-time restore of the last page read, the same way `fittedRef` guards zoom. */
  const restoredPageRef = useRef<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  // How far through the PDF the reader has got (page of pages), saved debounced by the hook.
  const reportProgress = useReadingProgress(docId);
  useEffect(() => {
    if (pageCount > 0) reportProgress(currentPage, pageCount);
  }, [currentPage, pageCount, reportProgress]);

  /**
   * The marks, behind an undo history.
   *
   * `commit` replaces `setAnnotations` everywhere below, which is what makes every tool undoable
   * without each one having to opt in — see `useAnnotationHistory`. `reset` is used only when the
   * stored set is read from disk, so undo can never reach back past the moment the document
   * opened and erase work from an earlier session.
   */
  const {
    annotations,
    commit,
    reset: resetAnnotations,
    undo: undoHistory,
    redo: redoHistory,
    canUndo,
    canRedo
  } = useAnnotationHistory();
  /**
   * True while a page insert/delete runs. Marks drawn then would carry pre-renumbering page
   * numbers and be dropped, so every mark change (tools, undo, redo) is ignored meanwhile.
   */
  const pageOpBusyRef = useRef(false);
  const setAnnotations = useMemo(() => gateWhileBusy(() => pageOpBusyRef.current, commit), [commit]);
  const undo = useMemo(() => gateWhileBusy(() => pageOpBusyRef.current, undoHistory), [undoHistory]);
  const redo = useMemo(() => gateWhileBusy(() => pageOpBusyRef.current, redoHistory), [redoHistory]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  /**
   * Whatever last failed in here.
   *
   * These operations used to fail into `console.error` or a bare `return`: an export that
   * produced no file, an inserted page that never appeared, a save that silently did not happen.
   * The last one is the reason this exists at all — marks the reader believes are on disk and are
   * not is the only failure in Marginalia that loses work.
   */
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * True once this document's zoom has been decided and applied.
   *
   * The instance navigator waits for it. Fitting the zoom re-lays out every page, which throws
   * away any scroll offset set before it — so jumping to the first mark the moment the marks
   * loaded landed correctly and was then silently undone, leaving the reader on page 1 of a
   * 180-page book with a pill claiming to be showing them mark 1 of 2.
   */
  const [layoutSettled, setLayoutSettled] = useState(false);

  /** Cleared when the reader dismisses the navigator; re-seeded if they arrive with a new focus. */
  const [activeFocus, setActiveFocus] = useState(focus ?? null);
  useEffect(() => setActiveFocus(focus ?? null), [focus]);

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  /**
   * The text the reader has selected, remembered independently of which tool is active.
   *
   * This is what makes both orders of operation work. Selecting text and THEN tapping Highlight
   * has to apply to that selection, so the selection cannot be discarded just because no marking
   * tool was active when it was made. It is held until the reader selects something else or
   * clicks away, which also lets the same tool be tapped repeatedly to toggle the mark on and off.
   *
   * A selection can cross a page break, so it is stored as one group per page.
   */
  const [pendingSelection, setPendingSelection] = useState<PendingSelection>(null);
  /** Where to put the selection menu, in viewport coordinates. */
  const [selectionAnchor, setSelectionAnchor] = useState<SelectionAnchor | null>(null);
  /** Which tool's colour/thickness submenu to open next — see the selection menu. */
  const [openSubmenuFor, setOpenSubmenuFor] = useState<string | null>(null);
  /**
   * When a tool's options panel last closed, and which tool's it was.
   *
   * A press on the tool button lands outside the panel, so the panel dismisses itself on
   * `pointerdown` — before the button's `click` handler has run. By the time the handler asks
   * "is this panel open?" the answer is already no, and it would dutifully open it again: the
   * panel would flicker shut and back, and could never be closed by tapping the tool. Recording
   * the moment it closed is how the handler tells "the press I am handling closed it" from "it
   * was closed long before this press".
   */
  const submenuClosedAt = useRef<{ tool: string; at: number } | null>(null);

  /**
   * Bumped after a page is inserted, to force the PDF to be refetched. `fileUrl` is otherwise a
   * stable string keyed only on `docId`, and the browser (and pdf.js's own cache) would
   * otherwise keep serving the pre-insertion bytes it already has for that exact URL.
   */
  const [fileVersion, setFileVersion] = useState(0);
  const fileUrl = `${originalDocumentUrl(docId, 'inline')}&v=${fileVersion}`;

  const marks: WorkspaceMarks = { annotations, setAnnotations, resetAnnotations, undo, redo, canUndo, canRedo, pageOpBusyRef };
  const selection: WorkspaceSelection = {
    selectedId, setSelectedId, hoveredId, setHoveredId, editingId, setEditingId, draftText, setDraftText,
    pendingSelection, setPendingSelection, selectionAnchor, setSelectionAnchor, openSubmenuFor, setOpenSubmenuFor, submenuClosedAt
  };
  const view: WorkspaceView = {
    scrollRef, pdf, setPdf, pageCount, scale, setScale, viewMode, setViewMode, currentPage, setCurrentPage,
    fittedRef, restoredPageRef, layoutSettled, setLayoutSettled
  };
  const status: WorkspaceStatus = {
    fileUrl, setFileVersion, loadError, setLoadError, failure, setFailure, saveState, setSaveState,
    isExporting, setIsExporting, isLoaded, setIsLoaded, isPanelOpen, setIsPanelOpen, activeFocus, setActiveFocus
  };
  return { marks, selection, view, status };
}
