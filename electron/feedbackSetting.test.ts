/**
 * Run with: npx tsx --test electron/feedbackSetting.test.ts
 *
 * The occasional feedback prompt: due from the 5th launch, snoozed 15 launches by "Later",
 * stopped by "Don't ask again" or by sending feedback. Kept in config.json.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { feedbackDueIn, countSession, registerFeedbackSetting } = require('./feedbackSetting.cjs');

function harness(initial: Record<string, unknown>) {
  let config = { ...initial };
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const io = {
    readConfig: () => config,
    updateConfig: (patch: Record<string, unknown>) => {
      config = { ...config, ...patch };
      return true;
    }
  };
  registerFeedbackSetting({ ipcMain: { handle: (c: string, fn: (...a: unknown[]) => unknown) => handlers.set(c, fn) }, ...io });
  return { handlers, io, config: () => config };
}

test('not due before the 5th launch, due from it', () => {
  assert.equal(feedbackDueIn({}), false);
  assert.equal(feedbackDueIn(null), false);
  assert.equal(feedbackDueIn({ sessionCount: 4 }), false);
  assert.equal(feedbackDueIn({ sessionCount: 5 }), true);
  assert.equal(feedbackDueIn({ sessionCount: 'x' }), false);
});

test('sent or never stops it; later snoozes 15 launches', () => {
  assert.equal(feedbackDueIn({ sessionCount: 50, feedbackAnswer: 'sent' }), false);
  assert.equal(feedbackDueIn({ sessionCount: 50, feedbackAnswer: 'never' }), false);
  assert.equal(feedbackDueIn({ sessionCount: 19, feedbackAnswer: 'later', feedbackSnoozedAt: 5 }), false);
  assert.equal(feedbackDueIn({ sessionCount: 20, feedbackAnswer: 'later', feedbackSnoozedAt: 5 }), true);
});

test('each launch is counted once, keeping other keys', () => {
  const h = harness({ storeDir: '/lib' });
  countSession(h.io);
  countSession(h.io);
  assert.deepEqual(h.config(), { storeDir: '/lib', sessionCount: 2 });
});

test('get and set over IPC; unknown answers are refused', async () => {
  const h = harness({ sessionCount: 6 });
  assert.deepEqual(await h.handlers.get('marginalia:feedback-get')!({}), { sessions: 6, due: true });
  assert.equal(await h.handlers.get('marginalia:feedback-set')!({}, 'later'), true);
  assert.equal(h.config().feedbackSnoozedAt, 6);
  assert.deepEqual(await h.handlers.get('marginalia:feedback-get')!({}), { sessions: 6, due: false });
  assert.equal(await h.handlers.get('marginalia:feedback-set')!({}, 'maybe'), false);
  assert.equal(await h.handlers.get('marginalia:feedback-set')!({}, 'sent'), true);
  assert.equal(h.config().feedbackAnswer, 'sent');
});
