// Generates demos/<slug>/index.html for all 10 Little Linden hero demos from one
// accessible template. Run: node tools/make-pages.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMOS } from '../shared/demos.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ICON = {
  bottle: '<path d="M40 22h20M42 22v8c-6 3-8 8-8 14v34a8 8 0 0 0 8 8h16a8 8 0 0 0 8-8V44c0-6-2-11-8-14v-8"/><path d="M46 22c0-6 2-10 4-10s4 4 4 10"/><path d="M34 54h12M34 66h8"/>',
  rattle: '<circle cx="50" cy="34" r="18"/><path d="M50 52v26"/><circle cx="50" cy="84" r="6"/>',
  moon: '<path d="M64 22a28 28 0 1 0 14 40 24 24 0 0 1-14-40z"/>',
  cloud: '<path d="M30 70h42a14 14 0 0 0 0-28 18 18 0 0 0-34-4 14 14 0 0 0-8 32z"/>',
  blocks: '<rect x="22" y="52" width="26" height="26" rx="5"/><rect x="52" y="52" width="26" height="26" rx="5"/><rect x="37" y="24" width="26" height="26" rx="5"/>',
  swaddle: '<rect x="20" y="58" width="60" height="18" rx="6"/><path d="M26 58c0-10 6-16 24-16s24 6 24 16"/><path d="M38 58v18M50 58v18M62 58v18"/>',
  teether: '<circle cx="50" cy="50" r="24"/><circle cx="50" cy="26" r="6"/><circle cx="71" cy="38" r="6"/><circle cx="29" cy="38" r="6"/>',
  stacker: '<path d="M30 80h40"/><path d="M50 80V26"/><ellipse cx="50" cy="72" rx="18" ry="5"/><ellipse cx="50" cy="60" rx="15" ry="5"/><ellipse cx="50" cy="48" rx="12" ry="4"/><circle cx="50" cy="26" r="5"/>',
  gift: '<rect x="24" y="42" width="52" height="36" rx="4"/><path d="M20 34h60v10H20zM50 34v44"/><path d="M50 34c-4-10-16-12-16-4s16 4 16 4zM50 34c4-10 16-12 16-4s-16 4-16 4z"/>'
};
const SMALL = {
  ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
  gift: '<rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M3 7h18v3H3zM12 7v13"/><path d="M12 7c-1.5-3-5-3.5-5-1.2S12 7 12 7zM12 7c1.5-3 5-3.5 5-1.2S12 7 12 7z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'
};

const PAGES = {
  '01-soft-organic': { theme: '', eyebrow: 'New arrivals · Nursery', title: 'Gentle essentials for <em>new beginnings.</em>', lede: 'Thoughtfully chosen pieces for feeding, sleep and play — designed to feel calm in your home.', cards: [['Play', 'Ring Stacker', 'stacker']] },
  '02-floating-gallery': { theme: '', eyebrow: 'The nursery edit', title: 'Everything in its <em>softest place.</em>', lede: 'Swaddles, storage and small comforts, curated for the first year and beyond.', cards: [['Baby essentials', 'Muslin Swaddle', 'swaddle']], galleryConfig: true },
  '03-liquid-silk': { theme: 'theme-blush', eyebrow: 'Soft textiles', title: 'Wrapped in <em>everyday comfort.</em>', lede: 'Breathable cotton and muslin layers with a quiet, timeless palette.', cards: [['Baby essentials', 'Muslin Swaddle', 'swaddle']] },
  '04-particle-atmosphere': { theme: 'theme-dusk', eyebrow: 'Evening routines', title: 'Calm evenings, <em>softly lit.</em>', lede: 'Night lights, sound machines and nursery details for a peaceful wind-down.', cards: [['Sleep & nursery', 'Cloud Night Light', 'cloud']] },
  '05-glass-light': { theme: '', eyebrow: 'Feeding & nursing', title: 'Made for the <em>little moments.</em>', lede: 'Bottles, bibs and nursing accessories that keep feeding time simple.', cards: [['Feeding', 'Feeding Bottle', 'bottle']] },
  '06-product-spotlight': { theme: 'theme-sage', eyebrow: 'Featured', title: 'Small hands, <em>big discoveries.</em>', lede: 'Age-appropriate toys in natural wood and soft silicone — always check the age guidance on each product.', cards: [['Toys & learning', 'Wooden Rattle', 'rattle'], ['Teething', 'Wooden Teether', 'teether', 'secondary'], ['Play', 'Soft Blocks', 'blocks', 'secondary']] },
  '07-depth-grid': { theme: '', eyebrow: 'Shop by room', title: 'A nursery with <em>room to grow.</em>', lede: 'Storage, decor and organizers that keep every corner calm and considered.', cards: [['Sleep & nursery', 'Moon Night Light', 'moon']] },
  '08-kinetic-type': { theme: 'theme-blush', eyebrow: 'For mom, too', title: 'Made for <em data-kinetic="every stage.|first hellos.|slow mornings.|new routines.">every stage.</em>', lede: 'From hospital bag to first birthday — practical comforts for mom and baby.', cards: [['Gifts & bundles', 'New Mom Gift Box', 'gift']] },
  '09-soft-carousel': { theme: '', eyebrow: 'Shop the collections', title: 'Find what you need, <em>faster.</em>', lede: 'Swipe, drag or use the arrows to explore our core collections.', cards: [['Collection', 'Feeding & Nursing', 'bottle']], carousel: true },
  '10-living-editorial': { theme: 'theme-sage', eyebrow: 'The Little Linden home', title: 'Thoughtful pieces, <em>lovingly kept.</em>', lede: 'A considered collection for nurseries that grow with your family. Scroll to step inside.', cards: [['Nursery decor', 'Cloud Night Light', 'cloud']] }
};

const card = ([kicker, name, icon, cls = ''], i) => `
          <div data-reveal class="${cls}">
            <a class="foil-card" href="#" data-card>
              <span class="foil-card__media" aria-hidden="true">
                <span class="foil-card__tag">Demo</span>
                <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICON[icon]}</svg>
              </span>
              <span class="foil-card__row">
                <span>
                  <span class="foil-card__kicker" data-card-kicker>${kicker}</span>
                  <span class="foil-card__name" data-card-name>${name}</span>
                  <span class="foil-card__price">Demo product · price from Shopify</span>
                </span>
                <span class="foil-card__go" aria-hidden="true">↗</span>
              </span>
            </a>
          </div>`;

const chip = (icon, html, attrs = '') => `<li class="ll-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-draw>${SMALL[icon]}</svg><span ${attrs}>${html}</span></li>`;

const tpl = (d, p, i) => `<!doctype html>
<html lang="en" class="${p.theme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${String(i + 1).padStart(2, '0')} ${d.name} — Little Linden hero lab (demo)</title>
  <meta name="description" content="Hero prototype: ${d.technique}. Demo content.">
  <meta name="robots" content="noindex">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap">
  <link rel="stylesheet" href="../../shared/lab.css">
  <script type="importmap">
    { "imports": { "three": "../../vendor/three/three.module.min.js", "three/addons/": "../../vendor/three/addons/", "gsap": "../../vendor/gsap/index.js" } }
  </script>
</head>
<body>
  <header class="ll-header">
    <a href="#" class="ll-logo" aria-label="Little Linden — home">Little <i>Linden</i></a>
    <nav class="ll-nav" aria-label="Primary">
      <a href="#">Baby</a><a href="#">Feeding</a><a href="#">Sleep &amp; Nursery</a><a href="#">Mom Care</a><a href="#">Gifts</a><a href="#">Guides</a>
    </nav>
    <div class="ll-icons">
      <a href="#" class="ll-icon-btn" aria-label="Search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></svg></a>
      <a href="#" class="ll-icon-btn" aria-label="Cart, 0 items"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 8h14l-1.2 11a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg><span class="count" aria-hidden="true">0</span></a>
    </div>
  </header>

  <main>
    <section class="ll-hero${p.carousel ? ' is-interactive' : ''}" aria-labelledby="hero-title" data-demo="${d.slug}">
      <canvas class="ll-hero__canvas" aria-hidden="true"></canvas>
      <div class="ll-hero__fallback" aria-hidden="true"></div>
      <div class="ll-hero__grain" aria-hidden="true"></div>
      <div class="ll-hero__veil" aria-hidden="true"></div>
      <p class="demo-flag">Demo content &amp; props</p>

      <div class="ll-hero__grid">
        <div class="ll-hero__copy">
          <p class="ll-eyebrow" data-reveal>${p.eyebrow}</p>
          <h1 id="hero-title" class="ll-title" data-reveal>${p.title}</h1>
          <p class="ll-lede" data-reveal>${p.lede}</p>
          <div class="ll-ctas" data-reveal>
            <a class="ll-btn ll-btn--primary" href="#">Shop best sellers <span aria-hidden="true">→</span></a>
            ${p.carousel
              ? '<button type="button" class="ll-btn ll-btn--ghost" data-carousel-prev aria-label="Previous collection">←</button><button type="button" class="ll-btn ll-btn--ghost" data-carousel-next aria-label="Next collection">→</button>'
              : '<a class="ll-btn ll-btn--ghost" href="#">Shop by age &amp; stage</a>'}
          </div>
          <ul class="ll-trust" data-reveal aria-label="Shopping highlights">
            ${chip('ruler', 'Shop by <b>age &amp; stage</b>')}
            ${chip('gift', '<b>Gift-ready</b> bundles')}
            ${chip('grid', '<b data-count-to="8">8</b> categories to explore')}
          </ul>
          ${p.carousel ? '<p class="visually-hidden" aria-live="polite" data-carousel-status></p>' : ''}
        </div>
        <div class="ll-hero__side" data-depth="0.5">${p.cards.map(card).join('')}
        </div>
      </div>
    </section>
    <section class="demo-next" aria-label="Next section placeholder"><p>Next homepage section · scroll back up to see parallax</p></section>
  </main>

  ${p.galleryConfig ? `<!-- Configurable imagery: add up to 7 entries, e.g. [{"src":"../../assets/photo-1.jpg","alt":"Muslin swaddle on linen"}].
       Empty list = labelled placeholders. In Shopify these come from section image_picker blocks. -->
  <script type="application/json" id="gallery-config">[]</script>` : ''}
  <noscript><style>[data-reveal]{opacity:1!important}</style></noscript>
  <script type="module" src="./main.js"></script>
</body>
</html>
`;

// Keep the lab self-contained: copy the design tokens next to lab.css
fs.copyFileSync(path.join(root, '../design-system/tokens.css'), path.join(root, 'shared/tokens.css'));

DEMOS.forEach((d, i) => {
  const dir = path.join(root, 'demos', d.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), tpl(d, PAGES[d.slug], i));
});
console.log('generated', DEMOS.length, 'pages');
