/**
 * Search, kind filter and reading order for the notes panel. Pure, so it is tested.
 */

import { Annotation, AnnotationKind, annotationBounds } from './annotationModel';

/** What the kind chips filter by: a stored kind, or terminology (a flagged highlight). */
export type NoteFilterKind = AnnotationKind | 'terminology';

export const NOTE_KIND_LABELS: Record<NoteFilterKind, string> = {
  highlight: 'Highlight',
  terminology: 'Terminology',
  underline: 'Underline',
  strikeout: 'Strikeout',
  question: 'Question',
  star: 'Asterisk',
  exclamation: 'Exclamation',
  note: 'Note',
  text: 'Text box',
  ink: 'Pen',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  arrow: 'Arrow',
  line: 'Line',
  bracket: 'Bracket'
};

/** Chip order: text marks, then reactions, then notes, then drawings. */
const KIND_ORDER = Object.keys(NOTE_KIND_LABELS) as NoteFilterKind[];

export function filterKindOf(a: Annotation): NoteFilterKind {
  return a.kind === 'highlight' && a.isTerminology ? 'terminology' : a.kind;
}

/** The kinds present in this document, in chip order, so no chip ever filters to nothing. */
export function presentKinds(annotations: Annotation[]): NoteFilterKind[] {
  const seen = new Set(annotations.map(filterKindOf));
  return KIND_ORDER.filter((k) => seen.has(k));
}

/** Page first, then top to bottom, then left to right, the order a reader meets the marks. */
export function compareReadingOrder(a: Annotation, b: Annotation): number {
  if (a.page !== b.page) return a.page - b.page;
  const ba = annotationBounds(a);
  const bb = annotationBounds(b);
  if (!ba || !bb) return ba ? -1 : bb ? 1 : 0;
  // Marks on the same line differ by a hair in y; within half a percent of the page they count
  // as one line and sort by x.
  if (Math.abs(ba.y - bb.y) > 0.005) return ba.y - bb.y;
  return ba.x - bb.x;
}

/** Case- and accent-insensitive match on the note, the quoted passage and the kind's name. */
export function matchesNoteQuery(a: Annotation, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  const hay = fold([a.text, a.quote, NOTE_KIND_LABELS[filterKindOf(a)]].filter(Boolean).join(' \n '));
  return q.split(/\s+/).every((word) => hay.includes(word));
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Everything the panel shows: matching marks of the chosen kind, in reading order. */
export function visibleNotes(
  annotations: Annotation[],
  query: string,
  kind: NoteFilterKind | null
): Annotation[] {
  return annotations
    .filter((a) => (kind ? filterKindOf(a) === kind : true) && matchesNoteQuery(a, query))
    .sort(compareReadingOrder);
}
