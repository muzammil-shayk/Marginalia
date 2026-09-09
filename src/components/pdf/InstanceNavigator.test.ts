/**
 * Run with: npx tsx --test src/components/pdf/InstanceNavigator.test.ts
 *
 * The navigator's whole job is picking the right marks and walking them in reading order. Both
 * are easy to get subtly wrong — a terminology mark also carries a themeId, and creation order is
 * not page order.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchingAnnotations } from './InstanceNavigator';
import type { Annotation } from './annotationModel';

const mark = (id: string, page: number, y: number, extra: Record<string, unknown> = {}) =>
  ({ id, page, kind: 'highlight', rects: [{ x: 0, y, w: 0.5, h: 0.02 }], ...extra }) as Annotation;

test('a theme focus takes only that theme, in reading order', () => {
  const annotations = [
    mark('c', 3, 0.1, { themeId: 'key' }),
    mark('a', 1, 0.8, { themeId: 'key' }),
    mark('b', 1, 0.2, { themeId: 'key' }),
    mark('x', 2, 0.5, { themeId: 'questions' })
  ];
  assert.deepEqual(
    matchingAnnotations(annotations, {
      kind: 'theme',
      themeId: 'key',
      label: 'Key Concepts',
      color: '#435c52'
    }).map((a) => a.id),
    ['b', 'a', 'c']
  );
});

test('a terminology focus takes flagged marks whatever theme they carry', () => {
  const annotations = [
    mark('t1', 2, 0.3, { isTerminology: true, themeId: 'key' }),
    mark('t2', 1, 0.4, { isTerminology: true, themeId: null }),
    mark('plain', 1, 0.1, { themeId: 'key' })
  ];
  assert.deepEqual(
    matchingAnnotations(annotations, {
      kind: 'terminology',
      label: 'Terminology',
      color: '#8a8578'
    }).map((a) => a.id),
    ['t2', 't1']
  );
});

test('no matches is an empty run, not a crash', () => {
  assert.deepEqual(
    matchingAnnotations([mark('a', 1, 0.1, { themeId: 'other' })], {
      kind: 'theme',
      themeId: 'key',
      label: 'Key Concepts',
      color: '#435c52'
    }),
    []
  );
});
