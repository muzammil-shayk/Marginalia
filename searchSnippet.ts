const isSpace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch);
const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * `text.slice(start, end)` for a search snippet, but cut on word boundaries instead of mid-word,
 * with "…" on each side that was cut and whitespace runs collapsed.
 *
 * `keep` is the match's [start, end): the window is never trimmed past it, so the term the
 * reader searched for always stays visible. When no boundary fits (one word longer than the
 * window), the raw slice is used rather than an empty snippet.
 */
export function wordWindow(text: string, start: number, end: number, keep?: [number, number]): string {
  start = Math.max(0, start);
  end = Math.min(text.length, end);
  let s = start;
  let e = end;

  if (s > 0 && !isSpace(text[s - 1])) {
    const limit = Math.min(keep ? keep[0] : e, e);
    let i = s;
    while (i < limit && !isSpace(text[i])) i++;
    if (i < limit) s = i + 1;
  }
  if (e < text.length && !isSpace(text[e])) {
    const floor = Math.max(keep ? keep[1] : s, s);
    let i = e - 1;
    while (i >= floor && !isSpace(text[i])) i--;
    if (i >= floor) e = i;
  }

  let body = collapse(text.slice(s, e));
  if (!body) body = collapse(text.slice(start, end));
  return `${start > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
}
