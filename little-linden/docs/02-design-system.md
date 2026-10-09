# Phase 2 — Design System: Little Linden

**Mood:** warm, nurturing, editorial, calm and trustworthy. The look is natural window light on linen, cream and soft sage. There is no cartoon styling, no neon and no gradient overload.

## Color

The source of truth is `design-system/tokens.css`. In the theme, every token becomes a Theme Settings color.

| Token | Hex | Use | Text contrast on ivory |
|---|---|---|---|
| Warm ivory | `#FAF7F2` | Page background | — |
| Soft cream | `#F1E8DC` | Alternate sections, cards | — |
| Muted sage | `#A9B5A0` | Decorative fills, illustration, 3D props | 2.0:1 — **never for text** |
| Dusty rose | `#D9B2AE` | Decorative fills, highlights | 1.8:1 — **never for text** |
| Warm taupe | `#B7A99A` | Borders, props | 2.15:1 — **never for text** |
| Deep charcoal | `#282826` | Text, primary buttons | 13.8:1 |
| Sage ink | `#55624F` | Accent text and icons | 6.05:1 |
| Rose ink | `#8A524D` | Accent text, italic display, sale price, focus ring | 5.79:1 |
| Taupe ink | `#6E6155` | Secondary accent text | 5.61:1 |
| Muted | `#6B6660` | Secondary body text | 5.32:1 |

The pastels are decorative only, so each one has an AA-compliant "ink" partner for text.

## Typography

- **Display:** *Instrument Serif* (regular and italic) for H1–H3. Italic words carry the emotion, for example "Gentle *beginnings*." Use tight tracking (−0.02em) and line-height 1.0–1.08.
- **Body/UI:** *DM Sans* 400/500 for navigation, body, buttons, prices and forms. Body text is 16px minimum on mobile with line-height 1.6.
- **Scale:** fluid `clamp()`. H1 2.8–6rem, H2 2.2–3.6rem, H3 1.6–2.25rem, H4 1.25–1.5rem, lede 18px, meta 14px, eyebrow 12px uppercase with 0.18em tracking.
- In the theme, the fonts are Shopify `font_picker` settings. The defaults are replaced with the nearest Shopify font-library equivalents, and font loading is verified during Phase 4.

## Spacing, layout, breakpoints

- **Spacing:** a 4px base (4/8/12/16/24/32/48/64/96). Section rhythm is `clamp(56px, 9vw, 120px)`. Gutter is `clamp(18px, 4vw, 56px)`. Max content width is 1440px.
- **Breakpoints:** 480 / 750 / 990 / 1200 / 1440. Layouts are mobile-first. On mobile, the hero puts its visual in the top ~40% and copy plus CTA in the bottom 60%. Both CTAs stay within thumb reach, and touch targets are at least 44px.

## Components (first set — used by the hero lab, extended in Phase 4)

| Component | Spec |
|---|---|
| Primary button | Charcoal pill, ivory text, 52px tall (48 on mobile). An animated **conic border** appears on hover/focus. A light sheen sweeps across on hover. |
| Secondary button | Ivory pill with a 1px line and a light backdrop blur. Its text is charcoal. |
| Product card | White surface with an 18px radius. The image sits on cream. The card tilts with the pointer and has a spotlight/glare plus a very subtle champagne-rose foil band. Title uses DM Sans 500; price uses the Shopify money format. |
| Trust chip | Animated line icon (stroke draws in) plus a short neutral statement. No unverifiable claims. |
| Counter | Animates **neutral, configurable facts only**, such as "8 categories" or the free-shipping threshold set by the merchant. It never shows customer, sales or review statistics. |
| Focus state | 2px rose-ink outline with a 3px offset on every interactive element. |

## Iconography

These are custom 1.6px line icons on a 24px grid with round caps: bottle, rattle, moon, gift, leaf, truck, return, chat, ruler, heart. They are inline SVG, with `aria-hidden` when decorative.

## Motion principles

1. **Restrained.** Ambient motion is slow (≥ 6s cycles) and small in amplitude. Nothing flashes, strobes or loops quickly.
2. **Purposeful.** Motion reveals content (blur → clear), signals interactivity (tilt, spotlight) or adds depth (parallax). It is never just decoration on every element.
3. **Never blocking.** Copy and CTAs are in the DOM before WebGL starts. Canvases have `pointer-events: none` unless an interaction requires otherwise.
4. **Respectful.** `prefers-reduced-motion` gives one static rendered frame with no ambient loops and instant reveals. Without WebGL, a static warm backdrop is shown and everything stays usable.
5. **Efficient.** Device-pixel-ratio is capped (2 on desktop, 1.5 on mobile). The render loop pauses off-screen and in hidden tabs. GPU resources are disposed on `pagehide`.

## Imagery direction (for real photography)

- Natural window light, warm soft shadows, and a consistent cream/linen backdrop.
- Real parents with real babies in natural interactions. Close-up product details with texture (cotton weave, wood grain).
- Only safe setups: no loose bedding or pillows shown in a crib with a sleeping infant, and car-seat or stroller accessories only as the manufacturer documents them.
- No AI-generated faces or hands, and no distorted anatomy.
- Until real photos exist, the lab uses **procedural 3D props** (ring stacker, rattle, bottle, soft blocks, cloud and moon night-light forms, folded swaddle) and **labelled image placeholders**.
