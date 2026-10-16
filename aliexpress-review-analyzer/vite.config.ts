import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Content-Security-Policy for production builds. Review images/videos are loaded
 * from arbitrary https hosts (CDNs), but scripts only from our own origin.
 * Not applied in dev because Vite's HMR preamble relies on inline scripts.
 */
const CSP = [
  "default-src 'self'",
  "img-src 'self' https: data: blob:",
  "media-src 'self' https: blob:",
  "connect-src 'self' http://localhost:* http://127.0.0.1:* https:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

/**
 * `--mode standalone` produces ONE self-contained HTML file (scripts, styles and the
 * lazily loaded XLSX/PDF libraries inlined) that opens by double-click, no server needed.
 * The CSP meta is left out there because every script is inline by design.
 */
export default defineConfig(({ mode }) => ({
  plugins: mode === 'standalone' ? [react(), tailwindcss(), viteSingleFile()] : [react(), tailwindcss(), cspPlugin()],
  base: mode === 'standalone' ? './' : '/',
  server: { port: 5173 },
  build: mode === 'standalone' ? { outDir: 'release', emptyOutDir: false, chunkSizeWarningLimit: 6000 } : { chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
}));
