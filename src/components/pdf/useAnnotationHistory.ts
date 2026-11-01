/**
 * Undo and redo for the whole annotation set.
 *
 * History is kept over the ANNOTATION LIST rather than per tool, which is what makes "every tool
 * undoable" true by construction: drawing a shape, moving one, recolouring one, writing a note,
 * changing a dash pattern and erasing are all the same operation as far as this is concerned —
 * one list replaced another — so no tool can be added later that forgets to be undoable.
 *
 * Snapshots are whole lists rather than diffs. Annotations are small plain objects and a document
 * rarely holds more than a few hundred, so the memory cost is trivial next to the complexity of
 * inverting every possible edit correctly.
 */

import { useCallback, useRef, useState } from 'react';
import { Annotation } from './annotationModel';
import { emptyHistory, historyCommit, historyRedo, historyUndo, HistoryState } from '../../hooks/historyCore';

/** The rules (100 steps, no-op edits are not steps) live in `hooks/historyCore`, shared with the text reader. */
export interface AnnotationHistory<T = Annotation> {
  annotations: T[];
  /** Records an undoable change. Accepts a value or an updater, like `setState`. */
  commit: (next: T[] | ((prev: T[]) => T[])) => void;
  /**
   * Replaces the list WITHOUT recording a step, and clears the history.
   *
   * Used when a document's marks are read from disk. Without this the reader could undo past the
   * moment the document opened and wipe every mark they had ever made in it — an undo stack must
   * never reach back further than the session that filled it.
   */
  reset: (next: T[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useAnnotationHistory<T = Annotation>(): AnnotationHistory<T> {
  const [annotations, setAnnotations] = useState<T[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // The history lives in a ref, not state: it is read and written inside the same callback that
  // sets the list, and a stale render-time copy would drop steps made in quick succession.
  const history = useRef<HistoryState<T>>(emptyHistory<T>([]));

  const apply = useCallback((next: HistoryState<T> | null) => {
    if (!next) return;
    history.current = next;
    setAnnotations(next.present);
    setCanUndo(next.past.length > 0);
    setCanRedo(next.future.length > 0);
  }, []);

  const commit = useCallback(
    (next: T[] | ((prev: T[]) => T[])) => {
      const previous = history.current.present;
      const value = typeof next === 'function' ? (next as (p: T[]) => T[])(previous) : next;
      apply(historyCommit(history.current, value));
    },
    [apply]
  );

  const reset = useCallback((next: T[]) => apply(emptyHistory(next)), [apply]);
  const undo = useCallback(() => apply(historyUndo(history.current)), [apply]);
  const redo = useCallback(() => apply(historyRedo(history.current)), [apply]);

  return { annotations, commit, reset, undo, redo, canUndo, canRedo };
}
