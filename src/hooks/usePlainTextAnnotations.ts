/**
 * Server-backed, docId-keyed persistence for the plain-text/EPUB reader's sticky notes and
 * inline formats.
 *
 * Mirrors `PdfWorkspace`'s own load/debounce/flush pattern exactly (`isLoaded` gate, a
 * `ref`-mirrored copy of the state so a pending debounce can be flushed on unmount without
 * closing over a stale value, 700ms debounce) — replacing what used to be a `sessionStorage` map
 * keyed by document TITLE, which was wiped on every app restart and collision-prone since titles
 * are neither unique nor stable. Reuses the existing, deliberately opaque
 * `/api/documents/:id/annotations` endpoint PDF annotations already go through rather than adding
 * new routes: each note or format is tagged with a `kind` discriminant so the two arrays can be
 * split back apart on load.
 *
 * Returns empty, no-op state when `docId` is undefined — a document that was never saved (e.g.
 * pasted text not yet stored) has nothing to key a server-side record on yet. Callers should fall
 * back to session-only state in that case.
 */

import { useEffect, useRef, useState } from 'react';
import { StickyNote } from '../types';
import { CustomFormat } from '../utils/documentExporter';
import { Annotation, fetchAnnotations, saveAnnotations } from '../utils/documentStorage';

const SAVE_DEBOUNCE_MS = 700;

function splitEntries(raw: Annotation[]): { notes: StickyNote[]; formats: CustomFormat[] } {
  const notes: StickyNote[] = [];
  const formats: CustomFormat[] = [];
  for (const entry of raw) {
    const { kind, ...rest } = entry as Annotation & { kind?: string };
    if (kind === 'format') formats.push(rest as unknown as CustomFormat);
    else if (kind === 'note') notes.push(rest as unknown as StickyNote);
    // An entry with neither kind is dropped — defensive against a future schema change, not
    // expected to happen given every write below always stamps one.
  }
  return { notes, formats };
}

function mergeEntries(notes: StickyNote[], formats: CustomFormat[]): Annotation[] {
  return [
    ...notes.map((n) => ({ ...n, kind: 'note' as const })),
    ...formats.map((f) => ({ ...f, kind: 'format' as const }))
  ];
}

export interface PlainTextAnnotations {
  notes: StickyNote[];
  setNotes: (updater: (prev: StickyNote[]) => StickyNote[]) => void;
  formats: CustomFormat[];
  setFormats: (updater: (prev: CustomFormat[]) => CustomFormat[]) => void;
  isLoaded: boolean;
}

export function usePlainTextAnnotations(docId: string | undefined): PlainTextAnnotations {
  const [notes, setNotesState] = useState<StickyNote[]>([]);
  const [formats, setFormatsState] = useState<CustomFormat[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const notesRef = useRef(notes);
  const formatsRef = useRef(formats);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  useEffect(() => {
    formatsRef.current = formats;
  }, [formats]);

  // Load whenever the document changes, resetting to empty state until the fetch resolves so a
  // save effect below can never fire against the PREVIOUS document's leftover state.
  useEffect(() => {
    setNotesState([]);
    setFormatsState([]);
    if (!docId) {
      setIsLoaded(false);
      return;
    }
    setIsLoaded(false);
    fetchAnnotations(docId).then((stored) => {
      const { notes: loadedNotes, formats: loadedFormats } = splitEntries(stored.annotations);
      setNotesState(loadedNotes);
      setFormatsState(loadedFormats);
      setIsLoaded(true);
    });
  }, [docId]);

  // Debounced save whenever either array changes, only once the initial load has completed.
  useEffect(() => {
    if (!docId || !isLoaded) return;
    const timer = window.setTimeout(() => {
      void saveAnnotations(docId, mergeEntries(notesRef.current, formatsRef.current));
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [docId, isLoaded, notes, formats]);

  // Flush on unmount / docId change, via the refs, so a still-pending debounce is never lost to
  // a navigate-away.
  useEffect(() => {
    return () => {
      if (docId && (notesRef.current.length || formatsRef.current.length)) {
        void saveAnnotations(docId, mergeEntries(notesRef.current, formatsRef.current));
      }
    };
  }, [docId]);

  return {
    notes,
    formats,
    setNotes: (updater) => setNotesState(updater),
    setFormats: (updater) => setFormatsState(updater),
    isLoaded
  };
}
