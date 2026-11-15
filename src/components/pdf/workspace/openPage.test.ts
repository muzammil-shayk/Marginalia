/**
 * Run with: npx tsx --test src/components/pdf/workspace/openPage.test.ts
 */

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { openPageAt } from './openPage';

test('openPageAt: single view, the page current, then scrolled to the top after paint and twice more', () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const frames: (() => void)[] = [];
  g.window = globalThis;
  g.requestAnimationFrame = (cb: () => void) => frames.push(cb);
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const calls: string[] = [];
    const scrolls: unknown[] = [];
    const target = { scrollIntoView: (o: unknown) => scrolls.push(o) };
    let asked = '';
    openPageAt(7, {
      showSingle: () => calls.push('single'),
      setCurrentPage: (p) => calls.push(`page ${p}`),
      scrollRoot: () => ({ querySelector: (sel: string) => ((asked = sel), target) }) as unknown as ParentNode
    });
    assert.deepEqual(calls, ['single', 'page 7']);
    assert.equal(scrolls.length, 0);
    frames.shift()!();
    frames.shift()!();
    assert.equal(asked, '[data-page-number="7"]');
    assert.deepEqual(scrolls, [{ block: 'start' }]);
    mock.timers.tick(250);
    assert.equal(scrolls.length, 2);
    mock.timers.tick(350);
    assert.equal(scrolls.length, 3);
  } finally {
    mock.timers.reset();
    delete g.window;
    delete g.requestAnimationFrame;
  }
});

test('openPageAt: no scroller yet is harmless', () => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = globalThis;
  g.requestAnimationFrame = (cb: () => void) => cb();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    assert.doesNotThrow(() => {
      openPageAt(1, { showSingle: () => {}, setCurrentPage: () => {}, scrollRoot: () => null });
      mock.timers.tick(600);
    });
  } finally {
    mock.timers.reset();
    delete g.window;
    delete g.requestAnimationFrame;
  }
});
