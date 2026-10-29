/**
 * Run with: npx tsx --test src/hooks/noteTimestamp.test.ts
 *
 * Text-reader notes used to store the literal string "Just now" as their time, so a note from
 * last year still said "Just now". New notes carry an ISO `createdAt`; the label is computed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteTimeLabel } from './noteTimestamp';

const now = new Date('2026-10-29T12:00:00Z');

test('a note made seconds ago reads "now"', () => {
  assert.equal(noteTimeLabel({ createdAt: '2026-10-29T11:59:50Z' }, now), 'now');
});

test('a note made 5 minutes ago reads "5 minutes ago"', () => {
  assert.equal(noteTimeLabel({ createdAt: '2026-10-29T11:55:00Z' }, now), '5 minutes ago');
});

test('a note made 3 hours ago reads "3 hours ago"', () => {
  assert.equal(noteTimeLabel({ createdAt: '2026-10-29T09:00:00Z' }, now), '3 hours ago');
});

test('a note made yesterday reads "yesterday"', () => {
  assert.equal(noteTimeLabel({ createdAt: '2026-10-28T10:00:00Z' }, now), 'yesterday');
});

test('a note older than a month shows its date', () => {
  assert.equal(noteTimeLabel({ createdAt: '2026-01-15T10:00:00Z' }, now), 'Jan 15, 2026');
});

test('an old note stored with "Just now" and no createdAt shows nothing', () => {
  assert.equal(noteTimeLabel({ timestamp: 'Just now' }, now), '');
});

test('an unreadable createdAt shows nothing rather than "Invalid Date"', () => {
  assert.equal(noteTimeLabel({ createdAt: 'garbage', timestamp: 'Just now' }, now), '');
});
