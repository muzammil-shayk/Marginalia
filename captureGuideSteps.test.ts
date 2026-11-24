import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { GUIDE_GROUPS, SHORTCUTS } from './src/data/guide';
import { KEY_STEP_CAPTIONS } from './src/data/guideKeyCaptions';
import { GUIDE_STEPS } from './src/data/guideSteps.generated';

const require = createRequire(import.meta.url);
const g = require('./scripts/guide-steps.cjs');

test('centrePct: an element box becomes its centre in percent of the window, one decimal', () => {
  assert.deepEqual(g.centrePct({ left: 100, top: 40, width: 56, height: 20 }, 1280, 800), { x: 10, y: 6.3 });
});

test('pctToPx: a percent point becomes whole window pixels', () => {
  assert.deepEqual(g.pctToPx({ x: 10, y: 6.3 }, 1280, 800), [128, 50]);
});

test('inBox: true only for a percent point inside the measured box', () => {
  const box = { left: 100, top: 40, width: 56, height: 20 };
  assert.equal(g.inBox({ x: 10, y: 6.3 }, box, 1280, 800), true);
  assert.equal(g.inBox({ x: 20, y: 6.3 }, box, 1280, 800), false);
});

test('framePath: frames live under steps/<card>/<n>.jpg', () => {
  assert.equal(g.framePath('tool-note', 2), 'steps/tool-note/2.jpg');
});

test('stepRecord: keeps only the fields given, with its frame', () => {
  assert.deepEqual(g.stepRecord('find', 1, { action: 'type', at: { x: 1, y: 2 }, keys: 'reader' }), {
    action: 'type',
    at: { x: 1, y: 2 },
    keys: 'reader',
    frame: 'steps/find/1.jpg'
  });
  assert.deepEqual(g.stepRecord('x', 0, { action: 'drag', at: { x: 1, y: 2 }, to: { x: 3, y: 4 } }), {
    action: 'drag',
    at: { x: 1, y: 2 },
    to: { x: 3, y: 4 },
    frame: 'steps/x/0.jpg'
  });
});

test('stepRecord: refuses an unknown action or a missing point', () => {
  assert.throws(() => g.stepRecord('x', 0, { action: 'swipe', at: { x: 1, y: 2 } }), /action/);
  assert.throws(() => g.stepRecord('x', 0, { action: 'click' }), /at/);
});

test('stepRecord: refuses a point off the picture', () => {
  assert.throws(() => g.stepRecord('x', 0, { action: 'click', at: { x: 101, y: 2 } }), /off the picture/);
  assert.throws(() => g.stepRecord('x', 0, { action: 'drag', at: { x: 1, y: 2 }, to: { x: 5, y: -1 } }), /off the picture/);
});

test('parseOnly: --only list, then GUIDE_ONLY, else every card', () => {
  assert.deepEqual([...g.parseOnly(['electron', 'x.cjs', '--only', 'find, tool-note'], {})], ['find', 'tool-note']);
  assert.deepEqual([...g.parseOnly(['x.cjs', '--only=find'], {})], ['find']);
  assert.deepEqual([...g.parseOnly([], { GUIDE_ONLY: 'shelf' })], ['shelf']);
  assert.equal(g.parseOnly([], {}), null);
});

test('renderStepsFile and readStepsFile round-trip, cards in name order', () => {
  const steps = { find: [{ action: 'key', at: { x: 1, y: 2 }, keys: 'Mod+F', frame: 'steps/find/0.jpg' }], 'a-card': [] };
  const src = g.renderStepsFile(steps);
  assert.match(src, /Made by scripts\/capture-guide\.cjs; do not edit/);
  assert.match(src, /export const GUIDE_STEPS: Record<string, GuideStep\[\]> = /);
  assert.match(src, /import type \{ GuideStep \} from '\.\/guideSteps';/);
  assert.ok(src.indexOf('"a-card"') < src.indexOf('"find"'));
  assert.deepEqual(g.readStepsFile(src), steps);
});

test('mergeSteps: a partial run replaces only the cards it remade', () => {
  const old = { find: ['old find'], 'tool-note': ['old note'] };
  const fresh = { find: ['new find'] };
  assert.deepEqual(g.mergeSteps(old, fresh, new Set(['find'])), { find: ['new find'], 'tool-note': ['old note'] });
  assert.deepEqual(g.mergeSteps(old, fresh, null), { find: ['new find'] });
});

test('dragPath: evenly spaced pixel points after the start, ending on the end', () => {
  assert.deepEqual(g.dragPath([0, 0], [10, 20], 2), [[5, 10], [10, 20]]);
});

test('polyPath: a drag through waypoints passes each one, ending on the last', () => {
  assert.deepEqual(g.polyPath([[0, 0], [10, 0], [10, 10]], 2), [[5, 0], [10, 0], [10, 5], [10, 10]]);
});

test('heldPoint: a key step with no target keeps the pointer where it was', () => {
  assert.deepEqual(g.heldPoint({ action: 'key', keys: 'Enter' }, { x: 4, y: 5 }), { x: 4, y: 5 });
  assert.equal(g.heldPoint({ action: 'key', keys: 'Enter', target: 'x' }, { x: 4, y: 5 }), null);
  assert.equal(g.heldPoint({ action: 'click' }, { x: 4, y: 5 }), null);
  assert.throws(() => g.heldPoint({ action: 'key', keys: 'Enter' }, null), /no pointer/);
});

test('heldPoint: typing never keeps the pointer behind: it goes to the field typed in', () => {
  assert.equal(g.heldPoint({ action: 'type', keys: 'a' }, { x: 4, y: 5 }), null);
});

test('stepTarget: a typing step with no target aims at the focused field; others keep theirs', () => {
  assert.equal(g.stepTarget({ action: 'type', keys: 'a' }), g.FOCUSED);
  assert.equal(g.stepTarget({ action: 'type', keys: 'a', target: 'x' }), 'x');
  assert.equal(g.stepTarget({ action: 'click', target: 'y' }), 'y');
  assert.equal(g.stepTarget({ action: 'key', keys: 'Enter' }), null);
});

test('drifted: true when a target moved after the frame before it was taken', () => {
  assert.equal(g.drifted({ x: 75.5, y: 50 }, { x: 75.5, y: 50 }), false);
  assert.equal(g.drifted({ x: 75.5, y: 50 }, { x: 75.6, y: 50.2 }), false);
  assert.equal(g.drifted({ x: 75.5, y: 50 }, { x: 75.5, y: 57 }), true);
  assert.equal(g.drifted({ x: 10, y: 50 }, { x: 11, y: 50 }), true);
  assert.equal(g.drifted(null, { x: 10, y: 50 }), false);
});

test('duplicateScripts: names cards whose pointer goes to exactly the same places', () => {
  const s = (pts) => pts.map(([x, y]) => ({ action: 'click', at: { x, y }, frame: 'f' }));
  const steps = { a: s([[1, 2], [3, 4]]), b: s([[1, 2], [3, 4]]), c: s([[1, 2], [3, 5]]) };
  assert.deepEqual(g.duplicateScripts(steps), [['a', 'b']]);
  assert.deepEqual(g.duplicateScripts({ c: steps.c }), []);
});

test('keyChord: a key caption becomes the key and its modifiers', () => {
  assert.deepEqual(g.keyChord('Mod+Shift+Z', 'meta'), { keyCode: 'Z', modifiers: ['meta', 'shift'] });
  assert.deepEqual(g.keyChord('Mod+F', 'control'), { keyCode: 'F', modifiers: ['control'] });
  assert.deepEqual(g.keyChord('Shift+Enter', 'meta'), { keyCode: 'Enter', modifiers: ['shift'] });
  assert.deepEqual(g.keyChord('H', 'meta'), { keyCode: 'h', modifiers: [] });
  assert.deepEqual(g.keyChord('2', 'meta'), { keyCode: '2', modifiers: [] });
  assert.deepEqual(g.keyChord('→', 'meta'), { keyCode: 'Right', modifiers: [] });
  assert.deepEqual(g.keyChord('←', 'meta'), { keyCode: 'Left', modifiers: [] });
});

test('keyChord: refuses an unknown modifier', () => {
  assert.throws(() => g.keyChord('Hyper+Z', 'meta'), /modifier/);
});

test('every shortcut has its own captured card, key-<demo>', () => {
  assert.deepEqual(SHORTCUTS.map((k) => `key-${k.demo}`).filter((id) => !GUIDE_STEPS[id]?.length), []);
});

test('every shortcut card shows the keys it teaches being pressed', () => {
  const taught: Record<string, string[]> = {
    highlight: ['H'], underline: ['U'], strike: ['S'], area: ['A'], pen: ['P'], note: ['N'],
    noteKeys: ['Shift+Enter', 'Enter'], selectErase: ['V', 'E'], theme: ['2', '3'], turn: ['→', '←'],
    find: ['Mod+F'], focus: ['F'], palette: ['T'], collapse: ['C'], undo: ['Mod+Z', 'Mod+Shift+Z'],
    delete: ['Delete'], escape: ['Esc']
  };
  assert.deepEqual(Object.keys(taught).sort(), SHORTCUTS.map((k) => k.demo).sort());
  for (const [demo, keys] of Object.entries(taught)) {
    const pressed = (GUIDE_STEPS[`key-${demo}`] ?? []).filter((s) => s.action === 'key').map((s) => s.keys);
    for (const k of keys) assert.ok(pressed.includes(k), `key-${demo}: ${k} is never pressed`);
  }
});

test('every shortcut card has one draft caption per step, in guideKeyCaptions.ts', () => {
  const ids = Object.keys(GUIDE_STEPS).filter((id) => id.startsWith('key-'));
  assert.deepEqual(Object.keys(KEY_STEP_CAPTIONS).sort(), ids.sort());
  for (const id of ids) {
    assert.equal(KEY_STEP_CAPTIONS[id].length, GUIDE_STEPS[id].length, `${id}: ${GUIDE_STEPS[id].length} steps, ${KEY_STEP_CAPTIONS[id].length} captions`);
    for (const c of KEY_STEP_CAPTIONS[id]) assert.ok(c.trim(), `${id}: empty caption`);
  }
});

test('every captured card has one caption per step, in guide.ts', () => {
  const features = new Map(GUIDE_GROUPS.flatMap((x) => x.features).map((f) => [f.id, f]));
  for (const [id, steps] of Object.entries(GUIDE_STEPS)) {
    if (id.startsWith('key-')) continue; // captions in guideKeyCaptions.ts
    const f = features.get(id);
    assert.ok(f, `${id} is not a card in guide.ts`);
    assert.equal(f.steps?.length, steps.length, `${id}: ${steps.length} steps, ${f.steps?.length ?? 0} captions`);
    for (const c of f.steps ?? []) assert.ok(c.trim(), `${id}: empty caption`);
  }
});

test('every toolbar card has captured steps', () => {
  const toolbar = GUIDE_GROUPS.find((x) => x.id === 'toolbar')!;
  assert.deepEqual(toolbar.features.map((f) => f.id).filter((id) => !GUIDE_STEPS[id]?.length), []);
});

test('every picture card has captured steps (the shortcuts card plays its own scenes)', () => {
  const pictureCards = GUIDE_GROUPS.flatMap((x) => x.features).filter((f) => !f.keys);
  assert.deepEqual(pictureCards.map((f) => f.id).filter((id) => !GUIDE_STEPS[id]?.length), []);
});

test('no two shipped cards send the pointer to exactly the same places', () => {
  assert.deepEqual(g.duplicateScripts(GUIDE_STEPS), []);
});

test('every captured card ends on a frame of its own, after at least one real action', () => {
  for (const [id, steps] of Object.entries(GUIDE_STEPS)) {
    assert.ok(steps.length >= 2 && steps.length <= 7, `${id}: ${steps.length} steps`);
    assert.equal(new Set(steps.map((s) => s.frame)).size, steps.length, `${id}: a frame used twice`);
    assert.ok(steps.slice(1).some((s) => s.action !== 'hover'), `${id}: nothing but hovering`);
  }
});

test('every typing step points at the field it types in, not the step before', () => {
  for (const [id, steps] of Object.entries(GUIDE_STEPS)) {
    steps.forEach((s, i) => {
      if (s.action === 'type' && i > 0) assert.notDeepEqual(s.at, steps[i - 1].at, `${id} step ${i}: pointer left on the step before`);
    });
  }
});

test('every step changes what is on screen (its frame differs from the one before)', () => {
  // Pressing V when Select is already the tool changes nothing: kept as a plain key press.
  const still = new Set(['key-delete/1', 'key-selectErase/1']);
  const md5 = (f: string) => createHash('md5').update(readFileSync(new URL(`./src/assets/guide/${f}`, import.meta.url))).digest('hex');
  for (const [id, steps] of Object.entries(GUIDE_STEPS)) {
    for (let i = 1; i < steps.length; i++) {
      if (still.has(`${id}/${i}`)) continue;
      assert.notEqual(md5(steps[i].frame), md5(steps[i - 1].frame), `${id} step ${i}: frame is the same as the one before`);
    }
  }
});
