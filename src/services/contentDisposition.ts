/**
 * A `Content-Disposition` header for any file name, curly quotes and Urdu included.
 *
 * Node refuses a header value with characters above U+00FF (ERR_INVALID_CHAR), so a stored
 * original named "Ghalib’s ghazal.pdf" or "غالب.pdf" used to throw inside the download route and
 * take the request down with it. The name goes out twice, as RFC 6266 asks: an ASCII stand-in in
 * `filename=` for old clients, and the real name, percent-encoded UTF-8, in `filename*=`.
 */
export function contentDisposition(type: 'inline' | 'attachment', filename: string): string {
  const name = filename.replace(/[\r\n\u0000-\u001f\u007f]/g, '').trim() || 'document';
  const ascii =
    name
      .normalize('NFKD')
      .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
      .replace(/[\u201C\u201D\u2033]/g, '')
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\]/g, '')
      .trim() || 'document';
  // encodeURIComponent leaves ' ( ) * ! unescaped; RFC 5987 wants them escaped too.
  const encoded = encodeURIComponent(name).replace(/['()*!]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
