/**
 * Pulls a book's title, author and edition out of the name it was uploaded under.
 *
 * Documents are stored under their filename minus the extension (see `fileParser.ts`), and books
 * that arrive from a library site carry that site's naming all over them:
 *
 *   Spencer, Johnson _ Blanchard, Kenneth - Who Moved My Cheese_ (2011) - libgen.li
 *   Ex libris confessions of a common reader (Fadiman, Anne, 1953-) (z-library.sk, 1lib.sk)
 *
 * Handing that straight to a web search finds the download page, not the book. This unpicks the
 * shapes those names actually take so the "look up by title" form opens already filled in with
 * something worth searching for.
 *
 * ponytail: heuristic, not a parser for any real citation format. It is only ever a prefill —
 * every field it produces is editable, and a name it cannot read is passed through as the title
 * unchanged. If it starts mangling real titles, narrow the rules rather than adding more.
 */

export interface BookFields {
  title: string;
  author: string;
  edition: string;
}

/** A parenthetical that is only site names — `(z-library.sk, 1lib.sk, z-lib.sk)`. */
const MIRRORS = /^[\w.-]+\.[a-z]{2,}(\s*,\s*[\w.-]+\.[a-z]{2,})*$/i;

/** A parenthetical that is only a year, which is the edition in every one of these names. */
const YEAR = /^(1[5-9]\d{2}|20\d{2})$/;

/** `Fadiman, Anne, 1953-` — a surname-first author, optionally with life dates. */
const AUTHOR_WITH_DATES = /^([^,]+,\s*[^,]+?)(,\s*\d{4}\??-?\d{0,4})?$/;

export function guessBookFields(rawTitle: string): BookFields {
  let text = rawTitle.trim();
  let author = '';
  let edition = '';

  // Trailing source credit: "… - libgen.li". Only a bare domain, so a real subtitle survives.
  text = text.replace(/\s*[-–]\s*[\w-]+\.[a-z]{2,}\s*$/i, '').trim();

  // Each parenthetical is either a year, a set of mirrors, or an author — take what it is and
  // drop it from the title either way.
  text = text
    .replace(/\(([^()]*)\)/g, (whole, inner: string) => {
      const body = inner.trim();
      if (YEAR.test(body)) {
        edition ||= body;
        return '';
      }
      if (MIRRORS.test(body)) return '';
      const named = AUTHOR_WITH_DATES.exec(body);
      if (named) {
        author ||= named[1].trim();
        return '';
      }
      return whole;
    })
    .trim();

  // "Author, First _ Author, Second - Title": the part before the first dash is an author list
  // only when it reads like one — surname-first, comma inside, and no sentence of its own.
  const dash = text.indexOf(' - ');
  if (!author && dash > 0) {
    const head = text.slice(0, dash).trim();
    if (head.includes(',') && head.split(/\s+/).length <= 10) {
      author = head.replace(/\s*_\s*/g, '; ');
      text = text.slice(dash + 3).trim();
    }
  }

  // Underscores stand in for characters a filename cannot hold — usually "?" or ":".
  const title = text.replace(/_+$/, '').replace(/\s*_\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

  return { title: title || rawTitle.trim(), author, edition };
}
