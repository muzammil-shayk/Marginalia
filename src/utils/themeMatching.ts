/**
 * Shared, framework-agnostic text matching between AI-extracted themes and the source
 * document. Runs identically on the client (to render highlights and mention-preview
 * lists) and on the server (to compute a theme's true mention count right after the AI
 * response comes back, overriding its own guessed count) so both sides always agree on
 * the exact same set of matches.
 */

export interface MatchableTheme {
  id?: string;
  title?: string;
  color?: string;
  excerpts?: string[];
  keyQuote?: string;
  matchedParagraphIndices?: number[];
}

export interface ThemeInterval {
  start: number;
  end: number;
  color?: string;
  themeId?: string;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a case-insensitive regex for `phrase` that tolerates whitespace differences between
 * it and the document text — real PDF text extraction routinely inserts irregular whitespace
 * an AI-generated excerpt never has, not just between words ("were  benefiting") but even
 * mid-word from letter-spacing/kerning artifacts ("execu  tives", "e  one"). Allowing an
 * optional run of whitespace between every character (not just at real word boundaries) makes
 * the match robust to both, and matching directly against the ORIGINAL text (not a normalized
 * copy) means the found range's offsets still line up exactly with what gets highlighted.
 */
function buildFuzzyPhraseRegex(phrase: string): RegExp | null {
  const collapsed = phrase.trim().replace(/\s+/g, ' ');
  if (!collapsed) return null;
  const tokens = Array.from(collapsed).map((ch) => (ch === ' ' ? '\\s+' : escapeRegExp(ch)));
  const pattern = tokens.join('\\s*');
  try {
    return new RegExp(pattern, 'gi');
  } catch {
    return null;
  }
}

/**
 * Locates every span in `paraText` that a theme's AI analysis matches — either the
 * whole paragraph (when the theme's `matchedParagraphIndices` includes `pIdx`) or
 * individual excerpt/quote phrases found (whitespace-tolerantly) in the text.
 */
export function computeThemeIntervals(paraText: string, themes: MatchableTheme[], pIdx?: number): ThemeInterval[] {
  const intervals: ThemeInterval[] = [];

  themes.forEach((theme) => {
    if (pIdx !== undefined && theme.matchedParagraphIndices?.includes(pIdx)) {
      intervals.push({ start: 0, end: paraText.length, color: theme.color, themeId: theme.id });
      return;
    }

    const rawPhrases = [...(theme.excerpts || [])];
    if (theme.keyQuote) rawPhrases.push(theme.keyQuote);
    if (theme.title) rawPhrases.push(theme.title);

    const phrasesToFind: string[] = [];
    rawPhrases.forEach((phrase) => {
      if (!phrase) return;
      const clean = phrase.replace(/["'“”‘’]/g, '').trim();
      if (clean.length >= 3) phrasesToFind.push(clean);
      const matches = phrase.match(/['"“]([^'"”]+)['"”]/g);
      if (matches) {
        matches.forEach((m) => {
          const sub = m.replace(/["'“”‘’]/g, '').trim();
          if (sub.length >= 3) phrasesToFind.push(sub);
        });
      }
    });

    const uniquePhrases = Array.from(new Set(phrasesToFind))
      .filter((p) => p.length >= 3)
      .sort((a, b) => b.length - a.length);

    uniquePhrases.forEach((phrase) => {
      const regex = buildFuzzyPhraseRegex(phrase);
      if (!regex) return;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(paraText)) !== null) {
        intervals.push({ start: match.index, end: match.index + match[0].length, color: theme.color, themeId: theme.id });
        if (match[0].length === 0) regex.lastIndex += 1;
      }
    });
  });

  return intervals;
}

export interface ThemeMentionNode {
  id: number;
  paragraphIndex: number;
  matchedTerm: string;
  quoteText: string;
}

export function getThemeMentionNodes(
  excerpts: string[],
  keyQuote: string | undefined,
  paragraphs: string[],
  themeTitle: string,
  matchedParagraphIndices?: number[]
): ThemeMentionNode[] {
  const nodes: ThemeMentionNode[] = [];

  if (matchedParagraphIndices && matchedParagraphIndices.length > 0) {
    matchedParagraphIndices.forEach((pIdx, id) => {
      nodes.push({
        id,
        paragraphIndex: pIdx,
        matchedTerm: themeTitle,
        quoteText: paragraphs[pIdx] || 'Theme mentioned here.'
      });
    });
    return nodes;
  }

  const terms = [...excerpts];
  if (keyQuote && !terms.includes(keyQuote)) {
    terms.unshift(keyQuote);
  }

  const validTerms = terms.filter((t) => t && t.trim().length > 2);

  validTerms.forEach((quote, qIdx) => {
    const lowerQuote = quote.toLowerCase();
    let foundIdx = paragraphs.findIndex((p) => p.toLowerCase().includes(lowerQuote));
    if (foundIdx === -1) {
      const words = quote.split(/\s+/).filter((w) => w.length > 3);
      foundIdx = paragraphs.findIndex((p) => {
        const lowerP = p.toLowerCase();
        return words.filter((w) => lowerP.includes(w.toLowerCase())).length >= Math.min(2, words.length);
      });
    }
    if (foundIdx === -1) {
      foundIdx = Math.min(qIdx, paragraphs.length - 1);
    }
    nodes.push({
      id: qIdx,
      paragraphIndex: Math.max(0, foundIdx),
      matchedTerm: quote,
      quoteText: quote
    });
  });

  if (nodes.length === 0 && paragraphs.length > 0) {
    paragraphs.forEach((p, idx) => {
      nodes.push({
        id: idx,
        paragraphIndex: idx,
        matchedTerm: themeTitle,
        quoteText: p.substring(0, 120)
      });
    });
  }

  return nodes;
}

export function splitIntoParagraphs(documentText: string): string[] {
  return documentText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export interface ThemeMention {
  paragraphIndex: number;
  start: number;
  end: number;
  quoteText: string;
}

/**
 * Every real, exact occurrence of a theme in the document — built from `computeThemeIntervals`,
 * the SAME strict character-position matching the reader actually sees highlighted in the
 * theme's color. Unlike `getThemeMentionNodes` (which, once a theme's excerpts don't literally
 * appear in the text, falls back to guessing a paragraph by position, or even claims every
 * paragraph), this only ever reports a mention where a real, colored highlight exists — so
 * "mention count" and "jump to mention" both stay truthful to what's actually on the page.
 */
export function findThemeMentions(paragraphs: string[], theme: MatchableTheme): ThemeMention[] {
  const mentions: ThemeMention[] = [];
  paragraphs.forEach((paraText, pIdx) => {
    const intervals = computeThemeIntervals(paraText, [theme], pIdx);
    if (intervals.length === 0) return;

    // Merge overlapping/adjacent intervals — an excerpt and the keyQuote can both match the
    // same phrase — so one real occurrence in the text isn't double-counted as two mentions.
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const merged: { start: number; end: number }[] = [];
    sorted.forEach((iv) => {
      const last = merged[merged.length - 1];
      if (last && iv.start <= last.end) {
        last.end = Math.max(last.end, iv.end);
      } else {
        merged.push({ start: iv.start, end: iv.end });
      }
    });

    merged.forEach((m) => {
      mentions.push({ paragraphIndex: pIdx, start: m.start, end: m.end, quoteText: paraText.slice(m.start, m.end) });
    });
  });
  return mentions;
}

/**
 * The true, exact mention count for a theme against the real document text — the same
 * strict text-matching the UI uses to draw highlights, rather than the AI's own guessed
 * `mentions` integer (which is frequently off since the model never actually re-counts
 * its own excerpts against the source).
 */
export function countThemeMentions(theme: MatchableTheme, documentText: string): number {
  if (!documentText || !documentText.trim()) return 1;
  const paragraphs = splitIntoParagraphs(documentText);
  return findThemeMentions(paragraphs, theme).length || 1;
}

/**
 * Guarantees a theme has at least one real, valid paragraph to highlight and navigate to — a
 * server-side safety net for when the model doesn't fully comply with the (required, non-empty)
 * `matchedParagraphIndices` schema field. Without this, a theme with no valid anchor renders no
 * highlight anywhere, so "jump to this theme's mention" has nowhere real to land and either does
 * nothing or (with a looser matcher) lands on unhighlighted text — exactly the bug this exists to
 * prevent. Order of trust: the model's own indices (if in range) > exact/fuzzy text matches via
 * `findThemeMentions` > the single paragraph with the most word-overlap with the theme's own
 * title/excerpts/keyQuote, which — since it always returns something as long as there's at least
 * one paragraph — is the last resort that keeps this from ever coming back empty.
 */
export function resolveMatchedParagraphIndices(theme: MatchableTheme, paragraphs: string[]): number[] {
  const inRange = (theme.matchedParagraphIndices || []).filter(
    (idx) => Number.isInteger(idx) && idx >= 0 && idx < paragraphs.length
  );
  if (inRange.length > 0) return Array.from(new Set(inRange));

  const mentions = findThemeMentions(paragraphs, theme);
  if (mentions.length > 0) return Array.from(new Set(mentions.map((m) => m.paragraphIndex)));

  if (paragraphs.length === 0) return [];

  const words = Array.from(
    new Set(
      [theme.title || '', ...(theme.excerpts || []), theme.keyQuote || '']
        .join(' ')
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 4)
    )
  );
  if (words.length === 0) return [0];

  let bestIdx = 0;
  let bestScore = -1;
  paragraphs.forEach((p, idx) => {
    const lowerP = p.toLowerCase();
    const score = words.reduce((count, w) => count + (lowerP.includes(w) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });
  return [bestIdx];
}
