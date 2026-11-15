/**
 * Which links leave the app window, and which navigations it keeps. Kept out of main.cjs so it can
 * be tested without Electron.
 *
 * `shell.openExternal` hands a URL to the operating system, which will act on `file://` or any
 * custom protocol another application registered, so only http(s) goes out, plus mail to the
 * app's own feedback address: Send feedback (src/utils/feedback.ts) fills in `subject` and `body`,
 * and nothing else is allowed, so a page cannot add recipients (`cc`, `bcc`, `to`) or attachments.
 */

const FEEDBACK_ADDRESS = 'marginaliaannotator@gmail.com';
const MAILTO_FIELDS = new Set(['subject', 'body']);

const parse = (url) => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

function isSafeExternalUrl(url) {
  const parsed = parse(url);
  if (!parsed) return false;
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return true;
  if (parsed.protocol !== 'mailto:') return false;
  let address;
  try {
    address = decodeURIComponent(parsed.pathname).toLowerCase();
  } catch {
    return false;
  }
  if (address !== FEEDBACK_ADDRESS) return false;
  for (const key of parsed.searchParams.keys()) if (!MAILTO_FIELDS.has(key)) return false;
  return true;
}

/** True only for a page of the running app; anything unparseable is not. */
function isAppNavigation(url, port) {
  const parsed = parse(url);
  return Boolean(parsed) && parsed.host === `127.0.0.1:${port}`;
}

module.exports = { isSafeExternalUrl, isAppNavigation };
