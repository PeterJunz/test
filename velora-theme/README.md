# Velora Immersive — Shopify Online Store 2.0 Theme

A premium, immersive wellness theme for selling at-home massage and relaxation products (neck & shoulder massagers, foot and calf massagers, lumbar cushions, massage guns, heated pillows and similar products) to US shoppers.

The design takes its cues from immersive product-launch sites: oversized editorial type, layered depth, ambient light and pointer-driven 3D parallax. All code, artwork and copy are original. No third-party assets or source code are copied.

- **Platform:** Shopify Online Store 2.0 (Liquid, JSON templates, sections everywhere, app blocks)
- **Dependencies:** none. Vanilla JS custom elements and CSS. No jQuery, animation libraries or external fonts beyond Shopify's font library.
- **Language:** American English (`locales/en.default.json`)

---

## 1. Architecture

```
velora-theme/
├── assets/
│   ├── base.css          Design tokens, color schemes, type, buttons, forms, header, drawers, cards, footer
│   ├── immersive.css     Hero / 3D depth / motion, homepage sections, PDP, collection, cart, blog, 404, password
│   └── global.js         Cart API, cart drawer, variant picker, gallery, depth scene, reveal, filters, search
├── config/
│   ├── settings_schema.json   Global theme settings (brand, colors, typography, layout, buttons, motion, cards, cart, social)
│   └── settings_data.json
├── layout/
│   ├── theme.liquid      Main layout (SEO meta, structured data, header/footer groups, cart drawer, search modal)
│   └── password.liquid
├── locales/en.default.json
├── sections/             40 sections + header-group.json / footer-group.json
├── snippets/             22 reusable snippets (product card, price, rating, icons, facets, cart line, etc.)
└── templates/            JSON templates for every page type + customers/* + gift_card.liquid
```

### Homepage sections (all addable, removable and reorderable in the theme editor)

| # | Section | File |
|---|---------|------|
| 1 | Announcement bar (static or marquee, with links and colors) | `announcement-bar.liquid` |
| 2 | Header (sticky, transparent over the hero, dropdowns, mobile drawer) | `header.liquid` |
| 3 | Immersive hero (layered 3D stage, floating callouts, ambient light) | `immersive-hero.liquid` |
| 4 | Trust indicators | `trust-bar.liquid` |
| 5 | Shop by body area | `body-areas.liquid` |
| 6 | Featured best sellers (real collection products, quick add) | `featured-collection.liquid` |
| 7 | Product spotlight (image, 3D model, hotspots, features) | `product-spotlight.liquid` |
| 8 | Product benefits | `benefits.liquid` |
| 9 | Immersive story (parallax and word reveals) | `brand-story.liquid` |
| 10 | Product comparison | `comparison.liquid` |
| 11 | Customer reviews (genuine reviews or app block only) | `testimonials.liquid` |
| 12 | FAQ | `faq.liquid` |
| 13 | Newsletter (native Shopify customer form) | `newsletter.liquid` |
| 14 | Footer (menus, contact, newsletter, policies, localization, payment icons) | `footer.liquid` |

The theme also includes these extra sections: Rich text, Image with text, Contact form, Apps, and Recently viewed.

### How the "3D" works

The hero is built in this order, from most to least reliable:

1. **Image-based depth.** Upload a cut-out product image (transparent PNG or WebP). It sits on a stage with rings, a halo, a floor grid and a soft shadow.
2. **CSS 3D and parallax.** `<depth-scene>` writes two CSS variables (`--mx` and `--my`) as the pointer moves. Each layer moves according to its own `--d` depth value. Only `transform` and `opacity` are animated, and updates are throttled with `requestAnimationFrame`.
3. **Real 3D models.** In the Product spotlight and on the product page, any GLB model attached to a product's media is shown with Shopify's native `model_viewer_tag`, plus AR ("View in your space"). This needs no external URLs.

If no image is uploaded, an original vector "render" of a neck massager, massage gun or cushion is shown, so the store looks finished from day one.

Pointer effects turn off automatically on touch devices, when the **Motion** settings disable them, and when visitors have `prefers-reduced-motion` turned on. Ambient animations pause while their section is off screen.

---

## 2. Upload the theme to Shopify

1. In Shopify admin, go to **Online Store → Themes**.
2. Under **Theme library**, click **Add theme → Upload zip file**.
3. Select `velora-immersive-wellness-shopify-theme.zip`. Upload the ZIP itself, not an unzipped folder. `layout/`, `sections/` and the other folders are already at the root of the ZIP.
4. When the upload finishes, click **Customize** to preview it, then **Publish** when you're ready.

If you use Shopify CLI instead: run `shopify theme push --path velora-theme`, or `shopify theme dev --path velora-theme` for a live preview.

---

## 3. Set-up checklist (do this once)

1. **Navigation** (Online Store → Navigation)
   - Edit `main-menu` with: *Shop*, *Shop by Body Area* (child links to each body-area collection), *Best Sellers*, *Our Technology* (a page), *Our Story* (a page).
   - Create or edit a `footer` menu with your support pages (Contact, FAQ, Shipping, Returns, Warranty).
2. **Collections.** Create collections such as *Best Sellers*, *Neck & Shoulders*, *Back & Lumbar*, *Feet & Legs*, *Full Body* and *Portable Massage*.
3. **Policies** (Settings → Policies). Add your refund, shipping, privacy and terms policies. They are linked automatically in the footer, on product pages and in the FAQ.
4. **Pages.** Create *Our Technology*, *Our Story* and *Contact*. For the Contact page, choose the `page.contact` template.
5. **Theme settings** (Customize → ⚙ Theme settings). Upload your logo, plus an optional light version for the transparent header and dark sections. Set your social links.

---

## 4. Customize the homepage

Open **Customize** and pick the **Home page** template.

- **Immersive hero.** Set the eyebrow, heading and text. Wrap words in *italics* to use the editorial accent font. Set the two buttons; each one stays hidden until it has a link. Upload a product image (a transparent cut-out works best), choose the color scheme, layout, height and ambient light colors, and set the 3D depth intensity. Add up to 4 **Floating callout** blocks and position them with the X/Y and depth sliders.
- **Shop by body area.** Each block can use a collection for its link, title and image, or you can set an image, title, text and link yourself.
- **Featured best sellers.** Pick a collection. Until you do, it shows all products.
- **Product spotlight.** Pick a product. Add **Feature** blocks for real specifications and **Hotspot** blocks, positioned with X/Y, for interactive callouts.
- **Product comparison.** Add one block per product. Rows with no data are hidden, and the whole section stays hidden on the live store until a product is added.
- **Customer reviews.** Add genuine reviews, or an app block from your review app. The section stays hidden until it has content.

Every section has a **Color scheme** option (Ivory, White, Sage or Midnight), so you can alternate light and dark rhythm down the page.

---

## 5. Brand colors and typography

**Theme settings → Colors**
- The core palette is Midnight `#101820`, Ivory `#F7F5F0`, Charcoal `#252A2D` and White.
- The accents are Wellness green `#A8C3AE`, Muted sage `#DCE6DC` and Champagne `#D6BE91`.
- Commerce colors cover sale prices, badges and primary buttons.

**Theme settings → Typography**
- **Heading font** (default: Inter), with weight, size scale and an optional uppercase display style.
- **Editorial accent font** (default: Playfair Display italic) for `<em>` words in headings.
- **Body font** (default: Inter) with a size scale.

All fonts come from Shopify's font library and load with `font-display: swap`. Type sizes are fluid, using `clamp()`.

**Theme settings → Layout / Buttons & shapes / Motion** cover page width, section spacing, grid gap, button shape (pill, rounded or square), card and image corner radius, scroll reveals, pointer depth and ambient light.

---

## 6. Product page

The template (`templates/product.json`) uses reorderable blocks: Vendor, Title, Rating, Price, Variant picker, Buy buttons, Highlights, Shipping & returns, Description, Specifications, Collapsible tabs, Share, Custom Liquid, and App blocks.

- **Media.** Images, videos, external videos and **3D models (GLB/USDZ)** uploaded to the product in Shopify admin. Selecting a variant jumps to that variant's image.
- **Variants.** Pill selectors (with swatches when your product options use Shopify swatches). Combinations that don't exist or are sold out are marked. Price, availability and the add-to-cart button re-render through Shopify's Section Rendering API, so currency formatting always follows your store settings.
- **Inventory.** "Only X left" appears only when Shopify tracks inventory and the real stock is at or below the threshold you set (default 5).
- **Subscriptions.** Selling plans appear automatically, and products that require one are handled.
- **Accelerated checkout.** Shopify's dynamic checkout buttons can be turned on or off in the Buy buttons block.
- **Specifications.** Values come from product metafields in the `custom` namespace, and rows with no value are hidden. Define these metafields in **Settings → Custom data → Products**:

  | Key | Suggested type |
  |-----|----------------|
  | `custom.body_area` | Single line text |
  | `custom.heat` | True or false / Single line text |
  | `custom.modes` | Single line text |
  | `custom.portability` | Single line text |
  | `custom.power` | Single line text |
  | `custom.dimensions` | Single line text |
  | `custom.accessories` | Multi-line text |

  The **Product comparison** section reads the same metafields.
- **Product badges.** A *Sale* badge shows when the compare-at price is higher than the price, and *Sold out* shows when the product is unavailable. For a custom badge, add a product tag such as `badge:Best Seller` (you can change the prefix in Theme settings → Product cards).
- **Related products** come from Shopify's product recommendations. Choose *Complementary* if you use the Search & Discovery app. **Recently viewed** is stored only in the shopper's own browser (localStorage, up to 8 handles).

## 7. Cart

- **Theme settings → Cart.** Choose drawer or page, turn on order notes, set an optional drawer message, and pick a collection to suggest when the cart is empty.
- The cart uses Shopify's Ajax Cart API (`/cart/add.js`, `/cart/change.js`) together with the `sections` parameter, so the drawer, cart page and header count always match the real cart.
- Discount codes are entered at checkout. Automatic and code discounts already applied are shown in the cart.

## 8. Collections, filtering and search

- Filters and sorting use Shopify's native storefront filtering. Configure filters in the **Shopify Search & Discovery** app (availability, price, product type, vendor, metafields and more).
- Without JavaScript, the filter form submits normally. With JavaScript, results update in place and the URL stays shareable.
- Predictive search (header search icon) uses `/search/suggest` and can be turned off in Theme settings → Search.

---

## 9. Features that need an app or merchant-supplied content

| Feature | What you need |
|---------|---------------|
| Star ratings on product cards and product pages | A review app that writes Shopify's standard `reviews.rating` and `reviews.rating_count` metafields (for example Judge.me, Okendo or Yotpo). Without that data, ratings stay hidden. |
| Review widgets | Add your review app's **app block** to the *Customer reviews* section or to the product page. |
| Complementary products | Shopify Search & Discovery app |
| Advanced filters | Shopify Search & Discovery app |
| Subscriptions | Any selling-plan app (for example Shopify Subscriptions) |
| 3D / AR product views | GLB (and optionally USDZ) files uploaded to product media |

### Assets the store owner must supply

- Logo (SVG or PNG) and, optionally, a light version for dark backgrounds.
- **Hero product image.** A transparent cut-out of your hero product, at least 1600px wide.
- Product photography (square or 4:5 recommended), plus lifestyle images for the story and body-area cards.
- Optional 3D models (GLB) of your products.
- All product specifications, policies, FAQ answers and reviews. **The theme deliberately ships no invented specs, reviews, ratings, certifications or shipping promises.**

### Content and compliance notes

- Default copy talks about comfort, relaxation and convenience. It makes no claims to treat, cure or prevent any condition.
- Placeholder FAQ answers, feature text and trust items are meant to be replaced with your real policies and specifications.
- If you sell in the US, check any health-related claims against FTC guidance before publishing.

---

## 10. Performance and accessibility notes

- Responsive images use `image_url` and `image_tag` with `srcset` and `sizes`. The hero and the first product images load eagerly with `fetchpriority="high"`, and everything else is lazy-loaded.
- There is one deferred JS file (~36 KB unminified) and two CSS files (~80 KB unminified total). No third-party libraries are loaded, and Shopify's model-viewer loads only when a 3D model is on the page.
- Scroll reveals use IntersectionObserver, and the hero exit uses CSS scroll-driven animation where the browser supports it. There are no continuous JavaScript animation loops.
- Accessibility: semantic landmarks, a skip link, native `<dialog>` drawers with focus return and Escape to close, `<details>` accordions, labelled form controls, live regions for cart and search feedback, visible focus rings, and `prefers-reduced-motion` support.
