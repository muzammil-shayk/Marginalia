/**
 * Server-side clean-up of an imported HTML page before Electron prints it to PDF.
 *
 * The client already strips scripting (`utils/htmlDocument.ts`), but the server cannot trust the
 * request body, and the print window runs with JavaScript on. Anything here that could reach the
 * network or run code is removed: scripts, frames, `<meta http-equiv=refresh>`, `<base>`, `on*`
 * handlers, remote CSS `url()` and every `@import`. The print window also blocks every request
 * that is not `file:`/`data:` (see `electron/renderGuard.cjs`); this is the first of the two layers.
 *
 * Regex-based on purpose — the server has no DOM. It is a filter in front of a sandboxed,
 * network-blocked window, not the only defence.
 */

/** The app's own signal that layout has settled; the print window waits for it. Same as htmlDocument.ts. */
const LAYOUT_READY_SCRIPT =
  '<script>if (document.readyState === "complete") { window.__marginaliaLayoutReady = true; } ' +
  'else { window.addEventListener("load", function () { window.__marginaliaLayoutReady = true; }); }</script>';

const REMOTE_URL = /^\s*(['"]?)\s*(https?:|\/\/|ftp:)/i;

/** The inside of a tag: unquoted text, or quoted values that may hold `>`. */
const TAG_BODY = `(?:"[^"]*"|'[^']*'|[^'">])*`;
const ATTR_VALUE = `("[^"]*"|'[^']*'|[^\\s>]+)`;

function cleanCss(css: string): string {
  return css
    // Escapes (`@\69mport`, `u\72l(`) and entities (`url(&quot;http…`) are dropped rather than
    // decoded: decoding could reassemble markup. Lossy for odd `content:` glyphs, safe for printing.
    .replace(/\\/g, '')
    .replace(/&#?[a-z0-9]+;?/gi, '')
    .replace(/@import\s+[^;]*;?/gi, '')
    .replace(/url\(\s*([^)]*)\)/gi, (whole, inner: string) => (REMOTE_URL.test(inner) ? 'url("")' : whole));
}

/** Decodes just enough of an attribute value to see the scheme a browser would. */
function isScriptUrl(value: string): boolean {
  const decoded = value
    .replace(/^['"]|['"]$/g, '')
    .replace(/&#x([0-9a-f]+);?/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_m, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&colon;?/gi, ':')
    .replace(/[\u0000-\u0020]|&(tab|newline);?/gi, '')
    .toLowerCase();
  return /^(javascript|vbscript):/.test(decoded);
}

function stripOnce(html: string): string {
  let out = html
    .replace(/<(script|iframe|object|embed|frame|frameset|noscript)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(new RegExp(`<\\/?(script|iframe|object|embed|frame|frameset|noscript|base)\\b${TAG_BODY}>`, 'gi'), '')
    .replace(new RegExp(`<meta\\b${TAG_BODY}http-equiv\\s*=\\s*(['"]?)\\s*refresh\\1${TAG_BODY}>`, 'gi'), '');

  // on* handlers, quoted or not, after whitespace or `/`. Repeated because one tag can carry several.
  const handler = new RegExp(`(<[a-z]${TAG_BODY}?)[\\s/]+on[a-z]+\\s*=\\s*${ATTR_VALUE}`, 'i');
  while (handler.test(out)) out = out.replace(handler, '$1');

  return out
    .replace(/([\s/](?:href|src|xlink:href|action|formaction)\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/gi, (whole, attr, value: string) =>
      isScriptUrl(value) ? `${attr}"#"` : whole)
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi, (_m, open, css, close) => open + cleanCss(css) + close)
    .replace(/([\s/]style\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/gi, (_m, attr, value: string) => attr + cleanCss(value));
}

export function sanitizeImportHtml(html: string): string {
  // Repeated until nothing changes: one removal can reassemble a tag (`<scr<script>ipt>`).
  let out = html;
  for (let prev = ''; prev !== out; ) {
    prev = out;
    out = stripOnce(out);
  }

  return /<\/body\s*>/i.test(out)
    ? out.replace(/<\/body\s*>(?![\s\S]*<\/body\s*>)/i, `${LAYOUT_READY_SCRIPT}</body>`)
    : out + LAYOUT_READY_SCRIPT;
}
