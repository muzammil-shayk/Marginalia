/**
 * Run with: npx tsx --test src/components/pdf/ocr/trackDrag.test.ts
 *
 * Following a drag on a scanned page (trackDrag.ts): where it ended, and no listener left behind.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackDrag } from './trackDrag';

const pointer = (type: string, x = 0, y = 0) => Object.assign(new Event(type), { clientX: x, clientY: y });
const at = (x: number, y: number) => ({ x: x / 100, y: y / 100 });

test('a drag ends on pointerup with the last point it moved to', () => {
  const win = new EventTarget();
  const ends: unknown[] = [];
  trackDrag(win, at, (to) => ends.push(to));
  win.dispatchEvent(pointer('pointermove', 20, 10));
  win.dispatchEvent(pointer('pointermove', 60, 10));
  win.dispatchEvent(pointer('pointerup', 60, 10));
  assert.deepEqual(ends, [{ x: 0.6, y: 0.1 }]);
  // Listeners are gone: a later release is not a second end.
  win.dispatchEvent(pointer('pointerup', 90, 90));
  assert.equal(ends.length, 1);
});

test('a cancelled drag (pointercancel) ends with no callback and leaves no listener behind', () => {
  const win = new EventTarget();
  const ends: unknown[] = [];
  trackDrag(win, at, (to) => ends.push(to));
  win.dispatchEvent(pointer('pointermove', 20, 10));
  win.dispatchEvent(pointer('pointercancel'));
  win.dispatchEvent(pointer('pointerup', 60, 10));
  assert.deepEqual(ends, []);
});

test('the returned stop removes the listeners too', () => {
  const win = new EventTarget();
  const ends: unknown[] = [];
  const stop = trackDrag(win, at, (to) => ends.push(to));
  stop();
  win.dispatchEvent(pointer('pointerup', 60, 10));
  assert.deepEqual(ends, []);
});
