/**
 * Run with: npx tsx --test src/hooks/readingProgressSaver.test.ts
 *
 * The debounced saver behind `useReadingProgress`: scrolling reports a position many times a
 * second, the server should hear the latest one once the reader pauses, and leaving the
 * document must not lose it.
 */

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createProgressSaver } from './readingProgressSaver';

const tick = () => new Promise((r) => setImmediate(r));
const ID = 'a'.repeat(32);

function recorder() {
  const writes: unknown[] = [];
  return { writes, save: async (id: string, report: unknown) => (writes.push([id, report]), true) };
}

test('reports within the delay are written once, with the latest position', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { writes, save } = recorder();
    const progress = createProgressSaver(ID, { save, delayMs: 1500 });
    progress.report(1, 10);
    progress.report(2, 10);
    progress.report(3, 10);
    mock.timers.tick(1499);
    await tick();
    assert.deepEqual(writes, []);
    mock.timers.tick(1);
    await tick();
    assert.deepEqual(writes, [[ID, { position: 3, total: 10 }]]);
  } finally {
    mock.timers.reset();
  }
});

test('an invalid report is ignored and does not replace a pending one', async () => {
  const { writes, save } = recorder();
  const progress = createProgressSaver(ID, { save, delayMs: 1500 });
  progress.report(4, 10);
  progress.report(Number.NaN, 10);
  progress.report(1, 0);
  await progress.saver.flush();
  assert.deepEqual(writes, [[ID, { position: 4, total: 10 }]]);
});

test('the unload request targets the progress endpoint with the pending report', () => {
  const progress = createProgressSaver(ID, { save: async () => true });
  assert.deepEqual(progress.unloadRequest({ position: 2, total: 5 }), {
    url: `/api/documents/${ID}/progress`,
    body: JSON.stringify({ position: 2, total: 5 })
  });
});
