/**
 * Run with: npx tsx --test src/components/paletteSpot.test.ts
 *
 * Where focus mode's floating tools sit and when they show (paletteSpot.ts).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SPOT, EDGE_GAP, dropSpot, nearEdge, nudgeSpot, paletteShown, spotBox, spotOf } from './paletteSpot';

test('a saved spot is read safely; anything malformed is the default', () => {
  assert.deepEqual(spotOf({ side: 'right', y: 0.3 }), { side: 'right', y: 0.3 });
  assert.deepEqual(spotOf(undefined), DEFAULT_SPOT);
  assert.deepEqual(spotOf({ side: 'top', y: Number.NaN }), DEFAULT_SPOT);
  assert.deepEqual(spotOf({ side: 'left', y: 7 }), { side: 'left', y: 0.95 });
});

test('dropping it snaps to the nearer edge at the height it was dropped', () => {
  assert.deepEqual(dropSpot(100, 250, 1000, 1000), { side: 'left', y: 0.25 });
  assert.deepEqual(dropSpot(900, 990, 1000, 1000), { side: 'right', y: 0.95 });
});

test('its box hugs the chosen edge and never leaves the window', () => {
  assert.deepEqual(spotBox({ side: 'left', y: 0.5 }, 50, 400, 1200, 800), { left: EDGE_GAP, top: 200 });
  assert.deepEqual(spotBox({ side: 'right', y: 0.5 }, 50, 400, 1200, 800), { left: 1200 - 50 - EDGE_GAP, top: 200 });
  // Near the bottom of a short window it stops at the edge rather than hanging off it.
  assert.deepEqual(spotBox({ side: 'left', y: 0.95 }, 50, 400, 1200, 500), { left: EDGE_GAP, top: 500 - 400 - EDGE_GAP });
  // Taller than the window: pinned to the top.
  assert.equal(spotBox({ side: 'left', y: 0.5 }, 50, 600, 1200, 500).top, EDGE_GAP);
});

test('only its own edge calls it', () => {
  assert.ok(nearEdge(10, 'left', 1000));
  assert.ok(!nearEdge(10, 'right', 1000));
  assert.ok(nearEdge(990, 'right', 1000));
  assert.ok(!nearEdge(500, 'left', 1000));
});

test('arrow keys on the grip move it; other keys do nothing', () => {
  assert.deepEqual(nudgeSpot({ side: 'left', y: 0.5 }, 'ArrowUp'), { side: 'left', y: 0.45 });
  assert.deepEqual(nudgeSpot({ side: 'left', y: 0.05 }, 'ArrowUp'), { side: 'left', y: 0.05 });
  assert.deepEqual(nudgeSpot({ side: 'left', y: 0.5 }, 'ArrowRight'), { side: 'right', y: 0.5 });
  assert.equal(nudgeSpot({ side: 'left', y: 0.5 }, 'Enter'), null);
});

test('shown while called, pinned, hovered, focused or dragged; hidden otherwise', () => {
  const none = { nearEdge: false, pinned: false, hovered: false, focusWithin: false, dragging: false };
  assert.equal(paletteShown(none), false);
  for (const k of Object.keys(none) as (keyof typeof none)[]) assert.equal(paletteShown({ ...none, [k]: true }), true, k);
});
