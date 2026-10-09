# Phase 1 — Audit & Architecture

## 1. Repository audit (as found)

| Path | What it is | Decision |
|---|---|---|
| `shopify-theme/` | "Vitalia" OS 2.0 theme (Vietnamese UI) for health, pet and mom & baby stores | Left untouched. Wrong language and market (US English is required here). |
| `velora-theme/` + `velora-theme-qa/` | "Velora Immersive" OS 2.0 theme (US English, wellness/massage) with QA tooling | Left untouched. Some proven patterns are reused: Ajax cart drawer, variant picker built on the Section Rendering API, facets, predictive search, a11y fixes. |
| `getsmarthome-hero-demos/` | 10 Three.js + GSAP hero prototypes for another brand. Demo 11 (Architectural Grid) is unfinished and uncommitted. | Left untouched. Its runtime pattern (renderer bootstrap, pointer, pause-off-screen loop, blur reveal, fallbacks) is copied and adapted for this project. |
| `fb_ads_bot/`, `tests/` | Python Telegram bot (unrelated) | Left untouched. |

There is no existing mom & baby US theme to preserve, so this project lives in a new, isolated folder: **`little-linden/`**.

## 2. Brand name — 5 suggestions

| Name | Feel |
|---|---|
| **Little Linden** *(provisional choice)* | Linden trees are soft, sheltering and long-lived. The name is warm and nature-led, and sounds premium without being twee. |
| Hushling | Quiet and tender; evokes calm early days |
| Nestwell & Co. | Practical and nurturing, with a "& Co." DTC cadence |
| Softbloom | Gentle and floral; leans more toward the mom-care side |
| Willowmere | Old-world and editorial; a heritage tone |

> ⚠️ **Not verified:** domain, trademark and social-handle availability have **not** been checked for any of these names. The brand name, logo and domain are configurable placeholders. The demo domain is `littlelinden.example` (`.example` is reserved and never resolves).

## 3. Planned architecture

```
little-linden/
├── docs/                      Phase docs (this file, design system, later QA reports)
├── design-system/tokens.css   Single source of truth for colors, type, spacing, radii, motion
├── hero-lab/                  Phase 3 — 10 isolated hero demos (NOT the production theme)
│   ├── index.html             Gallery (thumbnails only — no WebGL loaded here)
│   ├── demos/NN-slug/         One page per demo → only ONE WebGL scene is ever loaded
│   ├── shared/                Runtime (core.js), procedural props (props.js), UI (lab.css)
│   ├── vendor/                three@0.170.0 (MIT), gsap@3.12.5 (Standard no-charge license)
│   └── tools/                 page generator + headless QA
└── theme/                     Phase 4 (after hero approval) — Shopify OS 2.0 theme
    ├── layout/ theme.liquid, password.liquid
    ├── config/ settings_schema.json (tokens as editable settings), settings_data.json
    ├── sections/ header/footer groups, hero-<chosen>, category showcase, best sellers,
    │             featured collection, story, mom/baby feature, gift bundles, benefits,
    │             reviews (app block / labelled demo), guides, newsletter, FAQ, main-* templates
    ├── snippets/ product-card, price, badges, icon, cart-line, facets, …
    ├── templates/ index, product, collection, list-collections, cart, search, page(+about,
    │             contact, faq, size-guide, care-guide), blog, article, 404, password, customers/*
    ├── locales/ en.default.json
    └── assets/ base.css, theme.js, hero-<chosen>.js (bundled Three.js + GSAP, lazy-initialised)
```

### Dependency strategy

- **Hero lab:** ES modules plus an import map pointing to locally vendored, version-pinned files. No CDN at runtime except Google Fonts, and the pages work without them.
- **Production theme:** the chosen hero is bundled with esbuild into **one classic (IIFE) asset**. This avoids module/import-map problems in Shopify layouts and keeps a single copy of Three.js. It is loaded with `defer` and initialised only when the hero is near the viewport.
- GSAP is loaded once and comes from the same bundle. ScrollTrigger is only added if a chosen concept actually needs it.

### Data rules (apply to every phase)

- Product cards, prices, compare-at prices, availability, cart and search all come from Shopify objects and APIs. Nothing is hard-coded in production.
- Demo copy and props in the hero lab are clearly labelled **DEMO**.
- The lab contains no reviews, ratings, customer counts, certifications or safety/medical claims.
- Counters animate only neutral, configurable facts (for example the number of categories). They never show fabricated statistics.

## 4. Missing inputs & assumptions

| Input | Assumption until provided |
|---|---|
| Domain | `littlelinden.example` placeholder |
| Brand name / logo | "Little Linden" wordmark (text logo, configurable) |
| Product catalogue, photography | Procedural 3D props + labelled image placeholders in the lab; a CSV import template comes in Phase 4 |
| Free-shipping threshold | `$75` shown **only as a labelled demo value**; a theme setting will control it |
| Policies (shipping, returns, privacy, terms) | Editable templates that the merchant must review — no compliance claims |
| Review app | None assumed; the reviews section supports app blocks or clearly labelled demo content |
