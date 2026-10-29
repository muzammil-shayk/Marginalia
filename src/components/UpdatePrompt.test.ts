/**
 * Run with: npx tsx --test src/components/UpdatePrompt.test.ts
 *
 * Event sequences are electron-updater's real ones (AppUpdater.js): a check reports `checking`,
 * then `available` or `not-available` (or `error`); a re-check of a version already on disk
 * reports `available` and then `downloaded` straight from the cached file.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialFlow, MANUAL_TIMEOUT_MS, reduceFlow, selectDialog, type Flow, type FlowEvent } from './updateFlow';
import type { UpdateStatus } from '../utils/documentStorage';

const T0 = 1_000_000;
const status = (next: UpdateStatus, now = T0): FlowEvent => ({ type: 'status', next, now });
const run = (events: FlowEvent[], from: Flow = initialFlow) => events.reduce(reduceFlow, from);

// v2.3.0 downloaded in the background, and the reader said "Later" to it.
const readyV = run([
  status({ state: 'checking' }),
  status({ state: 'available', version: '2.3.0' }),
  status({ state: 'downloading', percent: 40 }),
  status({ state: 'downloaded', version: '2.3.0' }),
]);

test('a fresh download opens the ready dialog unless that version was dismissed', () => {
  assert.equal(selectDialog(readyV, null), 'ready');
  assert.equal(selectDialog(readyV, '2.3.0'), null);
  // The dismissed version is still being read from disk: never open against a guess.
  assert.equal(selectDialog(readyV, undefined), null);
});

test('manual re-check of a dismissed download reopens "Update ready"', () => {
  const after = run(
    [
      { type: 'manual-check', now: T0 },
      status({ state: 'checking' }, T0 + 100),
      status({ state: 'available', version: '2.3.0' }, T0 + 900),
      { type: 'manual-settled' },
      status({ state: 'downloaded', version: '2.3.0' }, T0 + 1000),
    ],
    readyV,
  );
  assert.equal(selectDialog(after, '2.3.0'), 'ready');
  assert.equal(after.manualUntil, 0, 'the flag is spent');
  // Version History steps the dialog aside; it comes back once the changelog closes.
  const viaHistory = reduceFlow(after, { type: 'close-result' });
  assert.equal(selectDialog(viaHistory, '2.3.0', true), null);
  assert.equal(selectDialog(viaHistory, '2.3.0', false), 'ready');
  // "Later" closes it again for good.
  assert.equal(selectDialog(reduceFlow(after, { type: 'later' }), '2.3.0'), null);
});

test('manual check answers "up to date" or the error', () => {
  const current = run([{ type: 'manual-check', now: T0 }, status({ state: 'checking' }), status({ state: 'not-available' })]);
  assert.equal(selectDialog(current, null), 'current');
  assert.equal(selectDialog(reduceFlow(current, { type: 'close-result' }), null), null);
  const failed = run([{ type: 'manual-check', now: T0 }, status({ state: 'checking' }), status({ state: 'error', message: 'offline' })]);
  assert.equal(selectDialog(failed, null), 'error');
  assert.deepEqual(failed.result, { kind: 'error', message: 'offline' });
});

test('automatic checks never open the up-to-date or error dialogs', () => {
  for (const end of [{ state: 'not-available' }, { state: 'error', message: 'offline' }] as UpdateStatus[]) {
    const auto = run([status({ state: 'checking' }), status(end)]);
    assert.equal(selectDialog(auto, null), null);
    assert.equal(auto.result, null);
  }
  // Nor does the 4-hourly re-check reopen a dismissed download.
  const recheck = run(
    [status({ state: 'checking' }), status({ state: 'available', version: '2.3.0' }), status({ state: 'downloaded', version: '2.3.0' })],
    readyV,
  );
  assert.equal(selectDialog(recheck, '2.3.0'), null);
});

test('a manual check that reports nothing does not leak into a later automatic check', () => {
  // The check settles with no events at all: the flag clears at once.
  const settled = run([{ type: 'manual-check', now: T0 }, { type: 'manual-settled' }]);
  assert.equal(settled.manualUntil, 0);
  assert.equal(selectDialog(run([status({ state: 'not-available' }, T0 + 5000)], settled), null), null);
  // It never settles: the flag runs out after the timeout.
  const stuck = run([
    { type: 'manual-check', now: T0 },
    status({ state: 'checking' }, T0 + MANUAL_TIMEOUT_MS + 1),
    status({ state: 'not-available' }, T0 + MANUAL_TIMEOUT_MS + 2),
  ]);
  assert.equal(selectDialog(stuck, null), null);
  const stuckOnReady = run(
    [{ type: 'manual-check', now: T0 }, status({ state: 'downloaded', version: '2.3.0' }, T0 + MANUAL_TIMEOUT_MS + 1)],
    readyV,
  );
  assert.equal(selectDialog(stuckOnReady, '2.3.0'), null);
});

test('a finished download is sticky except for a newer version', () => {
  const noise = run(
    [
      status({ state: 'checking' }),
      status({ state: 'available', version: '2.3.0' }),
      status({ state: 'downloading', percent: 10 }),
      status({ state: 'not-available' }),
      status({ state: 'error', message: 'offline' }),
      status({ state: 'idle' }),
    ],
    readyV,
  );
  assert.deepEqual(noise.status, { state: 'downloaded', version: '2.3.0' });
  const newer = reduceFlow(noise, status({ state: 'available', version: '2.4.0' }));
  assert.deepEqual(newer.status, { state: 'available', version: '2.4.0' });
  const newerReady = reduceFlow(newer, status({ state: 'downloaded', version: '2.4.0' }));
  assert.equal(selectDialog(newerReady, '2.3.0'), 'ready');
});

test('note-hidden and install-failed reset for a new version', () => {
  let s = run([status({ state: 'available', version: '2.3.0' }), { type: 'hide-note' }]);
  assert.equal(s.noteHidden, true);
  s = reduceFlow(s, status({ state: 'available', version: '2.3.0' }));
  assert.equal(s.noteHidden, true, 'a re-check of the same version keeps it hidden');
  s = run([status({ state: 'downloaded', version: '2.3.0' }), { type: 'install-failed' }], s);
  assert.equal(s.installFailed, true);
  s = run([status({ state: 'available', version: '2.4.0' })], s);
  assert.equal(s.noteHidden, false);
  assert.equal(s.installFailed, false);
});

test('install-failed clears when the ready dialog is opened anew', () => {
  const failed = run([{ type: 'install-failed' }, { type: 'later' }], readyV);
  assert.equal(failed.installFailed, false);
});
