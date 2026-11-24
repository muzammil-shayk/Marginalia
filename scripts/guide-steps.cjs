/**
 * The pure parts of the guide's step capture (scripts/capture-guide.cjs): measured boxes to percent
 * points, step records, frame names and the generated src/data/guideSteps.generated.ts.
 * Tested by captureGuideSteps.test.ts.
 */

const ACTIONS = ['click', 'drag', 'type', 'key', 'hover'];

/** A box (getBoundingClientRect) to its centre, in percent of the window = of the saved frame. */
function centrePct(box, width, height) {
  return {
    x: +(((box.left + box.width / 2) / width) * 100).toFixed(1),
    y: +(((box.top + box.height / 2) / height) * 100).toFixed(1)
  };
}

const pctToPx = (pt, width, height) => [Math.round((pt.x / 100) * width), Math.round((pt.y / 100) * height)];

/** Whether a percent point lands inside a measured box (the pointer really is on its target). */
function inBox(pt, box, width, height) {
  const [x, y] = [(pt.x / 100) * width, (pt.y / 100) * height];
  return x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;
}

const framePath = (card, n) => `steps/${card}/${n}.jpg`;

const onPicture = (pt) => pt.x >= 0 && pt.x <= 100 && pt.y >= 0 && pt.y <= 100;

/** One GuideStep (src/data/guideSteps.ts): its frame is the picture taken after the step. */
function stepRecord(card, n, { action, at, to, keys }) {
  if (!ACTIONS.includes(action)) throw new Error(`${card} step ${n}: unknown action ${action}`);
  if (!at) throw new Error(`${card} step ${n}: no at point`);
  for (const pt of [at, to]) if (pt && !onPicture(pt)) throw new Error(`${card} step ${n}: point off the picture ${JSON.stringify(pt)}`);
  return { action, at, ...(to ? { to } : {}), ...(keys !== undefined ? { keys } : {}), frame: framePath(card, n) };
}

/** Cards to remake: `--only a,b` (or `--only=a,b`), else GUIDE_ONLY, else null (every card). */
function parseOnly(argv, env) {
  const i = argv.findIndex((a) => a === '--only' || a.startsWith('--only='));
  const list = i >= 0 ? (argv[i] === '--only' ? argv[i + 1] : argv[i].slice('--only='.length)) : env.GUIDE_ONLY;
  return list ? new Set(list.split(',').map((x) => x.trim()).filter(Boolean)) : null;
}

const HEAD = '/** Made by scripts/capture-guide.cjs; do not edit. Re-run `npm run guide:capture`. */\n\n';
const DECL = 'export const GUIDE_STEPS: Record<string, GuideStep[]> = ';

function renderStepsFile(steps) {
  const sorted = Object.fromEntries(Object.keys(steps).sort().map((k) => [k, steps[k]]));
  return `${HEAD}import type { GuideStep } from './guideSteps';\n\n${DECL}${JSON.stringify(sorted, null, 2)};\n`;
}

function readStepsFile(src) {
  return JSON.parse(src.slice(src.indexOf(DECL) + DECL.length).replace(/;\s*$/, ''));
}

/** A partial run keeps every card it did not remake. */
function mergeSteps(old, fresh, only) {
  if (!only) return { ...fresh };
  const out = { ...fresh };
  for (const [id, v] of Object.entries(old)) if (!only.has(id)) out[id] = v;
  return out;
}

/** Pixel points a drag moves through after pressing at `a`, ending on `b`. */
function dragPath(a, b, n) {
  return Array.from({ length: n }, (_, i) => [Math.round(a[0] + ((b[0] - a[0]) * (i + 1)) / n), Math.round(a[1] + ((b[1] - a[1]) * (i + 1)) / n)]);
}

/** A drag through waypoints: `n` evenly spaced pixel points along each leg, ending on the last waypoint. */
function polyPath(points, n) {
  return points.slice(1).flatMap((p, i) => dragPath(points[i], p, n));
}

/**
 * Where the pointer is for a key press with no target of its own: it stays where the last step
 * left it (a key has nothing on screen to point at). Null for any other step: typing points at
 * the field it types in (stepTarget).
 */
function heldPoint(step, prev) {
  if (step.target || step.action !== 'key') return null;
  if (!prev) throw new Error(`a ${step.action} step with no pointer before it`);
  return prev;
}

/** Page code for the field that has focus, where typing lands (capture-guide.cjs defines __focused). */
const FOCUSED = '__focused()';

/** The page expression a step aims at: its own target, the focused field for typing, else null. */
function stepTarget(step) {
  return step.target || (step.action === 'type' ? FOCUSED : null);
}

/**
 * Whether a target moved (more than `tol` percent either way) between being measured just before
 * the previous frame was taken and the step itself: that frame would show it somewhere else.
 */
function drifted(planned, actual, tol = 0.3) {
  return !!planned && (Math.abs(planned.x - actual.x) > tol || Math.abs(planned.y - actual.y) > tol);
}

/** Pairs of cards whose pointer visits exactly the same points, in order (a copy-paste slip). */
function duplicateScripts(steps) {
  const sig = (list) => JSON.stringify(list.map((s) => [s.at, s.to ?? null]));
  const ids = Object.keys(steps).sort();
  const out = [];
  ids.forEach((a, i) => ids.slice(i + 1).forEach((b) => sig(steps[a]) === sig(steps[b]) && out.push([a, b])));
  return out;
}

const ARROWS = { '→': 'Right', '←': 'Left' };

/**
 * A key caption ('Mod+Shift+Z', 'Shift+Enter', 'H', '→') as Electron's sendInputEvent wants it.
 * Mod is the platform's command key (`mod`: 'meta' on a Mac, 'control' elsewhere); a lone letter
 * is sent lower-case, so no Shift reaches the page.
 */
function keyChord(caption, mod) {
  const parts = caption.split('+');
  const last = parts.pop();
  const modifiers = parts.map((p) => {
    if (p === 'Mod') return mod;
    if (p === 'Shift') return 'shift';
    throw new Error(`unknown modifier ${p} in ${caption}`);
  });
  const keyCode = ARROWS[last] || (/^[A-Z]$/.test(last) && !modifiers.length ? last.toLowerCase() : last);
  return { keyCode, modifiers };
}

module.exports = { ACTIONS, keyChord, centrePct, pctToPx, inBox, framePath, stepRecord, parseOnly, renderStepsFile, readStepsFile, mergeSteps, dragPath, polyPath, heldPoint, FOCUSED, stepTarget, drifted, duplicateScripts };
