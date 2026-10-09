// Interaction tests for the hero lab (Playwright, headless Chromium).
// Usage: CHROMIUM=/path/to/chrome node tools/interact.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const errors = [];
const open = async (slug, opts = {}) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, ...opts });
  page.on('pageerror', (e) => errors.push(`${slug}: ${e.message}`));
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.goto(`${base}/demos/${slug}/`);
  await page.waitForFunction(() => window.__hero && [...document.querySelectorAll('[data-reveal]')].every((e) => getComputedStyle(e).opacity === '1'), null, { timeout: 40000 });
  return page;
};

// Carousel
let page = await open('09-soft-carousel');
const name = () => page.$eval('[data-card-name]', (e) => e.textContent.trim());
check('carousel starts on first collection', (await name()) === 'Feeding & Nursing');
await page.click('[data-carousel-next]');
await page.waitForTimeout(700);
check('next button advances', (await name()) === 'Sleep & Nursery', await name());
check('live region announces', (await page.$eval('[data-carousel-status]', (e) => e.textContent)).includes('2 of 8'));
await page.click('[data-carousel-prev]');
await page.waitForTimeout(700);
check('prev button goes back', (await name()) === 'Feeding & Nursing');
await page.focus('[data-carousel-next]');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(700);
check('ArrowRight key advances', (await name()) === 'Sleep & Nursery', await name());
const box = await page.$eval('.ll-hero__canvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.x + r.width * 0.75, y: r.y + r.height * 0.25 }; });
await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.mouse.move(box.x - 160, box.y, { steps: 6 }); await page.mouse.up();
await page.waitForTimeout(700);
check('drag/swipe left advances', (await name()) === 'Baby Essentials', await name());
await page.close();

// Kinetic typography
page = await open('08-kinetic-type');
const label = await page.$eval('.ll-title', (e) => e.getAttribute('aria-label'));
check('heading keeps a stable accessible name', /Made for\s+every stage\./.test(label || ''), label);
const first = await page.$eval('.kin-line', (e) => e.textContent);
await page.mouse.move(5, 5);
await page.waitForTimeout(4600);
const second = await page.$eval('.kin-line', (e) => e.textContent);
check('phrase cycles over time', first !== second, `${first} → ${second}`);
check('animated phrase hidden from AT', (await page.$eval('[data-kinetic]', (e) => e.getAttribute('aria-hidden'))) === 'true');
await page.close();

// Foil card + cleanup
page = await open('01-soft-organic');
const card = await page.$('.foil-card');
const cb = await card.boundingBox();
await page.mouse.move(cb.x + cb.width * 0.8, cb.y + cb.height * 0.2);
await page.waitForTimeout(900);
const vars = await card.evaluate((e) => ({ ry: e.style.getPropertyValue('--ry'), px: e.style.getPropertyValue('--px') }));
check('card tilts toward the cursor', parseFloat(vars.ry) > 2, JSON.stringify(vars));
check('spotlight follows the cursor', parseFloat(vars.px) > 60, vars.px);
const disposed = await page.evaluate(() => {
  const h = window.__hero; const r = h.renderer;
  h.destroy();
  return { programs: r.info.programs ? r.info.programs.length : 0, geometries: r.info.memory.geometries, hero: window.__hero };
});
check('pagehide cleanup frees GPU memory', disposed.geometries === 0 && disposed.hero === null, JSON.stringify(disposed));
await page.close();

// Reduced motion: kinetic phrase must not rotate
page = await open('08-kinetic-type', { reducedMotion: 'reduce' });
const r1 = await page.$eval('.kin-line', (e) => e.textContent);
await page.waitForTimeout(4200);
check('reduced motion: no phrase rotation', r1 === (await page.$eval('.kin-line', (e) => e.textContent)));
await page.close();

check('no JS runtime errors', errors.length === 0, errors.join(' | '));
console.log(results.join('\n'));
console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
await browser.close();
server.close();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
