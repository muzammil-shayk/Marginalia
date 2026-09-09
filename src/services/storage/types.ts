import type { ThematicAnalysisResult } from '../../types';

/**
 * The storage contract every document backend implements. One exists today: the local
 * filesystem. The interface is kept so the store can be swapped without touching its callers.
 *
 * A backend stores three things per document — the extracted text plus metadata, the original
 * uploaded file byte-for-byte, and the reader's annotations — under this logical layout:
 *
 *   documents/{id}.json   metadata + extracted text + annotations
 *   originals/{id}{ext}   the raw uploaded file
 */

/**
 * A thematic analysis kept with the document it is about.
 *
 * Stored because a run costs real tokens and a minute of waiting — analysing the same book twice
 * to read the same answer is the one thing worth caching in this app. `analysedAt` and `model`
 * are kept so a result can be judged: an analysis from a year ago on a retired model is still
 * worth showing, but the reader should be able to see that is what it is.
 */
export interface StoredAnalysis extends ThematicAnalysisResult {
  analysedAt: string;
  model: string;
}

/**
 * Just enough of an analysis for the library to list it without loading every document's full
 * result. Recomputed from `analysis` on every write, the same way `themeIds` is.
 */
export interface AnalysisSummary {
  analysedAt: string;
  /** The themes marked Primary, in the order the model gave them. What the Home screen shows. */
  primaryThemes: string[];
  /** How many themes were found in total, primary or not. */
  themeCount: number;
}

/** Everything about a stored document except its (potentially huge) text and original bytes. */
export interface DocumentMeta {
  id: string;
  title: string;
  format: string;
  /** Original upload filename, kept so a re-download hands back the file the user recognizes. */
  filename: string;
  wordCount: number;
  /** Byte size of the stored original, or 0 when the document was pasted rather than uploaded. */
  originalBytes: number;
  createdAt: string;
  /** Last time the title or annotations changed, so the library can sort by recent activity. */
  updatedAt: string;
  /**
   * When the sweeper becomes eligible to delete this document, or null when retention is
   * disabled — the default. See RETENTION_DAYS.
   */
  expiresAt: string | null;
  /** How many annotations are stored, so the library can show a count without loading them. */
  annotationCount: number;
  /**
   * The distinct set of theme ids tagged anywhere in this document's annotations, so a
   * cross-document "which books touch theme X" view doesn't have to load every document's full
   * annotation list just to find out. Recomputed from `annotations` on every write; see
   * `computeThemeIds`.
   */
  themeIds: string[];
  /**
   * How many of this document's annotations are marked terminology (`isTerminology: true`), so
   * the Home screen's Terminologies section can list which books have any without loading every
   * document's full annotation list. Recomputed from `annotations` on every write, the same way
   * `themeIds` is; see `countTerminology`.
   */
  terminologyCount: number;
  /** A one-line digest of this document's saved analysis, or null if it has never been analysed. */
  analysis: AnalysisSummary | null;
  /**
   * How many marks this document carries under each theme id, so the library can say "4 marks
   * under Key Concepts" rather than only "this book touches Key Concepts". `themeIds` is kept
   * alongside it because a great deal of code only asks the yes/no question.
   */
  themeCounts: Record<string, number>;
}

/**
 * One annotation over the original PDF, in InkLayer Annotation Core v0.1 format.
 *
 * The client library (`inklayer-react`) owns this schema; the server stores and returns these
 * objects verbatim and never interprets their geometry, so the type stays deliberately open
 * rather than duplicating a third-party model that this side has no use for. Only `id` is
 * required, because that is the only field the store itself relies on.
 *
 * Coordinates inside are in PDF user space (origin bottom-left, 1pt = 1/72"), which is what
 * makes an annotation land on the same words no matter what zoom or window size it is later
 * viewed at. See `src/components/pdf/annotationTypes.ts` for the client-side mirror.
 */
export interface StoredAnnotation {
  id: string;
  [key: string]: unknown;
}

/**
 * Where the reader left off in the PDF workspace — zoom, page and single/spread view. Stored
 * alongside the document itself (not in the browser's localStorage) for the same reason
 * `UserSettings` moved server-side: the desktop build's embedded server binds to a fresh random
 * port every launch, so a different port is a different origin to the browser, and localStorage
 * would silently reset on every restart and every auto-update.
 */
export interface ReadingState {
  scale: number;
  page: number;
  viewMode: 'single' | 'spread';
}

// `analysis` is narrowed rather than inherited: the meta carries only the digest, the stored
// record carries the whole result.
export interface StoredDocument extends Omit<DocumentMeta, 'analysis'> {
  text: string;
  annotations: StoredAnnotation[];
  /** Null until the reader has opened this document in the PDF workspace at least once. */
  readingState: ReadingState | null;
  /** The last thematic analysis run on this document, kept so it need not be paid for twice. */
  analysis: StoredAnalysis | null;
}

/**
 * The distinct, non-null `themeId` values found across a document's own annotations, sorted for
 * a stable diff/compare. Each annotation is opaque to the store ({id: string; [key: string]:
 * unknown}), so `themeId` is read defensively rather than assumed to exist or be well-typed.
 */
export function computeThemeIds(annotations: StoredAnnotation[]): string[] {
  const ids = new Set<string>();
  for (const a of annotations) {
    if (typeof a.themeId === 'string' && a.themeId) ids.add(a.themeId);
  }
  return Array.from(ids).sort();
}

/** How many annotations sit under each theme id. See `DocumentMeta.themeCounts`. */
export function computeThemeCounts(annotations: StoredAnnotation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of annotations) {
    if (typeof a.themeId === 'string' && a.themeId) counts[a.themeId] = (counts[a.themeId] ?? 0) + 1;
  }
  return counts;
}

/** Digests a stored analysis for the library list. See `DocumentMeta.analysis`. */
export function summarizeAnalysis(analysis: StoredAnalysis | null): AnalysisSummary | null {
  if (!analysis) return null;
  const themes = Array.isArray(analysis.themes) ? analysis.themes : [];
  return {
    analysedAt: analysis.analysedAt,
    primaryThemes: themes.filter((t) => t.prominence === 'Primary').map((t) => t.themeName),
    themeCount: themes.length
  };
}

/** How many of this document's annotations are marked terminology. See `DocumentMeta.terminologyCount`. */
export function countTerminology(annotations: StoredAnnotation[]): number {
  return annotations.filter((a) => a.isTerminology === true).length;
}

export interface SaveDocumentParams {
  title: string;
  text: string;
  format: string;
  filename?: string;
}

/** The fields a caller is allowed to change on an existing document. */
export interface UpdateDocumentParams {
  title?: string;
  annotations?: StoredAnnotation[];
  readingState?: ReadingState;
  analysis?: StoredAnalysis;
}

export interface DocumentBackend {
  /** Human-readable name of this backend, surfaced in startup logs. */
  readonly name: string;
  /** Absolute path of the directory documents are written to, shown in the UI. */
  readonly location: string;
  saveDocument(params: SaveDocumentParams): Promise<DocumentMeta>;
  attachOriginal(id: string, original: Buffer, filename?: string): Promise<boolean>;
  getDocument(id: string): Promise<StoredDocument | null>;
  getOriginal(id: string): Promise<{ buffer: Buffer; filename: string } | null>;
  listDocuments(): Promise<DocumentMeta[]>;
  updateDocument(id: string, params: UpdateDocumentParams): Promise<DocumentMeta | null>;
  deleteDocument(id: string): Promise<boolean>;
  /** Deletes every document past its retention window; returns how many were removed. */
  sweepExpiredDocuments(): Promise<number>;
  /**
   * The reader's preferences (name, theme colours, palettes, typography, …), or null if none have
   * been saved yet. Kept alongside the document library rather than in the browser's localStorage
   * because the desktop build's embedded server binds to a fresh random port every launch (see
   * server.ts) — a different port is a different origin to the browser, so localStorage would
   * silently reset on every restart and every auto-update. This file, like the library itself,
   * lives in the OS per-user application-data directory and survives both.
   */
  getSettings(): Promise<Record<string, unknown> | null>;
  saveSettings(settings: Record<string, unknown>): Promise<void>;
}

/**
 * How long a document survives before the sweeper removes it, or 0 for "keep forever" — the
 * default.
 *
 * Retention is deliberately OFF unless asked for. This store holds the user's own library on
 * their own machine, and they delete from it explicitly through the library panel; a timer
 * that quietly erased documents they had not opened in a week would be data loss, not
 * housekeeping. Set MARGINALIA_RETENTION_DAYS to a positive number to opt back in.
 */
export const RETENTION_DAYS = Math.max(0, Number(process.env.MARGINALIA_RETENTION_DAYS || 0) || 0);

/**
 * Rejects any id that isn't one we generated. Ids arrive straight off the URL and are joined
 * into a filesystem path — without this, an id like `../../etc/passwd` could read or delete
 * something well outside the store.
 */
export function isValidId(id: string): boolean {
  return /^[a-f0-9]{32}$/.test(id);
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * The extension to store a file under. Only the extension is taken from the user's filename —
 * the rest of the stored name is our own generated id, so a hostile filename can never steer
 * the write outside the store.
 */
export function safeExtension(filename: string): string {
  const match = /\.[^./\\]+$/.exec(filename || '');
  if (!match) return '';
  return match[0].replace(/[^.a-zA-Z0-9]/g, '').slice(0, 12);
}

export function buildMeta(id: string, params: SaveDocumentParams): DocumentMeta {
  const now = new Date();
  return {
    id,
    title: params.title || 'Untitled Document',
    format: params.format || 'TXT',
    filename: params.filename || `${params.title || 'document'}.${(params.format || 'txt').toLowerCase()}`,
    wordCount: countWords(params.text),
    originalBytes: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: RETENTION_DAYS > 0 ? new Date(now.getTime() + RETENTION_DAYS * 864e5).toISOString() : null,
    annotationCount: 0,
    themeIds: [],
    themeCounts: {},
    terminologyCount: 0,
    analysis: null
  };
}
