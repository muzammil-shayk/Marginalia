/**
 * The settings as they may be cached in the browser.
 *
 * The server's settings file also holds the Gemini key and model, and hydration merges that
 * whole file into the app's settings — so the localStorage cache got a plain-text copy of the
 * key. Every `gemini*` field stays out of it. (The in-memory copy still carries the key, because
 * PUT /api/settings replaces the whole file and would otherwise erase it.)
 */
export function withoutSecrets<T extends object>(settings: T): T {
  return Object.fromEntries(Object.entries(settings).filter(([key]) => !/^gemini/i.test(key))) as T;
}
