/**
 * The first-run tutorial flag, kept in the main-process config.json via updateConfig() (not
 * localStorage: the embedded server's random port resets that every launch). Same shape as the
 * AI opt-in (aiSetting.cjs): not seen unless saved as a real `true`.
 */

/** Whether the reader has finished or skipped the tutorial in this config. */
function tutorialSeenIn(config) {
  return !!config && config.tutorialSeen === true;
}

/** Registers `marginalia:tutorial-get` / `marginalia:tutorial-set`; `set` answers the value read back after saving. */
function registerTutorialSetting({ ipcMain, readConfig, updateConfig }) {
  ipcMain.handle('marginalia:tutorial-get', () => tutorialSeenIn(readConfig()));
  ipcMain.handle('marginalia:tutorial-set', (_event, seen) => {
    updateConfig({ tutorialSeen: seen === true });
    return tutorialSeenIn(readConfig());
  });
}

module.exports = { tutorialSeenIn, registerTutorialSetting };
