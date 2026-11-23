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
const page = (text: string, langs = 'eng'): OcrPage => ({ words: [{ text, x: 0.1, y: 0.1, w: 0.1, h: 0.02, line: 0 }], langs, createdAt: '2026-11-20T10:00:00.000Z' });
const pdf = { numPages: 3 } as const;

function setup(o: { saved?: Record<number, OcrPage>; text?: number[]; rtl?: boolean; fail?: boolean; saveFails?: boolean; idleReleaseMs?: number; unmapped?: number[] } = {}) {
  const calls = { recognize: [] as number[], save: [] as [string, number, OcrPage][], release: 0, fetch: 0 };
  let gate: Promise<void> | null = null;
  const engine: OcrEngine = {
    async pageHasText(_pdf, n) {
      return (o.text ?? []).includes(n);
    },
    async isRtl() {
      return Boolean(o.rtl);
    },
    async pageUnmapped(_pdf, n) {
      return (o.unmapped ?? []).includes(n);
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
  const store = createOcrStore(engine, api, { idleReleaseMs: o.idleReleaseMs ?? 20 });
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

test('pages an older version read with both languages keep their words: never read again, not even by Read pages', async () => {
  const { store, calls } = setup({ saved: { 1: page('old one', 'eng+urd'), 2: page('saved two', 'urd') } });
  await store.attach(DOC, pdf);
  await store.runPage(DOC, 1);
  await store.runPage(DOC, 1, { auto: true });
  await store.runDocument(DOC);
  assert.deepEqual(calls.recognize, [3]);
  assert.deepEqual(store.page(DOC, 1).words.map((w) => w.text), ['old one']);
  assert.deepEqual(store.page(DOC, 2).words.map((w) => w.text), ['saved two']);
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
    isRtl: async () => false, pageUnmapped: async () => false,
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
  const engine: OcrEngine = { pageHasText: async () => false, isRtl: async () => false, pageUnmapped: async () => false, recognize: async () => { throw new Error('worker crashed'); }, release() {} };
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
  const engine: OcrEngine = { pageHasText: async () => false, isRtl: async () => false, pageUnmapped: async () => false, recognize: async () => page('x'), release() {} };
  const store = createOcrStore(engine, { fetchPages: async () => server, savePage: async () => {} });
  await store.attach(DOC, pdf);
  store.reportText(DOC, 3, true);
  server = { 4: page('four') };
  await store.attach(DOC, pdf);
  assert.equal(store.page(DOC, 2).status, 'idle');
  assert.equal(store.page(DOC, 4).status, 'done');
  assert.equal(store.page(DOC, 3).status, 'has-text');
});

test('an automatic read says so while it runs (activeRead), and a manual one does too', async () => {
  const { store, holdNext } = setup();
  await store.attach(DOC, pdf);
  assert.equal(store.activeRead(), null);
  const open = holdNext();
  const auto = store.runPage(DOC, 2, { auto: true });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(store.activeRead(), { docId: DOC, page: 2, auto: true });
  open();
  await auto;
  assert.equal(store.activeRead(), null);
});

test('a read asked for by the reader (a drag) stops an automatic one and goes first; the automatic page stays unread', async () => {
  const { store, calls, holdNext } = setup();
  await store.attach(DOC, pdf);
  const open = holdNext();
  const auto = store.runPage(DOC, 3, { auto: true });
  await new Promise((r) => setTimeout(r, 0));
  const manual = store.runPage(DOC, 1);
  await auto;
  // The manual read is now the running one (the engine's gate still held).
  assert.deepEqual(store.activeRead(), { docId: DOC, page: 1, auto: false });
  open();
  await manual;
  assert.equal(store.page(DOC, 1).status, 'done');
  assert.equal(store.page(DOC, 3).status, 'idle');
  assert.deepEqual(calls.save.map(([, n]) => n), [1]);
});

test('Read pages stops an automatic read and reads the whole document, that page included', async () => {
  const { store, calls, holdNext } = setup();
  await store.attach(DOC, pdf);
  const open = holdNext();
  const auto = store.runPage(DOC, 2, { auto: true });
  await new Promise((r) => setTimeout(r, 0));
  const all = store.runDocument(DOC);
  const stopped = await Promise.race([auto.then(() => true), new Promise((r) => setTimeout(() => r(false), 100))]);
  open();
  assert.equal(stopped, true);
  await all;
  assert.deepEqual(calls.save.map(([, n]) => n), [1, 2, 3]);
  assert.equal(store.doc(DOC).status, 'done');
});

test('an automatic read never stops a running one, manual or automatic', async () => {
  const { store, calls, holdNext } = setup();
  await store.attach(DOC, pdf);
  const open = holdNext();
  const manual = store.runPage(DOC, 1);
  await new Promise((r) => setTimeout(r, 0));
  await store.runPage(DOC, 2, { auto: true });
  open();
  await manual;
  assert.deepEqual(calls.recognize, [1]);
  assert.equal(store.page(DOC, 2).status, 'idle');
});

test('cancelAuto stops only an automatic read', async () => {
  const { store, holdNext } = setup();
  await store.attach(DOC, pdf);
  const open = holdNext();
  const manual = store.runPage(DOC, 1);
  await new Promise((r) => setTimeout(r, 0));
  store.cancelAuto(DOC);
  open();
  await manual;
  // The reader's own read was left alone: it finished and was saved.
  assert.equal(store.page(DOC, 1).status, 'done');
  holdNext();
  const auto = store.runPage(DOC, 2, { auto: true });
  await new Promise((r) => setTimeout(r, 0));
  store.cancelAuto(DOC);
  await auto;
  assert.equal(store.activeRead(), null);
  assert.equal(store.page(DOC, 2).status, 'idle');
});

test('loaded: only once the saved OCR has come back from the server (so nothing saved is read again)', async () => {
  const { store } = setup({ saved: { 2: page('saved two') } });
  assert.equal(store.loaded(DOC), false);
  const attaching = store.attach(DOC, pdf);
  assert.equal(store.loaded(DOC), false);
  await attaching;
  assert.equal(store.loaded(DOC), true);
});

test('textKnown: what the page reported about its own text layer, or undefined before it did', async () => {
  const { store } = setup();
  await store.attach(DOC, pdf);
  assert.equal(store.textKnown(DOC, 1), undefined);
  store.reportText(DOC, 1, false);
  store.reportText(DOC, 2, true);
  assert.equal(store.textKnown(DOC, 1), false);
  assert.equal(store.textKnown(DOC, 2), true);
});

test('automatic reads keep the engine warm between pages and free it after a quiet spell; a manual read frees it at once', async () => {
  const { store, calls } = setup({ idleReleaseMs: 40 });
  await store.attach(DOC, pdf);
  await store.runPage(DOC, 1, { auto: true });
  await store.runPage(DOC, 2, { auto: true });
  assert.equal(calls.release, 0);
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(calls.release, 1);
  await store.runPage(DOC, 3);
  assert.equal(calls.release, 2);
});

test('a read starting inside the quiet spell keeps the engine: the pending free is dropped', async () => {
  const { store, calls } = setup({ idleReleaseMs: 40 });
  await store.attach(DOC, pdf);
  await store.runPage(DOC, 1, { auto: true });
  await new Promise((r) => setTimeout(r, 20));
  await store.runPage(DOC, 2, { auto: true });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(calls.release, 0);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(calls.release, 1);
});

test('a right-to-left document is never read: an automatic read refuses quietly, a drag says why, Read pages reads nothing', async () => {
  const { store, calls } = setup({ rtl: true });
  await store.attach(DOC, pdf);
  await store.runPage(DOC, 2, { auto: true });
  assert.equal(store.page(DOC, 2).status, 'idle');
  assert.equal(store.refused(DOC, 2), true);
  assert.equal(store.refused(DOC, 1), false);
  await store.runPage(DOC, 2);
  assert.deepEqual(store.page(DOC, 2), { status: 'unsupported', progress: 0, words: [], refusal: 'rtl' });
  await store.runDocument(DOC);
  assert.deepEqual(calls.recognize, []);
  assert.deepEqual(calls.save, []);
  assert.equal(store.page(DOC, 3).status, 'unsupported');
  assert.equal(store.doc(DOC).status, 'error');
  assert.equal(store.doc(DOC).error, "Urdu and other right-to-left books aren't supported yet.");
});

test('a document whose pages an older version read came back right to left is not read further', async () => {
  const urdu = { words: [{ text: 'میں', x: 0.1, y: 0.1, w: 0.1, h: 0.02, line: 0, rtl: true as const }], langs: 'eng+urd', createdAt: '2026-11-20T10:00:00.000Z' };
  const { store, calls } = setup({ saved: { 1: urdu } });
  await store.attach(DOC, pdf);
  await store.runPage(DOC, 2);
  assert.deepEqual(calls.recognize, []);
  assert.equal(store.page(DOC, 2).status, 'unsupported');
  assert.deepEqual(store.page(DOC, 1).words.map((w) => w.text), ['میں']);
});

test('a page whose text has no letter map is never read; a drag says the PDF hides its letters, other pages still read', async () => {
  const { store, calls } = setup({ unmapped: [1] });
  await store.attach(DOC, pdf);
  await store.runPage(DOC, 1);
  assert.equal(store.page(DOC, 1).refusal, 'unmapped');
  await store.runPage(DOC, 2);
  assert.deepEqual(calls.recognize, [2]);
  assert.equal(store.page(DOC, 2).status, 'done');
});

test('Cancel on an auto read does not restart: automatic reads pause for the document until a drag or Read pages', async () => {
  const { store, calls, holdNext } = setup();
  await store.attach(DOC, pdf);
  const held = holdNext();
  const auto = store.runPage(DOC, 2, { auto: true });
  await new Promise((r) => setTimeout(r, 0));
  store.cancel(DOC);
  held();
  await auto;
  // The next pulses of the automatic reader: neither the cancelled page nor its neighbours start.
  await store.runPage(DOC, 2, { auto: true });
  await store.runPage(DOC, 3, { auto: true });
  assert.deepEqual(calls.recognize, [2]);
  assert.equal(store.page(DOC, 3).status, 'idle');
  // A drag reads its page and lets the automatic reader go on.
  await store.runPage(DOC, 1);
  await store.runPage(DOC, 3, { auto: true });
  assert.deepEqual(calls.recognize, [2, 1, 3]);
});

test('Read pages after cancelling an auto read lets automatic reads go on', async () => {
  const { store, calls, holdNext } = setup({ text: [1, 3] });
  await store.attach(DOC, { numPages: 4 });
  const held = holdNext();
  const auto = store.runPage(DOC, 2, { auto: true });
  await new Promise((r) => setTimeout(r, 0));
  store.cancel(DOC);
  held();
  await auto;
  const open = holdNext();
  const all = store.runDocument(DOC);
  await new Promise((r) => setTimeout(r, 0));
  store.cancel(DOC);
  open();
  await all;
  calls.recognize.length = 0;
  // Cancelling the reader's own Read pages does not pause the automatic reader.
  await store.runPage(DOC, 4, { auto: true });
  assert.deepEqual(calls.recognize, [4]);
});

test('Read pages on a book with one page OCR refuses ends done when other pages were read', async () => {
  const { store, calls } = setup({ unmapped: [2] });
  await store.attach(DOC, pdf);
  await store.runDocument(DOC);
  assert.deepEqual(calls.recognize, [1, 3]);
  assert.equal(store.doc(DOC).status, 'done');
  assert.equal(store.doc(DOC).error, undefined);
});
