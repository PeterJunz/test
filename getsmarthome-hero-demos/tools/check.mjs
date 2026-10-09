// Headless QA: serves the demos, opens each one at desktop + mobile sizes,
// records console/page errors, measures FPS over 2s, checks horizontal overflow,
// simulates pointer movement (tilt/spotlight) and saves screenshots to docs/screens.
//
// Usage:  npm i -D playwright-core   (Chromium must be installed)
//         CHROMIUM=/path/to/chrome node tools/check.mjs [slug ...]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { DEMOS } from '../shared/demos.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs/screens');
fs.mkdirSync(out, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;

const MODE = process.env.MODE || 'normal';   // normal | reduced | nowebgl
const only = process.argv.slice(2);
const list = only.length ? DEMOS.filter((d) => only.some((o) => d.slug.startsWith(o))) : DEMOS;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: MODE === 'nowebgl' ? ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
});

let failures = 0;
for (const d of list) {
  for (const [label, w, h, touch] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1, reducedMotion: MODE === 'reduced' ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('requestfailed', (r) => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errors.push('requestfailed: ' + r.url()); });
    page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ': ' + r.url()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(`http://localhost:${port}/demos/${d.slug}/`, { waitUntil: 'load' });
    if (!touch) {
      for (let i = 0; i <= 20; i++) { await page.mouse.move(w * (0.3 + i * 0.025), h * (0.35 + Math.sin(i / 3) * 0.1)); await page.waitForTimeout(40); }
    }
    // Software GL is slow; wait (max 40s) for the GSAP intro to finish before judging.
    await page.waitForFunction(() => [...document.querySelectorAll('[data-reveal]')].every((e) => getComputedStyle(e).opacity === '1'), null, { timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const stats = await page.evaluate(async () => {
      const hero = window.__hero;
      let frames = 0;
      const t0 = performance.now();
      await new Promise((r) => { const f = () => { frames++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
      return {
        webgl: !!(hero && hero.renderer),
        fallback: document.querySelector('.gsh-hero').classList.contains('no-webgl'),
        fps: Math.round(frames / ((performance.now() - t0) / 1000)),
        calls: hero && hero.renderer ? hero.renderer.info.render.calls : 0,
        tris: hero && hero.renderer ? hero.renderer.info.render.triangles : 0,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        revealed: [...document.querySelectorAll('[data-reveal]')].every((e) => getComputedStyle(e).opacity === '1')
      };
    });
    if (MODE === 'normal') await page.screenshot({ path: path.join(out, `${d.slug}-${label}.jpg`), type: 'jpeg', quality: 84 });
    const webglOk = MODE === 'nowebgl' ? (!stats.webgl && stats.fallback) : (stats.webgl && !stats.fallback);
    const ok = webglOk && !errors.length && !stats.overflow && stats.revealed;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'} [${MODE}] ${d.slug} ${label} webgl=${stats.webgl} fps≈${stats.fps} (software GL) calls=${stats.calls} tris=${stats.tris} overflow=${stats.overflow} revealed=${stats.revealed}${errors.length ? '\n   ' + errors.join('\n   ') : ''}`);
    await ctx.close();
  }
}
await browser.close();
server.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
