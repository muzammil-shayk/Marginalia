/**
 * Run with: npx tsx --test src/components/pdf/ocr/ocrStore.test.ts
 *
 * The OCR store with a fake engine and a fake server: OCR runs only when asked, a page read once
 * is never read again, pages with their own text are left alone, and cancel or failure saves nothing.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOcrStore, type OcrEngine, type OcrApi } from './ocrStore';
import type { OcrPage } from '../../../utils/ocrWords';

const DOC = 'a'.repeat(32);
const page = (text: string): OcrPage => ({ words: [{ text, x: 0.1, y: 0.1, w: 0.1, h: 0.02, line: 0 }], langs: 'eng+urd', createdAt: '2026-11-20T10:00:00.000Z' });
const pdf = { numPages: 3 } as const;

function setup(o: { saved?: Record<number, OcrPage>; text?: number[]; fail?: boolean; saveFails?: boolean } = {}) {
  const calls = { recognize: [] as number[], save: [] as [string, number, OcrPage][], release: 0, fetch: 0 };
  let gate: Promise<void> | null = null;
  const engine: OcrEngine = {
    async pageHasText(_pdf, n) {
      return (o.text ?? []).includes(n);
    },
    async recognize(_pdf, n, onProgress, signal) {
      calls.recognize.push(n);
      onProgress(0.5);
      if (o.fail) throw new Error('worker crashed');
      if (gate) await gate;
      if (signal.aborted) throw new DOMException('cancelled', 'AbortError');
      return page(`page ${n}`);
    },
    release() {
      calls.release++;
    }
  };
  const api: OcrApi = {
    async fetchPages() {
      calls.fetch++;
      return o.saved ?? {};
    },
    async savePage(id, n, data) {
      calls.save.push([id, n, data]);
      if (o.saveFails) throw new Error('disk full');
    }
  };
  const store = createOcrStore(engine, api);
  return {
    store,
    calls,
    /** Makes the next recognize wait until `release` is called. */
    holdNext() {
      let open = () => {};
      gate = new Promise<void>((r) => (open = r));
      return () => {
        gate = null;
        open();
      };
    }
  };
}

test('attaching a document reads its saved OCR but never runs OCR', async () => {
  const { store, calls } = setup({ saved: { 2: page('saved two') } });
  await store.attach(DOC, pdf);
  assert.equal(calls.fetch, 1);
  assert.deepEqual(calls.recognize, []);
  assert.equal(store.page(DOC, 2).status, 'done');
  assert.deepEqual(store.page(DOC, 2).words.map((w) => w.text), ['saved two']);
  assert.equal(store.page(DOC, 1).status, 'idle');
  assert.equal(store.docIdOf(pdf), DOC);
});

test('a page is read when asked, saved, and never read twice', async () => {
  const { store, calls } = setup();
  await store.attach(DOC, pdf);
  const seen: string[] = [];
  store.subscribe(() => seen.push(store.page(DOC, 1).status));
  await store.runPage(DOC, 1);
  assert.equal(store.page(DOC, 1).status, 'done');
  assert.deepEqual(store.page(DOC, 1).words.map((w) => w.text), ['page 1']);
  assert.ok(seen.includes('running'));
  assert.deepEqual(calls.recognize, [1]);
  assert.deepEqual(calls.save.map(([id, n, d]) => [id, n, d.words[0].text]), [[DOC, 1, 'page 1']]);
  assert.equal(calls.release, 1);
  await store.runPage(DOC, 1);
  assert.deepEqual(calls.recognize, [1]);
});

test('progress is reported while a page is read', async () => {
  const { store } = setup();
  await store.attach(DOC, pdf);
  const progress: number[] = [];
  store.subscribe(() => progress.push(store.page(DOC, 1).progress));
  await store.runPage(DOC, 1);
  assert.ok(progress.includes(0.5));
  assert.equal(store.page(DOC, 1).progress, 1);
});

test('a page with its own text layer is never read', async () => {
  const { store, calls } = setup();
  await store.attach(DOC, pdf);
  store.reportText(DOC, 3, true);
  assert.equal(store.page(DOC, 3).status, 'has-text');
  await store.runPage(DOC, 3);
  assert.deepEqual(calls.recognize, []);
});

test('a failure shows as an error, saves nothing, and can be tried again', async () => {
  const { store, calls } = setup({ fail: true });
  await store.attach(DOC, pdf);
  await store.runPage(DOC, 1);
  assert.equal(store.page(DOC, 1).status, 'error');
  assert.equal(store.page(DOC, 1).error, 'worker crashed');
  assert.deepEqual(calls.save, []);
  assert.equal(calls.release, 1);
  await store.runPage(DOC, 1);
  assert.deepEqual(calls.recognize, [1, 1]);
});

test('a page that cannot be saved is an error, not shown as read', async () => {
  const { store } = setup({ saveFails: true });
  await store.attach(DOC, pdf);
  await store.runPage(DOC, 1);
  assert.equal(store.page(DOC, 1).status, 'error');
  assert.equal(store.page(DOC, 1).error, 'disk full');
  assert.deepEqual(store.page(DOC, 1).words, []);
});

test('cancel stops the read: nothing saved, the page back to idle', async () => {
  const { store, calls, holdNext } = setup();
  await store.attach(DOC, pdf);
  const release = holdNext();
  const run = store.runPage(DOC, 1);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(store.page(DOC, 1).status, 'running');
  store.cancel(DOC);
  release();
  await run;
  assert.equal(store.page(DOC, 1).status, 'idle');
  assert.deepEqual(calls.save, []);
  assert.equal(calls.release, 1);
});

test('reading a whole document skips pages already read and pages with text', async () => {
  const { store, calls } = setup({ saved: { 2: page('saved two') }, text: [3] });
  await store.attach(DOC, pdf);
  const totals: string[] = [];
  store.subscribe(() => {
    const d = store.doc(DOC);
    totals.push(`${d.status} ${d.done}/${d.total}`);
  });
  await store.runDocument(DOC);
  assert.deepEqual(calls.recognize, [1]);
  assert.equal(store.page(DOC, 3).status, 'has-text');
  assert.deepEqual(store.doc(DOC), { status: 'done', done: 3, total: 3 });
  assert.ok(totals.includes('running 0/3'));
  assert.equal(calls.release, 1);
});

test('only one read runs at a time: a second request while one runs is ignored', async () => {
  const { store, calls, holdNext } = setup();
  await store.attach(DOC, pdf);
  const release = holdNext();
  const first = store.runPage(DOC, 1);
  await new Promise((r) => setTimeout(r, 5));
  await store.runPage(DOC, 2);
  release();
  await first;
  assert.deepEqual(calls.recognize, [1]);
  assert.equal(store.page(DOC, 2).status, 'idle');
});

test('an unattached document has nothing to read', async () => {
  const { store, calls } = setup();
  assert.equal(store.page('b'.repeat(32), 1).status, 'idle');
  await store.runPage('b'.repeat(32), 1);
  assert.deepEqual(calls.recognize, []);
});

test('cancel frees the read even when the engine never answers after it is stopped', async () => {
  let call = 0;
  let released = 0;
  const engine: OcrEngine = {
    async pageHasText() {
      return false;
    },
    recognize(_pdf, n) {
      call++;
      // The first read hangs for good, as a terminated tesseract worker's job does.
      return call === 1 ? new Promise<never>(() => {}) : Promise.resolve(page(`page ${n}`));
    },
    release() {
      released++;
    }
  };
  const saved: number[] = [];
  const store = createOcrStore(engine, { fetchPages: async () => ({}), savePage: async (_id, n) => void saved.push(n) });
  await store.attach(DOC, pdf);
  const run = store.runPage(DOC, 1);
  await new Promise((r) => setTimeout(r, 5));
  store.cancel(DOC);
  const settled = await Promise.race([run.then(() => 'settled'), new Promise((r) => setTimeout(() => r('stuck'), 1000))]);
  assert.equal(settled, 'settled');
  assert.equal(store.page(DOC, 1).status, 'idle');
  assert.equal(released, 1);
  assert.deepEqual(saved, []);
  // The next read is not blocked.
  await store.runPage(DOC, 2);
  assert.equal(store.page(DOC, 2).status, 'done');
});

test('re-attaching after a page edit drops OCR the server no longer has, and what was known about the old pages', async () => {
  let server: Record<number, OcrPage> = { 2: page('old two') };
  const engine: OcrEngine = { pageHasText: async () => false, recognize: async () => { throw new Error('worker crashed'); }, release() {} };
  const store = createOcrStore(engine, { fetchPages: async () => server, savePage: async () => {} });
  await store.attach(DOC, pdf);
  store.reportText(DOC, 3, true);
  await store.runPage(DOC, 1);
  assert.equal(store.page(DOC, 1).status, 'error');
  // A page was inserted: the server dropped the OCR, the PDF is a new pdf.js object.
  server = {};
  const edited = { numPages: 4 } as const;
  const attaching = store.attach(DOC, edited);
  // Gone at once, before the server answers: no old words on the new pages, even for a moment.
  assert.equal(store.page(DOC, 2).status, 'idle');
  await attaching;
  assert.equal(store.page(DOC, 2).status, 'idle');
  assert.deepEqual(store.page(DOC, 2).words, []);
  assert.equal(store.page(DOC, 3).status, 'idle');
  assert.equal(store.page(DOC, 1).status, 'idle');
  assert.equal(store.docIdOf(edited), DOC);
});

test('re-attaching the same document object keeps what it knows and takes the server\'s pages', async () => {
  let server: Record<number, OcrPage> = { 2: page('two') };
  const engine: OcrEngine = { pageHasText: async () => false, recognize: async () => page('x'), release() {} };
  const store = createOcrStore(engine, { fetchPages: async () => server, savePage: async () => {} });
  await store.attach(DOC, pdf);
  store.reportText(DOC, 3, true);
  server = { 4: page('four') };
  await store.attach(DOC, pdf);
  assert.equal(store.page(DOC, 2).status, 'idle');
  assert.equal(store.page(DOC, 4).status, 'done');
  assert.equal(store.page(DOC, 3).status, 'has-text');
});
