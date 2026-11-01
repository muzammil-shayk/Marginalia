/**
 * The server half of the AI opt-in (`electron/aiSetting.cjs` keeps the saved value in
 * config.json and calls `setAiEnabled` at start-up and on every change). Off by default, so a
 * plain dev server and a fresh desktop install both refuse every AI route.
 */

import type { RequestHandler } from 'express';

let aiEnabled = false;

export function setAiEnabled(on: boolean): void {
  aiEnabled = on === true;
}

export function isAiEnabled(): boolean {
  return aiEnabled;
}

/** Put in front of every AI route: while AI is off it answers 403 before the route runs. */
export const requireAi: RequestHandler = (_req, res, next) => {
  if (aiEnabled) {
    next();
    return;
  }
  res.status(403).json({ error: 'AI features are turned off in Settings.', aiDisabled: true });
};
