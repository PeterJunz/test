const { chromium } = require('playwright-core');
const http = require('http'); const fs = require('fs'); const path = require('path');
const root = path.resolve('out');
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  const ext = path.extname(f);
  res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' }[ext] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(8765);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pages = (process.argv[2] || 'index,product,collection,cart,404').split(',');
  const sizes = [['desktop', 1440, 900], ['tablet', 820, 1180], ['mobile', 390, 844], ['small', 320, 640]];
  fs.mkdirSync('shots', { recursive: true });
  for (const name of pages) for (const [label, w, h] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: label !== 'desktop' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(`http://localhost:8765/${name}.html`, { waitUntil: 'networkidle' });
    // Reveal everything for full-page screenshot
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 90)); } window.scrollTo({ top: 0, behavior: 'instant' }); });
    await page.waitForTimeout(1600);
    const overflow = await page.evaluate(() => {
      const W = document.documentElement.clientWidth; const bad = [];
      document.querySelectorAll('body *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > W + 1) && getComputedStyle(el).position !== 'fixed') {
          let p = el.parentElement, clipped = false;
          while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o !== 'visible') { clipped = true; break; } p = p.parentElement; }
          if (!clipped) bad.push(el.tagName.toLowerCase() + '.' + [...el.classList].join('.') + ' right=' + Math.round(r.right));
        }
      });
      window.scrollTo({ left: 400, top: 0, behavior: 'instant' }); const sx = window.scrollX; window.scrollTo({ left: 0, top: 0, behavior: 'instant' }); return { scrollW: 'scrollX=' + sx + ' sw=' + document.documentElement.scrollWidth, W, bad: bad.slice(0, 8) };
    });
    await page.screenshot({ path: `shots/${name}-${label}.png`, fullPage: label !== 'small' });
    if (label === 'small') await page.screenshot({ path: `shots/${name}-${label}-fold.png` });
    console.log(name, label, 'scrollW', overflow.scrollW, 'W', overflow.W, overflow.bad.length ? 'OVERFLOW ' + overflow.bad.join(' | ') : 'no-overflow', errors.length ? errors.join(' || ') : '');
    await ctx.close();
  }
  await browser.close(); server.close();
})();
