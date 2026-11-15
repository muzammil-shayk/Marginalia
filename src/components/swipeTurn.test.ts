/**
 * Run with: npx tsx --test src/components/swipeTurn.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWheelTurn, swipeStep, WHEEL_COOLDOWN_MS } from './swipeTurn';

test('a quick sideways swipe turns: left is forward, right is back', () => {
  assert.equal(swipeStep(-120, 10, 200), 1);
  assert.equal(swipeStep(120, -10, 200), -1);
});

test('taps, short moves, slow drags and mostly-vertical moves do not turn', () => {
  assert.equal(swipeStep(-30, 0, 100), 0);
  // A clear sideways movement is more than 60 px.
  assert.equal(swipeStep(-59, 0, 100), 0);
  assert.equal(swipeStep(-61, 0, 100), 1);
  assert.equal(swipeStep(-200, 0, 1200), 0);
  assert.equal(swipeStep(-80, 70, 200), 0);
});

const wheelEvent = (deltaX: number, deltaY = 0) => {
  const e = { ctrlKey: false, deltaX, deltaY, prevented: false, preventDefault: () => (e.prevented = true) };
  return e;
};

test('sideways trackpad scroll turns once past the threshold and swallows the scroll', () => {
  const steps: number[] = [];
  let t = 0;
  const w = createWheelTurn((s) => steps.push(s), () => false, () => t);
  const a = wheelEvent(50);
  w.onWheel(a);
  assert.equal(a.prevented, true);
  assert.deepEqual(steps, []);
  w.onWheel(wheelEvent(50));
  assert.deepEqual(steps, [1]);
  // Momentum inside the cooldown is the same gesture.
  t = WHEEL_COOLDOWN_MS - 1;
  w.onWheel(wheelEvent(200));
  assert.deepEqual(steps, [1]);
  w.dispose();
});

test('while blocked (tool armed or text selected) the wheel is neither swallowed nor turns', () => {
  const steps: number[] = [];
  let blocked = true;
  const w = createWheelTurn((s) => steps.push(s), () => blocked, () => 0);
  const e = wheelEvent(-200);
  w.onWheel(e);
  assert.equal(e.prevented, false);
  assert.deepEqual(steps, []);
  blocked = false;
  w.onWheel(wheelEvent(-200));
  assert.deepEqual(steps, [-1]);
  w.dispose();
});

test('vertical scroll and pinch-zoom are left alone', () => {
  const w = createWheelTurn(() => assert.fail('no turn'), () => false, () => 0);
  const v = wheelEvent(10, 50);
  w.onWheel(v);
  assert.equal(v.prevented, false);
  const pinch = { ...wheelEvent(200), ctrlKey: true };
  w.onWheel(pinch);
  w.dispose();
});
