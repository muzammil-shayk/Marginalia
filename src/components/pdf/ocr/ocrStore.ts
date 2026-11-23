/**
 * OCR of scanned PDF pages: what has been read, what is being read, and reading on request.
 *
 * Framework-free, with the engine (tesseract.js) and the server passed in, so it is tested with
 * fakes. OCR runs only from `runPage`/`runDocument`, which the reader's button calls: attaching a
 * document only reads what was saved before. A page read once is saved and never read again; a
 * page with its own text layer is never read. One read at a time across the app.
 */

import type { OcrPage, OcrWord } from '../../../utils/ocrWords';
import { mostlyRtlWords, ocrRefusal, OCR_REFUSAL_TEXT, type OcrRefusal } from './autoOcr';

/** The bit of a pdf.js document the store needs. */
export interface OcrPdf {
  numPages: number;
}

export interface OcrEngine {
  /** Whether pdf.js finds real text on the page (then there is nothing to read). */
  pageHasText(pdf: OcrPdf, page: number): Promise<boolean>;
  /** Whether the PDF says it is a right-to-left document (then it is not read: OCR is English only). */
  isRtl(pdf: OcrPdf): Promise<boolean>;
  /** Whether the page's text has characters but no letter map (not read either). */
  pageUnmapped(pdf: OcrPdf, page: number): Promise<boolean>;
  /** Reads one page in English. `onProgress` gets 0–1; rejects once `signal` aborts. */
  recognize(pdf: OcrPdf, page: number, onProgress: (progress: number) => void, signal: AbortSignal): Promise<OcrPage>;
  /** A run is over: free the worker. */
  release(): void;
}

export interface OcrApi {
  fetchPages(docId: string): Promise<Record<number, OcrPage>>;
  savePage(docId: string, page: number, data: OcrPage): Promise<void>;
}

/**
 * idle: not read; running; done: words ready; error; has-text: the page has its own text layer;
 * unsupported: the reader asked, and OCR refuses the page (`refusal`).
 */
export type PageOcrStatus = 'idle' | 'running' | 'done' | 'error' | 'has-text' | 'unsupported';

export interface PageOcrState {
  status: PageOcrStatus;
  /** 0–1 while running, 1 once done. */
  progress: number;
  /** The words read, as page fractions; empty until done. */
  words: OcrWord[];
  error?: string;
  refusal?: OcrRefusal;
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
  /** Pages OCR refuses (`ocrRefusal`), in memory only; `told`: the reader asked, so it shows. */
  refused: Map<number, OcrRefusal>;
  told: Set<number>;
  run: DocOcrState;
  /** The server's saved pages have arrived. */
  loaded?: boolean;
  /** The reader cancelled an automatic read: no automatic reads until a drag or Read pages (memory only). */
  autoPaused?: boolean;
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

/**
 * `idleReleaseMs`: after an automatic read the engine stays loaded this long, so the next page in
 * view does not load the models again; a read asked for by the reader frees it at once.
 */
export function createOcrStore(engine: OcrEngine, api: OcrApi, opts: { idleReleaseMs?: number } = {}) {
  const idleReleaseMs = opts.idleReleaseMs ?? 20000;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const dropIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  };
  const docs = new Map<string, DocEntry>();
  const byPdf = new WeakMap<object, string>();
  const listeners = new Set<() => void>();
  /** The one read in progress, app-wide; `auto` when started by looking at the page, not by the reader. */
  let active: { docId: string; page: number; auto: boolean; abort: AbortController; done: Promise<void> } | null = null;
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
      else if (d.told.has(n) && d.refused.has(n)) state = { status: 'unsupported', progress: 0, words: [], refusal: d.refused.get(n) };
      else if (d.errors.has(n)) state = { status: 'error', progress: 0, words: [], error: d.errors.get(n) };
    }
    pageCache.set(key, state);
    return state;
  };

  /** Whether OCR refuses the page (`ocrRefusal`); remembered, and shown when the reader asked (`tell`). */
  const refuses = async (d: DocEntry, n: number, signal: AbortSignal, tell: boolean): Promise<boolean> => {
    let why = d.refused.get(n) ?? null;
    if (!why) {
      const [rtlDoc, unmapped] = await untilAborted(Promise.all([engine.isRtl(d.pdf), engine.pageUnmapped(d.pdf, n)]), signal);
      why = ocrRefusal({ rtlDoc, unmapped, rtlReadBefore: [...d.saved.values()].some((p) => mostlyRtlWords(p.words)) });
      if (why) d.refused.set(n, why);
    }
    if (why && tell) d.told.add(n);
    if (why) emit();
    return Boolean(why);
  };

  /** Reads one page inside a run, unless read already, has text or is refused. Throws on abort. */
  const readPage = async (d: DocEntry, docId: string, n: number, signal: AbortSignal, auto = false): Promise<void> => {
    if (d.saved.has(n) || d.hasText.get(n)) return;
    if (await refuses(d, n, signal, !auto)) return;
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
  const exclusive = async (docId: string, page: number, auto: boolean, work: (signal: AbortSignal) => Promise<void>): Promise<boolean> => {
    if (active) return false;
    dropIdle();
    const abort = new AbortController();
    let finish = () => {};
    active = { docId, page, auto, abort, done: new Promise<void>((r) => (finish = r)) };
    try {
      await work(abort.signal);
    } catch (err) {
      if (!isAbort(err)) throw err;
    } finally {
      active = null;
      if (auto) idleTimer = setTimeout(() => ((idleTimer = null), engine.release()), idleReleaseMs);
      else engine.release();
      finish();
    }
    return true;
  };

  /** The reader's own read goes first: an automatic read in progress is stopped and waited for. */
  const stopAuto = async (): Promise<void> => {
    if (!active?.auto) return;
    const stopped = active;
    stopped.abort.abort();
    await stopped.done;
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
        known && known.pdf === pdf ? known : { pdf, saved: new Map(), running: new Map(), errors: new Map(), hasText: new Map(), refused: new Map(), told: new Set(), run: IDLE_DOC };
      docs.set(docId, d);
      emit();
      const saved = await api.fetchPages(docId).catch(() => ({}) as Record<number, OcrPage>);
      // Still this document's current file: the server's pages are the whole truth.
      if (docs.get(docId) !== d) return;
      d.saved = new Map(Object.entries(saved).map(([n, p]) => [Number(n), p]));
      d.loaded = true;
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

    /** The saved OCR of this document has come back from the server. */
    loaded(docId: string): boolean {
      return Boolean(docs.get(docId)?.loaded);
    },

    /** What the page reported about its own text layer; undefined until it did. */
    textKnown(docId: string, n: number): boolean | undefined {
      return docs.get(docId)?.hasText.get(n);
    },

    /** OCR refused the page (`ocrRefusal`), so it is not tried again on its own. */
    refused(docId: string, n: number): boolean {
      return Boolean(docs.get(docId)?.refused.has(n));
    },

    /** The page's own text layer was looked at (PdfPage reports it). */
    reportText(docId: string, n: number, hasText: boolean): void {
      const d = docs.get(docId);
      if (!d || d.hasText.get(n) === hasText) return;
      d.hasText.set(n, hasText);
      emit();
    },

    /**
     * Reads one page. Does nothing if read, with text, or refused (a drag on a refused page says why).
     * `auto` (the page came into view): only when nothing else is being read. The reader's own request stops an automatic read and goes first;
     * otherwise it waits for nothing and is ignored while another read runs.
     */
    async runPage(docId: string, n: number, opts: { auto?: boolean } = {}): Promise<void> {
      const d = docs.get(docId);
      if (!d || d.saved.has(n) || d.hasText.get(n)) return;
      const auto = Boolean(opts.auto);
      if (auto && d.autoPaused) return;
      if (!auto) {
        d.autoPaused = false;
        await stopAuto();
      }
      if (d.saved.has(n) || d.hasText.get(n)) return;
      await exclusive(docId, n, auto, async (signal) => {
        if (await engine.pageHasText(d.pdf, n)) {
          d.hasText.set(n, true);
          emit();
          return;
        }
        await readPage(d, docId, n, signal, auto);
      });
    },

    /** Reads every page not read yet, without its own text and not refused, in order, on the reader's request. */
    async runDocument(docId: string): Promise<void> {
      const d = docs.get(docId);
      if (!d) return;
      const total = d.pdf.numPages;
      d.autoPaused = false;
      await stopAuto();
      await exclusive(docId, 1, false, async (signal) => {
        d.run = { status: 'running', done: 0, total };
        emit();
        try {
          for (let n = 1; n <= total; n++) {
            if (!d.saved.has(n) && !d.hasText.has(n)) {
              d.hasText.set(n, await engine.pageHasText(d.pdf, n));
            }
            if (signal.aborted) throw new DOMException('cancelled', 'AbortError');
            if (active) active.page = n;
            await readPage(d, docId, n, signal);
            d.run = { status: 'running', done: n, total };
            emit();
          }
          const failed = [...d.errors.keys()].length;
          // A refusal speaks for the run only when OCR read nothing at all (an RTL book, say).
          const refused = d.saved.size ? undefined : [...d.refused.values()][0];
          d.run = refused
            ? { status: 'error', done: total, total, error: OCR_REFUSAL_TEXT[refused] }
            : failed ? { status: 'error', done: total, total, error: `${failed} page${failed === 1 ? '' : 's'} could not be read` } : { status: 'done', done: total, total };
        } catch (err) {
          d.run = IDLE_DOC;
          throw err;
        } finally {
          emit();
        }
      });
    },

    /** Stops the read in progress on this document; nothing from it is saved. Cancelling an automatic read pauses them (`autoPaused`). */
    cancel(docId: string): void {
      if (active?.docId !== docId) return;
      if (active.auto) docs.get(docId)!.autoPaused = true;
      active.abort.abort();
    },

    /** Stops the read in progress on this document only if it was started automatically. */
    cancelAuto(docId: string): void {
      if (active?.docId === docId && active.auto) active.abort.abort();
    },

    /** The read in progress, app-wide: its document, page and whether it was automatic. */
    activeRead(): { docId: string; page: number; auto: boolean } | null {
      return active && { docId: active.docId, page: active.page, auto: active.auto };
    },

    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}

export type OcrStore = ReturnType<typeof createOcrStore>;
