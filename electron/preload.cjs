/**
 * Preload bridge.
 *
 * The renderer runs sandboxed with no Node access, so this exposes exactly the desktop
 * capabilities the interface needs and nothing more. `window.marginaliaDesktop` being undefined
 * is how the client detects it is running outside the desktop app, which is what makes the
 * storage controls in Settings appear only where they can actually work.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('marginaliaDesktop', {
  isDesktop: true,
  /** Absolute path of the folder documents are stored in. */
  getStorageDir: () => ipcRenderer.invoke('marginalia:storage-dir'),
  /** Opens that folder in Finder / File Explorer. */
  revealStorageDir: () => ipcRenderer.invoke('marginalia:reveal-storage-dir'),
  /** Prompts for a new folder, offers to move the library into it, and re-points the store. */
  chooseStorageDir: () => ipcRenderer.invoke('marginalia:choose-storage-dir'),
  /** Returns the library to the default per-user location. */
  resetStorageDir: () => ipcRenderer.invoke('marginalia:reset-storage-dir'),
  /** App version and platform, for the About section. */
  getAppInfo: () => ipcRenderer.invoke('marginalia:app-info'),

  // ── Auto-update ─────────────────────────────────────────────────────────
  /** Asks the main process to check now, regardless of the background schedule. */
  checkForUpdates: () => ipcRenderer.invoke('marginalia:updater-check'),
  /** Installs an already-downloaded update and relaunches the app. */
  quitAndInstallUpdate: () => ipcRenderer.invoke('marginalia:updater-quit-and-install'),
  /** Whether background checks are turned on. */
  getAutoUpdatePreference: () => ipcRenderer.invoke('marginalia:updater-get-preference'),
  /** Turns background checks on or off. */
  setAutoUpdatePreference: (enabled) => ipcRenderer.invoke('marginalia:updater-set-preference', enabled),
  /**
   * Subscribes to update status changes (checking / available / downloading / downloaded / error).
   * Returns an unsubscribe function so the settings panel can stop listening on unmount.
   */
  onUpdateStatus: (callback) => {
    let active = true;
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('marginalia:updater-status', listener);
    // A status sent before this subscription (e.g. a download that finished before a reload) is
    // fetched once, so a late subscriber still hears it. Pushes made before this reply arrive first.
    ipcRenderer
      .invoke('marginalia:updater-last-status')
      .then((status) => {
        if (active && status) callback(status);
      })
      .catch(() => {});
    return () => {
      active = false;
      ipcRenderer.removeListener('marginalia:updater-status', listener);
    };
  },
  /** The update version the reader said "Later" to, kept on disk across restarts. */
  getDismissedUpdate: () => ipcRenderer.invoke('marginalia:updater-get-dismissed'),
  /** Records the update version the reader said "Later" to. */
  setDismissedUpdate: (version) => ipcRenderer.invoke('marginalia:updater-set-dismissed', version),

  // ── AI opt-in (off by default, kept in config.json) ───────────────────────
  /** Whether AI features are turned on. */
  getAiEnabled: () => ipcRenderer.invoke('marginalia:ai-get'),
  /** Turns AI features on or off; resolves with the value actually saved. */
  setAiEnabled: (enabled) => ipcRenderer.invoke('marginalia:ai-set', enabled === true),

  // ── First-run tutorial (kept in config.json) ──────────────────────────────
  /** Whether the reader has finished or skipped the tutorial. */
  getTutorialSeen: () => ipcRenderer.invoke('marginalia:tutorial-get'),
  /** Records it; resolves with the value actually saved. */
  setTutorialSeen: (seen) => ipcRenderer.invoke('marginalia:tutorial-set', seen === true),

  // ── Occasional feedback prompt (kept in config.json) ──────────────────────
  /** { sessions, due }: whether to offer the Send feedback prompt this launch. */
  getFeedbackPrompt: () => ipcRenderer.invoke('marginalia:feedback-get'),
  /** Records 'sent', 'later' or 'never'. */
  setFeedbackPrompt: (answer) => ipcRenderer.invoke('marginalia:feedback-set', String(answer)),

  /**
   * Registers the renderer's "save everything pending now" handler. Main calls it before a window
   * closes or the app quits (see electron/flushOnExit.cjs) and waits up to 3 s for the answer.
   * Returns an unsubscribe function.
   */
  onFlushPendingSaves: (handler) => {
    const listener = (_event, requestId) => {
      Promise.resolve()
        .then(handler)
        .then((ok) => ok === true, () => false)
        .then((ok) => ipcRenderer.send('marginalia:flush-pending-saves-done', requestId, ok));
    };
    ipcRenderer.on('marginalia:flush-pending-saves', listener);
    return () => ipcRenderer.removeListener('marginalia:flush-pending-saves', listener);
  }
});
