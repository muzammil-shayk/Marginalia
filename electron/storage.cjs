/**
 * Moving the library between folders. Kept out of main.cjs so it can be tested without Electron.
 */

const fs = require('fs');
const path = require('path');

/**
 * Copies an existing library into a new location.
 *
 * Copy-then-delete rather than `fs.rename`, because the two folders are very often on different
 * volumes — moving the library to an external drive is one of the main reasons to change it at
 * all — and rename fails across devices. The originals are only removed once the copy has
 * finished, so an interrupted move leaves the old library intact rather than losing documents.
 *
 * `settings.json` (themes, palettes, the Gemini key) lives in the library folder too, and used to
 * be left behind, so a move reset every preference. It is copied; the old copy is left in place.
 */
async function migrateLibrary(from, to) {
  if (!fs.existsSync(from)) return { moved: 0 };
  await fs.promises.mkdir(to, { recursive: true });

  let moved = 0;
  for (const sub of ['documents', 'originals']) {
    const sourceDir = path.join(from, sub);
    if (!fs.existsSync(sourceDir)) continue;
    await fs.promises.mkdir(path.join(to, sub), { recursive: true });
    for (const name of await fs.promises.readdir(sourceDir)) {
      await fs.promises.copyFile(path.join(sourceDir, name), path.join(to, sub, name));
      moved++;
    }
  }
  if (fs.existsSync(path.join(from, 'settings.json'))) {
    await fs.promises.copyFile(path.join(from, 'settings.json'), path.join(to, 'settings.json'));
    moved++;
  }

  for (const sub of ['documents', 'originals']) {
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
