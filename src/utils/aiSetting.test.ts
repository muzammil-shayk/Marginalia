/**
 * Run with: npx tsx --test src/utils/aiSetting.test.ts
 *
 * The renderer's view of the AI opt-in: the desktop shell's saved value, and off whenever there
 * is no shell (plain dev server) or the shell cannot answer.
 */

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getAiEnabled, setAiEnabled } from './documentStorage';

const g = globalThis as unknown as { window?: unknown };
afterEach(() => delete g.window);

test('off without the desktop shell', async () => {
  g.window = {};
  assert.equal(await getAiEnabled(), false);
  assert.equal(await setAiEnabled(true), false);
});

test('the shell\'s saved value, only a real true counts', async () => {
  let saved: unknown = false;
  g.window = {
    marginaliaDesktop: { getAiEnabled: async () => saved, setAiEnabled: async (on: boolean) => (saved = on) }
  };
  assert.equal(await getAiEnabled(), false);
  assert.equal(await setAiEnabled(true), true);
  assert.equal(await getAiEnabled(), true);
  saved = 'yes';
  assert.equal(await getAiEnabled(), false);
});

test('off when the shell throws', async () => {
  g.window = { marginaliaDesktop: { getAiEnabled: async () => { throw new Error('x'); } } };
  assert.equal(await getAiEnabled(), false);
});
