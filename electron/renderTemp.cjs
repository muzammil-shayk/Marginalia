/**
 * The temp file an HTML export is printed from (see renderPdfWithElectron in main.cjs).
 *
 * A fixed name in the shared temp folder could be pre-created or swapped by another program
 * between the write and the load. Each export instead gets its own new private folder
 * (`mkdtemp`, mode 0700), and the file is created there with 'wx' so it is never an existing one.
 */

const fs = require('fs');
const path = require('path');

/** `{ file, dispose }`: the written file, and a function that removes its folder. */
async function writeRenderTemp(tempRoot, html) {
  const dir = await fs.promises.mkdtemp(path.join(tempRoot, 'marginalia-export-'));
  const file = path.join(dir, 'export.html');
  try {
    await fs.promises.writeFile(file, html, { encoding: 'utf-8', flag: 'wx' });
  } catch (err) {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
  return { file, dispose: () => fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {}) };
}

module.exports = { writeRenderTemp };
