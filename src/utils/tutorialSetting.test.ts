/**
 * Run with: npx tsx --test src/utils/tutorialSetting.test.ts
 *
 * The renderer's view of the first-run tutorial flag. When the shell cannot answer (no desktop
 * shell, an older shell, an error) it counts as seen, so a returning reader is never re-shown it.
 */

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getTutorialSeen, setTutorialSeen } from './documentStorage';

const g = globalThis as unknown as { window?: unknown };
afterEach(() => delete g.window);

test('the shell\'s saved value; only a real true counts as seen', async () => {
  let saved: unknown = false;
  g.window = {
    marginaliaDesktop: { getTutorialSeen: async () => saved, setTutorialSeen: async (on: boolean) => (saved = on) }
  };
  assert.equal(await getTutorialSeen(), false);
  assert.equal(await setTutorialSeen(true), true);
  assert.equal(await getTutorialSeen(), true);
  saved = 'yes';
  assert.equal(await getTutorialSeen(), false);
});

test('seen when there is no shell, an older shell, or the shell throws', async () => {
  g.window = {};
  assert.equal(await getTutorialSeen(), true);
  g.window = { marginaliaDesktop: {} };
  assert.equal(await getTutorialSeen(), true);
  g.window = { marginaliaDesktop: { getTutorialSeen: async () => { throw new Error('x'); } } };
  assert.equal(await getTutorialSeen(), true);
});

test('set without a shell saves nothing and answers false', async () => {
  g.window = {};
  assert.equal(await setTutorialSeen(true), false);
});
