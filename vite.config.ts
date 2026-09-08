import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {createRequire} from 'module';
import {defineConfig, Plugin} from 'vite';

const require = createRequire(import.meta.url);

/**
 * Ships PDF.js's WebAssembly image decoders under a fixed, unhashed path.
 *
 * PDF.js decodes JPEG 2000 and JBIG2 images in WebAssembly, and finds those binaries by appending
 * a known filename to the `wasmUrl` it is given — so they cannot be fingerprinted like ordinary
 * assets, and `new URL(..., import.meta.url)` is no help. Without them a scanned book encoded in
 * either format renders as blank pages with no error at all, which is exactly what it did.
 *
 * Copied verbatim rather than committed, so the binaries always match the installed PDF.js.
 */
function pdfjsWasm(): Plugin {
  const dir = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'wasm');
  const files = () => fs.readdirSync(dir).filter((f) => f.endsWith('.wasm'));
  const PREFIX = '/pdf-wasm/';

  return {
    name: 'marginalia:pdfjs-wasm',
    // Build: emitted with an explicit fileName, which is what keeps the names intact.
    generateBundle() {
      for (const file of files()) {
        this.emitFile({
          type: 'asset',
          fileName: `pdf-wasm/${file}`,
          source: fs.readFileSync(path.join(dir, file))
        });
      }
    },
    // Dev: served straight off disk from the same path the built app uses.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(PREFIX)) return next();
        const file = path.join(dir, path.basename(req.url));
        if (!file.startsWith(dir) || !fs.existsSync(file)) return next();
        res.setHeader('Content-Type', 'application/wasm');
        fs.createReadStream(file).pipe(res);
      });
    }
  };
}

/**
 * Serves the project's own legal documents at a fixed path, the same way `pdfjsWasm` above serves
 * binaries that live outside `src/`. Only the two long, non-prose ones go through this — the MIT
 * license text and the full third-party notices dump — since linking out to them (opened by
 * Electron's window-open handler in the system's default browser; see electron/main.cjs) is
 * simpler than inlining several hundred KB into the JS bundle. The Privacy Policy and Terms of
 * Service are short enough to import directly with Vite's `?raw` suffix instead, right where
 * they're rendered in Settings — see SettingsScreen.tsx.
 */
function legalDocs(): Plugin {
  const root = path.resolve(__dirname);
  const FILES = ['LICENSE', 'THIRD_PARTY_NOTICES.txt'];
  const PREFIX = '/legal/';

  return {
    name: 'marginalia:legal-docs',
    generateBundle() {
      for (const file of FILES) {
        this.emitFile({
          type: 'asset',
          fileName: `legal/${file}`,
          source: fs.readFileSync(path.join(root, file))
        });
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(PREFIX)) return next();
        const file = path.join(root, decodeURIComponent(req.url.slice(PREFIX.length)));
        if (!FILES.includes(path.basename(file)) || path.dirname(file) !== root || !fs.existsSync(file)) {
          return next();
        }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        fs.createReadStream(file).pipe(res);
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), pdfjsWasm(), legalDocs()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
