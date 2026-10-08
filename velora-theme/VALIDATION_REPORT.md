# Validation Report: Velora Immersive Theme v1.0.0

All checks below were actually run in this environment. Where something could not be verified without a live Shopify store, this report says so.

## Files created

- `velora-theme/` is the theme source. It contains 92 theme files:
  - 3 assets
  - 2 config files
  - 2 layouts
  - 1 locale
  - 40 sections and 2 section groups
  - 22 snippets
  - 20 templates (12 page templates, 7 customer templates, and `gift_card.liquid`)
- `velora-theme/README.md`, `velora-theme/VALIDATION_REPORT.md` and `velora-theme/.shopifyignore` are documentation and CLI support files. They are not included in the ZIP.
- `velora-theme-qa/` holds the QA scripts used for the checks below. It is not included in the ZIP.
- `velora-immersive-wellness-shopify-theme.zip` is the importable theme. Its theme folders sit at the ZIP root.

Nothing existing was modified. The earlier theme in `shopify-theme/` and the Facebook ads bot were left untouched.

## Checks run

| # | Check | Command / tool | Result |
|---|-------|----------------|--------|
| 1 | Shopify Theme Check (official linter, v3.30.1, recommended config): Liquid syntax, schema validity, unknown filters and tags, missing snippets and assets, translation keys, setting IDs, deprecated tags, image/asset performance rules | `node velora-theme-qa/run-check.js velora-theme` | **0 offenses** (0 errors, 0 warnings) |
| 2 | The checker really catches problems: an invalid schema key, a missing snippet, an unknown filter and a missing translation were planted in a copy of the theme | same | All 4 problem types were reported as errors, so the clean result above is meaningful |
| 3 | Theme Check on the extracted ZIP | unzip, then `run-check.js` | **0 offenses**. The ZIP root has `assets config layout locales sections snippets templates` |
| 4 | JSON validity: every `config/`, `templates/`, `locales/` and section-group file, plus every embedded `{% schema %}` | Python `json.load` | 24 JSON files and 40 section schemas valid |
| 5 | JavaScript syntax | `node --check assets/global.js` | OK |
| 6 | Translation coverage: every `'key' \| t` used in Liquid exists in `en.default.json` | grep + Python, plus Theme Check `TranslationKeyExists` | 0 missing |
| 7 | Rendering: index, product, collection, cart and 404 pages rendered with LiquidJS and mocked Shopify objects | `velora-theme-qa/preview.js` | All pages render with no missing translations |
| 8 | Responsive layout at 1440 / 820 / 390 / 320 px: screenshots, plus a test that tries to scroll each page sideways | `velora-theme-qa/shoot.js` (Chromium) | **No horizontal scroll on any page at any width** (after fixes, see below) |
| 9 | Interactions against a mocked Shopify Cart API | `velora-theme-qa/interact.js` | **29/29 passed**. Covered: variant selection updates the variant ID and URL; unavailable options are marked; a sold-out variant disables purchase; quantity stepper; add to cart opens the drawer with line items; header count updates; quantity change posts `{line, quantity}`; Escape closes the drawer; sticky add-to-cart bar; mobile menu open/close with focus return; search modal plus predictive search; Escape closes search; newsletter email validation; hotspots; FAQ accordion; filter drawer; skip link is the first Tab stop; **no JavaScript runtime errors** |
| 10 | Accessibility (axe-core 4.14, WCAG 2.0/2.1 A + AA + best practice) on the rendered pages | `velora-theme-qa/axe.js` | **0 violations** on index, product, collection, cart and 404 (after fixes, see below) |

## Problems found by these checks and fixed

- On mobile, the product buy row and the cart lines at 320px were wider than the screen. Fixed with `minmax(0, 1fr)` grids and a compact quantity stepper.
- A visually hidden `<caption>` in the comparison table escaped its scroll container and made the page scroll sideways on mobile. Fixed by giving the scroll container `position: relative`.
- Escape inside the search field only cleared the text and didn't close the search modal. Added an explicit Escape handler with focus return.
- Five colors failed contrast checks: the sale price (`#B5543C` → `#A3462F`), the low-stock text, the accent green (`#5E7F68` → `#476650`), the sort label and the decorative numbers. All now pass AA.
- The product gallery scroller couldn't be reached by keyboard. Added `tabindex="0"`.
- Collection and search pages skipped a heading level (h1 straight to h3). Added a visually hidden h2.
- Liquid used empty placeholder values written as `assign x = blank`. Replaced with patterns that behave the same in every Liquid engine.
- The comparison section showed an empty heading when no products were added. It now stays hidden on the live store and shows a hint in the theme editor.
- In the hero, the headline collided with a floating callout. Adjusted the headline size and the callout positions.

## Not verifiable in this environment

There is no Shopify store or Shopify CLI login here, so these need a check in a real store:

- How Shopify actually renders the theme: real product, cart and filter objects, `structured_data`, `payment_terms`, dynamic checkout buttons, `model_viewer_tag` and AR. The theme uses only documented Shopify objects and filters, and Theme Check validated every filter and tag name.
- Real `/cart/*.js` responses. The tests ran against a mock server that follows Shopify's documented response shape. Inventory limits, selling plans and discount display need a real store.
- Storefront filtering and `/search/suggest` results, which depend on the Search & Discovery app configuration.
- Lighthouse and Core Web Vitals scores. **Not measured.** No scores are claimed.
- Real product photography and 3D models. None were available, so the theme's built-in vector renders and mock images were used.

## Manual setup still needed in Shopify

1. Upload the ZIP: **Online Store → Themes → Add theme → Upload zip file**.
2. Create the `main-menu` and `footer` menus, the collections, and the *Our Technology*, *Our Story* and *Contact* pages (the Contact page uses the `page.contact` template).
3. Add your store policies. Then replace the placeholder FAQ answers, feature text and spotlight copy with real information.
4. Upload a logo, a transparent hero product image and product photos.
5. Optional: create the `custom.*` product metafields for specifications and comparison, install a review app (for ratings and review blocks), and add GLB models to product media.
