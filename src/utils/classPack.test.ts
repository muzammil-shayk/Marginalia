/**
 * Run with: npx tsx --test src/utils/classPack.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClassPack, classPackFilename, parseClassPack } from './classPack';

const mark = { id: 'm1', kind: 'highlight', anchor: { paragraphIndex: 0, start: 0, end: 4 }, themeId: 't1', color: '#aa0000' };

function pack(extra: Record<string, unknown> = {}) {
  return buildClassPack({
    teacher: ' Ms Raza ',
    message: 'Read stanza one',
    document: { title: 'Odes', format: 'TXT', text: 'Moon over water', layout: 'verbatim' },
    themes: [{ id: 't1', name: 'Nature', color: '#aa0000' }, { id: 't2', name: 'Unused', color: '#00aa00' }],
    annotations: [mark],
    createdAt: '2026-11-03T10:00:00.000Z',
    ...extra
  });
}

test('a pack round-trips; only the themes in use travel; marks are signed by the teacher', () => {
  const parsed = parseClassPack(pack());
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(parsed.pack.teacher, 'Ms Raza');
  assert.equal(parsed.pack.message, 'Read stanza one');
  assert.equal(parsed.pack.document.layout, 'verbatim');
  assert.deepEqual(parsed.pack.themes.map((t) => t.id), ['t1']);
  assert.equal(parsed.pack.annotations.length, 1);
  assert.equal(parsed.pack.annotations[0].author, 'Ms Raza');
  assert.equal(parsed.pack.annotations[0].fromClassPack, true);
});

test('other files and damaged packs are refused with a reason', () => {
  assert.equal(parseClassPack('not json').ok, false);
  assert.equal(parseClassPack({ format: 'marginalia-marks' }).ok, false);
  const newer = JSON.parse(pack());
  newer.version = 2;
  assert.match((parseClassPack(newer) as { error: string }).error, /newer version/);
  const empty = JSON.parse(pack());
  empty.document.text = '  ';
  assert.equal(parseClassPack(empty).ok, false);
  const bad = JSON.parse(pack());
  bad.document.original = 'not base64!';
  assert.match((parseClassPack(bad) as { error: string }).error, /damaged/);
});

test('marks that cannot be placed and malformed styles are dropped', () => {
  const p = JSON.parse(pack());
  p.annotations.push({ id: 'x', kind: 'highlight' }, { id: 'y', kind: 'nonsense', page: 1 });
  p.document.textStyles = [{ anchor: { paragraphIndex: 0, start: 0, end: 4 }, style: 'italic' }, { style: 'bold' }];
  const parsed = parseClassPack(p);
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.pack.annotations.map((a) => a.id), ['m1']);
  assert.equal(parsed.pack.document.textStyles?.length, 1);
});

test('the original travels as base64 and the file name is safe', () => {
  const parsed = parseClassPack(pack({ document: { title: 'A/B', format: 'PDF', text: 'x', original: Buffer.from('%PDF').toString('base64') } }));
  assert.ok(parsed.ok && parsed.pack.document.original === 'JVBERg==');
  assert.equal(classPackFilename('A/B: odes?'), 'A B odes – class pack.marginalia-class');
});
