// Builds Shopify-ready assets from the demos:
//   shopify/assets/gsh-hero-01.js … gsh-hero-10.js  (one self-contained IIFE per demo:
//                                                    demo code + shared runtime + Three.js + GSAP)
//   shopify/assets/gsh-hero.css                      (hero styles scoped to .gsh-hero, no global resets)
//
// Usage:  npm install            (installs three, gsap, esbuild)
//         node tools/build-shopify.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { DEMOS } from '../shared/demos.js';

const require = createRequire(import.meta.url);
const esbuild = require(process.env.ESBUILD || 'esbuild');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'shopify/assets');
fs.mkdirSync(outDir, { recursive: true });
const nodePaths = (process.env.NODE_PATH || path.join(root, 'node_modules')).split(path.delimiter);

for (const [i, d] of DEMOS.entries()) {
  const n = String(i + 1).padStart(2, '0');
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'demos', d.slug, 'main.js')],
    bundle: true,
    format: 'iife',
    minify: true,
    target: ['es2020', 'safari15'],
    legalComments: 'eof',
    nodePaths,
    outfile: path.join(outDir, `gsh-hero-${n}.js`),
    metafile: true,
    logLevel: 'warning'
  });
  const bytes = Object.values(result.metafile.outputs)[0].bytes;
  console.log(`gsh-hero-${n}.js  ${(bytes / 1024).toFixed(0)} KB  (${d.name})`);
}

// Scoped CSS: drop demo-only blocks, move tokens from :root onto the section.
let css = fs.readFileSync(path.join(root, 'shared/hero.css'), 'utf8');
css = css.replace(/\/\* @shopify-skip-start \*\/[\s\S]*?\/\* @shopify-skip-end \*\//g, '');
css = css.replace(':root {', '.gsh-hero {');
css = css.replace('.theme-dark {', '.gsh-hero.theme-dark {');
css += `
/* ---------- Shopify section additions ---------- */
.gsh-hero { background: var(--bg); color: var(--fg); font-family: var(--font-body); line-height: 1.55; -webkit-font-smoothing: antialiased; }
.gsh-hero *, .gsh-hero *::before, .gsh-hero *::after { box-sizing: border-box; }
.gsh-hero a { color: inherit; text-decoration: none; }
.gsh-hero--with-header-offset { padding-top: calc(var(--gsh-header-offset, 0px) + 48px); }
.gsh-hero .foil-card__media img { width: 100%; height: 100%; object-fit: cover; }
`;
fs.writeFileSync(path.join(outDir, 'gsh-hero.css'), css);
console.log('gsh-hero.css', (css.length / 1024).toFixed(1), 'KB');
