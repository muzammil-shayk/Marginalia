/**
 * Right-to-left text: which way a passage runs and whether it is in Arabic script (Urdu, Persian,
 * Arabic), which the reader sets in Nastaliq. Pure, so it is tested.
 *
 * Direction follows the first strong character, as the browser's `dir="auto"` does, so the reader,
 * the margin cards and every export agree on it.
 */

/** Hebrew, Arabic, Syriac, Thaana, N'Ko, Samaritan, Mandaic and the Arabic presentation forms. */
const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/u;
const ARABIC_CHAR = /[؀-ۿݐ-ݿࡰ-ࣿﭐ-﷿ﹰ-﻿]/u;
const STRONG = /[\p{L}]/u;

export type TextDirection = 'rtl' | 'ltr';

/** The direction of a passage: that of its first letter. 'ltr' when it has none. */
export function textDirection(text: string): TextDirection {
  for (const ch of text) {
    if (!STRONG.test(ch)) continue;
    return RTL_CHAR.test(ch) ? 'rtl' : 'ltr';
  }
  return 'ltr';
}

/** Whether most of the letters in a passage are Arabic script. */
export function isArabicScript(text: string): boolean {
  let arabic = 0;
  let letters = 0;
  for (const ch of text) {
    if (!STRONG.test(ch)) continue;
    letters++;
    if (ARABIC_CHAR.test(ch)) arabic++;
  }
  return letters > 0 && arabic * 2 >= letters;
}

/** Whether any of the passages has right-to-left letters (an export then needs a shaping renderer). */
export function hasRtlText(texts: Iterable<string | undefined | null>): boolean {
  for (const t of texts) if (t && RTL_CHAR.test(t)) return true;
  return false;
}

/** The reader's choice for Arabic-script text: Nastaliq (the default) or the system Naskh. */
export type ArabicScriptStyle = 'nastaliq' | 'naskh';

export const NASTALIQ_STACK = "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', serif";
export const NASKH_STACK = "'Noto Naskh Arabic', 'Segoe UI', 'Geeza Pro', 'Arial', serif";

/**
 * Font and line height for one paragraph. Nastaliq's tall, sloping ligatures need far more line
 * room than Latin text, or the dots of one line collide with the next.
 */
export function paragraphTypeface(
  text: string,
  latinFont: string,
  style: ArabicScriptStyle = 'nastaliq'
): { dir: TextDirection; fontFamily: string; lineHeight: string } {
  const dir = textDirection(text);
  if (!isArabicScript(text)) return { dir, fontFamily: latinFont, lineHeight: '1.75' };
  return style === 'naskh'
    ? { dir, fontFamily: `${NASKH_STACK}, ${latinFont}`, lineHeight: '1.9' }
    : { dir, fontFamily: `${NASTALIQ_STACK}, ${latinFont}`, lineHeight: '2.4' };
}
