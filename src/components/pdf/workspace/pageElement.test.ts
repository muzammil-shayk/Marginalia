import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageElementAt } from './pageElement';

/** A page copy, inside a strip covering [top, bottom] of the page, or in no strip at all. */
const copy = (name: string, band?: [number, number]) =>
  ({
    name,
    closest: () => (band ? { dataset: { bandTop: String(band[0]), bandBottom: String(band[1]) } } : null)
  }) as unknown as HTMLElement;
const root = (els: HTMLElement[]) => ({ querySelectorAll: () => els }) as unknown as ParentNode;
const nameOf = (el: HTMLElement | null) => (el as unknown as { name: string } | null)?.name ?? null;

test('pageElementAt: a page not in strips is its only element', () => {
  assert.equal(nameOf(pageElementAt(root([copy('page')]), 2, 0.9)), 'page');
});

test('pageElementAt: picks the strip whose band holds the height', () => {
  const strips = root([copy('top', [0.08, 0.52]), copy('low', [0.84, 0.91])]);
  assert.equal(nameOf(pageElementAt(strips, 2, 0.1)), 'top');
  assert.equal(nameOf(pageElementAt(strips, 2, 0.87)), 'low');
});

test('pageElementAt: a height in no strip falls back to the first; none at all is null', () => {
  assert.equal(nameOf(pageElementAt(root([copy('top', [0.08, 0.52]), copy('low', [0.84, 0.91])]), 2, 0.7)), 'top');
  assert.equal(pageElementAt(root([]), 2, 0.5), null);
  assert.equal(pageElementAt(null, 2, 0.5), null);
});
