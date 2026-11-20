import test from 'node:test';
import assert from 'node:assert/strict';
import { locateSpan, type TextPiece } from './findHighlight';
import { findCountLabel, keepHit, startHit } from './FindBar';
import { backupTimeLabel, fileStem, importSummary } from './marksArchiveFormat';
import { excerpt } from './MarksArchive';
import { createTextAnnotationSession } from '../hooks/textAnnotationSession';

const node = (data: string) => ({ data }) as unknown as Text;

test('find: a hit maps onto text nodes, across nodes and past a <br> space', () => {
  const a = node('Hello ');
  const b = node('world');
  const c = node('again');
  const pieces: TextPiece[] = [
    { length: 6, node: a },
    { length: 5, node: b },
    { length: 1, node: null },
    { length: 5, node: c }
  ];
  assert.deepEqual(locateSpan(pieces, 0, 5), { start: { node: a, offset: 0 }, end: { node: a, offset: 5 } });
  assert.deepEqual(locateSpan(pieces, 3, 9), { start: { node: a, offset: 3 }, end: { node: b, offset: 3 } });
  // "world again": the <br> stands for the space; the hit still ends inside "again".
  assert.deepEqual(locateSpan(pieces, 6, 17), { start: { node: b, offset: 0 }, end: { node: c, offset: 5 } });
  // Ending on the synthetic space keeps the end on the last real node.
  assert.deepEqual(locateSpan(pieces, 6, 12), { start: { node: b, offset: 0 }, end: { node: b, offset: 5 } });
  assert.equal(locateSpan(pieces, 5, 5), null);
  assert.equal(locateSpan(pieces, 40, 45), null);
  assert.equal(locateSpan([], 0, 1), null);
});

test('find: where a search starts and how it counts', () => {
  const hits = [{ paragraphIndex: 1 }, { paragraphIndex: 4 }, { paragraphIndex: 9 }];
  assert.equal(startHit(hits, 0), 0);
  assert.equal(startHit(hits, 4), 1);
  assert.equal(startHit(hits, 5), 2);
  assert.equal(startHit(hits, 12), 0);
  assert.equal(startHit([], 3), -1);
  assert.equal(findCountLabel('', 0, -1, false), '');
  assert.equal(findCountLabel('x', 0, -1, true), 'Searching…');
  assert.equal(findCountLabel('x', 0, -1, false), 'No results');
  assert.equal(findCountLabel('x', 1204, 2, false), '3 of 1,204');
});

test('archive words: backup times, import summary, file names, excerpts', () => {
  const now = new Date(2026, 10, 1, 15, 0);
  assert.equal(backupTimeLabel(new Date(2026, 10, 1, 14, 5).toISOString(), now), 'Today, 14:05');
  assert.equal(backupTimeLabel(new Date(2026, 9, 31, 9, 0).toISOString(), now), 'Yesterday, 09:00');
  assert.equal(backupTimeLabel(new Date(2026, 9, 3, 8, 7).toISOString(), now), '3 Oct 2026, 08:07');
  assert.equal(backupTimeLabel('nope', now), '');
  assert.equal(importSummary(0, 0), 'Nothing new: every mark in that file is already here.');
  assert.equal(importSummary(1, 0), 'Added 1 mark.');
  assert.equal(importSummary(12, 2), 'Added 12 marks and 2 themes.');
  assert.equal(fileStem('  On: the / "Soul"? '), 'On the Soul');
  assert.equal(fileStem('///'), 'document');
  assert.equal(excerpt('  a   b  '), 'a b');
  assert.equal(excerpt('x'.repeat(70), 10), `${'x'.repeat(9)}…`);
});

test('text session reset loads a written set with a fresh undo history and saves nothing', async () => {
  const saves: unknown[] = [];
  const s = createTextAnnotationSession({
    load: async () => ({ annotations: [] }),
    save: async (e) => {
      saves.push(e);
      return true;
    },
    delayMs: 0,
    newId: () => 'm1'
  });
  await s.load();
  s.addMarks([{ paraIdx: 0, start: 0, end: 4 }], { kind: 'highlight', color: '#ff0000', themeIds: [] }, ['Text here']);
  assert.equal(s.getState().canUndo, true);
  await s.saver.flush();
  const before = saves.length;
  const restored = { id: 'r1', kind: 'highlight', anchor: { paragraphIndex: 0, start: 5, end: 9 }, color: '#00ff00', themeIds: [] };
  const pdfMark = { id: 'p1', page: 2, kind: 'rect' };
  s.reset([restored, pdfMark] as never);
  const st = s.getState();
  assert.deepEqual(st.marks.map((m) => m.id), ['r1']);
  assert.equal(st.canUndo, false);
  assert.deepEqual(s.entries().map((e) => e.id), ['p1', 'r1']);
  await s.saver.flush();
  assert.equal(saves.length, before);
  s.undo();
  assert.deepEqual(s.getState().marks.map((m) => m.id), ['r1']);
});

test('exports warn about black-outs only when the document has some', async () => {
  const { archiveRows, BLACKOUT_PACK_WARNING, BLACKOUT_TEXT_WARNING } = await import('./MarksArchive');
  const noop = () => {};
  const archive = { canImport: true, exportMarkdown: noop, exportJson: noop, commonplace: noop, importJson: noop, openRestore: noop, classPack: noop, ui: null };
  assert.ok(archiveRows(archive, 3).every((r) => !r.warning));
  const rows = archiveRows(archive, 3, true);
  const warn = (title: string) => rows.find((r) => r.title === title)?.warning;
  assert.equal(warn('Commonplace book'), BLACKOUT_TEXT_WARNING);
  assert.equal(warn('Full record'), BLACKOUT_TEXT_WARNING);
  assert.equal(warn('Class pack'), BLACKOUT_PACK_WARNING);
  assert.equal(warn('Bring marks back'), undefined);
});

test('find: when the text searched changes under the same query, the current hit stays where it was', () => {
  const hits = [{ paragraphIndex: 0, start: 4 }, { paragraphIndex: 3, start: 10 }, { paragraphIndex: 8, start: 2 }, { paragraphIndex: 9, start: 0 }];
  // The same hit, wherever it now sits in the list.
  assert.equal(keepHit({ paragraphIndex: 3, start: 10 }, hits), 1);
  assert.equal(keepHit({ paragraphIndex: 8, start: 2 }, hits), 2);
  // Gone: the next one after where it was.
  assert.equal(keepHit({ paragraphIndex: 3, start: 50 }, hits), 2);
  assert.equal(keepHit({ paragraphIndex: 5, start: 0 }, hits), 2);
  // Past the last: the first.
  assert.equal(keepHit({ paragraphIndex: 12, start: 0 }, hits), 0);
  assert.equal(keepHit({ paragraphIndex: 3, start: 10 }, []), -1);
});
