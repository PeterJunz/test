import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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

export default defineConfig({
  plugins: [react(), tailwindcss(), cspPlugin()],
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
