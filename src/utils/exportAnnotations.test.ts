/**
 * Run with: npx tsx --test src/utils/exportAnnotations.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMarkdown, generatePlainText, noteDateLabel, type ExportOptions } from './exportAnnotations';
import type { StickyNote } from '../types';

const note = (extra: Partial<StickyNote>): StickyNote => ({
  id: 'n', paragraphIndex: 0, color: 'yellow', title: 'T', content: 'C', author: 'Ann',
  timestamp: 'Just now', themeId: null, ...extra
});
const options: ExportOptions = { bookTitle: 'B', bookAuthor: 'A', themes: [], format: 'txt', includeQuotes: false };

test('createdAt is preferred and printed as a readable date', () => {
  const n = note({ createdAt: '2026-03-05T14:30:00.000Z', timestamp: 'Mar 5, 2026, 2:30 PM' });
  assert.equal(noteDateLabel(n), 'March 5, 2026');
  assert.match(generatePlainText([n], options), /Date: +March 5, 2026\n/);
  assert.match(generateMarkdown([n], options), /\*\*Author:\*\* Ann \(March 5, 2026\)/);
});

test('a legacy "Just now" note prints no date at all', () => {
  const n = note({});
  assert.equal(noteDateLabel(n), '');
  assert.doesNotMatch(generatePlainText([n], options), /Date:|Just now/);
  assert.doesNotMatch(generateMarkdown([n], options), /Just now|\(\)/);
});

test('a legacy note with a real timestamp string keeps it', () => {
  assert.equal(noteDateLabel(note({ timestamp: 'Mar 5, 2026, 2:30 PM' })), 'Mar 5, 2026, 2:30 PM');
  assert.equal(noteDateLabel(note({ createdAt: 'garbage', timestamp: 'Mar 5, 2026' })), 'Mar 5, 2026');
});
