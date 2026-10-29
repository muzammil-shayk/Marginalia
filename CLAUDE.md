# Marginalia: project notes

- Electron + React 19 + Vite + Tailwind 4 + `motion`. Launch with `npm run desktop`, never `npm run dev`.
- Checks: `npm run build`, then `npx tsc --noEmit` (tsc trips on a stale `dist/` if run first), then `npx tsx --test` on every `*.test.ts` (repo root and `src/`).
- No AI (Gemini) calls unless the user presses a button. Nothing that looks like work on startup, except the update check.
- The embedded server binds a random port each launch, so localStorage resets every launch. Flags that must survive a restart go in the main-process `config.json` via `updateConfig()` (atomic write).
- Home library = bookshelf (`src/components/Bookshelf.tsx`, `.shelf-*` in `src/index.css`), modelled on interesting-reads.vercel.app. The shelf background follows the app theme (paper in light, night in dark). The desk area opens smoothly. Spine colours come from a fixed palette. Titles must fit their spine. The desk box is a fixed size. Motion is eased, with no spring or bounce.
- Theme tokens in `index.css`: `paper`, `ink`, `night*`, `accent`/`on-accent` (filled buttons), `gold`, `text-muted` (muted text, ≥4.5:1 in both themes). Buttons are `rounded-full caps`.
- Keep the original logo `src/assets/images/marginalia-logo.png`. Dark mode puts it on a cream plate.
- Update prompt: `UpdatePrompt.tsx` renders; the logic lives in the pure reducer `updateFlow.ts` (tested). Mac alert style on Mac, Windows 11 style elsewhere. "Later" is saved to disk per version.
- Icons: `build/icon.icns` (mac, Big Sur plate with depth), `build/icon-mac.png` (dev Dock only), `build/icon.ico` (Windows), `build/icon.png` (Linux).
- Release: bump `package.json`, `package-lock.json` and `CURRENT_APP_VERSION` in `src/data/changelog.ts`. Add a changelog entry, commit on `main`, tag `vX.Y.Z` (annotated), and push main + tag to `origin` (muzammil-shayk) and `upstream` (shamawork95-cmyk). CI publishes each repo's release.
- Mac builds are unsigned (no paid Apple account), so Mac auto-update can't install. Windows auto-update works.
- 2.3.0 (2026-10-29): bookshelf, whole-app restyle, platform update dialogs, safer config writes.
- 2.3.1 (2026-10-29): theme-matched shelf, ~1.4 s open/close with scroll follow, sage nav pill, keyboard-only focus rings, word-boundary search snippets.
- Updates always download the full installer: `autoUpdater.disableDifferentialDownload = true`, no blockmaps published (2026-10-29).
