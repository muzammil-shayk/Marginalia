/**
 * Run with: npx tsx --test electron/aiSetting.test.ts
 *
 * The AI opt-in: off unless the reader turned it on, kept in config.json, and the embedded server
 * is told the saved value (never one that failed to save).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { aiEnabledIn, registerAiSetting } = require('./aiSetting.cjs');

function harness(initial: Record<string, unknown>, saveWorks = true) {
  let config = { ...initial };
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const applied: boolean[] = [];
  registerAiSetting({
    ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn) },
    readConfig: () => config,
    updateConfig: (patch: Record<string, unknown>) => {
      if (!saveWorks) return false;
      config = { ...config, ...patch };
      return true;
    },
    apply: (on: boolean) => applied.push(on)
  });
  return { handlers, applied, config: () => config };
}

test('AI is off for a new user and for an existing config without the flag', () => {
  assert.equal(aiEnabledIn({}), false);
  assert.equal(aiEnabledIn({ storeDir: '/x', autoUpdateEnabled: true }), false);
  assert.equal(aiEnabledIn({ aiEnabled: 'yes' }), false);
  assert.equal(aiEnabledIn({ aiEnabled: true }), true);
});

test('get answers the saved value', async () => {
  const h = harness({ aiEnabled: true });
  assert.equal(await h.handlers.get('marginalia:ai-get')!({}), true);
  assert.equal(await harness({}).handlers.get('marginalia:ai-get')!({}), false);
});

test('set saves to config.json, tells the server and answers the saved value', async () => {
  const h = harness({ storeDir: '/lib' });
  assert.equal(await h.handlers.get('marginalia:ai-set')!({}, true), true);
  assert.deepEqual(h.config(), { storeDir: '/lib', aiEnabled: true });
  assert.deepEqual(h.applied, [true]);
  assert.equal(await h.handlers.get('marginalia:ai-set')!({}, false), false);
  assert.deepEqual(h.applied, [true, false]);
});

test('only a real true turns it on', async () => {
  const h = harness({});
  assert.equal(await h.handlers.get('marginalia:ai-set')!({}, 'true'), false);
  assert.equal(h.config().aiEnabled, false);
});

test('a failed save changes nothing: the server keeps its state and the answer is the old value', async () => {
  const h = harness({}, false);
  assert.equal(await h.handlers.get('marginalia:ai-set')!({}, true), false);
  assert.deepEqual(h.applied, []);
});

test('preload exposes getAiEnabled / setAiEnabled over the two channels', async () => {
  const invoked: unknown[][] = [];
  const ipcRenderer = { invoke: async (...args: unknown[]) => (invoked.push(args), true), on() {}, removeListener() {}, send() {} };
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
  assert.equal(await api.getAiEnabled(), true);
  assert.equal(await api.setAiEnabled(false), true);
  assert.deepEqual(invoked, [['marginalia:ai-get'], ['marginalia:ai-set', false]]);
});
