/**
 * OCR of scanned PDF pages: what has been read, what is being read, and reading on request.
 *
 * Framework-free, with the engine (tesseract.js) and the server passed in, so it is tested with
 * fakes. OCR runs only from `runPage`/`runDocument`, which the reader's button calls: attaching a
 * document only reads what was saved before. A page read once is saved and never read again; a
 * page with its own text layer is never read. One read at a time across the app.
 */

import type { OcrPage, OcrWord } from '../../../utils/ocrWords';

/** The bit of a pdf.js document the store needs. */
export interface OcrPdf {
  numPages: number;
}

export interface OcrEngine {
  /** Whether pdf.js finds real text on the page (then there is nothing to read). */
  pageHasText(pdf: OcrPdf, page: number): Promise<boolean>;
  /** Reads one page. `onProgress` gets 0–1; rejects once `signal` aborts. */
  recognize(pdf: OcrPdf, page: number, onProgress: (progress: number) => void, signal: AbortSignal): Promise<OcrPage>;
  /** A run is over: free the worker. */
  release(): void;
}

export interface OcrApi {
  fetchPages(docId: string): Promise<Record<number, OcrPage>>;
  savePage(docId: string, page: number, data: OcrPage): Promise<void>;
}

/** idle: not read; running; done: words ready; error; has-text: the page has its own text layer. */
export type PageOcrStatus = 'idle' | 'running' | 'done' | 'error' | 'has-text';

export interface PageOcrState {
  status: PageOcrStatus;
  /** 0–1 while running, 1 once done. */
  progress: number;
  /** The words read, as page fractions; empty until done. */
  words: OcrWord[];
  error?: string;
}

export interface DocOcrState {
  status: 'idle' | 'running' | 'done' | 'error';
  /** Pages dealt with (read, already read, or with their own text) of `total`. */
  done: number;
  total: number;
  error?: string;
}

interface DocEntry {
  pdf: OcrPdf;
  saved: Map<number, OcrPage>;
  running: Map<number, number>;
  errors: Map<number, string>;
  hasText: Map<number, boolean>;
  run: DocOcrState;
}

const IDLE: PageOcrState = Object.freeze({ status: 'idle', progress: 0, words: [] }) as PageOcrState;
const IDLE_DOC: DocOcrState = Object.freeze({ status: 'idle', done: 0, total: 0 }) as DocOcrState;
const NO_TEXT: PageOcrState = Object.freeze({ status: 'has-text', progress: 0, words: [] }) as PageOcrState;

/**
 * `work`, or an AbortError as soon as `signal` aborts, whichever comes first. A stopped engine may
 * never answer (a terminated tesseract worker leaves its job pending); the run must still end.
 */
export function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException('cancelled', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('cancelled', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));
const isAbort = (err: unknown) => (err as { name?: string } | null)?.name === 'AbortError';

export function createOcrStore(engine: OcrEngine, api: OcrApi) {
  const docs = new Map<string, DocEntry>();
  const byPdf = new WeakMap<object, string>();
  const listeners = new Set<() => void>();
  /** The one read in progress, app-wide. */
  let active: { docId: string; abort: AbortController } | null = null;
  /** Snapshots handed out, kept until something changes so React sees stable objects. */
  let pageCache = new Map<string, PageOcrState>();
  let docCache = new Map<string, DocOcrState>();

  const emit = () => {
    pageCache = new Map();
    docCache = new Map();
    for (const fn of [...listeners]) fn();
  };

  const page = (docId: string, n: number): PageOcrState => {
    const key = `${docId}|${n}`;
    const hit = pageCache.get(key);
    if (hit) return hit;
    const d = docs.get(docId);
    let state: PageOcrState = IDLE;
    if (d) {
      const saved = d.saved.get(n);
      if (saved) state = { status: 'done', progress: 1, words: saved.words };
      else if (d.running.has(n)) state = { status: 'running', progress: d.running.get(n)!, words: [] };
      else if (d.hasText.get(n)) state = NO_TEXT;
      else if (d.errors.has(n)) state = { status: 'error', progress: 0, words: [], error: d.errors.get(n) };
    }
    pageCache.set(key, state);
    return state;
  };

  /** Reads one page inside a run; true when it was read (or already was). Throws on abort. */
  const readPage = async (d: DocEntry, docId: string, n: number, signal: AbortSignal): Promise<void> => {
    if (d.saved.has(n) || d.hasText.get(n)) return;
    d.errors.delete(n);
    d.running.set(n, 0);
    emit();
    try {
      const result = await untilAborted(
        engine.recognize(d.pdf, n, (p) => {
          if (signal.aborted) return;
          d.running.set(n, p);
          emit();
        }, signal),
        signal
      );
      if (signal.aborted) throw new DOMException('cancelled', 'AbortError');
      await api.savePage(docId, n, result);
      d.saved.set(n, result);
    } catch (err) {
      if (isAbort(err)) throw err;
      d.errors.set(n, messageOf(err));
    } finally {
      d.running.delete(n);
      emit();
    }
  };

  /** Runs `work` as the app's one read, freeing the engine afterwards. False when one is already running. */
  const exclusive = async (docId: string, work: (signal: AbortSignal) => Promise<void>): Promise<boolean> => {
    if (active) return false;
    const abort = new AbortController();
    active = { docId, abort };
    try {
      await work(abort.signal);
    } catch (err) {
      if (!isAbort(err)) throw err;
    } finally {
      active = null;
      engine.release();
    }
    return true;
  };

  return {
    /** A document was opened: remembers its pdf.js object and reads its saved OCR (no OCR runs). */
    async attach(docId: string, pdf: OcrPdf): Promise<void> {
      byPdf.set(pdf, docId);
      const known = docs.get(docId);
      // A new pdf.js object is a reopened or edited file (a page inserted, removed or moved): pages
      // may have new numbers, so nothing known about the old ones carries over, not even for the
      // moment until the server answers.
      const d: DocEntry =
        known && known.pdf === pdf ? known : { pdf, saved: new Map(), running: new Map(), errors: new Map(), hasText: new Map(), run: IDLE_DOC };
      docs.set(docId, d);
      emit();
      const saved = await api.fetchPages(docId).catch(() => ({}) as Record<number, OcrPage>);
      // Still this document's current file: the server's pages are the whole truth.
      if (docs.get(docId) !== d) return;
      d.saved = new Map(Object.entries(saved).map(([n, p]) => [Number(n), p]));
      emit();
    },

    docIdOf(pdf: OcrPdf): string | null {
      return byPdf.get(pdf) ?? null;
    },

    page,

    doc(docId: string): DocOcrState {
      const hit = docCache.get(docId);
      if (hit) return hit;
      const state = docs.get(docId)?.run ?? IDLE_DOC;
      docCache.set(docId, state);
      return state;
    },

    /** The page's own text layer was looked at (PdfPage reports it). */
    reportText(docId: string, n: number, hasText: boolean): void {
      const d = docs.get(docId);
      if (!d || d.hasText.get(n) === hasText) return;
      d.hasText.set(n, hasText);
      emit();
    },

    /** Reads one page, on the reader's request. Does nothing if read, has text, or a read is running. */
    async runPage(docId: string, n: number): Promise<void> {
      const d = docs.get(docId);
      if (!d || d.saved.has(n) || d.hasText.get(n)) return;
      await exclusive(docId, async (signal) => {
        if (await engine.pageHasText(d.pdf, n)) {
          d.hasText.set(n, true);
          emit();
          return;
        }
        await readPage(d, docId, n, signal);
      });
    },

    /** Reads every page not read yet and without its own text, in order, on the reader's request. */
    async runDocument(docId: string): Promise<void> {
      const d = docs.get(docId);
      if (!d) return;
      const total = d.pdf.numPages;
      await exclusive(docId, async (signal) => {
        d.run = { status: 'running', done: 0, total };
        emit();
        try {
          for (let n = 1; n <= total; n++) {
            if (!d.saved.has(n) && !d.hasText.has(n)) {
              d.hasText.set(n, await engine.pageHasText(d.pdf, n));
            }
            if (signal.aborted) throw new DOMException('cancelled', 'AbortError');
            await readPage(d, docId, n, signal);
            d.run = { status: 'running', done: n, total };
            emit();
          }
          const failed = [...d.errors.keys()].length;
          d.run = failed ? { status: 'error', done: total, total, error: `${failed} page${failed === 1 ? '' : 's'} could not be read` } : { status: 'done', done: total, total };
        } catch (err) {
          d.run = IDLE_DOC;
          throw err;
        } finally {
          emit();
        }
      });
    },

    /** Stops the read in progress on this document; nothing from it is saved. */
    cancel(docId: string): void {
      if (active?.docId === docId) active.abort.abort();
    },

    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}

export type OcrStore = ReturnType<typeof createOcrStore>;
