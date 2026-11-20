/**
 * Moving the library between folders. Kept out of main.cjs so it can be tested without Electron.
 */

const fs = require('fs');
const path = require('path');

/** The library's folders, copied whole (nested: mark backups backups/{id}/{ms}.json, OCR ocr/{id}/{page}.json). */
const FOLDERS = ['documents', 'originals', 'backups', 'ocr'];

/**
 * Copies one file without ever replacing a different file already at `to`. An identical file
 * there (left by an earlier, interrupted move) is fine. `ours` maps files this move already
 * wrote to the source's mtime then: those may be refreshed when the source changed since.
 */
async function copyNoClobber(from, to, ours) {
  const stat = await fs.promises.stat(from);
  const mine = ours.get(to);
  if (mine !== undefined) {
    if (mine === stat.mtimeMs) return false;
    await fs.promises.copyFile(from, to);
    ours.set(to, stat.mtimeMs);
    return false;
  }
  try {
    await fs.promises.copyFile(from, to, fs.constants.COPYFILE_EXCL);
  } catch (err) {
    if (!err || err.code !== 'EEXIST') throw err;
    const [a, b] = await Promise.all([fs.promises.readFile(from), fs.promises.readFile(to)]);
    if (!a.equals(b)) {
      throw new Error(`The new folder already has a different ${path.basename(to)}. Choose an empty folder, or move that file away first.`);
    }
  }
  ours.set(to, stat.mtimeMs);
  return true;
}

/** Copies a folder tree; returns how many files were new to the target. */
async function copyTree(from, to, ours) {
  if (!fs.existsSync(from)) return 0;
  await fs.promises.mkdir(to, { recursive: true });
  let moved = 0;
  for (const entry of await fs.promises.readdir(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) moved += await copyTree(source, target, ours);
    else if (await copyNoClobber(source, target, ours)) moved++;
  }
  return moved;
}

/**
 * Copies an existing library into a new location.
 *
 * Copy-then-delete rather than `fs.rename`, because the two folders are very often on different
 * volumes — moving the library to an external drive is one of the main reasons to change it at
 * all — and rename fails across devices. The originals are only removed once the copy has
 * finished, so an interrupted move leaves the old library intact rather than losing documents.
 * A different file already in the new folder is never overwritten: the move fails instead.
 *
 * `settings.json` (themes, palettes, the Gemini key) lives in the library folder too, and used to
 * be left behind, so a move reset every preference. It is copied; the old copy is left in place.
 *
 * Writes are not locked while this runs: the app can still save to the old folder. A second pass
 * re-copies anything that changed or appeared during the first, so only a save in the last
 * moments of the move (the second pass and the delete) can be missed.
 */
async function migrateLibrary(from, to) {
  if (!fs.existsSync(from)) return { moved: 0 };
  await fs.promises.mkdir(to, { recursive: true });

  const ours = new Map();
  let moved = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (const sub of FOLDERS) moved += await copyTree(path.join(from, sub), path.join(to, sub), ours);
    if (fs.existsSync(path.join(from, 'settings.json'))) {
      if (await copyNoClobber(path.join(from, 'settings.json'), path.join(to, 'settings.json'), ours)) moved++;
    }
  }

  for (const sub of FOLDERS) {
    await fs.promises.rm(path.join(from, sub), { recursive: true, force: true }).catch(() => {});
  }
  return { moved };
}

/** `migrateLibrary` that never throws: `{ ok: true, moved }` or `{ ok: false, message }`. */
async function tryMigrateLibrary(from, to) {
  try {
    const { moved } = await migrateLibrary(from, to);
    return { ok: true, moved };
  } catch (err) {
    return { ok: false, message: String((err && err.message) || err) };
  }
}

module.exports = { migrateLibrary, tryMigrateLibrary };
