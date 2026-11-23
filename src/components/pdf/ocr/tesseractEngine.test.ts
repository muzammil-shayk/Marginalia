/**
 * Run with: timeout 60 npx tsx --test src/components/pdf/ocr/tesseractEngine.test.ts
 *
 * The tesseract engine with a fake worker and a fake page renderer: a read cancelled while its
 * page is still being drawn, or while its worker is still starting, leaves no worker behind and
 * never hands a stopped worker a job.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTesseractEngine, ocrImageScale } from './tesseractEngine';

function held<T>() {
  let open: (v: T) => void = () => {};
  const promise = new Promise<T>((r) => (open = r));
  return { promise, open };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(o: { rtl?: boolean; holdWorker?: boolean; pageText?: string } = {}) {
  const calls = { created: 0, terminated: 0, recognize: 0, render: 0, reinitialize: 0, params: [] as unknown[], sides: [] as number[] };
  const renders: ReturnType<typeof held<{ width: number; height: number }>>[] = [];
  const startup = held<void>();
  const fakeWorker = {
    async recognize() {
      calls.recognize++;
      return { data: { confidence: 90, text: 'some english words here', blocks: [] } };
    },
    async reinitialize() {
      calls.reinitialize++;
    },
    async setParameters(p: unknown) {
      calls.params.push(p);
    },
    async terminate() {
      calls.terminated++;
    }
  };
  const engine = createTesseractEngine({
    async createWorker() {
      calls.created++;
      if (o.holdWorker) await startup.promise;
      return fakeWorker as never;
    },
    pageImage(_pdf: unknown, _n: number, side: number) {
      calls.render++;
      calls.sides.push(side);
      const r = held<{ width: number; height: number }>();
      renders.push(r);
      return r.promise as never;
    }
  });
  const pdf = {
    async getMetadata() {
      return { info: o.rtl ? { Language: 'ur' } : {} };
    },
    async getViewerPreferences() {
      return null;
    },
    async getPage() {
      if (o.pageText === undefined) throw new Error('no page');
      return { getTextContent: async () => ({ items: [{ str: o.pageText }] }) };
    }
  };
  return { engine, calls, renders, startup, pdf: pdf as never };
}

test('cancelled while the page is drawing: no worker is created afterwards', async () => {
  const s = setup();
  const abort = new AbortController();
  const read = s.engine.recognize(s.pdf, 1, () => {}, abort.signal);
  while (s.renders.length === 0) await flush();
  abort.abort();
  await assert.rejects(read, { name: 'AbortError' });
  s.engine.release();
  s.renders[0].open({ width: 10, height: 10 });
  await flush();
  await flush();
  assert.equal(s.calls.created, 0);
});

test('cancelled while the worker is still starting: it is stopped once up and never given a job', async () => {
  const s = setup({ holdWorker: true });
  const abort = new AbortController();
  const read = s.engine.recognize(s.pdf, 1, () => {}, abort.signal);
  while (s.renders.length === 0) await flush();
  s.renders[0].open({ width: 10, height: 10 });
  while (s.calls.created === 0) await flush();
  abort.abort();
  await assert.rejects(read, { name: 'AbortError' });
  s.engine.release();
  s.startup.open();
  await flush();
  await flush();
  assert.equal(s.calls.created, 1);
  assert.equal(s.calls.terminated, 1);
  assert.equal(s.calls.recognize, 0);
});

test('every page is read once, in English with automatic page layout, at reading size: no language look first', async () => {
  const s = setup();
  const read = s.engine.recognize(s.pdf, 1, () => {}, new AbortController().signal);
  while (s.renders.length === 0) await flush();
  s.renders[0].open({ width: 10, height: 10 });
  const page = await read;
  assert.equal(page.langs, 'eng');
  assert.deepEqual(s.calls.sides, [2400]);
  assert.equal(s.calls.recognize, 1);
  assert.equal(s.calls.reinitialize, 0);
  assert.deepEqual(s.calls.params, [{ tessedit_pageseg_mode: '3' }]);
});

test('a page whose own text has characters but no letters has no letter map; letters, or no page, do not', async () => {
  assert.equal(await setup({ pageText: '\u0001\u0002 \u0003' }).engine.pageUnmapped(setup().pdf, 1), false);
  const s = setup({ pageText: '\u0001\u0002 \u0003' });
  assert.equal(await s.engine.pageUnmapped(s.pdf, 1), true);
  const english = setup({ pageText: 'Chapter one' });
  assert.equal(await english.engine.pageUnmapped(english.pdf, 1), false);
});

test('a PDF whose /Lang is Urdu is right to left', async () => {
  const s = setup({ rtl: true });
  assert.equal(await s.engine.isRtl(s.pdf), true);
  const e = setup();
  assert.equal(await e.engine.isRtl(e.pdf), false);
});

test('the page is drawn so its long side is the given size, however small the stored page', () => {
  assert.equal(ocrImageScale(595, 842, 2400), 2400 / 842);
  assert.equal(Math.round(173 * ocrImageScale(122, 173, 2400)), 2400);
});
