# Design Guide

This document is the source of truth for the visual system of the Habits app. When you add UI, your job is to make it indistinguishable from what's already there. When the implementation diverges from this doc, update the doc.

## 1. Concept

**Quiet Discipline.** A private ledger of small acts, printed on warm paper, in deep moss-green ink. Editorial calm — not playful, not corporate, not minimalist-for-its-own-sake. The aesthetic rewards restraint: a single color signal does more work than three.

Three words to keep in mind: **warm, intentional, quiet.**

## 2. Color

All colors are defined as OKLCH CSS variables in `frontend/src/index.css` and exposed to Tailwind via `@theme inline`. **Never reach for `bg-white`, `text-neutral-*`, `bg-red-*`, etc.** — use the token.

### Palette

OKLCH is the source of truth (it's what `index.css` declares). Hex values are approximate — for reference and design tools only; **do not paste them into code**.

#### Neutrals — the paper and the ink

| Swatch | Token | OKLCH | ~Hex | Role |
|---|---|---|---|---|
| ░ | `--paper` | `oklch(0.961 0.012 80)` | `#F4F0E8` | App background. The warm bone canvas. `body` only. |
| ▒ | `--paper-deep` | `oklch(0.935 0.018 78)` | `#ECE6D9` | Recessed background, hover wells, subtle insets. |
| □ | `--card` | `oklch(0.995 0.003 80)` | `#FDFCFA` | Surface for cards, inputs, dropdowns. Warm off-white. |
| ▓ | `--hairline` | `oklch(0.88 0.012 75)` | `#DDD6C8` | All borders and dividers. 1px only. |
| ▪ | `--ink` | `oklch(0.22 0.012 60)` | `#2A2722` | Headings, body text. Near-black with a warm cast. |
| ▫ | `--ink-soft` | `oklch(0.42 0.010 65)` | `#5C5750` | Secondary text — labels, captions, helpers. |
| · | `--ink-faint` | `oklch(0.62 0.008 70)` | `#918C82` | Tertiary text — mono micro-labels, disabled, ellipses. |

#### Accents — the moss, the clay, the ember

| Swatch | Token | OKLCH | ~Hex | Role |
|---|---|---|---|---|
| ● | `--moss` | `oklch(0.46 0.085 152)` | `#4A6F54` | Primary accent. Focus rings, hover ink, dot markers. |
| ● | `--moss-deep` | `oklch(0.36 0.080 152)` | `#335240` | Affirmative value text (active habits, primary buttons). |
| ◌ | `--moss-tint` | `oklch(0.94 0.030 152)` | `#E2EDDD` | Affirmative wash. Hover backgrounds on accent items. |
| ● | `--clay` | `oklch(0.74 0.090 55)` | `#D49F75` | Warm marker. Active-user pill. Tertiary — use sparingly. |
| ● | `--ember` | `oklch(0.48 0.130 28)` | `#9C4533` | Negative accent + destructive. Cost values, delete actions. |
| ◌ | `--ember-tint` | `oklch(0.94 0.030 28)` | `#F1E0D9` | Negative wash. Soft warning/error backgrounds. |

#### Hue map

The whole palette sits on a deliberate hue arc through OKLCH:

```
  28° ember       55° clay      80° paper       152° moss
  (warm red) ── (terracotta) ── (warm bone) ── (deep green)
```

Three warm tones (28/55/80°) and one cool counterweight (152°). That's why moss feels grounded next to the paper instead of foreign — and why ember reads as a darker sibling of clay rather than a foreign alert red. **Stay on this arc.** If you ever need a new accent, place it on the same line (e.g. ~115° for a deeper olive) before reaching for a different hue family.

#### Tailwind class reference

Every token is exposed as a Tailwind utility through `@theme inline` in `index.css`. Most-used:

```
bg-paper          bg-paper-deep      bg-card
text-ink          text-ink-soft      text-ink-faint
border-hairline   divide-hairline
text-moss         text-moss-deep     bg-moss-tint
text-clay         bg-clay/15
text-ember        bg-ember           bg-ember-tint
```

Opacity modifiers (`bg-ember/90`, `text-moss-deep/80`, `border-ember/25`) are the right tool for subtle variants — don't add new tokens for tinted versions of existing ones.

### Rules

1. **One color per signal.** A bad-habit card tints the *number*, not the card. The hairline + label stay neutral. If you find yourself adding a border tint AND a background AND colored text, delete two of them.
2. **Color carries meaning, not decoration.** If the user can't articulate why something is moss or ember, it shouldn't be moss or ember.
3. **Zero-states are neutral.** `cost = 0` is ink, not ember. `activeHabits = 0` is ink, not moss. Color only fires when there's something to say.
4. **User-chosen habit colors** (per habit definition) are kept as raw hex but **rendered as 2px dots, never as filled chip backgrounds.** They are markers in the user's vocabulary, not part of the system palette.
5. **Never introduce a new color without a new token.** If you need a new accent, add a `--token` to `index.css` and `@theme inline` — don't inline a hex.

## 3. Typography

Three families, loaded from Google Fonts in `frontend/index.html`:

| Family | Role | Token |
|---|---|---|
| **Fraunces** (variable serif) | Display — page heroes, section titles, large data | `font-display` |
| **Geist** (variable sans) | Body — everything readable | `font-sans` (default) |
| **JetBrains Mono** | Micro-labels, dates, numeric metadata | `font-mono` |

### Rules

1. **Page hero pattern.** Every top-level page opens with: eyebrow (`<p class="eyebrow">`) → Fraunces 4xl/5xl heading with tight tracking → optional one-line ink-soft tagline. See `pages/Home.tsx`, `pages/Metrics.tsx`.
2. **Eyebrows.** Use the `eyebrow` utility (defined in `index.css`): mono, 11px, 0.18em tracking, uppercase, ink-faint. Pair with a flexing `<div class="h-px flex-1 bg-hairline" />` for section dividers.
3. **Headings are Fraunces.** All `h1/h2/h3` inherit `font-display` from the base layer. Don't override to sans.
4. **Card values use sans.** Inside score cards, entry rows, and lists, values are `text-xl font-semibold` Geist — not Fraunces. Reserve serif for narrative hierarchy, not data density.
5. **Tabular nums for numbers.** Anything that changes — counts, currency — gets `tabular-nums`.
6. **Italic moss for the user.** The user's name in the Home hero is italic Fraunces in `text-moss-deep`. Don't reuse this treatment for anything else.

## 4. Surfaces & Composition

### Cards

Use the `surface` utility (`index.css`) for elevated cards. It bundles: `bg-card`, 1px `--hairline` border, generous radius, soft layered shadow with an inset highlight.

For lighter rows (list items, score cards), keep it flat: `rounded-md border border-hairline bg-card p-3`.

### Radius scale

- `radius-sm` (≈8px) — chips, tiny buttons
- `radius-md` (≈10px) — inputs, default
- `radius-lg` (14px) — surfaces, dialogs (default `--radius`)
- `radius-xl` (≈20px) — large feature cards

### Width

There is no global content width. Each page sets its own:

- Home (editorial column): `max-w-2xl`
- Settings (form-heavy): `max-w-3xl`
- Metrics (data-dense): `max-w-5xl`

The header (`components/Header.tsx`) deliberately spans the full viewport — it adopts the visual width of whichever page is showing rather than fighting it.

### Section divider pattern

The recurring rhythm across the app:

```tsx
<div className="flex items-baseline gap-3">
  <span className="eyebrow">last 6 months</span>
  <div className="h-px flex-1 bg-hairline" />
  <h2 className="font-display text-2xl tracking-tight">Heatmaps</h2>
</div>
```

Variants flip the eyebrow and title between sides, or replace the title with a mono date range. Use this; don't invent new section chrome.

## 5. Background atmosphere

The body background is layered (see `index.css`):

1. Solid warm paper
2. Top-right radial moss glow (~55% alpha)
3. Bottom-left radial clay glow (~40% alpha)
4. Fixed SVG grain noise overlay at ~5% alpha

This is **the** atmosphere. Don't add gradients to individual cards — the page already does that work. Cards should stay flat and crisp.

## 6. Motion

Restrained. The base layer ships one keyframe: `rise` (8px upward translate + fade-in over 0.6s with a soft ease).

- Apply `rise` to the top-level page container so each route entrance has one orchestrated reveal.
- Avoid scattered hover bounces, scroll-jacking, or anything that draws attention without purpose.
- Transitions on interactive elements should target `color`, `background-color`, `border-color`, `opacity` — never `transform` for state changes.

## 7. Forms & controls

- **Inputs & select triggers**: `bg-card` (white), `border-hairline`. Never `bg-transparent` on the warm paper — it reads as disabled.
- **Focus ring**: 3px ring at `ring/50` (moss-tinted). Already wired through the shadcn primitives.
- **Pill-shaped filter selects**: use `rounded-full` for tertiary filters (e.g. habit filter on Home). Reserve `rounded-md` for primary form fields.
- **Destructive buttons**: `bg-ember hover:bg-ember/90`. Destructive ghost icons: `text-ember hover:text-ember/80`.

## 8. Iconography

Lucide-react. Sized 18px in the header, 16px (`h-4 w-4`) in row actions. Stroke weight default. Wrap header/nav icons in 40×40 circular hit-targets with `hover:bg-moss-tint hover:text-moss-deep`.

## 9. Do / Don't

**Do**
- Use tokens. Always.
- Open a page with the eyebrow → Fraunces hero pattern.
- Let one tinted number do the work of a colored card.
- Add a new token (with a clear name and role) when you need a new color.
- Match the existing section divider rhythm.

**Don't**
- Use raw Tailwind palettes (`neutral-*`, `red-*`, `slate-*`, `amber-*`).
- Apply gradient washes inside cards — the page background already provides depth.
- Use Fraunces for body, data, or buttons.
- Stack three signals (border + bg + text) when one suffices.
- Introduce shadows beyond what the `surface` utility provides.
- Reach for emoji or icon decoration when a typographic dash, hairline, or eyebrow would do.

## 10. Where things live

- **Tokens & base styles** — `frontend/src/index.css`
- **Fonts** — loaded in `frontend/index.html`
- **App shell** — `frontend/src/App.tsx`
- **Header / nav** — `frontend/src/components/Header.tsx`
- **Page heroes** — `frontend/src/pages/{Home,Metrics,Settings}.tsx`
- **Form primitives (shadcn)** — `frontend/src/components/ui/*`

When in doubt, read those files first. The system is small enough to fit in your head; keep it that way.
