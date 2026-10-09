# Little Linden — Premium Mom & Baby Shopify Store (work in progress)

> **Status: Phase 3 complete. Waiting for your hero selection.**
> Nothing has been uploaded to Shopify, published, or integrated into a production theme yet. All copy, products and 3D props are **demo placeholders**.

| Phase | Status | Where |
|---|---|---|
| 1. Audit & architecture | ✅ Done | [`docs/01-audit-and-architecture.md`](docs/01-audit-and-architecture.md) |
| 2. Design system | ✅ Done | [`docs/02-design-system.md`](docs/02-design-system.md), [`design-system/tokens.css`](design-system/tokens.css) |
| 3. Hero lab: 10 concepts | ✅ Done, **awaiting approval** | [`hero-lab/`](hero-lab/) |
| 4. Theme build (homepage, PDP, collection, cart, search, pages) | ⏸ Starts after you approve a hero | `theme/` (not created yet) |
| 5. QA | Partly done (hero lab only) | see below |
| 6. Delivery (theme ZIP, CSV template, merchant guide) | Not started | — |

**Brand:** "Little Linden" is a *provisional* name, chosen from five suggestions in the Phase 1 doc. Domain and trademark availability have **not** been checked. The demo domain is `littlelinden.example`.

---

## Run the hero lab

1. Open `hero-lab/` and double-click the launcher for your system:
   - **Windows:** `RUN-DEMOS-WINDOWS.bat`
   - **Mac:** `RUN-DEMOS-MAC.command` (if macOS blocks it, right-click → Open → Open)

   The launchers use Python, or Node.js if Python isn't installed.
2. Your browser opens `http://localhost:5173`, the gallery of all 10 concepts. Click one to open it full-screen; use the ← ☰ → bar to switch.
3. Keep the terminal window open while you browse.

Manual alternative:

```bash
cd hero-lab && python3 -m http.server 5173
```

Do **not** open `index.html` by double-clicking. ES modules and WebGL need an `http://` URL.

## The 10 concepts

All 10 share these features:

- **Cursor tilt** on the 3D scene and the product card.
- **Spotlight/glare and subtle foil** on the product card.
- **Animated conic border** on the primary CTA.
- **Parallax depth** on 3D layers and cards. The copy and CTAs stay still so they are easy to click.
- **Blur-to-clear reveal** of the copy.
- **Animated line icons** and a **neutral counter**: the number of categories, never fabricated statistics.

| # | Concept | Distinct technique |
|---|---|---|
| 01 | Soft Organic 3D | Sculpted pebble forms and a ring stacker, soft PCF shadows, GLSL window-light backdrop that follows the cursor |
| 02 | Floating Product Gallery | Image planes at 5 depths with a rounded-corner + glare shader. **Configurable images** via `#gallery-config` JSON; labelled placeholders until then |
| 03 | Liquid Silk Shader | Full-screen GLSL muslin/silk height field with sheen; the cursor pushes the folds |
| 04 | Particle Atmosphere | Dust and bokeh GPU particle layers drifting around a cloud night light (dusk palette) |
| 05 | Glass & Light | Frosted-glass arches with physical transmission refracting a colour field and a product, plus drifting light beams |
| 06 | Interactive Product Spotlight | Real SpotLight + visible volumetric cone following the cursor, animated conic floor ring, configurable secondary cards |
| 07 | Architectural Depth Grid | Anti-aliased GLSL perspective grid that "draws" in from the horizon, a corridor of arches, a crescent-moon product |
| 08 | Kinetic Typography | GSAP word-mask reveals and a cycling italic phrase (stable accessible name) over a WebGL thread-line field that bends to the cursor |
| 09 | Soft 3D Carousel | Curved panels on a ring. Drag/swipe, ← → buttons and arrow keys all work, and a live region announces the active collection |
| 10 | Living Editorial Scene | Layered nursery-shelf diorama, a slowly turning wall mobile, leaf-shadow window light, scroll-linked camera dolly |

Child-safety note: the scenes show decorative products only. There are no crib or sleep setups and no car-seat use, and no safety, medical or certification claims anywhere.

## Engineering notes

- **One scene at a time:** each concept is its own page, and the gallery shows only static thumbnails.
- **Libraries:** Three.js 0.170.0 and GSAP 3.12.5 are vendored locally with pinned versions and loaded through an import map. There are no duplicate imports and no runtime CDN dependency; Google Fonts are optional.
- **Rendering cost:** DPR is capped (2 on desktop, 1.5 on mobile). The render loop pauses when the hero is off-screen or the tab is hidden. Particle counts and texture resolution are lower on small screens.
- **Cleanup on `pagehide`:** the rAF loop stops, all listeners are removed via `AbortController`, every geometry, material and texture is disposed, and the renderer is disposed. This is verified by a test (renderer memory drops to 0 geometries).
- **Fallbacks:** with `prefers-reduced-motion`, you get a single static frame, no ambient loops and instant reveals. Without WebGL, a warm static backdrop appears and all copy and CTAs keep working. The canvas never blocks text or buttons (`pointer-events: none`, except the carousel canvas, which uses `touch-action: pan-y` so vertical scrolling still works).

## Test results (actually run, headless Chromium + SwiftShader)

| Check | Result |
|---|---|
| `tools/check.mjs`: 10 demos × desktop 1440×900 + mobile 390×844 (WebGL init, JS/console/HTTP errors, horizontal overflow, reveal completes) | **20/20 pass** |
| `MODE=reduced` (prefers-reduced-motion) | **20/20 pass** |
| `MODE=nowebgl` (WebGL disabled → fallback) | **20/20 pass** |
| `tools/interact.mjs`: carousel next/prev/keyboard/drag + live region, kinetic phrase cycling + stable aria-label + reduced-motion stop, card tilt + spotlight, pagehide GPU cleanup, no runtime errors | **14/14 pass** |
| `tools/a11y.mjs`: axe-core WCAG 2.0/2.1 A + AA on all 10 demos + gallery | **0 violations** |

Bugs found by these tests and fixed during the build:
- The design-token stylesheet path broke when the lab was served on its own.
- SVG icon length threw an error when hidden on mobile.
- The grid "draw-in" shader ran in the wrong direction.
- The carousel ring covered the headline.
- The copy and CTA column drifted with parallax, so buttons were moving targets.
- One GPU geometry leaked on cleanup.

**Not measured / not verified:**
- Real-device frame rate. The FPS numbers in the logs come from a software GPU and mean nothing; test on a mid-range iPhone and Android.
- Lighthouse / Core Web Vitals.
- Safari and Firefox.

## How to approve

Reply with the concept number (for example "07"), plus any tweaks you want. Only then will Phase 4 start:

1. Integrate the chosen hero as a Shopify section. The bundle will be lazy-initialised, with Theme Editor settings for copy, CTAs, images, colours and motion.
2. Build the full OS 2.0 theme and supporting templates.
3. Provide the theme ZIP, the product CSV template and the merchant setup guide.
