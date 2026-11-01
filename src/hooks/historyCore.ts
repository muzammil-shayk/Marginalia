/**
 * Undo and redo over a whole list of marks, as pure functions.
 *
 * Shared by the PDF workspace (`useAnnotationHistory`) and the text reader's annotation session,
 * so both get the same rules: whole-list snapshots, an edit that changes nothing is not a step,
 * a new edit clears redo, and at most `HISTORY_LIMIT` steps back.
 */

/** How many steps back the reader can go. Deep enough for a session, bounded so it cannot grow. */
export const HISTORY_LIMIT = 100;

export interface HistoryState<T> {
  past: T[][];
  present: T[];
  future: T[][];
}

/** A history with nothing to undo — what a document's marks start as when read from disk. */
export function emptyHistory<T>(present: T[]): HistoryState<T> {
  return { past: [], present, future: [] };
}

/**
 * Records `next` as a step, or returns null when it changes nothing. Most no-op edits arrive as a
 * fresh array of the very same objects (`prev.map(...)` where nothing matched), so identity per
 * element catches them without a deep comparison.
 */
export function historyCommit<T>(h: HistoryState<T>, next: T[]): HistoryState<T> | null {
  const previous = h.present;
  if (next === previous) return null;
  if (next.length === previous.length && next.every((mark, index) => mark === previous[index])) return null;
  return { past: [...h.past, previous].slice(-HISTORY_LIMIT), present: next, future: [] };
}

export function historyUndo<T>(h: HistoryState<T>): HistoryState<T> | null {
  const previous = h.past[h.past.length - 1];
  if (!previous) return null;
  return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future].slice(0, HISTORY_LIMIT) };
}

export function historyRedo<T>(h: HistoryState<T>): HistoryState<T> | null {
  const next = h.future[0];
  if (!next) return null;
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: h.future.slice(1) };
}
