import type { ThematicAnalysisResult } from '../types';
/**
 * Client side of the local document store (see `src/services/documentStore.ts` for the server
 * half). Documents live on the machine's own filesystem instead of in the browser, so the app
 * is not bounded by the ~5MB `sessionStorage` quota, the original uploaded file is kept rather
 * than discarded the moment it is parsed, and annotations survive restarts. The browser holds
 * only an id and a bit of metadata; text, originals and annotations are fetched on demand.
 */

/**
 * One stored annotation. Deliberately opaque: the store round-trips these records verbatim and
 * never interprets them, so it does not need to model whatever the reader writes into them.
 */
export type Annotation = { id: string; [key: string]: unknown };

export interface StoredDocumentMeta {
  id: string;
  title: string;
  format: string;
  filename: string;
  wordCount: number;
  originalBytes: number;
  createdAt: string;
  updatedAt: string;
  /** Null when retention is off, which is the default — the document is kept until deleted. */
  expiresAt: string | null;
  annotationCount: number;
  /** The distinct theme ids tagged anywhere in this document, for the Home screen's theme dashboard. */
  themeIds: string[];
  /** How many marks this document carries under each theme id, keyed by `UserSettings.activeThemes[].id`. */
  themeCounts: Record<string, number>;
  /** How many annotations in this document are marked terminology, for the Home screen's Terminologies section. */
  terminologyCount: number;
  /** A digest of the saved thematic analysis, or null if this book has never been analysed.
   *  Drives the Home screen's AI Themes section without loading every full result. */
  analysis: {
    analysedAt: string;
    primaryThemes: string[];
    themeCount: number;
  } | null;
  retentionDays?: number;
}

export interface StorageInfo {
  backend: string;
  /** Absolute path documents are written to, shown to the user in the library panel. */
  location: string;
  retentionDays: number;
}

/**
 * Uploads one parsed document: its extracted text as JSON, then the original file's raw bytes.
 *
 * Two requests, deliberately. A document's text is far too large to ride in a query string
 * (Node caps request headers at ~16KB, so anything past ~3,000 words is rejected outright),
 * and base64-ing the file into the JSON would inflate it by a third. Sending each in the shape
 * that suits it keeps both effectively unbounded.
 *
 * Unlike before, attaching the original is NOT best-effort for PDFs: the workspace renders the
 * real file, so a PDF whose bytes failed to store would open to an empty viewer. The error is
 * surfaced instead of swallowed, and the caller decides what to do about it.
 */
export async function storeUploadedDocument(params: {
  file: File;
  title: string;
  text: string;
  format: string;
}): Promise<StoredDocumentMeta> {
  const meta = await storePastedDocument({
    title: params.title,
    text: params.text,
    format: params.format,
    filename: params.file.name
  });

  const res = await fetch(
    `/api/documents/${meta.id}/original?filename=${encodeURIComponent(params.file.name)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: await params.file.arrayBuffer()
    }
  );
  if (!res.ok) {
    throw new Error('The document was saved, but its original file could not be stored.');
  }

  return { ...meta, originalBytes: params.file.size };
}

/**
 * Stores an imported HTML document, converting it to a PDF on the server on the way in.
 *
 * One request rather than the two an ordinary upload takes, because the bytes to store do not
 * exist until the conversion has run — the server prints the page and attaches the result
 * itself, so there is never a moment where a record exists without its renderable original.
 * See `POST /api/documents/from-html` for why the conversion happens at import time at all.
 */
export async function storeHtmlDocument(params: {
  title: string;
  text: string;
  html: string;
  filename: string;
}): Promise<StoredDocumentMeta> {
  const res = await fetch('/api/documents/from-html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || 'That HTML file could not be imported.');
  }
  return res.json();
}

/** Stores a document that has no original file behind it — text pasted straight into the app. */
export async function storePastedDocument(params: {
  title: string;
  text: string;
  format?: string;
  filename?: string;
}): Promise<StoredDocumentMeta> {
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: params.title,
      text: params.text,
      format: params.format || 'TXT',
      filename: params.filename
    })
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || 'Failed to store the document on this device.');
  }
  return res.json();
}

/**
 * Re-fetches a stored document's text. Returns null when the document is gone — because it was
 * deleted from the library, or retired by the sweeper if retention was turned on — so callers
 * can tell that apart from a genuine failure.
 */
export async function fetchDocumentText(id: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/documents/${id}`);
    if (!res.ok) return null;
    const doc = await res.json();
    return typeof doc.text === 'string' ? doc.text : null;
  } catch {
    return null;
  }
}

/** Every document currently on disk, newest activity first. Backs the library panel. */
export async function listStoredDocuments(): Promise<StoredDocumentMeta[]> {
  try {
    const res = await fetch('/api/documents');
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body.documents) ? body.documents : [];
  } catch {
    return [];
  }
}

/** Renames a stored document. Returns null if it is no longer there. */
export async function renameStoredDocument(id: string, title: string): Promise<StoredDocumentMeta | null> {
  try {
    const res = await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * URL for the original uploaded file.
 *
 * `inline` is what the PDF workspace loads: it makes the server send the file with its real
 * content type instead of as a download, which is what PDF.js needs to render the actual pages.
 */
export interface GeminiConfig {
  configured: boolean;
  /** 'settings' when set from inside the app, 'environment' when it came from GEMINI_API_KEY. */
  source: 'settings' | 'environment' | null;
  model: string;
}

/** Whether analysis is ready, and which model it will use. Never returns the key itself. */
export async function fetchGeminiConfig(): Promise<GeminiConfig | null> {
  try {
    const res = await fetch('/api/gemini-config');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Stores the key and model on this machine. An empty key clears it. */
export async function saveGeminiConfig(update: {
  apiKey?: string;
  model?: string;
}): Promise<GeminiConfig | null> {
  try {
    const res = await fetch('/api/gemini-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update)
    });
    if (!res.ok) return null;
    const body = await res.json();
    return { configured: Boolean(body.configured), source: 'settings', model: body.model };
  } catch {
    return null;
  }
}

/**
 * The analysis already saved for a document, or null if it has never been analysed.
 *
 * Separate from `fetchDocument` because that hands back the entire text of the book, which is the
 * one thing this caller does not want.
 */
export async function fetchSavedAnalysis(
  id: string
): Promise<{ data: ThematicAnalysisResult; analysedAt: string; model: string } | null> {
  try {
    const res = await fetch(`/api/documents/${id}/analysis`);
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data ? { data: body.data, analysedAt: body.analysedAt, model: body.model } : null;
  } catch {
    return null;
  }
}

/**
 * What a stored PDF says it is inside its own metadata, for prefilling the analysis lookup form.
 * Empty strings when the document is not a PDF, carries nothing usable, or cannot be parsed —
 * the caller falls back to guessing from the filename.
 */
export async function fetchBookMetadata(id: string): Promise<{ title: string; author: string }> {
  try {
    const res = await fetch(`/api/documents/${id}/book-metadata`);
    if (!res.ok) return { title: '', author: '' };
    return await res.json();
  } catch {
    return { title: '', author: '' };
  }
}

export function originalDocumentUrl(id: string, disposition: 'inline' | 'attachment' = 'attachment'): string {
  return `/api/documents/${id}/original${disposition === 'inline' ? '?disposition=inline' : ''}`;
}

export interface StoredAnnotationSet {
  annotations: Annotation[];
}

/**
 * Reads a document's marks, or null if they could not be read.
 *
 * The null matters more than it looks. This used to answer a failed request with an empty set,
 * which is indistinguishable from a book nobody has marked yet — so the workspace would open
 * showing nothing, decide it was loaded, and write that emptiness straight back over the marks
 * still on disk. A request that fails while the server is still starting is enough to do it.
 * Failure and emptiness are different answers and callers must be able to tell them apart.
 */
export async function fetchAnnotations(id: string): Promise<StoredAnnotationSet | null> {
  try {
    const res = await fetch(`/api/documents/${id}/annotations`);
    if (!res.ok) return null;
    const body = await res.json();
    return { annotations: Array.isArray(body.annotations) ? body.annotations : [] };
  } catch {
    return null;
  }
}

/**
 * Writes the document's complete annotation set to disk, replacing what was there.
 *
 * The client holds the authoritative set and re-sends all of it after each edit. That is a
 * little wasteful per keystroke — which is why callers debounce — but it removes any chance of
 * the on-disk set drifting out of sync with what the reader can see.
 */
export async function saveAnnotations(id: string, annotations: Annotation[]): Promise<boolean> {
  try {
    const res = await fetch(`/api/documents/${id}/annotations`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annotations })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type PageInsertPlacement = 'before' | 'after' | 'both-ends';
export type PageInsertHeight = 'full' | 'header' | 'notes';

export interface PageInsertResult {
  /** 1-based page numbers the new blank page(s) landed at, in the NEW numbering. */
  insertedPages: number[];
  pageCount: number;
}

/**
 * Inserts a real blank page into this document's own stored PDF, relative to `anchorPage`
 * (ignored for `'both-ends'`, which adds one at the very start and one at the very end). Existing
 * annotations are renumbered server-side to match — see server.ts's handler for exactly how.
 *
 * Returns null on failure (a non-PDF document, a missing file, or a malformed PDF).
 */
export async function insertPage(
  id: string,
  placement: PageInsertPlacement,
  height: PageInsertHeight,
  anchorPage: number
): Promise<PageInsertResult | null> {
  try {
    const res = await fetch(`/api/documents/${id}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement, height, anchorPage })
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Removes one page — inserted or original — from this document's own stored PDF, discarding any
 * annotation on it and shifting every later page down by one. Returns null on failure (the last
 * remaining page, an out-of-range page number, or a non-PDF document).
 */
export async function deletePage(id: string, pageNumber: number): Promise<{ pageCount: number } | null> {
  try {
    const res = await fetch(`/api/documents/${id}/pages/${pageNumber}`, { method: 'DELETE' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Where the reader left off in a document's PDF workspace — zoom, page, single/spread view. */
export interface ReadingState {
  scale: number;
  page: number;
  viewMode: 'single' | 'spread';
}

/**
 * The reader's last position in this document, or null if it has never been opened in the PDF
 * workspace. Kept on the server rather than in localStorage — see `ReadingState`'s definition on
 * the server side (server.ts) for why that matters for the desktop build specifically.
 */
export async function fetchReadingState(id: string): Promise<ReadingState | null> {
  try {
    const res = await fetch(`/api/documents/${id}/reading-state`);
    if (!res.ok) return null;
    const body = await res.json();
    return body.readingState ?? null;
  } catch {
    return null;
  }
}

export async function saveReadingState(id: string, readingState: ReadingState): Promise<boolean> {
  try {
    const res = await fetch(`/api/documents/${id}/reading-state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readingState })
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Deletes a document from this device permanently — its record, its original file and its
 * annotations. There is no undo, which is why the library panel confirms first.
 */
export async function deleteStoredDocument(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (!res.ok) return false;
    const body = await res.json();
    return Boolean(body.deleted);
  } catch {
    return false;
  }
}

/** Where documents are being written, so the library can show the user the real folder. */
export async function fetchStorageInfo(): Promise<StorageInfo | null> {
  try {
    const res = await fetch('/api/storage');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * The reader's saved preferences (name, theme colours, palettes, typography, dark mode), or null
 * if none have been saved yet. This is the durable copy — see `saveRemoteSettings` for why it
 * exists alongside localStorage rather than instead of it.
 */
/**
 * Reads the durable settings, distinguishing "nothing saved yet" from "could not read".
 *
 * It used to answer both with `null`, and the caller treats `null` as a first launch — so a
 * settings request that failed because the embedded server had not finished starting looked
 * exactly like a fresh install. The app then held whatever localStorage had (nothing, on a new
 * machine: a different port is a different origin), and the next settings change wrote those
 * defaults over the real ones. One failed request at startup was enough to replace a reader's
 * themes with the stock three.
 */
export async function fetchRemoteSettings(): Promise<
  { ok: true; settings: Record<string, unknown> | null } | { ok: false }
> {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return { ok: false };
    const body = await res.json();
    return { ok: true, settings: body.settings ?? null };
  } catch {
    return { ok: false };
  }
}

/**
 * Writes the reader's preferences to disk, alongside the document library rather than only to
 * the browser's localStorage. The desktop build's embedded server binds to a fresh random port
 * every launch (see server.ts's PORT=0 comment), and a different port is a different origin to
 * the browser — so localStorage alone would quietly reset every restart and every auto-update.
 * This file lives in the OS per-user application-data directory instead, which survives both.
 */
export async function saveRemoteSettings(settings: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Result of asking the desktop shell to change where documents are stored. */
export interface StorageChangeResult {
  changed: boolean;
  path?: string;
  /** How many files were copied across, when the user chose to move their library. */
  moved?: number;
  error?: string;
}

export interface AppInfo {
  version: string;
  platform: string;
  electron: string;
  defaultStorageDir: string;
}

/** Progress of the current auto-update check, download or install. */
export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string };

/**
 * The desktop bridge exposed by `electron/preload.cjs`, or null when not running in the desktop
 * app. Settings uses its absence to hide controls that only the shell can perform — picking a
 * folder needs a native dialog, which a page cannot open.
 */
export interface DesktopBridge {
  isDesktop: boolean;
  getStorageDir(): Promise<string>;
  revealStorageDir(): Promise<void>;
  chooseStorageDir(): Promise<StorageChangeResult>;
  resetStorageDir(): Promise<StorageChangeResult>;
  getAppInfo(): Promise<AppInfo>;
  checkForUpdates(): Promise<void>;
  quitAndInstallUpdate(): Promise<void>;
  getAutoUpdatePreference(): Promise<boolean>;
  setAutoUpdatePreference(enabled: boolean): Promise<void>;
  onUpdateStatus(callback: (status: UpdateStatus) => void): () => void;
}

export function desktopBridge(): DesktopBridge | null {
  return (window as unknown as { marginaliaDesktop?: DesktopBridge }).marginaliaDesktop ?? null;
}
