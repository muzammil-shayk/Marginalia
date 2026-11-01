/**
 * Run with: npx tsx --test src/utils/themes.test.ts
 *
 * Custom themes: the reader's list (`UserSettings.activeThemes`), edited from Settings and from
 * the highlight pop-over, saved with the settings. Deleting a theme never touches a mark.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTheme, renameTheme, recolorTheme, deleteTheme, resolveTheme, themeUsage, UNTITLED_THEME } from './themes';

const base = [
  { id: 't1', name: 'Memory', color: '#aa3300' },
  { id: 't2', name: 'Power', color: '#0055ff' }
];

test('create adds a trimmed, lower-cased-colour theme with a new id', () => {
  const r = createTheme(base, { name: '  Grief ', color: '#ABCDEF' }, () => 't3');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.theme, { id: 't3', name: 'Grief', color: '#abcdef' });
  assert.equal(r.themes.length, 3);
  assert.equal(base.length, 2, 'input not mutated');
});

test('create refuses an empty name, a duplicate name (any case), and a colour that is not hex', () => {
  assert.equal(createTheme(base, { name: ' ', color: '#000' }, () => 'x').ok, false);
  assert.equal(createTheme(base, { name: 'memory', color: '#000' }, () => 'x').ok, false);
  assert.equal(createTheme(base, { name: 'New', color: 'red' }, () => 'x').ok, false);
  assert.equal(createTheme(base, { name: 'New', color: '#12345' }, () => 'x').ok, false);
  assert.equal(createTheme(base, { name: 'x'.repeat(61), color: '#000' }, () => 'x').ok, false);
  const r = createTheme(base, { name: '', color: '#000' }, () => 'x');
  assert.equal('error' in r && typeof r.error === 'string' && r.error.length > 0, true);
});

test('rename keeps the id (marks point at the id, so none is orphaned)', () => {
  const r = renameTheme(base, 't1', 'Remembering');
  assert.equal(r.ok && r.themes[0].id === 't1' && r.themes[0].name === 'Remembering', true);
  assert.equal(renameTheme(base, 't1', 'MEMORY').ok, true, 'renaming to its own name in another case is fine');
  assert.equal(renameTheme(base, 't1', 'power').ok, false, 'not to another theme\'s name');
  assert.equal(renameTheme(base, 'nope', 'X').ok, false);
});

test('recolour changes the colour only', () => {
  const r = recolorTheme(base, 't2', '#00FF00');
  assert.equal(r.ok && r.themes[1].color === '#00ff00' && r.themes[1].name === 'Power', true);
  assert.equal(recolorTheme(base, 't2', 'green').ok, false);
});

test('delete removes the theme from the list only', () => {
  assert.deepEqual(deleteTheme(base, 't1'), [base[1]]);
  assert.equal(deleteTheme(base, 'nope'), base);
});

test('a mark under a deleted theme still resolves: "Untitled" with the fallback colour', () => {
  const after = deleteTheme(base, 't1');
  assert.deepEqual(resolveTheme(after, 't1'), { id: 't1', name: UNTITLED_THEME.name, color: UNTITLED_THEME.color });
  assert.deepEqual(resolveTheme(after, 't2'), base[1]);
  assert.equal(resolveTheme(after, null), null);
});

test('themeUsage counts marks under a theme across the library (to warn before deleting)', () => {
  const metas = [{ themeCounts: { t1: 3, t2: 1 } }, { themeCounts: { t1: 2 } }, { themeCounts: {} }];
  assert.equal(themeUsage(metas, 't1'), 5);
  assert.equal(themeUsage(metas, 'zz'), 0);
});
