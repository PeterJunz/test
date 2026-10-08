// Local preview harness: renders the Shopify theme with LiquidJS and mocked
// Shopify objects so layouts can be inspected in a real browser.
// This is NOT Shopify's renderer — it is a best-effort approximation for visual QA.
const fs = require('fs');
const path = require('path');
const { Liquid, Tag, Hash } = require('liquidjs');

const THEME = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
for (const f of fs.readdirSync(path.join(THEME, 'assets'))) fs.copyFileSync(path.join(THEME, 'assets', f), path.join(OUT, 'assets', f));

const locale = JSON.parse(fs.readFileSync(path.join(THEME, 'locales/en.default.json'), 'utf8'));
const schemaOf = (file) => {
  const src = fs.readFileSync(path.join(THEME, 'sections', file + '.liquid'), 'utf8');
  const m = src.match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/);
  return m ? JSON.parse(m[1]) : { settings: [] };
};

/* ---------- mock data ---------- */
const color = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return { red: (n >> 16) & 255, green: (n >> 8) & 255, blue: n & 255, toString: () => hex, valueOf: () => hex };
};
const font = (family, fallback) => ({ family, fallback_families: fallback, weight: 400, system: false, toString: () => family });

const svgImg = (name, hue, shape) => {
  const file = `img-${name}.svg`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},25%,94%)"/><stop offset="1" stop-color="hsl(${hue},22%,78%)"/></linearGradient><radialGradient id="p" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="hsl(${hue},18%,55%)"/></radialGradient></defs><rect width="800" height="1000" fill="url(#g)"/><ellipse cx="400" cy="800" rx="230" ry="26" fill="#000" opacity=".12"/>${shape === 'gun' ? '<rect x="200" y="330" width="380" height="150" rx="75" fill="url(#p)"/><rect x="350" y="450" width="90" height="300" rx="40" fill="#2E3539"/><circle cx="620" cy="405" r="58" fill="#D6BE91"/>' : '<path d="M180 420c-6 180 90 300 220 300s226-120 220-300" fill="none" stroke="url(#p)" stroke-width="110" stroke-linecap="round"/><circle cx="180" cy="400" r="70" fill="url(#p)"/><circle cx="620" cy="400" r="70" fill="url(#p)"/>'}</svg>`;
  fs.writeFileSync(path.join(OUT, file), svg);
  return { src: file, width: 800, height: 1000, aspect_ratio: 0.8, alt: '', id: Math.floor(Math.random() * 1e9), media_type: 'image' };
};

const mkProduct = (i, title, price, compare, shape, hue, opts = {}) => {
  const img1 = svgImg(`p${i}a`, hue, shape);
  const img2 = svgImg(`p${i}b`, hue + 40, shape);
  const media = [img1, img2].map((im) => ({ ...im, preview_image: im }));
  const multi = opts.multi;
  const variants = multi
    ? ['Sage', 'Ivory', 'Midnight'].map((c, n) => ({ id: 1000 * i + n, title: c, options: [c], option1: c, price, compare_at_price: compare, available: n !== 2, inventory_management: 'shopify', inventory_policy: 'deny', inventory_quantity: n === 0 ? 3 : 20, featured_media: media[n % 2] }))
    : [{ id: 1000 * i, title: 'Default Title', options: ['Default Title'], price, compare_at_price: compare, available: true, featured_media: null }];
  return {
    id: i, title, handle: title.toLowerCase().replace(/[^a-z]+/g, '-'), url: '/products/p' + i, vendor: 'Velora',
    price, price_min: price, price_varies: false, compare_at_price: compare, available: true,
    featured_media: media[0], media, images: [img1, img2], tags: opts.tags || [],
    description: '<p>A thoughtfully designed device for everyday comfort at home. Replace this with your real product description.</p>',
    has_only_default_variant: !multi, requires_selling_plan: false, selling_plan_groups: [],
    variants, selected_or_first_available_variant: variants[0],
    options_with_values: multi ? [{ name: 'Color', position: 1, selected_value: 'Sage', values: ['Sage', 'Ivory', 'Midnight'] }] : [{ name: 'Title', position: 1, values: ['Default Title'] }],
    metafields: { custom: { body_area: { value: opts.area || 'Neck & shoulders' }, heat: { value: opts.heat ?? true }, modes: { value: '3 modes' }, power: { value: 'Rechargeable battery' } }, reviews: {} }
  };
};
const products = [
  mkProduct(1, 'Halo Neck & Shoulder Massager', 12900, 15900, 'neck', 140, { multi: true, tags: ['badge:Best Seller'] }),
  mkProduct(2, 'Pulse Mini Massage Gun', 8900, null, 'gun', 30, { area: 'Portable', heat: false }),
  mkProduct(3, 'Cloud Heated Foot Massager', 18900, null, 'neck', 200, { area: 'Feet & legs' }),
  mkProduct(4, 'Contour Lumbar Cushion', 9900, 11900, 'neck', 90, { area: 'Back & lumbar' })
];
const allCollection = {
  id: 1, title: 'Best Sellers', handle: 'all', url: '/collections/all', products, products_count: 4, all_products_count: 4,
  description: '<p>Our most-loved wellness essentials, designed for everyday comfort.</p>',
  sort_options: [{ value: 'manual', name: 'Featured' }, { value: 'price-ascending', name: 'Price, low to high' }], default_sort_by: 'manual', sort_by: 'manual',
  filters: [
    { label: 'Availability', type: 'list', param_name: 'filter.v.availability', active_values: [], values: [{ label: 'In stock', value: '1', param_name: 'filter.v.availability', count: 4, active: false }] },
    { label: 'Price', type: 'price_range', min_value: {}, max_value: {}, range_max: 18900, active_values: [] }
  ]
};

const settings = {};
for (const group of JSON.parse(fs.readFileSync(path.join(THEME, 'config/settings_schema.json'), 'utf8'))) {
  for (const s of group.settings || []) if ('default' in s) settings[s.id] = s.default;
}
{
  const sd = JSON.parse(fs.readFileSync(path.join(THEME, 'config/settings_data.json'), 'utf8'));
  const cur = typeof sd.current === 'string' ? (sd.presets || {})[sd.current] : sd.current;
  Object.assign(settings, cur || {});
}
for (const k of Object.keys(settings)) if (/^color_/.test(k)) settings[k] = color(settings[k]);
settings.type_heading_font = font('"Inter"', 'system-ui, sans-serif');
settings.type_body_font = font('"Inter"', 'system-ui, sans-serif');
settings.type_accent_font = font('"Playfair Display"', 'Georgia, serif');
settings.cart_empty_collection = allCollection;

const cartItems = [products[0], products[1]].map((p, n) => ({
  key: 'k' + n, url: p.url, image: p.featured_media, product: p, variant: p.variants[0], quantity: n + 1,
  properties: {}, line_level_discount_allocations: [], original_line_price: p.price * (n + 1), final_line_price: p.price * (n + 1), url_to_remove: '#'
}));
const routes = { root_url: '/', cart_url: '/cart', cart_add_url: '/cart/add', cart_change_url: '/cart/change', cart_update_url: '/cart/update', predictive_search_url: '/search/suggest', search_url: '/search', account_url: '/account', account_login_url: '/account/login', account_register_url: '/account/register', account_logout_url: '/account/logout', all_products_collection_url: '/collections/all', collections_url: '/collections', product_recommendations_url: '/recommendations/products', account_addresses_url: '/account/addresses' };
const mainMenu = { links: [
  { title: 'Shop', url: '/collections/all', links: [{ title: 'Neck & Shoulders', url: '#', links: [] }, { title: 'Back & Lumbar', url: '#', links: [] }, { title: 'Feet & Legs', url: '#', links: [] }] },
  { title: 'Shop by Body Area', url: '#', links: [] }, { title: 'Best Sellers', url: '#', links: [] },
  { title: 'Our Technology', url: '#', links: [] }, { title: 'Our Story', url: '#', links: [] }
] };

/* ---------- engine ---------- */
const engine = new Liquid({ root: [path.join(THEME, 'snippets'), path.join(THEME, 'sections')], extname: '.liquid', jsTruthy: false });

const lookup = (key) => key.split('.').reduce((o, k) => (o ? o[k] : undefined), locale);
engine.registerFilter('t', (key, ...args) => {
  let v = lookup(key);
  const vars = {};
  for (const a of args) if (Array.isArray(a)) vars[a[0]] = a[1];
  if (v && typeof v === 'object') v = vars.count === 1 ? v.one : v.other;
  if (v == null) return `[missing: ${key}]`;
  return String(v).replace(/{{\s*(\w+)\s*}}/g, (_, k) => (vars[k] ?? ''));
});
const money = (c) => (c == null ? '' : '$' + (Number(c) / 100).toFixed(2));
engine.registerFilter('money', money);
engine.registerFilter('money_with_currency', (c) => money(c) + ' USD');
engine.registerFilter('money_without_currency', (c) => (c == null ? '' : (Number(c) / 100).toFixed(2)));
engine.registerFilter('asset_url', (n) => 'assets/' + n);
engine.registerFilter('shopify_asset_url', (n) => n);
engine.registerFilter('stylesheet_tag', (u) => `<link rel="stylesheet" href="${u}">`);
engine.registerFilter('image_url', (img) => (img && img.src ? { __img: img, toString: () => img.src } : ''));
engine.registerFilter('image_tag', (obj, ...args) => {
  const a = Object.fromEntries(args.filter(Array.isArray));
  const img = obj && obj.__img;
  if (!img) return '';
  return `<img src="${img.src}" width="${img.width}" height="${img.height}" alt="${a.alt ?? img.alt ?? ''}" ${a.class ? `class="${a.class}"` : ''} loading="${a.loading || 'lazy'}" ${a.style ? `style="${a.style}"` : ''}>`;
});
engine.registerFilter('placeholder_svg_tag', (n, cls) => `<svg class="${cls || ''}" viewBox="0 0 100 100"><rect width="100" height="100"/></svg>`);
engine.registerFilter('font_face', () => '');
engine.registerFilter('font_modify', (f) => f);
engine.registerFilter('json', (v) => JSON.stringify(v ?? null));
engine.registerFilter('payment_type_svg_tag', () => '<svg class="payment-icon" viewBox="0 0 38 24"><rect width="38" height="24" rx="4" fill="#ddd"/></svg>');
engine.registerFilter('link_to', (t, u) => `<a href="${u}">${t}</a>`);
engine.registerFilter('time_tag', (d) => `<time>${new Date(d).toDateString()}</time>`);
engine.registerFilter('structured_data', () => '{}');
engine.registerFilter('default_errors', () => '');
engine.registerFilter('format_address', () => '<p>123 Main St<br>Austin, TX</p>');
engine.registerFilter('model_viewer_tag', () => '');
engine.registerFilter('media_tag', () => '');
engine.registerFilter('payment_button', () => '<div class="shopify-payment-button"><button class="btn btn--ghost btn--block btn--lg" type="button">Buy it now</button></div>');
engine.registerFilter('payment_terms', () => '');
engine.registerFilter('handle', (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
engine.registerFilter('format_code', (s) => s);

engine.registerTag('schema', {
  parse(token, remain) {
    this.tpls = [];
    let t;
    while ((t = remain.shift())) { if (t.name === 'endschema') return; }
  },
  * render() { return ''; }
});
engine.registerTag('layout', { parse() {}, * render() { return ''; } });

const blockTag = (name, before, after, varName, makeVar) => {
  engine.registerTag(name, {
    parse(token, remain) {
      this.args = token.args;
      this.tpls = [];
      const stream = this.liquid.parser.parseStream(remain)
        .on('tag:end' + name, () => stream.stop())
        .on('template', (tpl) => this.tpls.push(tpl))
        .on('end', () => { throw new Error(`tag ${token.getText()} not closed`); });
      stream.start();
    },
    * render(ctx, emitter) {
      const attrs = {};
      const re = /([\w-]+):\s*('([^']*)'|"([^"]*)"|([\w.\[\]']+))/g;
      let m;
      while ((m = re.exec(this.args))) {
        attrs[m[1]] = m[3] ?? m[4] ?? (yield this.liquid.evalValue(m[5], ctx));
      }
      ctx.push({ [varName]: makeVar(this.args) });
      emitter.write(before(attrs, this.args));
      yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
      emitter.write(after);
      ctx.pop();
    }
  });
};
blockTag('form', (a, args) => {
  const type = (args.match(/'([^']+)'/) || [])[1];
  const action = type === 'product' ? '/cart/add' : '/contact';
  const extra = Object.entries(a).filter(([k]) => !['id', 'class'].includes(k)).map(([k, v]) => `${k}="${v}"`).join(' ');
  return `<form method="post" action="${action}" ${a.id ? `id="${a.id}"` : ''} class="${a.class || ''}" ${extra}><input type="hidden" name="form_type" value="${type}">`;
}, '</form>', 'form', () => ({ errors: null, 'posted_successfully?': false }));
blockTag('paginate', () => '', '', 'paginate', () => ({ pages: 1, current_page: 1, parts: [] }));

const sectionHTML = async (type, id, data, extraScope) => {
  const schema = schemaOf(type);
  const s = {};
  for (const st of schema.settings || []) if ('default' in st) s[st.id] = st.default;
  Object.assign(s, (data && data.settings) || {});
  const resolve = (obj, defs) => {
    for (const d of defs || []) {
      if (d.type === 'collection' && typeof obj[d.id] === 'string') obj[d.id] = allCollection;
      if (d.type === 'product' && typeof obj[d.id] === 'string') obj[d.id] = products[0];
      if (d.type === 'link_list') obj[d.id] = mainMenu;
      if (d.type === 'url' && typeof obj[d.id] === 'string') obj[d.id] = obj[d.id].replace('shopify://', '/');
    }
  };
  resolve(s, schema.settings);
  if (process.env.FILL && type === 'comparison' && !(data && data.block_order && data.block_order.length)) {
    data = { settings: (data && data.settings) || {}, blocks: { c1: { type: 'product', settings: { product: products[0], dimensions: '12.4 x 9.8 x 3.1 in' } }, c2: { type: 'product', settings: { product: products[1] } }, c3: { type: 'product', settings: { product: products[2] } } }, block_order: ['c1', 'c2', 'c3'] };
  }
  if (process.env.FILL && type === 'testimonials') {
    data = { settings: (data && data.settings) || {}, blocks: { r1: { type: 'review', settings: { quote: '<p>[Sample review placeholder used only in local preview]</p>', author: 'Preview A.', rating: 5, verified: false } }, r2: { type: 'review', settings: { quote: '<p>[Sample review placeholder used only in local preview]</p>', author: 'Preview B.', rating: 4 } } }, block_order: ['r1', 'r2'] };
  }
  if (process.env.FILL && type === 'product-spotlight') { data = JSON.parse(JSON.stringify(data)); }
  const blocks = ((data && data.block_order) || []).map((bid) => {
    const b = data.blocks[bid];
    const bs = {};
    const bdef = (schema.blocks || []).find((x) => x.type === b.type) || {};
    for (const st of bdef.settings || []) if ('default' in st) bs[st.id] = st.default;
    Object.assign(bs, b.settings || {});
    resolve(bs, bdef.settings);
    return { id: bid, type: b.type, settings: bs, shopify_attributes: '' };
  });
  const section = { id, settings: s, blocks };
  const html = await engine.renderFile(type, { section, ...(extraScope || {}) });
  return `<div id="shopify-section-${id}" class="shopify-section ${schema.class || ''}">${html}</div>`;
};

const renderGroup = async (name, scope) => {
  const g = JSON.parse(fs.readFileSync(path.join(THEME, 'sections', name + '.json'), 'utf8'));
  let out = '';
  for (const id of g.order) if (!g.sections[id].disabled) out += await sectionHTML(g.sections[id].type, id, g.sections[id], scope);
  return out;
};

engine.registerTag('sections', {
  parse(token) { this.name = token.args.replace(/'/g, '').trim(); },
  * render(ctx) { return yield renderGroup(this.name, ctx.getAll()); }
});
engine.registerTag('section', {
  parse(token) { this.name = token.args.replace(/'/g, '').trim(); },
  * render(ctx) { return yield sectionHTML(this.name, this.name, null, ctx.getAll()); }
});

const page = async (template, out, pageType, extra = {}) => {
  const globals = {
    settings, routes, shop: { name: 'Velora Wellness', customer_accounts_enabled: true, policies: [{ title: 'Refund policy', url: '#' }, { title: 'Privacy policy', url: '#' }], enabled_payment_types: ['visa', 'master', 'american_express', 'shopify_pay'], shipping_policy: { body: 'x', url: '#', title: 'Shipping policy' }, refund_policy: { url: '#', title: 'Refund policy' } },
    request: { page_type: pageType, locale: { iso_code: 'en' }, design_mode: false, origin: 'https://example.com' },
    cart: extra.cart || { item_count: 0, items: [], total_price: 0, currency: { iso_code: 'USD', symbol: '$' }, cart_level_discount_applications: [] },
    localization: { available_countries: [], available_languages: [] },
    collections: { all: allCollection }, template: { name: pageType }, page_title: 'Velora Wellness', canonical_url: '/', ...extra
  };
  engine.options.globals = globals;
  const tpl = JSON.parse(fs.readFileSync(path.join(THEME, 'templates', template + '.json'), 'utf8'));
  let content = '';
  for (const id of tpl.order) if (!tpl.sections[id].disabled) content += await sectionHTML(tpl.sections[id].type, id, tpl.sections[id], globals);
  const layout = fs.readFileSync(path.join(THEME, 'layout/theme.liquid'), 'utf8');
  const html = await engine.parseAndRender(layout, { ...globals, content_for_layout: content, content_for_header: '' });
  fs.writeFileSync(path.join(OUT, out), html.replace(/<script>\s*document\.documentElement/, '<script>window.Shopify={};document.documentElement'));
  const missing = html.match(/\[missing: [^\]]+\]/g);
  console.log(out, 'rendered', html.length, 'bytes', missing ? 'MISSING ' + [...new Set(missing)].join(', ') : '');
};

(async () => {
  await page('index', 'index.html', 'index');
  await page('product', 'product.html', 'product', { product: products[0], recommendations: { performed: false } });
  await page('collection', 'collection.html', 'collection', { collection: allCollection });
  const cart = { item_count: 3, items: cartItems, total_price: 30700, currency: { iso_code: 'USD', symbol: '$' }, cart_level_discount_applications: [], taxes_included: false };
  await page('cart', 'cart.html', 'cart', { cart });
  await page('404', '404.html', '404');
})().catch((e) => { console.error(e); process.exit(1); });
