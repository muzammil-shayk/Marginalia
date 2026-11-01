/**
 * Reports how far the reader has got in a document, debounced, flushed on leaving.
 *
 * `report(position, total)` in the reader's own unit: PDF = current page of page count; text =
 * (index of the last paragraph in view + 1) of paragraph count. The library shows the furthest
 * point as `StoredDocumentMeta.progressPercent`. No-op without a `docId`.
 */

import { useCallback, useEffect, useRef } from 'react';
import { saveReadingProgress } from '../utils/documentStorage';
import { createProgressSaver } from './readingProgressSaver';
import { registerUnloadFlush } from './unloadFlush';

export function useReadingProgress(docId: string | undefined): (position: number, total: number) => void {
  const ref = useRef<ReturnType<typeof createProgressSaver> | null>(null);
  useEffect(() => {
    if (!docId) return;
    const progress = createProgressSaver(docId, { save: saveReadingProgress });
    ref.current = progress;
    const unregister = registerUnloadFlush(progress.saver, progress.unloadRequest);
    return () => {
      unregister();
      if (ref.current === progress) ref.current = null;
      void progress.saver.flush();
    };
  }, [docId]);
  return useCallback((position: number, total: number) => ref.current?.report(position, total), []);
}
