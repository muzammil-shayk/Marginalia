/**
 * Run with: npx tsx --test src/components/pdf/export/classPackRedaction.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanedPack, cleanClassPack } from './classPackRedaction';
import { buildClassPack, parseClassPack, type ClassPack } from '../../../utils/classPack';

const base = { themeIds: [], color: '#000000', createdAt: '2026-11-15T00:00:00.000Z' };
const blackout = { ...base, id: 'b', page: 1, kind: 'rect', box: { x: 0.1, y: 0.1, w: 0.3, h: 0.05 }, filled: true, blackout: true };
const over = { ...base, id: 'h1', page: 1, kind: 'highlight', rects: [{ x: 0.2, y: 0.11, w: 0.1, h: 0.02 }], quote: 'secret words', text: 'my note' };
const away = { ...base, id: 'h2', page: 1, kind: 'highlight', rects: [{ x: 0.2, y: 0.8, w: 0.1, h: 0.02 }], quote: 'open words' };
const otherPage = { ...base, id: 'h3', page: 2, kind: 'highlight', rects: [{ x: 0.2, y: 0.11, w: 0.1, h: 0.02 }], quote: 'page two' };

function pack(annotations: unknown[]): ClassPack {
  const parsed = parseClassPack(
    buildClassPack({
      teacher: 'T',
      document: { title: 'Doc', format: 'PDF', text: 'secret words open words page two', filename: 'd.pdf', original: 'QUJD' },
      themes: [],
      annotations: annotations as never
    })
  );
  assert.ok(parsed.ok);
  return (parsed as { pack: ClassPack }).pack;
}

test('the cleaned copy replaces the original and its text; quotes under a black-out go, notes stay', () => {
  const out = cleanedPack(pack([blackout, over, away, otherPage]), { original: 'WFla', text: 'open words page two' });
  assert.equal(out.document.original, 'WFla');
  assert.equal(out.document.text, 'open words page two');
  const byId = Object.fromEntries(out.annotations.map((a) => [a.id, a as Record<string, unknown>]));
  assert.equal(byId.h1.quote, undefined);
  assert.equal(byId.h1.text, 'my note');
  assert.equal(byId.h2.quote, 'open words');
  assert.equal(byId.h3.quote, 'page two');
  assert.equal(byId.b.blackout, true);
  assert.ok(!JSON.stringify(out).includes('secret'));
});

test('a pack without black-outs is passed through untouched', async () => {
  const body = JSON.stringify(pack([away]));
  assert.equal(await cleanClassPack(body), body);
});

test('black-outs with no original to redact refuse the pack rather than leak it', async () => {
  const p = pack([blackout]);
  delete p.document.original;
  await assert.rejects(cleanClassPack(JSON.stringify(p)));
});
