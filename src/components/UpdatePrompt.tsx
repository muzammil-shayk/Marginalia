/**
 * App-wide update prompt.
 *
 * The main process checks for updates on its own (10 s after launch, then every 4 h) and downloads
 * them in the background. Settings shows that progress, but only while Settings is open, so a
 * finished download used to wait silently for the next quit. This listens from the app root: a
 * small note while a version downloads, and a dialog once it is ready to install.
 *
 * "Later" is remembered per version on disk, across restarts. The 4-hourly re-check reports the same
 * finished download again, and a reader who already said "later" should not be asked twice.
 * The update still installs on the next quit (`autoInstallOnAppQuit`), so nothing is lost.
 *
 * The dialog wears the host platform's own alert: an NSAlert on macOS (translucent material,
 * stacked full-width buttons), a Windows 11 ContentDialog elsewhere (solid surface, button bar).
 * A manual "Check Now" in Settings also answers here, with "You're up to date" or the error;
 * automatic background checks never open a dialog unless an update is ready.
 */

import React, { useEffect, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from './icons';
import logo from '../assets/images/marginalia-logo.png';
import { CURRENT_APP_VERSION } from '../data/changelog';
import { desktopBridge } from '../utils/documentStorage';
import { initialFlow, reduceFlow, selectDialog, type FlowEvent } from './updateFlow';

// shortcut: anything that is not a Mac gets the Windows 11 dialog (Linux too); add a Linux look if it ships there.
const OS: 'mac' | 'win' = /Mac/i.test(navigator.userAgent) ? 'mac' : 'win';

// Settings' "Check Now" reaches the prompt through module scope, because the two are siblings.
// The prompt is mounted for the app's whole life, so `sendFlow` is set whenever Settings is open.
let sendFlow: ((e: FlowEvent) => void) | null = null;
export const markManualUpdateCheck = (check: Promise<unknown>) => {
  sendFlow?.({ type: 'manual-check', now: Date.now() });
  const settled = () => sendFlow?.({ type: 'manual-settled' });
  check.then(settled, settled);
};

// Native-feeling entrances with no overshoot: macOS settles in from slightly small, Fluent from
// slightly large on its decelerate curve.
const MOTION = {
  mac: { from: 0.96, out: 0.98, ease: [0.23, 1, 0.32, 1] as const, duration: 0.2 },
  win: { from: 1.05, out: 1.05, ease: [0, 0, 0, 1] as const, duration: 0.25 },
}[OS];

type Action = { label: string; onClick: () => void; role: 'primary' | 'secondary' | 'history'; safe?: boolean; disabled?: boolean };

export const UpdatePrompt: React.FC<{
  isDark?: boolean;
  onOpenChangelog?: () => void;
  /** While the changelog is open the ready dialog steps aside (not dismissed) and returns after. */
  changelogOpen?: boolean;
}> = ({ isDark = false, onOpenChangelog, changelogOpen = false }) => {
  const [flow, send] = useReducer(reduceFlow, initialFlow);
  const { status } = flow;
  // The version the reader said "Later" to, read from the desktop config. `undefined` until it has
  // been read, so the dialog never opens against a default and asks a returning reader again.
  const [dismissed, setDismissedState] = useState<string | null | undefined>(undefined);
  // The running app's own version; the bundled constant only stands in until the bridge answers.
  const [appVersion, setAppVersion] = useState(CURRENT_APP_VERSION);
  const [installing, setInstalling] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const safeRef = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();

  const setDismissed = (version: string | null) => {
    setDismissedState(version);
    // Not stored on failure: the choice still holds until the window reloads.
    if (version) desktopBridge()?.setDismissedUpdate(version).catch(() => {});
  };

  useEffect(() => {
    const bridge = desktopBridge();
    if (!bridge) return;
    const settle = (version: string | null) => setDismissedState((prev) => (prev === undefined ? version : prev));
    bridge.getDismissedUpdate().then((v) => settle(v ?? null), () => settle(null));
    bridge.getAppInfo().then((info) => info?.version && setAppVersion(info.version), () => {});
    sendFlow = send;
    const off = bridge.onUpdateStatus((next) => send({ type: 'status', next, now: Date.now() }));
    return () => {
      sendFlow = null;
      off();
    };
  }, []);

  const { result } = flow;
  const readyVersion = status.state === 'downloaded' ? status.version : null;
  const shown = selectDialog(flow, dismissed, changelogOpen);
  const later = () => {
    send({ type: 'later' });
    setDismissed(readyVersion);
  };
  const closeResult = () => send({ type: 'close-result' });
  const fetching = status.state === 'available' || status.state === 'downloading';
  const noteOpen = fetching && !flow.noteHidden;
  const fetchingVersion = flow.fetchingVersion;

  const restart = async () => {
    setInstalling(true);
    try {
      await desktopBridge()?.quitAndInstallUpdate();
    } catch {
      setInstalling(false);
      send({ type: 'install-failed' });
    }
  };

  // The changelog hides the dialog without dismissing it: a ready update (even one reopened by a
  // manual check) comes back when the changelog closes; a check's answer does not.
  const openHistory = () => {
    closeResult();
    onOpenChangelog?.();
  };

  const dialog =
    shown === 'ready'
      ? {
          key: `ready-${readyVersion}`,
          title: 'Update ready',
          body: `Marginalia v${readyVersion} has downloaded and will install on restart.`,
          close: later,
          actions: [
            { label: installing ? 'Restarting…' : 'Restart now', role: 'primary', onClick: () => void restart(), disabled: installing },
            // "Later" takes focus, so a stray Enter or Space while typing never restarts the app.
            { label: 'Later', role: 'secondary', safe: true, onClick: later },
            { label: 'Version History', role: 'history', onClick: openHistory },
          ] as Action[],
        }
      : shown === 'current'
        ? {
            key: 'current',
            title: "You're up to date!",
            body: `Marginalia ${appVersion} is currently the newest version available.`,
            close: closeResult,
            actions: [
              { label: 'OK', role: 'primary', safe: true, onClick: closeResult },
              { label: 'Version History', role: 'history', onClick: openHistory },
            ] as Action[],
          }
        : shown === 'error' && result?.kind === 'error'
          ? {
              key: 'error',
              title: "Couldn't check for updates",
              body: result.message || 'Check your connection and try again.',
              close: closeResult,
              actions: [{ label: 'OK', role: 'primary', safe: true, onClick: closeResult }] as Action[],
            }
          : null;

  const dialogKey = dialog?.key ?? null;
  const closeRef = useRef<() => void>(() => {});
  closeRef.current = dialog?.close ?? (() => {});

  useEffect(() => {
    if (!dialogKey) return;
    const opener = document.activeElement as HTMLElement | null;
    safeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key !== 'Tab') return;
      // Focus trap: Tab cycles between the dialog's own buttons.
      e.preventDefault();
      const stops = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      if (stops.length === 0) return;
      const at = stops.indexOf(document.activeElement as HTMLButtonElement);
      stops[(at + (e.shiftKey ? -1 : 1) + stops.length) % stops.length].focus();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [dialogKey]);

  // Windows puts Version History at the bar's far left, so it leads the DOM (and the Tab order) there.
  const ordered = !dialog
    ? []
    : OS === 'win'
      ? [...dialog.actions.filter((a) => a.role === 'history'), ...dialog.actions.filter((a) => a.role !== 'history')]
      : dialog.actions;
  const theme = isDark ? 'dark' : 'light';
  const scale = (s: number) => (reduced ? 1 : s);
  const percent = status.state === 'downloading' ? Math.round(status.percent) : null;
  const noteLabel = `Downloading Marginalia${fetchingVersion ? ` v${fetchingVersion}` : ''}`;

  return (
    <>
      {/* Non-blocking note while the new version downloads. */}
      <AnimatePresence>
        {noteOpen && (
          <motion.div
            key="update-note"
            role="status"
            data-os={OS}
            data-theme={theme}
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 4 }}
            transition={{ duration: 0.22, ease: MOTION.ease }}
            className="upd-note fixed z-40 right-4 bottom-24 md:bottom-5"
          >
            <span className="upd-plate upd-plate-sm" aria-hidden="true">
              <img src={logo} alt="" />
            </span>
            <div className="upd-note-text">
              <div className="upd-note-row">
                <span className="upd-note-label">Downloading{fetchingVersion ? ` v${fetchingVersion}` : ' update'}…</span>
                {percent !== null && <span className="upd-note-pct">{percent}%</span>}
              </div>
              <div
                className="upd-progress"
                role="progressbar"
                aria-label={noteLabel}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent ?? undefined}
              >
                <span style={{ width: `${percent ?? 0}%` }} />
              </div>
            </div>
            <button type="button" onClick={() => send({ type: 'hide-note' })} aria-label="Hide download progress" className="upd-note-close">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ready-to-install dialog, or the answer to a manual check. The scrim is inert, as behind an
          NSAlert or a ContentDialog: only a button or Escape closes it. */}
      <AnimatePresence>
        {dialog && (
          <motion.div
            key="update-backdrop"
            data-os={OS}
            data-theme={theme}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="upd-scrim"
          >
            <motion.div
              key={dialog.key}
              ref={panelRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="update-title"
              aria-describedby="update-body"
              data-os={OS}
              data-theme={theme}
              initial={{ opacity: 0, scale: scale(MOTION.from) }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: scale(MOTION.out), transition: { duration: 0.15, ease: 'easeIn' } }}
              transition={{ duration: MOTION.duration, ease: MOTION.ease }}
              className="upd"
            >
              <div className="upd-content">
                <span className="upd-plate" aria-hidden="true">
                  <img src={logo} alt="" />
                </span>
                <h2 id="update-title" className="upd-title">
                  {dialog.title}
                </h2>
                <p id="update-body" className="upd-body">
                  {dialog.body}
                </p>
                {flow.installFailed && dialog.key.startsWith('ready') && (
                  <p role="alert" className="upd-body upd-alert">
                    Could not restart. Quit Marginalia to install the update.
                  </p>
                )}
              </div>
              <div className="upd-actions">
                {ordered.map((a) => (
                  <button
                    key={a.role}
                    ref={a.safe ? safeRef : undefined}
                    type="button"
                    data-role={a.role}
                    onClick={a.onClick}
                    disabled={a.disabled}
                    className="upd-btn"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
