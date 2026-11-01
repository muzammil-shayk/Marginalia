/**
 * Linked marks: two marks that refer to each other ("see also"), in either format.
 *
 * A link is stored on BOTH marks, as `links: string[]` holding the other mark's id, so it lives
 * inside the annotation list: it is saved, undone (historyCore), backed up and exported with the
 * marks. Deleting one side leaves a dangling id on the other; `pruneLinks` drops it, and the
 * store runs it on every annotations save, so the survivor never points at nothing on disk.
 *
 * Every function returns the SAME array when nothing changes, and unchanged marks keep their
 * identity, so the undo history records only real edits.
 */

type Linkable = { id: string; links?: string[] };

const linksOf = (m: Linkable): string[] => (Array.isArray(m.links) ? m.links.filter((x) => typeof x === 'string') : []);

/** `m` with `links` replaced; the field is removed when empty. */
function withLinks<T extends Linkable>(m: T, links: string[]): T {
  const { links: _old, ...rest } = m;
  return (links.length ? { ...rest, links } : rest) as T;
}

export function linkMarks<T extends Linkable>(marks: T[], a: string, b: string): T[] {
  if (a === b || !marks.some((m) => m.id === a) || !marks.some((m) => m.id === b)) return marks;
  let changed = false;
  const out = marks.map((m) => {
    const other = m.id === a ? b : m.id === b ? a : null;
    if (other === null || linksOf(m).includes(other)) return m;
    changed = true;
    return withLinks(m, [...linksOf(m), other]);
  });
  return changed ? out : marks;
}

export function unlinkMarks<T extends Linkable>(marks: T[], a: string, b: string): T[] {
  let changed = false;
  const out = marks.map((m) => {
    const other = m.id === a ? b : m.id === b ? a : null;
    if (other === null || !linksOf(m).includes(other)) return m;
    changed = true;
    return withLinks(m, linksOf(m).filter((x) => x !== other));
  });
  return changed ? out : marks;
}

/** Drops every link to a mark that is no longer in the list (and any malformed `links` field). */
export function pruneLinks<T extends Linkable>(marks: T[]): T[] {
  const ids = new Set(marks.map((m) => m.id));
  let changed = false;
  const out = marks.map((m) => {
    if (m.links === undefined) return m;
    const kept = linksOf(m).filter((x) => ids.has(x));
    if (Array.isArray(m.links) && kept.length === m.links.length && kept.length > 0) return m;
    changed = true;
    return withLinks(m, kept);
  });
  return changed ? out : marks;
}

/** Ids of the marks linked to `id` that still exist, in the order they were linked. */
export function linkedIds(marks: Linkable[], id: string): string[] {
  const mark = marks.find((m) => m.id === id);
  if (!mark) return [];
  const ids = new Set(marks.map((m) => m.id));
  return linksOf(mark).filter((x) => ids.has(x));
}
