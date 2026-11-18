/**
 * Run with: npx tsx --test src/components/guideDeck.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardAt, cardPose, nearestPos, releaseTarget, wrapOffset, zoomTo } from './guideDeck';

test('offsets wrap so the deck loops both ways', () => {
  assert.equal(wrapOffset(0, 0, 10), 0);
  assert.equal(wrapOffset(1, 0, 10), 1);
  assert.equal(wrapOffset(9, 0, 10), -1);
  assert.equal(wrapOffset(0, 9, 10), 1);
  assert.equal(wrapOffset(3, 2.5, 10), 0.5);
  assert.equal(wrapOffset(2, -0.5, 10), 2.5);
  assert.equal(wrapOffset(2, 0, 0), 0);
});

test('the card shown is the nearest whole one, for any position', () => {
  assert.equal(cardAt(0.4, 5), 0);
  assert.equal(cardAt(0.6, 5), 1);
  assert.equal(cardAt(-1, 5), 4);
  assert.equal(cardAt(12, 5), 2);
});

test('the front card is whole, the ones behind smaller, shaded, leaning and lower', () => {
  const front = cardPose(0);
  assert.deepEqual({ x: front.x, scale: front.scale, rotate: front.rotate, shade: front.shade }, { x: 0, scale: 1, rotate: 0, shade: 0 });
  const right = cardPose(1);
  const left = cardPose(-1);
  assert.ok(right.x > 0 && left.x === -right.x);
  assert.ok(right.scale < 1 && right.shade > 0 && right.rotate > 0 && left.rotate < 0);
  assert.ok(right.zIndex < front.zIndex && cardPose(2).zIndex < right.zIndex);
  assert.ok(cardPose(2).x > right.x, 'the second card peeks out past the first');
  assert.equal(cardPose(2).opacity, 1);
  assert.equal(cardPose(3).opacity, 0);
});

test('poses change smoothly through a swipe', () => {
  for (let d = -3; d < 3; d += 0.05) {
    const a = cardPose(d);
    const b = cardPose(d + 0.05);
    assert.ok(Math.abs(a.x - b.x) < 2, `x jumps at ${d}`);
    assert.ok(Math.abs(a.scale - b.scale) < 0.01, `scale jumps at ${d}`);
  }
});

test('a short slow drag springs back; past the threshold it moves one card', () => {
  assert.equal(releaseTarget(4, 4.1, 0), 4);
  assert.equal(releaseTarget(4, 4.3, 0), 5);
  assert.equal(releaseTarget(4, 3.7, 0), 3);
});

test('a quick flick moves one card however short; a long drag moves as far as it went', () => {
  assert.equal(releaseTarget(4, 4.05, 1.2), 5);
  assert.equal(releaseTarget(4, 3.95, -1.2), 3);
  assert.equal(releaseTarget(4, 6.1, 0), 6);
  assert.equal(releaseTarget(4, 5, 0), 5);
});

test('jumping to a card takes the short way round the loop', () => {
  assert.equal(nearestPos(9, 0, 10), -1);
  assert.equal(nearestPos(2, 10, 10), 12);
});

test('a zoomed picture brings its feature towards the middle without showing its edge', () => {
  const mid = zoomTo({ x: 50, y: 50, zoom: 2 });
  assert.deepEqual(mid, { tx: -50, ty: -50, x: 50, y: 50 });
  const corner = zoomTo({ x: 90, y: 10, zoom: 1.5 });
  assert.equal(corner.tx, -50, 'pushed as far left as the right edge allows');
  assert.equal(corner.ty, 0, 'kept at the top edge');
  assert.ok(corner.x > 50 && corner.x < 90 && corner.y === 15);
  assert.deepEqual(zoomTo({ x: 30, y: 30, zoom: 1 }), { tx: 0, ty: 0, x: 30, y: 30 });
});
