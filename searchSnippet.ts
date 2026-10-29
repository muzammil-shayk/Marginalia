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

/**
 * Whether a mark matches `needle` (already lower-cased), and the text its snippet is cut from.
 *
 * PDF marks carry `quote` and a note's `text`; plain-text (TXT/EPUB/DOCX) notes carry `title` and
 * `content` instead, which search used to ignore. A mark also matches on its theme's name and on
 * the word "terminology". The snippet comes from the field that matched, so the term is visible.
 */
export function markSearchText(
  mark: Record<string, unknown>,
  needle: string,
  themeName?: string
): { text: string; keep?: [number, number] } | null {
  const field = (key: string) => (typeof mark[key] === "string" ? collapse(mark[key] as string) : "");
  const words = [field("quote"), field("text"), field("content"), field("title")];
  const isTerm = mark.isTerminology === true;
  const all = [...words, themeName ?? "", isTerm ? "terminology" : ""];
  if (!all.some((f) => f.toLowerCase().includes(needle))) return null;

  const text = words.find((f) => f.toLowerCase().includes(needle)) || words.find(Boolean) || themeName || "Terminology";
  const at = text.toLowerCase().indexOf(needle);
  return at === -1 ? { text } : { text, keep: [at, at + needle.length] };
}
