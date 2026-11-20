/**
 * Runs every end-to-end suite in turn, even after one fails, so a single flake does not hide the
 * others' results. Exits 1 if any suite failed. Expects a fresh `npm run build`.
 *
 *   npm run build && node scripts/run-e2e.cjs
 */

const { spawnSync } = require('child_process');
const path = require('path');

// Outside Electron, require('electron') is the path to its binary.
const ELECTRON = require('electron');
const SUITES = [
  [ELECTRON, 'e2e-marking.cjs'],
  [ELECTRON, 'e2e-views.cjs'],
  [ELECTRON, 'e2e-blackout.cjs'],
  [ELECTRON, 'e2e-collapse.cjs'],
  [ELECTRON, 'e2e-ocr.cjs'],
  [ELECTRON, 'e2e-find.cjs'],
  [ELECTRON, 'e2e-inkarrow.cjs'],
  [ELECTRON, 'e2e-focus.cjs'],
  [ELECTRON, 'e2e-ocr-ui.cjs'],
  [process.execPath, 'e2e-first-run.cjs']
];

const failed = SUITES.filter(([bin, file]) => {
  console.log(`\n== ${file}`);
  const { status, error } = spawnSync(bin, [path.join(__dirname, file)], { stdio: 'inherit' });
  if (error) console.error(error);
  return status !== 0;
}).map(([, file]) => file);

console.log(failed.length ? `\ne2e: ${failed.length} of ${SUITES.length} suites failed: ${failed.join(', ')}` : `\ne2e: all ${SUITES.length} suites passed`);
process.exit(failed.length ? 1 : 0);
