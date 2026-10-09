// axe-core WCAG 2.0/2.1 A+AA audit of every demo (reduced motion, so content is static).
// Usage: AXE=/path/to/axe-core node tools/a11y.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
import { DEMOS } from '../shared/demos.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const axeSrc = fs.readFileSync(require.resolve((process.env.AXE || 'axe-core') + '/axe.min.js'), 'utf8');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(0);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
let total = 0;
for (const d of [...DEMOS.map((x) => `demos/${x.slug}/`), '']) {
  const p = await b.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await p.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await p.goto(`http://localhost:${server.address().port}/${d}`);
  await p.waitForTimeout(1200);
  await p.addScriptTag({ content: axeSrc });
  const v = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.map((x) => `${x.impact} ${x.id} ×${x.nodes.length}: ${x.nodes[0].target.join(' ')} — ${(x.nodes[0].failureSummary || '').split('\n')[1] || ''}`));
  total += v.length;
  console.log(`${v.length ? 'FAIL' : 'PASS'} ${d || 'gallery'}${v.length ? '\n   ' + v.join('\n   ') : ''}`);
  await p.close();
}
await b.close(); server.close();
console.log(total ? `${total} violation group(s)` : 'no WCAG A/AA violations');
