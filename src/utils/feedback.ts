/**
 * "Send feedback": a pre-filled email to the Marginalia team, opened in the reader's own mail
 * app. Nothing is sent by Marginalia itself; the reader sees and sends (or discards) the email.
 * The version and platform go in the body so a report says what it is about.
 */

export const FEEDBACK_EMAIL = 'marginaliaannotator@gmail.com';

export function feedbackMailto(info: { version: string; platform?: string }): string {
  const subject = `Marginalia ${info.version} feedback`;
  const body = [
    'What I like:',
    '',
    '',
    'What I would change or what went wrong:',
    '',
    '',
    '—',
    `Marginalia ${info.version}${info.platform ? ` on ${platformName(info.platform)}` : ''}`
  ].join('\n');
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function platformName(p: string): string {
  if (p === 'darwin') return 'macOS';
  if (p === 'win32') return 'Windows';
  if (p === 'linux') return 'Linux';
  return p;
}
