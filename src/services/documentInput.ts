/**
 * The body of `POST /api/documents` as the store's save parameters.
 *
 * Uploads (text extracted on the client) are stored as sent. Pasted custom text is sent with
 * `layout: 'verbatim'`: its line breaks and indentation are kept (see `utils/pastedText.ts`),
 * and an optional `html` (the clipboard's HTML) is sanitised and read for bold/italic/underline.
 */

import type { SaveDocumentParams } from './storage/types';
import { cleanTitle } from './storage/types';
import { sanitizeImportHtml } from './htmlSanitize';
import { pastedHtmlLayout, pastedTextLayout } from '../utils/pastedText';

export function documentParamsFromBody(body: unknown): SaveDocumentParams | { error: string } {
  const { title, text, format, filename, layout, html } = (body ?? {}) as Record<string, unknown>;
  if (typeof text !== 'string' || !text.trim()) return { error: 'Document text is required.' };
  const base = {
    title: cleanTitle(title) ?? 'Untitled Document',
    format: typeof format === 'string' && format ? format : 'TXT',
    filename: typeof filename === 'string' ? filename : undefined
  };
  if (layout !== 'verbatim') return { ...base, text };

  if (typeof html === 'string' && html.trim()) {
    const fromHtml = pastedHtmlLayout(sanitizeImportHtml(html));
    if (fromHtml.text.trim()) {
      return {
        ...base,
        text: fromHtml.text,
        layout: 'verbatim',
        ...(fromHtml.styles.length && { textStyles: fromHtml.styles })
      };
    }
  }
  return { ...base, text: pastedTextLayout(text), layout: 'verbatim' };
}
