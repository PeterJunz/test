// Checks for the scroll-driven room tour (scroll-nursery/), headless Chromium.
// Usage: CHROMIUM=/path/to/chrome [MODE=normal|reduced|nowebgl] node tools/check-scroll.mjs
// For each viewport it scrolls to every stop and verifies: camera arrived (stop
// space value), progress rail aria-current, card visible, no horizontal
// overflow, no JS/console/HTTP errors (aborted web-font requests excluded); saves a screenshot per stop; finally
// checks that pagehide cleanup frees GPU resources.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODE = process.env.MODE || 'normal';
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const args = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'];
if (MODE === 'nowebgl') args.push('--disable-webgl', '--disable-3d-apis');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args });
const outDir = path.join(root, 'docs/screens/scroll-nursery');
fs.mkdirSync(outDir, { recursive: true });

const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} [${MODE}] ${name}${extra ? ' — ' + extra : ''}`);
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844, isMobile: true, hasTouch: true } };

for (const [vp, viewport] of Object.entries(VIEWPORTS)) {
  const { isMobile, hasTouch, ...size } = viewport;
  const page = await browser.newPage({ viewport: size, isMobile, hasTouch, reducedMotion: MODE === 'reduced' ? 'reduce' : 'no-preference' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text()) && !(MODE === 'nowebgl' && /WebGL/i.test(m.text()))) errors.push(m.text()); });
  page.on('requestfailed', (r) => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errors.push('requestfailed ' + r.url()); });
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.goto(`${base}/scroll-nursery/`, { waitUntil: 'load' });
  if (MODE !== 'nowebgl') await page.waitForFunction(() => window.__tour, null, { timeout: 30000 });
  else await page.waitForTimeout(800);
  check(`${vp} fallback state correct`, (await page.evaluate(() => document.documentElement.classList.contains('no-webgl'))) === (MODE === 'nowebgl'));

  const n = await page.$$eval('[data-stop]', (s) => s.length);
  for (let i = 0; i < n; i++) {
    await page.evaluate((i) => {
      const s = document.querySelector(`[data-stop="${i}"]`);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: Math.min(max, s.getBoundingClientRect().top + window.scrollY), behavior: 'instant' });
    }, i);
    if (MODE !== 'nowebgl') {
      const arrived = await page.waitForFunction((i) => window.__tour && Math.abs(window.__tour.f - i) < 0.02, i, { timeout: 40000 }).then(() => true, () => false);
      check(`${vp} stop ${i}: camera arrives`, arrived, arrived ? '' : `f=${await page.evaluate(() => window.__tour.f.toFixed(3))}`);
    }
    await page.waitForTimeout(1200); // card reveal is scrubbed with 0.6 s smoothing
    const state = await page.evaluate((i) => {
      const cur = document.querySelector('[aria-current="step"]');
      const card = document.querySelector(`[data-stop="${i}"] .sn-reveal, [data-stop="${i}"] .sn-copy`);
      const r = card.getBoundingClientRect();
      return {
        nav: cur ? Number(cur.dataset.nav) : -1,
        opacity: Number(getComputedStyle(card).opacity),
        inView: r.top >= 0 && r.bottom <= window.innerHeight + 1,
        overflow: document.documentElement.scrollWidth > window.innerWidth
      };
    }, i);
    check(`${vp} stop ${i}: progress rail marks stop`, state.nav === i, `nav=${state.nav}`);
    check(`${vp} stop ${i}: content visible and in view`, state.opacity > 0.95 && state.inView, JSON.stringify(state));
    check(`${vp} stop ${i}: no horizontal overflow`, !state.overflow);
    await page.screenshot({ path: path.join(outDir, `${MODE}-${vp}-${i}.jpg`), type: 'jpeg', quality: 78 });
  }

  // Keyboard: rail links are focusable and jump to the section
  await page.focus('[data-nav="2"]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const top2 = await page.$eval('#air', (e) => Math.round(e.getBoundingClientRect().top));
  check(`${vp} rail link jumps to its stop`, Math.abs(top2) < 40, `top=${top2}`);

  if (MODE !== 'nowebgl') {
    const freed = await page.evaluate(() => { const r = window.__tour.renderer; window.__tour.destroy(); return { geometries: r.info.memory.geometries, textures: r.info.memory.textures, tour: window.__tour }; });
    check(`${vp} pagehide cleanup frees GPU memory`, freed.geometries === 0 && freed.textures === 0 && freed.tour === null, JSON.stringify(freed));
  }
  check(`${vp} no JS/console/HTTP errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`${results.length - failed}/${results.length} passed`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
