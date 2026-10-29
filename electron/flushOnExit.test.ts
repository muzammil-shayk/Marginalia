/**
 * Run with: npx tsx --test electron/flushOnExit.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { requestFlush, createExitGuard } = require('./flushOnExit.cjs');

/** A fake renderer: answers each flush request through a fake ipcMain, the way preload.cjs does. */
function fakeRenderer(answer: ((id: number) => [number, boolean] | null) | null) {
  const ipcMain = new EventEmitter();
  const sent: unknown[][] = [];
  const webContents = {
    isDestroyed: () => false,
    send: (channel: string, id: number) => {
      sent.push([channel, id]);
      const reply = answer?.(id);
      if (reply) setImmediate(() => ipcMain.emit('marginalia:flush-pending-saves-done', {}, ...reply));
    }
  };
  return { ipcMain, webContents, sent };
}

test('requestFlush sends a request and resolves with the renderer\'s answer', async () => {
  const r = fakeRenderer((id) => [id, true]);
  assert.equal(await requestFlush(r.webContents, r.ipcMain, 3000), true);
  assert.equal(r.sent[0][0], 'marginalia:flush-pending-saves');
  assert.equal(r.ipcMain.listenerCount('marginalia:flush-pending-saves-done'), 0);
});

test('requestFlush ignores answers to other requests and gives up after the timeout', async () => {
  const r = fakeRenderer((id) => [id + 1, true]);
  const started = Date.now();
  assert.equal(await requestFlush(r.webContents, r.ipcMain, 50), false);
  assert.ok(Date.now() - started >= 45);
  assert.equal(r.ipcMain.listenerCount('marginalia:flush-pending-saves-done'), 0);
});

test('requestFlush resolves false at once for a destroyed window', async () => {
  const r = fakeRenderer(null);
  assert.equal(await requestFlush({ ...r.webContents, isDestroyed: () => true }, r.ipcMain, 3000), false);
  assert.equal(r.sent.length, 0);
});

test('the exit guard holds the first close, flushes once, proceeds once, then lets closes through', async () => {
  let flushes = 0;
  let proceeds = 0;
  let release!: () => void;
  const guard = createExitGuard(() => {
    flushes++;
    return new Promise<boolean>((resolve) => (release = () => resolve(true)));
  });
  const event = () => ({ prevented: false, preventDefault() { this.prevented = true; } });

  const first = event();
  guard(first, () => proceeds++);
  const second = event(); // e.g. the user clicks close again while saving
  guard(second, () => proceeds++);
  assert.equal(first.prevented, true);
  assert.equal(second.prevented, true);
  assert.equal(flushes, 1);

  release();
  await new Promise((r) => setImmediate(r));
  assert.equal(proceeds, 1);

  const after = event(); // the close that proceed() triggers must not loop
  guard(after, () => proceeds++);
  assert.equal(after.prevented, false);
  assert.equal(flushes, 1);
});

test('the exit guard still proceeds when the flush fails', async () => {
  let proceeds = 0;
  const guard = createExitGuard(() => Promise.reject(new Error('renderer gone')));
  guard({ preventDefault() {} }, () => proceeds++);
  await new Promise((r) => setImmediate(r));
  assert.equal(proceeds, 1);
});

test('preload exposes onFlushPendingSaves that runs the handler and replies with the request id', async () => {
  const ipcRenderer = Object.assign(new EventEmitter(), {
    sent: [] as unknown[][],
    send(...args: unknown[]) { this.sent.push(args); },
    invoke: async () => null
  });
  let api: any;
  const electronPath = require.resolve('electron');
  const saved = require.cache[electronPath];
  require.cache[electronPath] = {
    exports: { contextBridge: { exposeInMainWorld: (_n: string, value: unknown) => (api = value) }, ipcRenderer }
  } as any;
  try {
    delete require.cache[require.resolve('./preload.cjs')];
    require('./preload.cjs');
  } finally {
    if (saved) require.cache[electronPath] = saved;
    else delete require.cache[electronPath];
  }

  const unsubscribe = api.onFlushPendingSaves(async () => true);
  ipcRenderer.emit('marginalia:flush-pending-saves', {}, 7);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(ipcRenderer.sent, [['marginalia:flush-pending-saves-done', 7, true]]);

  unsubscribe();
  assert.equal(ipcRenderer.listenerCount('marginalia:flush-pending-saves'), 0);

  api.onFlushPendingSaves(async () => { throw new Error('x'); });
  ipcRenderer.emit('marginalia:flush-pending-saves', {}, 8);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(ipcRenderer.sent[1], ['marginalia:flush-pending-saves-done', 8, false]);
});

test('a window close that arrives after the quit-time flush passes untouched (Cmd+Q must not be cancelled)', () => {
  let quitFlushed = false;
  let flushes = 0;
  const closeGuard = createExitGuard(() => (flushes++, Promise.resolve(true)), () => quitFlushed);
  quitFlushed = true;
  let proceeds = 0;
  const event = { prevented: false, preventDefault() { this.prevented = true; } };
  closeGuard(event, () => proceeds++);
  assert.equal(event.prevented, false, 'preventing this close would cancel the quit');
  assert.equal(flushes, 0);
  assert.equal(proceeds, 0);
});

test('a window close before any quit is still held for the flush', () => {
  const closeGuard = createExitGuard(() => Promise.resolve(true), () => false);
  const event = { prevented: false, preventDefault() { this.prevented = true; } };
  closeGuard(event, () => {});
  assert.equal(event.prevented, true);
});
