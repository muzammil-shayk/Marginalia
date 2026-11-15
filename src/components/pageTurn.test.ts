/**
 * The page turn's safety nets: the overlay's fail-safe and the wait for new pages to paint.
 *
 * Run with: npx tsx --test src/components/pageTurn.test.ts
 */

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { FADE_MS, TURN_FAILSAFE_MS, TURN_MS, TURN_WAIT_MAX_MS, turnFailsafeMs, waitFor } from './pageTurn';

test('the overlay is gone by 800 ms whatever happens, sooner for a fade or a shorter turn', () => {
  assert.equal(TURN_FAILSAFE_MS, 800);
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
