/**
 * The occasional "Send feedback" prompt, kept in the main-process config.json via updateConfig()
 * (not localStorage: the embedded server's random port resets that every launch).
 *
 *   sessionCount      launches so far, counted once per launch by main
 *   feedbackAnswer    'sent' | 'never' stop the prompt for good; 'later' snoozes it
 *   feedbackSnoozedAt the launch a "Later" was given at
 *
 * Due from the 5th launch, and again 15 launches after each "Later".
 */

const FIRST_PROMPT_AT = 5;
const SNOOZE_SESSIONS = 15;
const ANSWERS = new Set(['sent', 'later', 'never']);

const sessionsIn = (config) => (config && Number.isInteger(config.sessionCount) && config.sessionCount > 0 ? config.sessionCount : 0);

/** Whether the prompt should show this launch. */
function feedbackDueIn(config) {
  const sessions = sessionsIn(config);
  if (sessions < FIRST_PROMPT_AT) return false;
  const answer = config && config.feedbackAnswer;
  if (answer === 'sent' || answer === 'never') return false;
  if (answer === 'later') {
    const at = Number.isInteger(config.feedbackSnoozedAt) ? config.feedbackSnoozedAt : 0;
    return sessions >= at + SNOOZE_SESSIONS;
  }
  return true;
}

/** Counts this launch. Called once by main when the app is ready. */
function countSession({ readConfig, updateConfig }) {
  updateConfig({ sessionCount: sessionsIn(readConfig()) + 1 });
}

/** Registers `marginalia:feedback-get` / `marginalia:feedback-set`. */
function registerFeedbackSetting({ ipcMain, readConfig, updateConfig }) {
  ipcMain.handle('marginalia:feedback-get', () => {
    const config = readConfig();
    return { sessions: sessionsIn(config), due: feedbackDueIn(config) };
  });
  ipcMain.handle('marginalia:feedback-set', (_event, answer) => {
    if (!ANSWERS.has(answer)) return false;
    const config = readConfig();
    // Sending from the sidebar while snoozed or never asked still counts as sent.
    return updateConfig({ feedbackAnswer: answer, feedbackSnoozedAt: answer === 'later' ? sessionsIn(config) : undefined }) !== false;
  });
}

module.exports = { feedbackDueIn, countSession, registerFeedbackSetting, FIRST_PROMPT_AT, SNOOZE_SESSIONS };
