/**
 * Run with: npx tsx --test electron/tutorialSetting.test.ts
 *
 * First-run tutorial flag: `tutorialSeen` in config.json (not localStorage, which the random port
 * resets every launch), read and set over IPC like the AI opt-in.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { tutorialSeenIn, registerTutorialSetting } = require('./tutorialSetting.cjs');

function harness(initial: Record<string, unknown>, saveWorks = true) {
  let config = { ...initial };
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  registerTutorialSetting({
    ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn) },
    readConfig: () => config,
    updateConfig: (patch: Record<string, unknown>) => {
      if (!saveWorks) return false;
      config = { ...config, ...patch };
      return true;
    }
  });
  return { handlers, config: () => config };
}

test('not seen for a new user or a config without the flag; only a real true counts', () => {
  assert.equal(tutorialSeenIn({}), false);
  assert.equal(tutorialSeenIn(null), false);
  assert.equal(tutorialSeenIn({ storeDir: '/x' }), false);
  assert.equal(tutorialSeenIn({ tutorialSeen: 'yes' }), false);
  assert.equal(tutorialSeenIn({ tutorialSeen: true }), true);
});

test('get answers the saved value', async () => {
  assert.equal(await harness({ tutorialSeen: true }).handlers.get('marginalia:tutorial-get')!({}), true);
  assert.equal(await harness({}).handlers.get('marginalia:tutorial-get')!({}), false);
});

test('set saves to config.json (keeping other keys) and answers the saved value', async () => {
  const h = harness({ storeDir: '/lib', aiEnabled: true });
  assert.equal(await h.handlers.get('marginalia:tutorial-set')!({}, true), true);
  assert.deepEqual(h.config(), { storeDir: '/lib', aiEnabled: true, tutorialSeen: true });
  assert.equal(await h.handlers.get('marginalia:tutorial-set')!({}, false), false);
  assert.equal(h.config().tutorialSeen, false);
});

test('a failed save answers the old value', async () => {
  const h = harness({}, false);
  assert.equal(await h.handlers.get('marginalia:tutorial-set')!({}, true), false);
});

test('preload exposes getTutorialSeen / setTutorialSeen over the two channels', async () => {
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
  assert.equal(await api.getTutorialSeen(), true);
  assert.equal(await api.setTutorialSeen('yes'), true);
  assert.deepEqual(invoked, [['marginalia:tutorial-get'], ['marginalia:tutorial-set', false]]);
});
