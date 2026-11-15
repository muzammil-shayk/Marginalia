/**
 * The shelf's flight and the zoom into the reader: timings inside the recorded 1.25–1.5 s window,
 * the final pose exactly the desk (or the slot), and no overshoot on the way in.
 *
 * Run with: npx tsx --test src/components/shelf/shelfMotion.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deskPhases,
  phases,
  poseAt,
  shelfPhases,
  zoomFrame,
  DESK_TILT,
  SWAP_DELAY,
  ZOOM_FADE_BACK,
  ZOOM_HANDOFF,
  ZOOM_PUSH,
  type Flight,
  type Pose
} from './shelfMotion';

const slot: Pose = { x: 120, y: 400, s: 1, ry: 0, rz: 0, leaf: 0 };
/** The desk pose a flight aims at (cover shut); the flight itself opens the cover to -180. */
const deskAim: Pose = { x: 700, y: 900, s: 1.6, ry: -90, rz: -3, leaf: 0 };
/** The book as it lies open on the desk. */
const desk: Pose = { ...deskAim, leaf: -180 };
const toDesk = (o: Partial<Flight> = {}): Flight => ({ key: 1, id: 'a', to: 'desk', from: slot, fromSlot: true, fast: false, delay: 0, ...o });
const toShelf = (o: Partial<Flight> = {}): Flight => ({ key: 2, id: 'a', to: 'shelf', from: desk, fromSlot: false, fast: false, delay: 0, ...o });

const inWindow = (ms: number) => ms >= 1250 && ms <= 1500;

test('opening and closing each take 1.25–1.5 s from click to settle', () => {
  assert.ok(inWindow(deskPhases(toDesk()).total), `open ${deskPhases(toDesk()).total}`);
  assert.ok(inWindow(shelfPhases(toShelf()).total), `close ${shelfPhases(toShelf()).total}`);
  // Previous/Next: the new book leaves after SWAP_DELAY at the faster speed, still 1.4 s in all.
  assert.ok(inWindow(SWAP_DELAY + deskPhases(toDesk({ fast: true })).total));
  // phases() picks the matching one.
  assert.equal(phases(toDesk()).total, deskPhases(toDesk()).total);
  assert.equal(phases(toShelf()).total, shelfPhases(toShelf()).total);
});

test('a book already half shut closes for less time', () => {
  const half = shelfPhases(toShelf({ from: { ...desk, leaf: -90 } }));
  assert.equal(half.close, 150);
  assert.ok(shelfPhases(toShelf({ from: { ...desk, leaf: 0 } })).close === 0);
});

/** Every ms of the flight, plus the exact end. */
function samples(f: Flight, target: Pose): Pose[] {
  const total = phases(f).total;
  const out: Pose[] = [];
  for (let ms = 0; ms <= total; ms++) out.push(poseAt(f, ms, target));
  out.push(poseAt(f, total, target));
  return out;
}

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test('to the desk: ends exactly on the desk, x and the cover never pass their end', () => {
  const f = toDesk();
  const s = samples(f, deskAim);
  const end = s[s.length - 1];
  for (const k of ['x', 'y', 's', 'ry', 'rz', 'leaf'] as const) assert.ok(close(end[k], desk[k]), `${k} ${end[k]} vs ${desk[k]}`);
  for (let i = 1; i < s.length; i++) {
    // Across the shelf toward the desk, one way only.
    assert.ok(s[i].x >= s[i - 1].x - 1e-9, `x went back at ${i}`);
    assert.ok(s[i].x <= desk.x + 1e-9, `x overshot at ${i}`);
    // The cover opens one way and stops flat at -180.
    assert.ok(s[i].leaf <= s[i - 1].leaf + 1e-9 && s[i].leaf >= -180 - 1e-9, `leaf at ${i}`);
    // No jumps: a frame moves at most a few px.
    assert.ok(Math.abs(s[i].x - s[i - 1].x) < 10 && Math.abs(s[i].y - s[i - 1].y) < 10, `jump at ${i}`);
  }
  // Landing (after the arc) settles straight down onto the desk, never below it.
  const p = deskPhases(f);
  for (let ms = p.pull + p.arc; ms <= p.total; ms++) {
    const q = poseAt(f, ms, deskAim);
    assert.ok(q.y <= desk.y + 1e-9, `y below the desk at ${ms}`);
    assert.ok(q.s <= desk.s + 1e-9, `scale past the desk at ${ms}`);
  }
});

test('back to the shelf: ends exactly in the slot, x never passes it, the push never overshoots', () => {
  const f = toShelf();
  const s = samples(f, slot);
  const end = s[s.length - 1];
  for (const k of ['x', 'y', 's', 'ry', 'rz', 'leaf'] as const) assert.ok(close(end[k], slot[k]), `${k} ${end[k]} vs ${slot[k]}`);
  for (let i = 1; i < s.length; i++) {
    assert.ok(s[i].x <= s[i - 1].x + 1e-9, `x went back at ${i}`);
    assert.ok(s[i].x >= slot.x - 1e-9, `x overshot at ${i}`);
    assert.ok(s[i].leaf >= s[i - 1].leaf - 1e-9 && s[i].leaf <= 0 + 1e-9, `leaf at ${i}`);
  }
  const p = shelfPhases(f);
  let prevY = -Infinity;
  for (let ms = p.close + p.arc; ms <= p.total; ms++) {
    const q = poseAt(f, ms, slot);
    // The push goes down into the slot, one way, and stops level with it.
    assert.ok(q.y >= prevY - 1e-9 && q.y <= slot.y + 1e-9, `push y at ${ms}`);
    prevY = q.y;
  }
});

test('the zoom into the reader lasts about 1–1.4 s and starts after the room fades back', () => {
  const total = ZOOM_PUSH + ZOOM_HANDOFF;
  assert.ok(total >= 1 && total <= 1.4, String(total));
  assert.ok(ZOOM_FADE_BACK < ZOOM_PUSH);
});

test('zoom frames: the desk crop at 0, the reader page exactly at 1, edges one way between', () => {
  const start = { from: { x: 500, y: 600 }, full: { w: 300, h: 420 }, crop: { x: 20, bottom: 40 }, bw: 744, ratio: 1.4, s0: 300 / 744 };
  const reader = { x: 800, y: 168, w: 744 };
  const a = zoomFrame(0, reader, start);
  assert.equal(a.x, 500);
  assert.equal(a.y, 600);
  assert.equal(a.rotate, DESK_TILT);
  assert.ok(close(a.clipX, 20 / start.s0) && close(a.clipBottom, 40 / start.s0));
  assert.equal(a.shadow, 1);
  const b = zoomFrame(1, reader, start);
  assert.equal(b.x, 800);
  assert.equal(b.y, 168 + (744 * 1.4) / 2);
  assert.equal(b.s, 1);
  assert.equal(b.rotate, 0);
  assert.equal(b.clipX, 0);
  assert.equal(b.clipBottom, 0);
  assert.equal(b.shadow, 0);
  assert.equal(b.gutter, 0);
  let prev = a;
  for (let i = 1; i <= 100; i++) {
    const z = zoomFrame(i / 100, reader, start);
    assert.ok(z.x >= prev.x && z.s >= prev.s && z.clipX <= prev.clipX && z.rotate >= prev.rotate, `frame ${i}`);
    assert.ok(z.x <= reader.x && z.s <= 1 + 1e-12, `overshoot at ${i}`);
    prev = z;
  }
});
