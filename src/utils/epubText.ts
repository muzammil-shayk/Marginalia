/**
 * Text extraction for EPUB chapters.
 *
 * The reader splits stored text into paragraphs on blank lines, and every plain-text note is
 * anchored to a paragraph index. `body.textContent` ran a whole chapter together into one
 * paragraph — headings glued to the first line, list items to each other — so a chapter was one
 * giant block. This walks the block elements instead and joins them with `\n\n`.
 *
 * Applies to new imports only: an existing document keeps its stored text, because its notes'
 * paragraph indices were computed against it.
 */

/** Elements that start their own paragraph. Text between them inside a block is one paragraph too. */
const BLOCK = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'div',
  'section', 'article', 'header', 'footer', 'aside', 'ul', 'ol', 'dl', 'dt', 'dd',
  'figure', 'figcaption', 'table', 'tr', 'td', 'th', 'hr', 'nav', 'main', 'address'
]);
const SKIP = new Set(['script', 'style', 'head', 'title']);

const tagOf = (node: Node) => ((node as Element).localName || node.nodeName || '').toLowerCase();

export function chapterText(doc: Document): string {
  const body = doc.getElementsByTagName('body')[0];
  if (!body) return '';
  const out: string[] = [];
  let inline = '';
  const flush = () => {
    const text = inline.replace(/\s+/g, ' ').trim();
    if (text) out.push(text);
    inline = '';
  };

  const walk = (node: Node) => {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3 || child.nodeType === 4) {
        inline += child.nodeValue ?? '';
        continue;
      }
      if (child.nodeType !== 1) continue;
      const tag = tagOf(child);
      if (SKIP.has(tag)) continue;
      if (tag === 'br') {
        inline += ' ';
      } else if (tag === 'pre') {
        flush();
        // Kept as one paragraph: its own line breaks stay, blank lines inside it do not.
        const text = (child.textContent ?? '').replace(/\n\s*\n+/g, '\n').trim();
        if (text) out.push(text);
      } else if (BLOCK.has(tag)) {
        flush();
        walk(child);
        flush();
      } else {
        walk(child);
      }
    }
  };

  walk(body);
  flush();
  return out.join('\n\n');
}

/**
 * Loads each spine item and joins the chapters' text. A chapter that fails to load is logged by
 * name rather than dropped silently, so a short import can be explained.
 */
export async function collectEpubText(
  hrefs: string[],
  load: (href: string) => Promise<unknown>,
  warn: (...args: unknown[]) => void = console.warn
): Promise<string> {
  const parts: string[] = [];
  for (const href of hrefs) {
    try {
      const doc = await load(href);
      if (!doc || typeof doc !== 'object' || typeof (doc as Document).getElementsByTagName !== 'function') {
        warn(`[Marginalia] EPUB chapter ${href} is not a document; skipped`);
        continue;
      }
      const text = chapterText(doc as Document);
      if (text) parts.push(text);
    } catch (err) {
      warn(`[Marginalia] EPUB chapter ${href} could not be loaded; skipped`, err);
    }
  }
  return parts.join('\n\n');
}
