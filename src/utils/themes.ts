/**
 * Custom themes: the reader's list (`UserSettings.activeThemes`), edited from Settings and from
 * the highlight pop-over. Pure: each edit returns a new list, which the caller saves with the rest
 * of the settings (`saveRemoteSettings`), the same path the list already uses. No separate theme
 * route, so the two edit points cannot overwrite each other with a stale copy.
 *
 * Marks point at a theme by id, so a rename never orphans one, and deleting a theme never touches
 * a mark: a mark keeps its own colour and its `themeId`, and `resolveTheme` names it "Untitled"
 * (fallback colour) from then on. Nothing is lost, and nothing is written across the library.
 */

export type Theme = { id: string; name: string; color: string };
export type ThemeResult = { ok: true; themes: Theme[]; theme: Theme } | { ok: false; error: string };

/** What a mark under a deleted (or unknown) theme is shown and exported as. */
export const UNTITLED_THEME = { name: 'Untitled', color: '#9a9a9a' };

const MAX_NAME = 60;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function checkName(themes: Theme[], name: string, selfId?: string): string | null {
  if (!name) return 'Give the theme a name.';
  if (name.length > MAX_NAME) return `Keep the name under ${MAX_NAME} characters.`;
  const taken = themes.some((t) => t.id !== selfId && t.name.trim().toLowerCase() === name.toLowerCase());
  return taken ? 'A theme with that name already exists.' : null;
}

const checkColor = (color: string): string | null => (HEX.test(color) ? null : 'Pick a colour.');

export function createTheme(themes: Theme[], props: { name: string; color: string }, newId: () => string): ThemeResult {
  const name = (props.name ?? '').trim();
  const color = (props.color ?? '').trim();
  const error = checkName(themes, name) ?? checkColor(color);
  if (error) return { ok: false, error };
  const theme = { id: newId(), name, color: color.toLowerCase() };
  return { ok: true, themes: [...themes, theme], theme };
}

function edit(themes: Theme[], id: string, patch: Partial<Theme>, error: string | null): ThemeResult {
  if (error) return { ok: false, error };
  const index = themes.findIndex((t) => t.id === id);
  if (index === -1) return { ok: false, error: 'That theme no longer exists.' };
  const theme = { ...themes[index], ...patch };
  return { ok: true, themes: themes.map((t, i) => (i === index ? theme : t)), theme };
}

export function renameTheme(themes: Theme[], id: string, name: string): ThemeResult {
  const clean = (name ?? '').trim();
  return edit(themes, id, { name: clean }, checkName(themes, clean, id));
}

export function recolorTheme(themes: Theme[], id: string, color: string): ThemeResult {
  const clean = (color ?? '').trim();
  return edit(themes, id, { color: clean.toLowerCase() }, checkColor(clean));
}

/** The list without the theme. Marks under it are left as they are (see `resolveTheme`). */
export function deleteTheme(themes: Theme[], id: string): Theme[] {
  return themes.some((t) => t.id === id) ? themes.filter((t) => t.id !== id) : themes;
}

/** The theme a mark is filed under; "Untitled" when that theme was deleted; null when untagged. */
export function resolveTheme(themes: Theme[], themeId: string | null | undefined): Theme | null {
  if (!themeId) return null;
  return themes.find((t) => t.id === themeId) ?? { id: themeId, ...UNTITLED_THEME };
}

/** How many marks across the library sit under a theme (from each document's `themeCounts`). */
export function themeUsage(metas: { themeCounts?: Record<string, number> }[], themeId: string): number {
  return metas.reduce((sum, m) => sum + (m.themeCounts?.[themeId] ?? 0), 0);
}
