/**
 * Run with: npx tsx --test src/components/pdf/annotationModel.test.ts
 *
 * Selection rectangles come from the browser one per text run, and turning them into per-line
 * bars is where a two-column page goes wrong: the two columns share every vertical band, so
 * grouping on vertical overlap alone spans the gutter.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrowHeadPath, blackoutBoxFromPoints, inkArrowReach, isStroked, MIN_BLACKOUT_HEIGHT, mergeRectsIntoLines, pageToolFor, inkArrowHead, inkArrowShaft, tailAnchor, type Annotation } from './annotationModel';

// Node has no DOM, and only these six numbers are read.
class Rect {
  constructor(
    public left: number,
    public top: number,
    public width: number,
    public height: number
  ) {}
  get right() { return this.left + this.width; }
  get bottom() { return this.top + this.height; }
}
const rect = (left: number, top: number, width: number, height = 12) =>
  new Rect(left, top, width, height) as unknown as DOMRect;

test('runs on the same line merge into one bar', () => {
  const merged = mergeRectsIntoLines([rect(100, 40, 60), rect(163, 40, 50)]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].left, 100);
  assert.equal(merged[0].right, 213);
});

test('two columns on the same band stay apart', () => {
  // Column one ends at x=300; column two starts at x=520. Same vertical band.
  const merged = mergeRectsIntoLines([rect(100, 40, 200), rect(520, 40, 180)]);
  assert.equal(merged.length, 2, 'the gutter must not be swallowed into one rectangle');
  assert.deepEqual(
    merged.map((m) => [m.left, m.right]),
    [
      [100, 300],
      [520, 700]
    ]
  );
});

test('separate lines stay separate', () => {
  const merged = mergeRectsIntoLines([rect(100, 40, 200), rect(100, 60, 200)]);
  assert.equal(merged.length, 2);
});

test('muted highlight colours are laid down harder than vivid ones, so they never read as a selection', async () => {
  const { highlightOpacity } = await import('./annotationModel');
  assert.equal(highlightOpacity('#52796f'), 0.56); // sage
  assert.equal(highlightOpacity('#eab308'), 0.38); // vivid yellow
  assert.ok(highlightOpacity('#52796f', true) > highlightOpacity('#52796f'));
  assert.equal(highlightOpacity('not-a-colour'), 0.38);
});

test('a black-out dragged along a line gets a line of height, centred and kept on the page', () => {
  const flat = blackoutBoxFromPoints({ x: 0.2, y: 0.5 }, { x: 0.7, y: 0.5 });
  assert.equal(flat.h, MIN_BLACKOUT_HEIGHT);
  assert.ok(Math.abs(flat.y + flat.h / 2 - 0.5) < 1e-9);
  assert.ok(Math.abs(flat.w - 0.5) < 1e-9);
  assert.equal(blackoutBoxFromPoints({ x: 0.2, y: 0 }, { x: 0.7, y: 0 }).y, 0);
  const tall = blackoutBoxFromPoints({ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.4 });
  assert.ok(Math.abs(tall.h - 0.3) < 1e-9);
});

// ── Freehand arrow: the head's direction is read from the stroke's tail, not its last two points ──

const angleOf = (from: { x: number; y: number }, to: { x: number; y: number }) => (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

test('freehand arrow: a straight stroke points its head straight along it', () => {
  const points = Array.from({ length: 20 }, (_, i) => ({ x: 0.1 + i * 0.01, y: 0.5 }));
  const anchor = tailAnchor(points, 0.03);
  assert.ok(Math.abs(anchor.x - 0.26) < 1e-9 && anchor.y === 0.5, JSON.stringify(anchor));
  assert.equal(angleOf(anchor, points[19]), 0);
});

test('freehand arrow: jitter and a lift-off hook do not swing the head', () => {
  // Heading right and a little down; the hand wobbles, and the last sample flicks up as the pen lifts.
  const points = Array.from({ length: 30 }, (_, i) => ({ x: 0.1 + i * 0.008, y: 0.5 + i * 0.002 + (i % 2 ? 0.0015 : -0.0015) }));
  points.push({ x: points[29].x + 0.002, y: points[29].y - 0.003 });
  const truth = angleOf(points[0], points[29]);
  const naive = angleOf(points[29], points[30]);
  const smoothed = angleOf(tailAnchor(points, inkArrowReach(0.0028)), points[30]);
  assert.ok(Math.abs(naive - truth) > 45, `naive ${naive} vs ${truth}`);
  assert.ok(Math.abs(smoothed - truth) < 12, `smoothed ${smoothed} vs ${truth}`);
});

test('freehand arrow: a curve that ends heading down gets a head pointing down', () => {
  // A quarter circle from the top, sweeping right and then down.
  const points = Array.from({ length: 40 }, (_, i) => {
    const t = (i / 39) * (Math.PI / 2);
    return { x: 0.3 + Math.sin(t) * 0.2, y: 0.3 + (1 - Math.cos(t)) * 0.2 };
  });
  const head = angleOf(tailAnchor(points, inkArrowReach(0.0028)), points[39]);
  assert.ok(head > 80 && head <= 90, String(head));
});

test('freehand arrow: on a short stroke the direction reads from half of it at most', () => {
  const points = [{ x: 0.5, y: 0.5 }, { x: 0.51, y: 0.5 }, { x: 0.51, y: 0.51 }];
  const anchor = tailAnchor(points, 1);
  assert.ok(Math.abs(anchor.x - 0.51) < 1e-9 && Math.abs(anchor.y - 0.5) < 1e-9, JSON.stringify(anchor));
  assert.equal(inkArrowReach(0.001), 0.04);
  assert.ok(Math.abs(inkArrowReach(0.01) - 0.14) < 1e-12);
});

test('freehand arrow on screen: the head is drawn in pixels, so it keeps its size and aim on a tall page', () => {
  // A stroke heading straight down an A4-shaped page 600 x 848 px, 2 px wide.
  const points = Array.from({ length: 10 }, (_, i) => ({ x: 0.5, y: 0.3 + i * 0.01 }));
  const head = inkArrowHead(points, 2 / 600, 600, 848)!;
  const [tip, left, right] = head.split(' ').map((p) => p.split(',').map(Number)).map(([x, y]) => [(x / 100) * 600, (y / 100) * 848]);
  // Tip one width (2 px) past the end, back corners 8 px behind it and 8 px apart: in pixels, not viewBox units.
  assert.ok(Math.abs(tip[0] - 300) < 0.01 && Math.abs(tip[1] - (0.39 * 848 + 2)) < 0.01, JSON.stringify(tip));
  assert.ok(Math.abs(left[1] - (tip[1] - 8)) < 0.01 && Math.abs(right[1] - (tip[1] - 8)) < 0.01);
  assert.ok(Math.abs(Math.abs(left[0] - right[0]) - 8) < 0.01);
  // No direction, no page size: no head.
  assert.equal(inkArrowHead([points[0], points[0]], 0.003, 600, 848), null);
  assert.equal(inkArrowHead(points, 0.003, 0, 0), null);
});

test('freehand arrow: a toolbar tool, stroked, that draws an ordinary ink mark', () => {
  assert.ok(isStroked('inkArrow'));
  assert.equal(pageToolFor('inkArrow', 'box'), 'inkArrow');
  // Old pen marks carry no flag and stay plain strokes.
  const old: Annotation = { id: 'a', page: 1, kind: 'ink', color: '#000000', themeIds: [], points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], createdAt: '' };
  assert.equal(old.arrowHead, undefined);
});

test('straight arrow on screen: the same pixel head as the freehand one, along the line, past its end', () => {
  // From (0.2, 0.5) to (0.6, 0.5) on a 600 x 848 page, 3 px wide: the tip 3 px past x = 360.
  const head = inkArrowHead([{ x: 0.2, y: 0.5 }, { x: 0.6, y: 0.5 }], 3 / 600, 600, 848)!;
  const [tip, left, right] = head.split(' ').map((p) => p.split(',').map(Number)).map(([x, y]) => [(x / 100) * 600, (y / 100) * 848]);
  assert.ok(Math.abs(tip[0] - 363) < 0.01 && Math.abs(tip[1] - 424) < 0.01, JSON.stringify(tip));
  assert.ok(Math.abs(left[0] - 351) < 0.01 && Math.abs(right[0] - 351) < 0.01);
  assert.ok(Math.abs(Math.abs(left[1] - right[1]) - 12) < 0.01);
});

test('export arrowhead: 4 widths long, 4 wide, tip one width past the end, along the angle', () => {
  const nums = (d: string) => d.match(/-?\d+\.\d+/g)!.map(Number);
  // Pointing right from (100, 200) with a 2 pt stroke. Y is negated for drawSvgPath.
  const [tx, ty, lx, ly, rx, ry] = nums(arrowHeadPath(100, 200, 0, 2));
  assert.deepEqual([tx, -ty], [102, 200]);
  assert.deepEqual([lx, -ly], [94, 204]);
  assert.deepEqual([rx, -ry], [94, 196]);
  // Pointing straight down the page (PDF y falls): tip below the end.
  const [dx, dy] = nums(arrowHeadPath(100, 200, -Math.PI / 2, 2));
  assert.deepEqual([dx, -dy], [100, 198]);
});

test('freehand arrow: the shaft runs straight into the head, so a lift-off hook never pokes out beside it', () => {
  // Along a line, a hook down and back up at the very end.
  const points = [...Array.from({ length: 20 }, (_, i) => ({ x: 0.1 + i * 0.01, y: 0.5 })), { x: 0.295, y: 0.505 }, { x: 0.3, y: 0.499 }];
  const shaft = inkArrowShaft(points, 0.0028);
  const anchor = tailAnchor(points, inkArrowReach(0.0028));
  assert.deepEqual(shaft[shaft.length - 1], points[points.length - 1]);
  assert.deepEqual(shaft[shaft.length - 2], anchor);
  // The hook's dip is gone, everything before the anchor is kept as drawn.
  assert.ok(!shaft.some((p) => p.y === 0.505));
  assert.deepEqual(shaft.slice(0, shaft.length - 2), points.filter((p) => p.x < anchor.x));
  // Short strokes and single points come back whole.
  assert.deepEqual(inkArrowShaft([points[0]], 0.0028), [points[0]]);
});
