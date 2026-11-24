/**
 * Run with: npx tsx --test src/components/guideDeck.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCue, cardAt, chipText, KEY_ROWS_START, keyLabel, keyRows, keyScriptId, cardPose, FULL_VIEW, nearestPos, onScreen, openingState, releaseTarget, settledState, stepCaption, stepTimeline, stepView, wrapOffset, zoomTo } from './guideDeck';
import { GUIDE_STEPS_FIXTURE } from '../test-fixtures/guideSteps.fixture';

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

// ── Step scripts ──

const play = (steps: Parameters<typeof stepTimeline>[0], until = Infinity) => {
  const { cues } = stepTimeline(steps, 1.6);
  return cues.filter((c) => c.t <= until).reduce((s, c) => applyCue(s, c.state), openingState(steps));
};

test('a script plays every step in order, each step bringing in its own frame', () => {
  for (const steps of Object.values(GUIDE_STEPS_FIXTURE)) {
    const { cues, total } = stepTimeline(steps, 1.6);
    for (let n = 1; n < cues.length; n++) assert.ok(cues[n].t >= cues[n - 1].t, 'cues in time order');
    assert.ok(total > cues[cues.length - 1].t, 'the loop ends after the last cue');
    const named = cues.map((c) => c.state.step).filter((s) => s !== undefined);
    assert.deepEqual([...new Set(named)], steps.map((_, i) => i), 'every step is named, in order');
    for (let i = 1; i < steps.length; i++) assert.ok(cues.some((c) => c.state.frame === i), `step ${i} shows its frame`);
    // The loop ends whole and back on the first frame, so it can start again without a jump.
    const end = play(steps);
    assert.deepEqual(end.view, FULL_VIEW);
    assert.equal(end.frame, 0);
    assert.equal(end.pointerOn, false);
    assert.equal(end.chip, null);
  }
});

test('the pointer goes to every step, not one spot', () => {
  const steps = GUIDE_STEPS_FIXTURE['find'];
  const { cues } = stepTimeline(steps, 1.6);
  const spots = cues.filter((c) => c.state.pointer && c.state.pointerOn).map((c) => `${c.state.pointer!.x.toFixed(1)},${c.state.pointer!.y.toFixed(1)}`);
  assert.ok(new Set(spots).size >= 3, `pointer visits several spots: ${spots.join(' ')}`);
  // Each glide lands on the step's point as the zoomed picture shows it.
  steps.forEach((s, i) => {
    const glide = cues.find((c) => c.state.step === i && c.state.pointerOn)!;
    assert.deepEqual(glide.state.pointer, onScreen(stepView(s, 1.6), s.at));
  });
});

test('a drag runs from its start to its end while its frame fades in, and keeps both ends in view', () => {
  const steps = GUIDE_STEPS_FIXTURE['tool-highlight'];
  const drag = steps[2];
  const v = stepView(drag, 1.6);
  for (const p of [drag.at, drag.to!]) {
    const sp = onScreen(v, p);
    assert.ok(sp.x >= 0 && sp.x <= 100 && sp.y >= 0 && sp.y <= 100, 'drag end on screen');
  }
  const { cues } = stepTimeline(steps, 1.6);
  const draw = cues.find((c) => c.state.frame === 2)!;
  assert.deepEqual(draw.state.pointer, onScreen(v, drag.to!), 'the frame fades in as the pointer draws');
  assert.equal(draw.state.fadeMs, draw.state.pointerMs);
  // A wide drag zooms less than the card asks for, a point zooms the full amount.
  assert.ok(v.z < 1.6 + 1e-9);
  assert.equal(stepView({ action: 'click', at: { x: 50, y: 50 } }, 1.6).z, 1.6);
});

test('keys and typed text show on a keycap, then go', () => {
  const steps = GUIDE_STEPS_FIXTURE['find'];
  const { cues } = stepTimeline(steps, 1.6);
  assert.ok(cues.some((c) => c.state.chip === '⌘F'));
  assert.ok(cues.some((c) => c.state.chip === 'margin'));
  const keyAt = cues.find((c) => c.state.chip === '⌘F')!.t;
  const gone = cues.find((c) => c.t > keyAt && c.state.chip === null);
  assert.ok(gone, 'the keycap goes before the next step');
});

test('a new frame keeps the old one under it while it fades in', () => {
  const s0 = openingState(GUIDE_STEPS_FIXTURE['find']);
  const s1 = applyCue(s0, { frame: 2, fadeMs: 400 });
  assert.equal(s1.under, 0);
  assert.equal(s1.fadeKey, 1);
  const s2 = applyCue(s1, { frame: 2, pointerOn: true });
  assert.equal(s2.fadeKey, 1, 'the same frame does not fade again');
});

test('pressing a step dot stops on that step with its frame and the pointer where it ended', () => {
  const steps = GUIDE_STEPS_FIXTURE['tool-highlight'];
  const s = settledState(openingState(steps), steps, 2, 1.6);
  assert.equal(s.step, 2);
  assert.equal(s.frame, 2);
  assert.deepEqual(s.pointer, onScreen(stepView(steps[2], 1.6), steps[2].to!));
  assert.equal(s.pressed, false);
});

test('step captions fall back to plain words until written', () => {
  assert.equal(stepCaption({ action: 'key', at: { x: 0, y: 0 }, keys: 'H' }, undefined), 'Press H');
  assert.equal(stepCaption({ action: 'drag', at: { x: 0, y: 0 } }, 'Drag across the words'), 'Drag across the words');
});

test('Mod+ keys read as the reader\'s own keyboard; typed text is left alone', () => {
  assert.equal(keyLabel('Mod+F', true), '⌘F');
  assert.equal(keyLabel('Mod+Shift+Z', false), 'Ctrl+Shift+Z');
  assert.equal(keyLabel('Mod+Shift+Z', true), '⌘⇧Z', 'a Mac chord is all symbols');
  assert.equal(keyLabel('Cmd/Ctrl+Shift+Z', true), '⌘⇧Z');
  assert.equal(keyLabel('⌘Z · ⌘Shift+Z', true), '⌘Z · ⌘⇧Z', 'guide.ts writes ⌘Shift+ through MOD on a Mac');
  assert.equal(keyLabel('Ctrl+Z · Ctrl+Shift+Z', false), 'Ctrl+Z · Ctrl+Shift+Z');
  assert.equal(keyLabel('Enter · Shift+Enter', true), 'Enter · Shift+Enter', 'Shift alone keeps its word');
  assert.equal(chipText({ action: 'type', at: { x: 0, y: 0 }, keys: 'Mod+F' }, true), 'Mod+F');
  assert.equal(stepCaption({ action: 'key', at: { x: 0, y: 0 }, keys: 'Mod+F' }, undefined, true), 'Press ⌘F');
  const { cues } = stepTimeline([{ action: 'key', at: { x: 50, y: 50 }, keys: 'Mod+F' }], 1.5, false);
  assert.ok(cues.some((c) => c.state.chip === 'Ctrl+F'));
});

test('the shortcuts card goes through its rows by itself and loops', () => {
  let s = KEY_ROWS_START;
  s = keyRows(s, { type: 'played' }, 3);
  assert.deepEqual(s, { row: 1, auto: true });
  s = keyRows(keyRows(s, { type: 'played' }, 3), { type: 'played' }, 3);
  assert.deepEqual(s, { row: 0, auto: true });
  assert.equal(keyScriptId('find'), 'key-find');
});

test('picking a shortcut stops the card on it until it comes to the front again', () => {
  let s = keyRows(KEY_ROWS_START, { type: 'pick', row: 2 }, 17);
  assert.deepEqual(s, { row: 2, auto: false });
  assert.deepEqual(keyRows(s, { type: 'played' }, 17), s, 'a picked row replays, it does not move on');
  s = keyRows(s, { type: 'resume' }, 17);
  assert.deepEqual(s, { row: 2, auto: true });
  assert.deepEqual(keyRows(s, { type: 'played' }, 17), { row: 3, auto: true });
});

test('arrow, Home and End keys move along the shortcut rows, wrapping at the ends', () => {
  const s = { row: 0, auto: true };
  assert.deepEqual(keyRows(s, { type: 'move', by: 'prev' }, 17), { row: 16, auto: false });
  assert.deepEqual(keyRows({ row: 16, auto: false }, { type: 'move', by: 'next' }, 17), { row: 0, auto: false });
  assert.deepEqual(keyRows({ row: 5, auto: true }, { type: 'move', by: 'first' }, 17), { row: 0, auto: false });
  assert.deepEqual(keyRows(s, { type: 'move', by: 'last' }, 17), { row: 16, auto: false });
  assert.deepEqual(keyRows(s, { type: 'pick', row: 20 }, 17), { row: 3, auto: false });
  assert.deepEqual(keyRows(s, { type: 'played' }, 0), s, 'no rows: nothing moves');
});

test('written captions name keys for the reader\'s own keyboard too', () => {
  const key = { action: 'key' as const, at: { x: 0, y: 0 }, keys: 'Mod+Z' };
  assert.equal(stepCaption(key, 'Press Cmd/Ctrl+Z: the highlight is undone', true), 'Press ⌘Z: the highlight is undone');
  assert.equal(stepCaption(key, 'Press Mod+Shift+Z: it is back', false), 'Press Ctrl+Shift+Z: it is back');
  assert.equal(stepCaption(key, 'Press Cmd/Ctrl+Shift+Z: it is back', true), 'Press ⌘⇧Z: it is back');
  assert.equal(stepCaption(key, 'Press Esc to put it down', true), 'Press Esc to put it down');
});
