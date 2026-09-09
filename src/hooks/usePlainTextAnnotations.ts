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

/**
 * Splits a document's stored entries into the two this hook owns — and everything else.
 *
 * `others` is the important one. A document's annotations are ONE list, shared with the PDF
 * workspace, whose marks carry no `kind`. Dropping them here and then writing back only notes and
 * formats replaced every PDF mark in the document with nothing — and because the save fires as
 * soon as the load completes, merely opening an annotated PDF was enough to erase it. Anything
 * this hook does not understand is carried through untouched instead.
 */
export function splitEntries(raw: Annotation[]): {
  notes: StickyNote[];
  formats: CustomFormat[];
  others: Annotation[];
} {
  const notes: StickyNote[] = [];
  const formats: CustomFormat[] = [];
  const others: Annotation[] = [];
  for (const entry of raw) {
    const { kind, ...rest } = entry as Annotation & { kind?: string };
    if (kind === 'format') formats.push(rest as unknown as CustomFormat);
    else if (kind === 'note') notes.push(rest as unknown as StickyNote);
    else others.push(entry);
  }
  return { notes, formats, others };
}

export function mergeEntries(
  notes: StickyNote[],
  formats: CustomFormat[],
  others: Annotation[]
): Annotation[] {
  return [
    ...others,
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
  /** Mirrors `isLoaded` for the unmount flush, which cannot read state from its closure. */
  const isLoadedRef = useRef(false);
  /** Entries belonging to the PDF workspace, held only so every save can hand them back. */
  const othersRef = useRef<Annotation[]>([]);
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
    isLoadedRef.current = false;
    othersRef.current = [];
    // Cancelled when the document changes, because a slow read for the PREVIOUS document must
    // never land as this one's. Without it, opening A then B while A's read is in flight installs
    // A's notes under B's id — and the save effect below then writes A's entire annotation list
    // over B's. The workspace has always guarded its own read this way; this one did not.
    let cancelled = false;
    fetchAnnotations(docId).then((stored) => {
      if (cancelled) return;
      // A failed read is not an empty document. Leaving `isLoaded` false keeps the save effect
      // below switched off, so a document whose marks could not be read is never written over
      // with the nothing we managed to load.
      if (!stored) return;
      const {
        notes: loadedNotes,
        formats: loadedFormats,
        others
      } = splitEntries(stored.annotations);
      othersRef.current = others;
      setNotesState(loadedNotes);
      setFormatsState(loadedFormats);
      isLoadedRef.current = true;
      setIsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  // Debounced save whenever either array changes, only once the initial load has completed.
  useEffect(() => {
    if (!docId || !isLoaded) return;
    const timer = window.setTimeout(() => {
      void saveAnnotations(
        docId,
        mergeEntries(notesRef.current, formatsRef.current, othersRef.current)
      );
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [docId, isLoaded, notes, formats]);

  // Flush on unmount / docId change, via the refs, so a still-pending debounce is never lost to
  // a navigate-away.
  useEffect(() => {
    return () => {
      // Gated on having LOADED, not on having something to write. The old length check meant
      // deleting your only note wrote nothing on the way out, and the note came back on reopen.
      if (docId && isLoadedRef.current) {
        void saveAnnotations(
          docId,
          mergeEntries(notesRef.current, formatsRef.current, othersRef.current)
        );
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
