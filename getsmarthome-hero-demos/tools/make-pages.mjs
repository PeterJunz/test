// Generates demos/<slug>/index.html from one template so all 10 demos share
// identical, accessible markup. Run: node tools/make-pages.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMOS } from '../shared/demos.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ICONS = {
  lamp: '<path d="M38 18h24l12 30H26z"/><path d="M50 48v34M36 86h28"/>',
  vase: '<path d="M42 16h16M44 16c0 12-14 18-14 38s10 30 20 30 20-10 20-30-14-26-14-38"/>',
  speaker: '<rect x="30" y="16" width="40" height="70" rx="14"/><circle cx="50" cy="56" r="12"/><path d="M42 28h16"/>',
  candle: '<rect x="30" y="34" width="40" height="50" rx="8"/><path d="M50 34v-8"/><path d="M50 26c-5-6 0-12 0-12s5 6 0 12z"/>',
  mug: '<path d="M26 34h40v30a16 16 0 0 1-16 16h-8a16 16 0 0 1-16-16z"/><path d="M66 42h6a8 8 0 0 1 0 16h-6"/><path d="M40 18c0 6 6 6 6 12M52 18c0 6 6 6 6 12"/>',
  diffuser: '<path d="M28 84h44l-4-12H32z"/><path d="M32 72c0-22 8-40 18-40s18 18 18 40"/><path d="M46 22c-4-4 0-8 4-10M54 24c4-4 0-8-4-12"/>',
  spark: '<path d="M50 14c3 20 10 27 30 30-20 3-27 10-30 30-3-20-10-27-30-30 20-3 27-10 30-30z"/>',
  sculpture: '<circle cx="50" cy="44" r="22"/><path d="M38 84h24M50 66v18"/>'
};

const PAGES = {
  '01-golden-hour': { theme: '', eyebrow: 'New season · Living room', title: 'Light that feels like <em>home.</em>', lede: 'Warm lighting, tactile ceramics and quiet smart tech — curated for slow evenings in.', kicker: 'Lighting', product: 'Arc Table Lamp', icon: 'lamp' },
  '02-silk-flow': { theme: '', eyebrow: 'The comfort edit', title: 'Soft textures, softer <em>mornings.</em>', lede: 'Layered linens, glazed ceramics and gentle tones that make every room feel lived in.', kicker: 'Décor', product: 'Ceramic Vase', icon: 'vase' },
  '03-particle-morph': { theme: 'theme-dark', eyebrow: 'Smart living', title: 'Everyday objects, <em>reimagined.</em>', lede: 'Thoughtful design for the things you touch every day — from sound to scent to light.', kicker: 'Audio', product: 'Smart Speaker', icon: 'spark' },
  '04-glass-refraction': { theme: '', eyebrow: 'Evening rituals', title: 'Clear glass, <em>warm glow.</em>', lede: 'Hand-poured candles and glassware that catch the light and hold the mood.', kicker: 'Home fragrance', product: 'Amber Candle', icon: 'candle' },
  '05-liquid-brass': { theme: 'theme-dark', eyebrow: 'Objects of desire', title: 'Sculpted in <em>brass &amp; light.</em>', lede: 'Statement décor with a molten, hand-finished feel — made to be noticed.', kicker: 'Décor', product: 'Brass Sculpture', icon: 'sculpture' },
  '06-paper-arches': { theme: '', eyebrow: 'Room by room', title: 'Every room, a <em>quiet arch.</em>', lede: 'Calm silhouettes, natural materials and pieces that frame the way you live.', kicker: 'Décor', product: 'Ceramic Vase', icon: 'vase' },
  '07-window-light': { theme: '', eyebrow: 'Kitchen & table', title: 'Slow light. <em>Slow living.</em>', lede: 'Stoneware, wood and warm details for unhurried mornings at home.', kicker: 'Kitchen', product: 'Stoneware Mug', icon: 'mug' },
  '08-turntable': { theme: '', eyebrow: 'Best of the season', title: 'Made for the <em>way you live.</em>', lede: 'A rotating edit of our most-loved pieces for living, dining and unwinding.', kicker: 'Featured', product: 'Arc Table Lamp', icon: 'lamp' },
  '09-ripple-glaze': { theme: '', eyebrow: 'Studio ceramics', title: 'Glazed, poured, <em>perfected.</em>', lede: 'Glossy finishes and organic forms — move your cursor to ripple the glaze.', kicker: 'Ceramics', product: 'Glazed Vase', icon: 'vase' },
  '10-wood-mosaic': { theme: 'theme-dark', eyebrow: 'Natural materials', title: 'Crafted from <em>warm materials.</em>', lede: 'Walnut, linen and brass, brought together in pieces made to last.', kicker: 'Wellness', product: 'Aroma Diffuser', icon: 'diffuser' }
};

const tpl = (d, p, i) => `<!doctype html>
<html lang="en" class="${p.theme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${d.name} — GetSmartHome 3D hero demo ${String(i + 1).padStart(2, '0')}</title>
  <meta name="description" content="Prototype hero banner: ${d.technique}.">
  <meta name="robots" content="noindex">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=Inter:wght@400;500&display=swap">
  <link rel="stylesheet" href="../../shared/hero.css">
  <script type="importmap">
    { "imports": { "three": "../../vendor/three/three.module.min.js", "three/addons/": "../../vendor/three/addons/", "gsap": "../../vendor/gsap/index.js" } }
  </script>
</head>
<body>
  <header class="gsh-header">
    <a href="#" class="gsh-logo" aria-label="GetSmartHome home">getsmart<span>home</span></a>
    <nav class="gsh-nav" aria-label="Primary">
      <a href="#">Living</a><a href="#">Kitchen</a><a href="#">Lighting</a><a href="#">Wellness</a><a href="#">Journal</a>
    </nav>
    <div class="gsh-icons">
      <a href="#" class="gsh-icon" aria-label="Search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></svg></a>
      <a href="#" class="gsh-icon" aria-label="Cart"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 7h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg></a>
    </div>
  </header>

  <main>
    <section class="gsh-hero" aria-labelledby="hero-title" data-demo="${d.slug}">
      <canvas class="gsh-hero__canvas" aria-hidden="true"></canvas>
      <div class="gsh-hero__fallback" aria-hidden="true"></div>
      <div class="gsh-hero__grain" aria-hidden="true"></div>
      <div class="gsh-hero__vignette" aria-hidden="true"></div>

      <div class="gsh-hero__grid">
        <div class="gsh-hero__copy" data-depth="0.25">
          <p class="gsh-eyebrow" data-reveal>${p.eyebrow}</p>
          <h1 id="hero-title" class="gsh-title" data-reveal>${p.title}</h1>
          <p class="gsh-lede" data-reveal>${p.lede}</p>
          <div class="gsh-ctas" data-reveal>
            <a class="gsh-btn gsh-btn--primary" href="#">Shop the collection <span aria-hidden="true">→</span></a>
            <a class="gsh-btn gsh-btn--ghost" href="#">Explore rooms</a>
          </div>
        </div>
        <div class="gsh-hero__side" data-depth="0.6">
          <div data-reveal>
            <a class="foil-card" href="#" data-card>
              <span class="foil-card__media" aria-hidden="true">
                <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[p.icon]}</svg>
              </span>
              <span class="foil-card__row">
                <span>
                  <span class="foil-card__kicker" data-card-kicker>${p.kicker}</span>
                  <span class="foil-card__name" data-card-name style="display:block">${p.product}</span>
                </span>
                <span class="foil-card__go" aria-hidden="true">↗</span>
              </span>
            </a>
          </div>
        </div>
      </div>
      <div class="gsh-cue" aria-hidden="true"><i></i>Scroll</div>
    </section>

    <section class="demo-next" aria-label="Next section placeholder">
      <p>Next homepage section · scroll back up to see the parallax</p>
    </section>
  </main>

  <noscript><style>[data-reveal]{opacity:1!important}</style></noscript>
  <script type="module" src="./main.js"></script>
</body>
</html>
`;

DEMOS.forEach((d, i) => {
  const dir = path.join(root, 'demos', d.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), tpl(d, PAGES[d.slug], i));
});
console.log('generated', DEMOS.length, 'pages');
