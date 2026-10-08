const { chromium } = require('playwright-core');
const http = require('http'); const fs = require('fs'); const path = require('path');
const OUT = path.resolve('out');
const cartHtml = fs.readFileSync(path.join(OUT, 'cart.html'), 'utf8');
const drawerSection = cartHtml.match(/<div id="shopify-section-cart-drawer"[\s\S]*?<\/cart-drawer>\s*<\/div>/)[0];
const mainCart = cartHtml.match(/<div id="shopify-section-main"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>(?=<div id="shopify-section-featured")/);
const requests = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (url.pathname === '/cart/add.js') { requests.push(['add', body.length]); res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ id: 1, quantity: 1, sections: { 'cart-drawer': drawerSection } })); }
    if (url.pathname === '/cart.js') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ item_count: 3 })); }
    if (url.pathname === '/cart/change.js') { requests.push(['change', body]); res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ item_count: 4, items: [{ key: 'k0', quantity: 2 }], sections: { 'cart-drawer': drawerSection } })); }
    if (url.pathname === '/cart/update.js') { requests.push(['update', body]); res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{}'); }
    if (url.pathname === '/search/suggest') { requests.push(['suggest', url.search]); res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<div class="predictive__results" data-results-count="1"><div class="predictive__group"><ul role="listbox" class="predictive__queries"><li role="option"><a href="#">neck massager</a></li></ul></div></div>'); }
    let p = url.pathname; if (p === '/') p = '/index.html';
    if (p.startsWith('/products/')) p = '/product.html';
    const f = path.join(OUT, p);
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' }[path.extname(f)] });
    fs.createReadStream(f).pipe(res);
  });
}).listen(8770);

const results = [];
const check = (name, ok, extra = '') => { results.push((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  /* Product page */
  await page.goto('http://localhost:8770/product.html');
  await page.waitForTimeout(400);
  check('sticky bar hidden at top', !(await page.$eval('[data-sticky-buy]', (e) => e.classList.contains('is-visible'))));
  await page.click('label[for$="-1-1"]'); // Ivory
  await page.waitForTimeout(500);
  check('variant id updated', (await page.$eval('[data-variant-id]', (e) => e.value)) === '1001');
  check('URL updated with variant', page.url().includes('variant=1001'), page.url());
  check('legend shows selected value', (await page.$eval('[data-selected-value="0"]', (e) => e.textContent)) === 'Ivory');
  check('unavailable option marked', await page.$eval('input[value="Midnight"]', (e) => e.classList.contains('is-unavailable')));
  await page.click('label[for$="-1-2"]'); // Midnight (sold out)
  await page.waitForTimeout(400);
  check('sold-out variant disables id input', await page.$eval('[data-variant-id]', (e) => e.disabled));
  await page.click('label[for$="-1-0"]'); // back to Sage
  await page.waitForTimeout(400);
  await page.click('quantity-input button[name="plus"]');
  check('quantity plus works', (await page.$eval('input[name="quantity"]', (e) => e.value)) === '2');

  await page.click('.pdp__add');
  await page.waitForSelector('#CartDrawer.is-active', { timeout: 3000 }).catch(() => {});
  check('add to cart opens drawer', await page.$eval('#CartDrawer', (e) => e.open && e.classList.contains('is-active')));
  check('drawer shows line items', (await page.$$('#CartDrawer .line')).length === 2);
  check('cart count bubble updated', (await page.$eval('[data-cart-count]', (e) => e.textContent.trim())) === '3');
  check('add request sent', requests.some((r) => r[0] === 'add'));
  await page.click('#CartDrawer .line quantity-input button[name="plus"]');
  await page.waitForTimeout(800);
  const change = requests.find((r) => r[0] === 'change');
  check('qty change posts line + quantity', !!change && /"line":1/.test(change[1]) && /"quantity":2/.test(change[1]), change && change[1].slice(0, 60));
  check('count bubble reflects change', (await page.$eval('[data-cart-count]', (e) => e.textContent.trim())) === '4');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  check('Escape closes cart drawer', !(await page.$eval('#CartDrawer', (e) => e.open)));

  await page.evaluate(() => window.scrollTo({ top: 1600, behavior: 'instant' }));
  await page.waitForTimeout(500);
  check('sticky bar visible after scrolling past buy box', await page.$eval('[data-sticky-buy]', (e) => e.classList.contains('is-visible')));

  /* Home page */
  await page.goto('http://localhost:8770/index.html');
  await page.waitForTimeout(400);
  await page.click('[data-menu-open]');
  await page.waitForTimeout(500);
  check('mobile menu opens', await page.$eval('#MenuDrawer', (e) => e.open));
  check('menu button aria-expanded', (await page.$eval('[data-menu-open]', (e) => e.getAttribute('aria-expanded'))) === 'true');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  check('mobile menu closes on Escape', !(await page.$eval('#MenuDrawer', (e) => e.open)));
  check('focus returns to menu button', await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-menu-open')));

  await page.click('[data-search-open]');
  await page.waitForTimeout(300);
  check('search modal opens', await page.$eval('#SearchModal', (e) => e.open));
  await page.fill('#SearchModalInput', 'neck');
  await page.waitForTimeout(800);
  check('predictive search renders results', (await page.$$('#PredictiveResults .predictive__results')).length === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('search modal closes on Escape', !(await page.$eval('#SearchModal', (e) => e.open)));

  const nl = await page.$('.newsletter form[data-newsletter]');
  await nl.$eval('input[type="email"]', (e) => { e.scrollIntoView(); });
  await nl.$eval('input[type="email"]', (e) => (e.value = 'not-an-email'));
  await nl.$eval('button[type="submit"]', (b) => b.click());
  await page.waitForTimeout(200);
  check('newsletter rejects invalid email', (await nl.$eval('.newsletter-form__msg', (e) => e.classList.contains('is-error'))) && (await nl.$eval('input[type="email"]', (e) => e.getAttribute('aria-invalid'))) === 'true');

  await page.$eval('[data-hotspot]', (e) => e.scrollIntoView());
  await page.click('[data-hotspot]');
  check('hotspot toggles card', await page.$eval('[data-hotspot]', (b) => b.getAttribute('aria-expanded') === 'true' && !document.getElementById(b.getAttribute('aria-controls')).hidden));

  const faq = await page.$('.faq details');
  await faq.$eval('summary', (s) => s.click());
  check('FAQ accordion opens', await faq.evaluate((d) => d.open));

  /* Collection */
  await page.goto('http://localhost:8770/collection.html');
  await page.waitForTimeout(300);
  await page.click('[data-facet-toggle]');
  await page.waitForTimeout(400);
  check('filter drawer opens', await page.$eval('facet-filters', (e) => e.classList.contains('is-open')));
  await page.keyboard.press('Escape');
  check('filter drawer closes on Escape', !(await page.$eval('facet-filters', (e) => e.classList.contains('is-open'))));

  /* Keyboard: skip link */
  await page.goto('http://localhost:8770/index.html');
  await page.keyboard.press('Tab');
  check('first Tab focuses skip link', await page.evaluate(() => document.activeElement.classList.contains('skip-link')));

  check('no JS runtime errors', errors.length === 0, errors.join(' | '));
  console.log(results.join('\n'));
  console.log(results.filter((r) => r.startsWith('PASS')).length + '/' + results.length + ' passed');
  await browser.close(); server.close();
})();
