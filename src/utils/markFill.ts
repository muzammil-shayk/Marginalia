/**
 * The fill behind a highlighted passage in the text reader, tuned per theme. Pure, tested.
 *
 * A flat alpha on the theme colour read well on paper for some colours and vanished on night for
 * all of them (a 22% dark green over #0b0b0a is ~1.3:1). So the fill is solved instead of fixed:
 * - light: the theme colour, at the alpha that puts the composite at `target` contrast to paper;
 * - dark: the theme colour lifted a quarter of the way toward paper (a dark hue has no light to
 *   give on black; near-black further), at the alpha that reaches the dark target against night.
 * The alpha is then lowered, if needed, until body text on the fill keeps 4.5:1.
 * The theme colour itself is never changed; only how strongly it is laid down.
 */

type RGB = [number, number, number];

const PAPER: RGB = [0xf3, 0xef, 0xe7];
const NIGHT: RGB = [0x0b, 0x0b, 0x0a];
/** Reader body text: stone-800 on paper, stone-200 on night. */
const TEXT_LIGHT: RGB = [0x26, 0x24, 0x20];
const TEXT_DARK: RGB = [0xe2, 0xdb, 0xcd];

/** Fill-to-ground contrast each state aims for. Hover is the mark being pointed at. */
export const FILL_TARGETS = {
  light: { rest: 1.4, hover: 1.75 },
  dark: { rest: 1.8, hover: 2.4 }
} as const;
const DARK_LIFT = 0.25;
const MIN_TEXT = 4.5;

export function parseHex(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => v + (b[i] - v) * t) as RGB;

export function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: RGB, b: RGB): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export interface SolvedFill {
  rgb: RGB;
  alpha: number;
  /** The fill composited on the ground, for checks. */
  composite: RGB;
}

export function solveMarkFill(hex: string, isDark: boolean, state: 'rest' | 'hover' = 'rest'): SolvedFill | null {
  const base = parseHex(hex);
  if (!base) return null;
  const ground = isDark ? NIGHT : PAPER;
  const text = isDark ? TEXT_DARK : TEXT_LIGHT;
  const target = FILL_TARGETS[isDark ? 'dark' : 'light'][state];
  // A near-black theme colour is lifted further, until it can reach the target at all.
  let lift = DARK_LIFT;
  while (isDark && lift < 0.6 && contrast(mix(NIGHT, mix(base, PAPER, lift), 0.9), NIGHT) < target) lift += 0.05;
  const rgb = isDark ? mix(base, PAPER, lift) : base;
  const at = (a: number) => mix(ground, rgb, a);
  // Contrast to the ground rises with alpha (the fill moves away from it), so bisect.
  // A colour too close to the ground to reach the target at 0.9 stays at 0.9.
  let lo = 0.08;
  let hi = 0.9;
  for (let i = 0; i < 24 && contrast(at(hi), ground) >= target; i++) {
    const mid = (lo + hi) / 2;
    if (contrast(at(mid), ground) < target) lo = mid;
    else hi = mid;
    if (hi - lo < 0.002) break;
  }
  // Rounded up, so the stored two-decimal alpha still meets the target; then text keeps 4.5:1.
  let alpha = Math.ceil(hi * 100) / 100;
  while (alpha > 0.08 && contrast(at(alpha), text) < MIN_TEXT) alpha = Math.round((alpha - 0.01) * 100) / 100;
  return { rgb: rgb.map(Math.round) as RGB, alpha, composite: at(alpha).map(Math.round) as RGB };
}

/** CSS colour for a mark's fill; falls back to a light tint of the raw value if it is not hex. */
export function markFill(hex: string, isDark: boolean, state: 'rest' | 'hover' = 'rest'): string {
  const solved = solveMarkFill(hex, isDark, state);
  if (!solved) return `color-mix(in srgb, ${hex} ${state === 'hover' ? 36 : 24}%, transparent)`;
  const [r, g, b] = solved.rgb;
  return `rgb(${r} ${g} ${b} / ${solved.alpha})`;
}

export const READER_GROUNDS = { paper: PAPER, night: NIGHT, textLight: TEXT_LIGHT, textDark: TEXT_DARK };
