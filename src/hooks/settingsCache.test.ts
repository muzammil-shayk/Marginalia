/**
 * Run with: npx tsx --test src/hooks/settingsCache.test.ts
 *
 * The server's settings file also holds the Gemini key and model. Hydration merged that whole
 * file into the app's settings, which were then cached in localStorage — a plain-text copy of
 * the key in the browser profile. Anything `gemini*` is stripped before the cache is written.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withoutSecrets } from './settingsCache';

test('the Gemini key and model are stripped from what goes to localStorage', () => {
  const cached = withoutSecrets({ name: 'Ada', fontSize: 18, geminiApiKey: 'AIza-secret', geminiModel: 'm' });
  assert.deepEqual(cached, { name: 'Ada', fontSize: 18 });
});

test('the serialised cache never contains the key', () => {
  const json = JSON.stringify(withoutSecrets({ name: 'Ada', GeminiApiKey: 'AIza-secret' }));
  assert.equal(json.includes('AIza-secret'), false);
});

test('the settings object it was given is not changed', () => {
  const settings = { name: 'Ada', geminiApiKey: 'AIza-secret' };
  withoutSecrets(settings);
  assert.equal(settings.geminiApiKey, 'AIza-secret');
});
