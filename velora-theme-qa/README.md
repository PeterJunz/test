# Velora theme QA tools

These are development-only scripts for checking the theme in `../velora-theme`. They are **not** part of the theme ZIP.

```bash
npm install
npm run check      # Shopify Theme Check (official linter)
npm run interact   # Renders pages with LiquidJS and runs 29 browser interaction tests against a mocked Cart API
npm run a11y       # axe-core WCAG 2.1 AA audit of the rendered pages
npm run preview && npm run shots   # Screenshots at 1440 / 820 / 390 / 320px, plus horizontal-overflow detection
```

`preview.js` is an approximation of Shopify's renderer. It uses LiquidJS with mocked `product`, `cart`, `settings` and other objects, so you can inspect layout and JavaScript behaviour offline. Before going live, always check the theme in a real store, using `shopify theme dev` or an unpublished theme.

The Chromium path is set to `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Change `executablePath` in the scripts to match your machine.
