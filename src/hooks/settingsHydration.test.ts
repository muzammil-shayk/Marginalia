/**
 * Run with: npx tsx --test src/hooks/settingsHydration.test.ts
 *
 * The saved settings arriving after launch must not drop a theme made in the meantime.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeHydratedSettings } from './settingsHydration';

const t = (id: string, name = id) => ({ id, name, color: '#000000' });
const launch = { name: '', fontSize: 18, activeThemes: [t('1'), t('2')] };

test('nothing changed since launch: the disk copy wins whole', () => {
  const remote = { name: 'Shama', fontSize: 20, activeThemes: [t('1'), t('2'), t('9')] };
  assert.equal(mergeHydratedSettings(remote, launch, launch), remote);
});

test('a theme made before the disk copy arrived is kept, after the disk themes', () => {
  const current = { ...launch, activeThemes: [...launch.activeThemes, t('new', 'Light')] };
  const remote = { name: 'Shama', fontSize: 20, activeThemes: [t('1'), t('2'), t('9')] };
  const out = mergeHydratedSettings(remote, launch, current);
  assert.deepEqual(out.activeThemes.map((x) => x.id), ['1', '2', '9', 'new']);
  // Fields the reader did not touch come from disk.
  assert.equal(out.name, 'Shama');
  assert.equal(out.fontSize, 20);
});

test('fields changed this session keep the reader’s value; a deleted or renamed theme stays so', () => {
  const current = { ...launch, fontSize: 24, activeThemes: [t('2', 'Renamed')] };
  const remote = { name: 'Shama', fontSize: 20, activeThemes: [t('1'), t('2'), t('9')] };
  const out = mergeHydratedSettings(remote, launch, current);
  assert.equal(out.fontSize, 24);
  assert.deepEqual(out.activeThemes.map((x) => `${x.id}:${x.name}`), ['2:Renamed', '9:9']);
});
