/**
 * Run with: npx tsx --test src/components/pdf/annotationTools.test.ts
 *
 * Pure helpers behind the workspace shortcuts, popover placement and the notes panel.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveWorkspaceKey, isTypingTarget, withShortcut, themeShortcut, popoverTakesTab } from './workspaceKeys';
import { placePanel } from './panelPlacement';
import { visibleNotes, presentKinds, compareReadingOrder, matchesNoteQuery } from './notesFilter';
import type { Annotation } from './annotationModel';

test('tool letters map to tools, case-insensitive, without modifiers', () => {
  const tools = Object.fromEntries('HUSNPEV'.split('').map((k) => [k, resolveWorkspaceKey({ key: k.toLowerCase() })]));
  assert.deepEqual(tools.H, { type: 'tool', tool: 'highlight' });
  assert.deepEqual(tools.U, { type: 'tool', tool: 'underline' });
  assert.deepEqual(tools.S, { type: 'tool', tool: 'strikeout' });
  assert.deepEqual(tools.N, { type: 'tool', tool: 'note' });
  assert.deepEqual(tools.P, { type: 'tool', tool: 'ink' });
  assert.deepEqual(tools.E, { type: 'tool', tool: 'erase' });
  assert.deepEqual(tools.V, { type: 'tool', tool: 'select' });
  assert.deepEqual(resolveWorkspaceKey({ key: 'H' }), { type: 'tool', tool: 'highlight' });
  assert.equal(resolveWorkspaceKey({ key: 'h', shiftKey: true }), null);
  assert.equal(resolveWorkspaceKey({ key: 'h', altKey: true }), null);
  assert.equal(resolveWorkspaceKey({ key: 'h', metaKey: true }), null);
  assert.equal(resolveWorkspaceKey({ key: 'x' }), null);
});

test('digits pick themes 1-9, Delete and Backspace delete, undo and redo keep their chords', () => {
  assert.deepEqual(resolveWorkspaceKey({ key: '1' }), { type: 'theme', index: 0 });
  assert.deepEqual(resolveWorkspaceKey({ key: '9' }), { type: 'theme', index: 8 });
  assert.equal(resolveWorkspaceKey({ key: '0' }), null);
  assert.equal(resolveWorkspaceKey({ key: '1', metaKey: true }), null);
  assert.deepEqual(resolveWorkspaceKey({ key: 'Delete' }), { type: 'delete' });
  assert.deepEqual(resolveWorkspaceKey({ key: 'Backspace' }), { type: 'delete' });
  assert.deepEqual(resolveWorkspaceKey({ key: 'Escape' }), { type: 'escape' });
  assert.deepEqual(resolveWorkspaceKey({ key: 'z', metaKey: true }), { type: 'undo' });
  assert.deepEqual(resolveWorkspaceKey({ key: 'Z', metaKey: true, shiftKey: true }), { type: 'redo' });
  assert.deepEqual(resolveWorkspaceKey({ key: 'y', ctrlKey: true }), { type: 'redo' });
});

test('typing targets are text fields and contenteditable, not buttons or colour wells', () => {
  const el = (tagName: string, extra: Record<string, unknown> = {}) => ({ tagName, isContentEditable: false, ...extra }) as unknown as EventTarget;
  assert.equal(isTypingTarget(el('INPUT', { type: 'search' })), true);
  assert.equal(isTypingTarget(el('INPUT', { type: '' })), true);
  assert.equal(isTypingTarget(el('TEXTAREA')), true);
  assert.equal(isTypingTarget(el('DIV', { isContentEditable: true })), true);
  assert.equal(isTypingTarget(el('INPUT', { type: 'color' })), false);
  assert.equal(isTypingTarget(el('BUTTON')), false);
  assert.equal(isTypingTarget(null), false);
  assert.equal(withShortcut('Highlight', 'H'), 'Highlight (H)');
  assert.equal(themeShortcut(0), '1');
  assert.equal(themeShortcut(9), undefined);
});

const view = { viewportWidth: 1440, viewportHeight: 900, width: 400, height: 40 };

test('a panel opens above its anchor by default, never over it', () => {
  const p = placePanel({ ...view, anchor: { left: 300, top: 500, bottom: 520 } });
  assert.equal(p.side, 'above');
  assert.equal(p.top, 500 - 8 - 40);
  assert.ok(p.top + 40 <= 500);
});

test('it drops below when there is no room above (toolbar counts as the top edge)', () => {
  const p = placePanel({ ...view, topInset: 120, anchor: { left: 300, top: 150, bottom: 170 } });
  assert.equal(p.side, 'below');
  assert.equal(p.top, 178);
});

test('it is clamped inside the window horizontally at phone width', () => {
  const p = placePanel({ ...view, viewportWidth: 390, width: 374, height: 76, anchor: { left: 200, top: 400, bottom: 420 } });
  assert.equal(p.left, 8);
  assert.ok(p.left + 374 <= 390 - 8);
  const wide = placePanel({ ...view, viewportWidth: 390, width: 500, anchor: { left: 200, top: 400, bottom: 420 } });
  assert.equal(wide.left, 8);
});

test('when neither side fits it takes the roomier side and stays inside the window', () => {
  const p = placePanel({ ...view, viewportHeight: 300, height: 200, bottomInset: 50, anchor: { left: 10, top: 60, bottom: 220 } });
  assert.equal(p.side, 'above'); // 52px of room above vs 22px below
  assert.ok(p.top >= 8 && p.top + 200 <= 300 - 50 - 8 + 0.001);
});

test('a side that would cover a note card is blocked when the other side is clear', () => {
  const anchor = { left: 300, top: 500, bottom: 520 };
  const card = { left: 280, top: 380, right: 900, bottom: 490 };
  const p = placePanel({ ...view, anchor, avoid: [card] });
  assert.equal(p.side, 'below');
  assert.equal(p.top, 528);
  // A card off to the side of where the panel would go blocks nothing.
  assert.equal(placePanel({ ...view, anchor, avoid: [{ left: 800, top: 380, right: 1000, bottom: 490 }] }).side, 'above');
  // Both sides covered: the usual preference (above) stands.
  assert.equal(placePanel({ ...view, anchor, avoid: [card, { left: 280, top: 525, right: 900, bottom: 600 }] }).side, 'above');
  // Below would leave the window: above, even over the card.
  assert.equal(placePanel({ ...view, viewportHeight: 560, anchor, avoid: [card] }).side, 'above');
});

const mark = (over: Partial<Annotation>): Annotation =>
  ({ id: Math.random().toString(36), page: 1, kind: 'highlight', color: '#ff0', themeId: null, createdAt: '', ...over }) as Annotation;

test('notes sort by page, then top to bottom, then left to right', () => {
  const a = mark({ id: 'a', page: 2, rects: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.02 }] });
  const b = mark({ id: 'b', page: 1, rects: [{ x: 0.5, y: 0.6, w: 0.2, h: 0.02 }] });
  const c = mark({ id: 'c', page: 1, kind: 'note', box: { x: 0.7, y: 0.2, w: 0.2, h: 0.1 } });
  const d = mark({ id: 'd', page: 1, rects: [{ x: 0.1, y: 0.602, w: 0.2, h: 0.02 }] });
  assert.deepEqual([a, b, c, d].sort(compareReadingOrder).map((m) => m.id), ['c', 'd', 'b', 'a']);
});

test('search matches note text, quote and kind; the kind chip narrows it', () => {
  const marks = [
    mark({ id: 'h', quote: 'The Café on the corner' }),
    mark({ id: 't', isTerminology: true, quote: 'epistemology' }),
    mark({ id: 'n', kind: 'note', text: 'Ask about the cafe', box: { x: 0, y: 0, w: 0.1, h: 0.1 } })
  ];
  assert.deepEqual(visibleNotes(marks, 'cafe', null).map((m) => m.id).sort(), ['h', 'n']);
  assert.deepEqual(visibleNotes(marks, 'cafe', 'note').map((m) => m.id), ['n']);
  assert.deepEqual(visibleNotes(marks, '', 'terminology').map((m) => m.id), ['t']);
  assert.equal(matchesNoteQuery(marks[1], 'terminology'), true);
  assert.deepEqual(presentKinds(marks), ['highlight', 'terminology', 'note']);
});

test('Tab enters a popover only from the page or from nowhere, never from the toolbar or a field', () => {
  const base = { onBody: false, inSurface: false, inPopover: false, typing: false };
  assert.equal(popoverTakesTab({ ...base, onBody: true }), true);
  assert.equal(popoverTakesTab({ ...base, inSurface: true }), true);
  assert.equal(popoverTakesTab(base), false); // toolbar Undo, notes panel
  assert.equal(popoverTakesTab({ ...base, inSurface: true, typing: true }), false);
  assert.equal(popoverTakesTab({ ...base, inSurface: true, inPopover: true }), false);
});
