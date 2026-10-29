/**
 * Run with: npx tsx --test src/hooks/debouncedSaver.test.ts
 *
 * The saver behind the PDF workspace's autosave. What matters: a save may never land in the
 * middle of a page insert/delete (it would PUT the pre-shift page numbers back over the server's
 * renumbering), and nothing pending may be lost to that operation either.
 */

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createDebouncedSaver, gateWhileBusy, runPageOperation } from './debouncedSaver';

function recorder(result = true) {
  const writes: string[] = [];
  const save = async (value: string) => {
    writes.push(value);
    return result;
  };
  return { writes, save };
}

const tick = () => new Promise((r) => setImmediate(r));

test('a save scheduled before a pause does not write when its timer fires', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { writes, save } = recorder();
    const saver = createDebouncedSaver({ save, delayMs: 700 });
    saver.schedule('marks-v1');
    saver.pause();
    mock.timers.tick(700);
    await tick();
    assert.deepEqual(writes, []);
  } finally {
    mock.timers.reset();
  }
});

test('flush writes the pending value at once and the timer then writes nothing more', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { writes, save } = recorder();
    const saver = createDebouncedSaver({ save, delayMs: 700 });
    saver.schedule('marks-v1');
    assert.equal(await saver.flush(), true);
    mock.timers.tick(700);
    await tick();
    assert.deepEqual(writes, ['marks-v1']);
    assert.equal(saver.pending(), null);
  } finally {
    mock.timers.reset();
  }
});

test('flush waits for a save that is already in flight', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let release!: () => void;
    let finished = false;
    const save = () =>
      new Promise<boolean>((resolve) => {
        release = () => {
          finished = true;
          resolve(true);
        };
      });
    const saver = createDebouncedSaver({ save, delayMs: 700 });
    saver.schedule('marks-v1');
    mock.timers.tick(700);
    const flushed = saver.flush();
    await tick();
    assert.equal(finished, false);
    release();
    assert.equal(await flushed, true);
    assert.equal(finished, true);
  } finally {
    mock.timers.reset();
  }
});

test('a paused saver never writes, not even on flush', async () => {
  const { writes, save } = recorder();
  const saver = createDebouncedSaver({ save, delayMs: 700 });
  saver.pause();
  saver.schedule('marks-v1');
  assert.equal(await saver.flush(), false);
  assert.deepEqual(writes, []);
});

test('a failed flush keeps the value pending so the next flush retries it', async () => {
  let ok = false;
  const writes: string[] = [];
  const saver = createDebouncedSaver({
    save: async (v: string) => {
      writes.push(v);
      return ok;
    },
    delayMs: 700
  });
  saver.schedule('marks-v1');
  assert.equal(await saver.flush(), false);
  ok = true;
  assert.equal(await saver.flush(), true);
  assert.deepEqual(writes, ['marks-v1', 'marks-v1']);
});

test('pending marks are saved before the page operation runs', async () => {
  const log: string[] = [];
  const saver = createDebouncedSaver({
    save: async (v: string) => {
      log.push(`save ${v}`);
      return true;
    },
    delayMs: 700
  });
  saver.schedule('new mark on page 3');
  const outcome = await runPageOperation({
    saver,
    operate: async () => {
      log.push('insert page');
      return { insertedPages: [2] };
    },
    reload: async () => 'shifted marks',
    reset: () => {}
  });
  assert.equal(outcome.status, 'done');
  assert.deepEqual(log.slice(0, 2), ['save new mark on page 3', 'insert page']);
});

test('the page operation does not run when the pending marks cannot be saved', async () => {
  let operated = false;
  const saver = createDebouncedSaver({ save: async () => false, delayMs: 700 });
  saver.schedule('unsaved mark');
  const outcome = await runPageOperation({
    saver,
    operate: async () => {
      operated = true;
      return {};
    },
    reload: async () => 'x',
    reset: () => {}
  });
  assert.equal(outcome.status, 'unsaved');
  assert.equal(operated, false);
});

test('after a page operation the re-read marks reset the history (no undo across it)', async () => {
  const resets: string[] = [];
  const saver = createDebouncedSaver({ save: async () => true, delayMs: 700 });
  const outcome = await runPageOperation({
    saver,
    operate: async () => ({ pageCount: 4 }),
    reload: async () => 'renumbered marks',
    reset: (m: string) => resets.push(m)
  });
  assert.deepEqual(resets, ['renumbered marks']);
  assert.deepEqual(outcome, { status: 'done', result: { pageCount: 4 }, reloaded: true });
});

test('an edit made during the page operation is never written with the old page numbers', async () => {
  const { writes, save } = recorder();
  const saver = createDebouncedSaver({ save, delayMs: 700 });
  await runPageOperation({
    saver,
    operate: async () => {
      saver.schedule('mark drawn mid-insert');
      return {};
    },
    reload: async () => 'renumbered marks',
    reset: () => {}
  });
  assert.equal(await saver.flush(), true);
  assert.deepEqual(writes, []);
});

test('when the marks cannot be re-read after the operation, saving stays off', async () => {
  const { writes, save } = recorder();
  const saver = createDebouncedSaver({ save, delayMs: 700 });
  const outcome = await runPageOperation({
    saver,
    operate: async () => ({}),
    reload: async () => null,
    reset: () => assert.fail('nothing to reset to')
  });
  assert.deepEqual(outcome, { status: 'done', result: {}, reloaded: false });
  saver.schedule('stale pre-shift marks');
  assert.equal(await saver.flush(), false);
  assert.deepEqual(writes, []);
});

test('a failed page operation resumes saving', async () => {
  const { writes, save } = recorder();
  const saver = createDebouncedSaver({ save, delayMs: 700 });
  const outcome = await runPageOperation({
    saver,
    operate: async () => null,
    reload: async () => 'x',
    reset: () => {}
  });
  assert.equal(outcome.status, 'failed');
  saver.schedule('later mark');
  assert.equal(await saver.flush(), true);
  assert.deepEqual(writes, ['later mark']);
});

test('an edit made during a FAILED page operation is kept and saved by the normal timer', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { writes, save } = recorder();
    const saver = createDebouncedSaver({ save, delayMs: 700 });
    const outcome = await runPageOperation({
      saver,
      operate: async () => {
        saver.schedule('mark drawn while the insert failed');
        return null;
      },
      reload: async () => 'x',
      reset: () => {}
    });
    assert.equal(outcome.status, 'failed');
    mock.timers.tick(700);
    await tick();
    assert.deepEqual(writes, ['mark drawn while the insert failed']);
  } finally {
    mock.timers.reset();
  }
});

test('an edit made during a page operation that THROWS is kept too', async () => {
  const { writes, save } = recorder();
  const saver = createDebouncedSaver({ save, delayMs: 700 });
  await assert.rejects(
    runPageOperation({
      saver,
      operate: async () => {
        saver.schedule('mark drawn before the network error');
        throw new Error('network');
      },
      reload: async () => 'x',
      reset: () => {}
    })
  );
  assert.equal(await saver.flush(), true);
  assert.deepEqual(writes, ['mark drawn before the network error']);
});

test('marking is ignored while a page operation is running and works again after', () => {
  let busy = false;
  const marks: string[] = [];
  const commit = gateWhileBusy(() => busy, (m: string) => marks.push(m));
  commit('before');
  busy = true;
  commit('during');
  busy = false;
  commit('after');
  assert.deepEqual(marks, ['before', 'after']);
});

test('when re-reading the marks THROWS after the operation, saving stays off', async () => {
  const { writes, save } = recorder();
  const saver = createDebouncedSaver({ save, delayMs: 700 });
  await assert.rejects(
    runPageOperation({
      saver,
      operate: async () => ({}),
      reload: async () => {
        throw new Error('network');
      },
      reset: () => assert.fail('nothing to reset to')
    })
  );
  saver.schedule('stale pre-shift marks');
  assert.equal(await saver.flush(), false);
  assert.deepEqual(writes, []);
});
