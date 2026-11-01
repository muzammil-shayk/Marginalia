/**
 * The AI opt-in, kept in the main-process config.json (not localStorage: the embedded server's
 * random port resets that every launch). Off unless the reader turned it on — for new users and
 * for existing configs that predate the flag. The embedded server is told the saved value
 * (`setAiEnabled` in server.ts), and refuses every AI route while it is off.
 */

/** Whether AI features are on in this config. Only a real `true` counts. */
function aiEnabledIn(config) {
  return !!config && config.aiEnabled === true;
}

/**
 * Registers `marginalia:ai-get` / `marginalia:ai-set`. `set` answers the value read back after
 * saving, and only that saved value reaches the server, so a failed save changes nothing.
 */
function registerAiSetting({ ipcMain, readConfig, updateConfig, apply }) {
  ipcMain.handle('marginalia:ai-get', () => aiEnabledIn(readConfig()));
  ipcMain.handle('marginalia:ai-set', (_event, enabled) => {
    if (updateConfig({ aiEnabled: enabled === true })) apply(aiEnabledIn(readConfig()));
    return aiEnabledIn(readConfig());
  });
}

module.exports = { aiEnabledIn, registerAiSetting };
