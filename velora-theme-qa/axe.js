const { chromium } = require('playwright-core');
const http = require('http'); const fs = require('fs'); const path = require('path');
const OUT = path.resolve('out');
const server = http.createServer((req, res) => { let p = req.url.split('?')[0]; const f = path.join(OUT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': {'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'}[path.extname(f)]}); fs.createReadStream(f).pipe(res); }).listen(8771);
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const name of ['index', 'product', 'collection', 'cart', '404']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.goto(`http://localhost:8771/${name}.html`);
    await p.waitForTimeout(600);
    await p.addScriptTag({ content: axeSrc });
    const r = await p.evaluate(async () => { const res = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }); return res.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]) })); });
    console.log('==', name, r.length ? '' : 'no violations');
    r.forEach(v => console.log(' ', v.impact, v.id, 'x' + v.n, '\n    ' + v.ex.join('\n    ')));
    await p.close();
  }
  await b.close(); server.close();
})();
