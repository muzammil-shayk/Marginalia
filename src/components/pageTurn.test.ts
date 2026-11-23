/**
 * The page turn's safety nets: the overlay's fail-safe and the wait for new pages to paint.
 *
 * Run with: npx tsx --test src/components/pageTurn.test.ts
 */

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { angleAt, FADE_MS, FOLD, foldFrames, foldShade, STEP_WAIT_MAX_MS, stripPoses, TURN_FAILSAFE_MS, TURN_MS, TURN_WAIT_MAX_MS, turnFailsafeMs, TurnPrep, waitFor, type PreparedTurn, type TurnOptions } from './pageTurn';

test('a turn is quick (520-560 ms) and its overlay is gone 40 ms after, sooner for a fade or a shorter turn', () => {
  assert.ok(TURN_MS >= 520 && TURN_MS <= 560);
  assert.equal(TURN_FAILSAFE_MS, TURN_MS + 40);
  assert.ok(STEP_WAIT_MAX_MS <= 250);
  assert.equal(turnFailsafeMs(false), TURN_MS + 40);
  assert.equal(turnFailsafeMs(false, 5000), TURN_FAILSAFE_MS);
  assert.equal(turnFailsafeMs(false, 300), 340);
  assert.equal(turnFailsafeMs(true, 5000), FADE_MS + 40);
});

/** Just enough DOM for `waitFor`: window timers and a MutationObserver the test can fire. */
function withFakeDom(run: (mutate: () => void) => void) {
  const g = globalThis as Record<string, unknown>;
  const saved = { window: g.window, MutationObserver: g.MutationObserver };
  const observers = new Set<() => void>();
  g.window = globalThis;
  g.MutationObserver = class {
    private cb: () => void;
    constructor(cb: () => void) {
      this.cb = cb;
    }
    observe() {
      observers.add(this.cb);
    }
    disconnect() {
      observers.delete(this.cb);
    }
  };
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    run(() => [...observers].forEach((cb) => cb()));
  } finally {
    mock.timers.reset();
    g.window = saved.window;
    g.MutationObserver = saved.MutationObserver;
  }
}

const root = {} as HTMLElement;

test('a turn waits at most 1500 ms for its pages to paint, then turns anyway, once', () => {
  assert.equal(TURN_WAIT_MAX_MS, 1500);
  withFakeDom(() => {
    let calls = 0;
    waitFor(root, () => false, TURN_WAIT_MAX_MS, () => calls++);
    mock.timers.tick(1499);
    assert.equal(calls, 0);
    mock.timers.tick(1);
    assert.equal(calls, 1);
    mock.timers.tick(5000);
    assert.equal(calls, 1);
  });
});

test('pages already painted turn at once; a paint mid-wait turns then, not again at the cap', () => {
  withFakeDom((mutate) => {
    let now = 0;
    waitFor(root, () => true, TURN_WAIT_MAX_MS, () => now++);
    assert.equal(now, 1);

    let painted = false;
    let later = 0;
    waitFor(root, () => painted, TURN_WAIT_MAX_MS, () => later++);
    mutate();
    assert.equal(later, 0);
    painted = true;
    mutate();
    assert.equal(later, 1);
    mock.timers.tick(TURN_WAIT_MAX_MS);
    assert.equal(later, 1);
  });
});

test('a cancelled wait never turns', () => {
  withFakeDom((mutate) => {
    let calls = 0;
    let painted = false;
    const cancel = waitFor(root, () => painted, TURN_WAIT_MAX_MS, () => calls++);
    cancel();
    painted = true;
    mutate();
    mock.timers.tick(TURN_WAIT_MAX_MS);
    assert.equal(calls, 0);
  });
});

test('the fold: flat at the start, over at the end, and no point ever swings back', () => {
  const n = 64;
  const W = 500;
  const { poses } = foldFrames(n, W, 40);
  assert.ok(poses[0].every((p) => p.phi === 0));
  assert.ok(poses[40].every((p) => Math.abs(p.phi - Math.PI) < 1e-9));
  for (let i = 0; i < n; i++) {
    for (let k = 1; k <= 40; k++) assert.ok(poses[k][i].phi >= poses[k - 1][i].phi - 1e-12, `strip ${i} reversed at ${k}`);
  }
});

test('the free edge leads the hinge, so the sheet curls rather than swinging flat', () => {
  for (const t of [0.1, 0.3, 0.5, 0.7]) assert.ok(angleAt(1, t) > angleAt(0, t));
  assert.equal(angleAt(0, FOLD.lead), 0);
});

test('the sheet never stretches: its strips add up to the page width', () => {
  for (const t of [0, 0.25, 0.56, 0.9, 1]) {
    const p = stripPoses(32, 400, t);
    const last = p[p.length - 1];
    const w = 400 / 32;
    const endX = last.x + w * Math.cos(last.phi);
    const endZ = last.z + w * Math.sin(last.phi);
    assert.ok(Math.hypot(endX, endZ) <= 400 + 1e-6);
  }
});

test('the shade is the same on both faces where they meet edge-on, and nothing when flat', () => {
  assert.equal(foldShade(0), 0);
  assert.ok(foldShade(Math.PI) < 1e-6);
  assert.ok(Math.abs(foldShade(Math.PI / 2) - 1) < 1e-9);
  assert.ok(Math.abs(foldShade(Math.PI / 2 - 0.01) - foldShade(Math.PI / 2 + 0.01)) < 1e-9);
});

/** TurnPrep with fake idle callbacks and fake prepared turns. */
function fakePrep() {
  const idle: Array<() => void> = [];
  const built: string[] = [];
  const disposed: string[] = [];
  const prep = new TurnPrep(
    (o: TurnOptions) => {
      const name = `${o.dir}`;
      built.push(name);
      return { start: () => ({ done: Promise.resolve(), finish: () => undefined }), dispose: () => disposed.push(name) } as PreparedTurn;
    },
    { request: (cb) => idle.push(cb), cancel: () => undefined }
  );
  const run = () => {
    while (idle.length) idle.shift()!();
  };
  return { prep, idle, built, disposed, run };
}
const opts = (dir: 1 | -1) => ({ dir }) as unknown as TurnOptions;

test('prepared turns are built when idle, one direction per idle moment, forward first', () => {
  const f = fakePrep();
  f.prep.schedule({ key: (d) => `k${d}`, options: opts });
  assert.equal(f.built.length, 0);
  f.idle.shift()!();
  assert.deepEqual(f.built, ['1']);
  f.run();
  assert.deepEqual(f.built, ['1', '-1']);
  assert.ok(f.prep.take(1, 'k1'));
  assert.deepEqual(f.disposed, [], 'not removed on the click itself');
  f.run();
  assert.deepEqual(f.disposed, ['-1'], 'the other way is dropped once idle after a turn starts');
  assert.equal(f.prep.take(1, 'k1'), null, 'handed over once');
});

test('a prepared turn is thrown away when the pages change or the key differs', () => {
  const f = fakePrep();
  f.prep.schedule({ key: (d) => `k${d}`, options: opts });
  f.run();
  f.prep.invalidate();
  assert.equal(f.prep.take(1, 'k1'), null);
  f.run();
  assert.equal(f.prep.take(-1, 'other'), null);
  assert.ok(f.disposed.length >= 2);
});

test('nothing is built while a turn plays, and no turn past the last page', async () => {
  const f = fakePrep();
  let land!: () => void;
  f.prep.after(new Promise<void>((r) => (land = r)));
  f.prep.schedule({ key: (d) => (d === 1 ? null : 'back'), options: opts });
  f.run();
  assert.equal(f.built.length, 0);
  land();
  await new Promise((r) => setTimeout(r, 0));
  f.run();
  assert.deepEqual(f.built, ['-1']);
});
