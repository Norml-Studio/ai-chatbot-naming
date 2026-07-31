# WP Concierge Product Direction — Design Contract

> **This file is binding.** Every build or edit in this artifact follows the values below.
>
> **Status:** v1.5.0 · Jul 31, 2026
> **Implemented in:** `../index.html` and `../styles.css`
> **Mode:** DEFINE — a self-contained strategic review page, not a product website.

## 1. Identity

Editorial product-direction and naming review: calm, opinionated, and legible at a distance. The decision-lab subroute applies the same warm-paper / dark-workspace system to a gesture-first, local-persistence interaction, rather than a dashboard or SaaS landing page.

## 2. Colour

| Token | Hex | Role |
|---|---|---|
| Canvas | `#f3efe7` | One page canvas |
| Ink | `#27211d` | Primary text and rules |
| Muted ink | `#70675e` | Supporting text |
| Clay | `#b84935` | The one accent: actions, ranks, selection status |
| Clay deep | `#8d2e20` | Accent hover / dark background detail |
| Dark canvas | `#24221e` | One major chapter break |
| Dark ink | `#f5f0e8` | Text on dark canvas |
| Panel | `#e5ddd1` | Surface inside the canvas only |

Accent discipline: clay appears only in rank markers, focus states, active filters, and selected-status marks. It never appears as a decorative gradient, an arbitrary section fill, or body text.

## 3. Typography

| Role | Family | Usage |
|---|---|---|
| Display | `Source Serif 4` | H1/H2, large candidate names |
| Text | `Public Sans` | Body, controls, tables, notes |

Google Fonts are used under their open licences. Source Serif 4 replaces the earlier Bodoni Moda choice because its lower contrast and sturdier forms remain easier to read at display size. Banned: Inter, Roboto, Arial, system-ui as the primary face; any mono face for visual garnish; all eyebrows and micro-labels above headings.

| Role | Desktop | Tablet | Mobile | Weight | Leading | Tracking |
|---|---:|---:|---:|---:|---:|---:|
| H1 | 96px | 68px | 46px | 500 | .98 | -.045em |
| H2 | 58px | 46px | 36px | 500 | 1.04 | -.035em |
| H3 / name | 34px | 29px | 25px | 500 | 1.08 | -.025em |
| Lead | 22px | 19px | 18px | 400 | 1.45 | -.012em |
| Body | 16px | 16px | 16px | 400 | 1.55 | .002em |
| Meta | 12px | 12px | 12px | 600 | 1.3 | .08em |

## 4. Spacing & shape

- Base unit: 8px
- Spacing scale: 8 / 16 / 24 / 32 / 48 / 64 / 96 / 128 / 160px
- Radius: 6px for buttons and inputs; 14px for elevated panels; no pills except status markers
- Elevation: one restrained multi-layer shadow only on the featured name panel; elsewhere use no border or a one-pixel ink rule only where it separates a real group

## 5. Surfaces & canvas rule

The page is one warm canvas. Transparent sections inherit it. There is one dark full-bleed chapter for the 80-name field. Panel is used inside the hero and selected name feature only.

Canvas audit rule: no more than three top-level background treatments. Current implementation: canvas, dark canvas, print white. PASS.

## 6. Layout

- Full-viewport sections; adaptive gutters: 80px desktop / 48px tablet / 20px mobile
- No max width at page level. Text measure: 680px maximum; repeated shortlist rows: 900px maximum.
- Main editorial split: 1.3fr / .7fr on desktop, stacked at ≤1024px.
- Major section rhythm: 160 / 120 / 80px, varied by section.
- Desktop ≥1025px, tablet 641–1024px, mobile ≤640px. Scale-up adjustments at 1600 and 1800px.

## 7. Components

- Buttons: 44px min-height; 6px radius; clay fill or transparent ink rule; explicit transform/colour transitions; active scale `.96`.
- Filter controls: 44px min-height; compact text; active state is clay fill.
- Candidate rows: no card grid; each row is a contained editorial item with rank, name, idea, and status.
- Tables: two-column cards become rows at mobile; no control stranded across the viewport.

## 8. Imagery

This is a text-first strategy artifact. No stock or AI imagery is used. The visual counterweight is typographic scale, an evidence matrix, and an actual interactive candidate field; no decorative illustration substitutes for content.

## 9. Motion

One primary movement: shortlist rows gently reveal after initial load. Filters transition opacity and background only. `prefers-reduced-motion` disables all movement.

## 10. Do / Don’t

Do:

- Let the headline and names carry visual weight.
- Keep long text and repeated items contained.
- Make a dark chapter mean something: it holds the full working field.
- Use the clay accent only as a decision signal.

Don’t:

- Add micro-labels above headings.
- Turn every name into the same rounded card.
- Add gradients, blobs, glass, dashboard widgets, or generic AI imagery.
- Add a new section background to create separation.

## 11. Agent prompt guide

- Editorial, warm paper canvas; Bodoni Moda display and Public Sans body.
- One clay accent; dark full-bleed field chapter; no gradients or blobs.
- Full-width canvas with adaptive gutters, but body copy and repeated rows stay narrow.
- No kicker/eyebrow above headings and no monospace design language.
- Preserve deliberate asymmetry in the hero and podium; do not flatten into equal cards.
- All controls have 44px target, `text-wrap: balance` headings, and explicit transitions.

## 12. Code export

```css
:root {
  --canvas: #f3efe7;
  --ink: #27211d;
  --muted: #70675e;
  --clay: #b84935;
  --clay-deep: #8d2e20;
  --dark: #24221e;
  --dark-ink: #f5f0e8;
  --panel: #e5ddd1;
  --gutter: clamp(20px, 5.55vw, 80px);
}
```

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&display=swap" rel="stylesheet" />
```

## 13. Provenance

| Source | What it gave |
|---|---|
| `Product positioning [Strategy] | AI Chatbot.md` | Product direction, capability set, and legal caveat |
| `vibe-frontend-standards` | Responsive layout contract |
| `design-anti-slop` | Universal visual constraints |
| `make-interfaces-feel-better` | Detail polish rules |

Known gaps: no final product brand decision exists yet; this page must keep the “preliminary screen, not legal clearance” wording until final counsel/registry checks are completed.
