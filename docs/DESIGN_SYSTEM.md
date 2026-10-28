# Design System Architecture

This workspace ships a token-based design system in the **BuildPad brand — Ink & Ember**, aligned with
[buildpad.ai](https://www.buildpad.ai). Ink (`#0a0a0b`) is the primary action colour, ember orange is the
brand accent, and both sit on cool neutral greys with calm flat surfaces, hairline borders, soft long
shadows, Inter body text and Inter Tight headings.

## Overview

The design system has three layers:

1. **Design tokens** in `app/design-tokens.css` (single source of truth)
2. **Mantine theme mapping** in `lib/theme.ts` (tokens → component defaults)
3. **Global overrides** in `app/globals.css` (Mantine class-level tweaks + `.bp-*` app-shell classes)

## Files

```
app/design-tokens.css   # Color, typography, spacing, radius, shadow tokens (light + dark)
app/globals.css         # Font import, base styles, Mantine overrides, .bp-* shell classes
lib/theme.ts            # Mantine createTheme() using CSS variables
components/ColorSchemeToggle.tsx  # Optional light/dark toggle
```

## Principles

1. **Ink is the primary action colour; ember is the brand accent.** A Button with no `color` renders as a
   black ink pill with white text. Orange is used for interactive state (checkbox, switch, radio, slider,
   focus ring, active tab underline, active nav, progress, links on hover), brand marks, highlights, and
   explicit brand CTAs (`color="primary"`). Never orange body text on white below the 700 stop.
2. **Cool neutrals.** Greys are the site's neutral-cool scale, not Tailwind slate (no blue cast).
3. **Calm surfaces.** A flat `#fafbfc` page, white cards with hairline `#e8e9ec` borders and a soft, long
   shadow. No page gradients.
4. **One radius language.** Inputs 8px, popovers/menus 12px, cards/modals 16px, large surfaces 24px,
   buttons and badges are pills.
5. **Built-in hues resolve to brand semantics.** `color="red" | "green" | "yellow" | "blue" | "orange"`
   resolve to the danger / success / warning / info / primary scales, so status props pick up the brand
   colours automatically.

## Color Palette

Each hue has eleven stops (`--ds-{hue}-50` … `--ds-{hue}-950`) plus an unsuffixed main (`--ds-{hue}`)
equal to the 600 stop. Mantine palettes map indices 0–9 to stops 50–900 (950 is dropped).

| Role          | Light main | Dark main | Notes                                                       |
|---------------|-----------|-----------|-------------------------------------------------------------|
| **Primary**   | `#e86a00` | `#fd9843` | Ember — brand accent (`--ds-primary-rgb: 232, 106, 0`)      |
| **Secondary** | `#2a2b31` | `#d7d9df` | Ink — inverts to light greys in dark mode                   |
| **Success**   | `#059669` | `#34d399` | Emerald (alias `green`)                                     |
| **Info**      | `#2563eb` | `#60a5fa` | Blue (alias `blue`)                                         |
| **Warning**   | `#d97706` | `#fbbf24` | Amber (alias `yellow`)                                      |
| **Danger**    | `#d92d20` | `#f97066` | Red (alias `red`)                                           |
| **Gray**      | Neutral   | Neutral (hand-tuned) | Cool neutrals, numbered stops only               |

`orange` and `accent` are aliases of the primary scale.

### Primary (Ember) and Secondary (Ink) scales

| Stop | Primary   | Secondary |
|------|-----------|-----------|
| 50   | `#fff8f2` | `#f4f4f6` |
| 100  | `#ffeee1` | `#e8e9ec` |
| 200  | `#ffd9b8` | `#d7d9df` |
| 300  | `#feaa6b` | `#b9bac2` |
| 400  | `#fd9843` | `#8a8b94` |
| 500  | `#fd7f15` | `#54555d` |
| 600  | `#e86a00` | `#2a2b31` |
| 700  | `#b34d00` | `#18191d` |
| 800  | `#8f3d00` | `#131418` |
| 900  | `#6b2e00` | `#0a0a0b` |
| 950  | `#3d1a00` | `#050506` |

### Gray Scale (Neutral)

| Token           | Light     | Dark      |
|-----------------|-----------|-----------|
| `--ds-gray-50`  | `#fafbfc` | `#0a0a0b` |
| `--ds-gray-100` | `#f4f4f6` | `#131418` |
| `--ds-gray-200` | `#e8e9ec` | `#23242a` |
| `--ds-gray-300` | `#d7d9df` | `#34353c` |
| `--ds-gray-400` | `#9b9ca6` | `#6b6c75` |
| `--ds-gray-500` | `#6b6c75` | `#9b9ca6` |
| `--ds-gray-600` | `#54555d` | `#b9bac2` |
| `--ds-gray-700` | `#3a3b42` | `#d7d9df` |
| `--ds-gray-800` | `#2a2b31` | `#e8e9ec` |
| `--ds-gray-900` | `#131418` | `#f4f4f6` |
| `--ds-gray-950` | `#0a0a0b` | `#ffffff` |

### Contrast rules

- Small coloured text uses the **700** stop (`--ds-primary-700` = `#b34d00`, ≈5.3:1 on white). Use
  `--ds-accent-text` for orange text: it resolves to the 700 stop in both schemes.
- `--ds-gray-500` (`#6b6c75`) is the lightest grey for muted text (5.2:1 on white, 4.75:1 on gray-100).
- White on filled orange is ≈3.2:1, so filled orange is for graphics and large brand CTAs only. The
  default Button is ink (19.8:1) and the default Badge is the light variant.
- Light and outline variants (badges, alerts, outline buttons) use index 7 for their text colour in both
  schemes, for every palette and alias, so they pass AA. Warning/yellow use index 8 in light mode
  (amber-700 is only ≈4.4:1 on its own tint).
- The focus border and active-tab underline use the 600 stop (`#e86a00`, ≈3.2:1 on white), which meets the
  3:1 non-text minimum. Storybook keeps a solid 2px ember `:focus-visible` outline.

## Surfaces, text and borders

| Token                      | Light                     | Dark                      |
|----------------------------|---------------------------|---------------------------|
| `--ds-body-bg`             | `#fafbfc` (flat)          | `#0a0a0b`                 |
| `--ds-ink`                 | `#0a0a0b`                 | `#f4f4f6`                 |
| `--ds-ink-secondary`       | `#54555d`                 | `#b9bac2`                 |
| `--ds-ink-faint`           | `#6b6c75`                 | `#9b9ca6`                 |
| `--ds-body-color`          | `var(--ds-gray-900)`      | `#e8e9ec`                 |
| `--ds-card-bg`             | `#ffffff`                 | `#131418`                 |
| `--ds-card-border`         | `#e8e9ec`                 | `#23242a`                 |
| `--ds-divider`             | `#eeeff2`                 | `#1c1d22`                 |
| `--ds-border-color`        | `var(--ds-gray-200)`      | `var(--ds-gray-200)`      |
| `--ds-border-color-subtle` | `var(--ds-gray-100)`      | `var(--ds-gray-100)`      |
| `--ds-accent-text`         | `var(--ds-primary-700)`   | `var(--ds-primary-700)`   |

Cards and dividers use gray-200; inputs use gray-300 (one step stronger).

### New tokens

| Token                                         | Light                                      | Dark                                       |
|-----------------------------------------------|--------------------------------------------|--------------------------------------------|
| `--ds-cta-bg` / `-bg-hover` / `--ds-cta-color` | `#0a0a0b` / `#2a2b31` / `#ffffff`          | `#f4f4f6` / `#ffffff` / `#0a0a0b`          |
| `--ds-focus-border`                           | `var(--ds-primary-500)` (`#fd7f15`)        | `var(--ds-primary-600)` (`#fd9843`)        |
| `--ds-focus-ring`                             | `0 0 0 3px rgb(253 127 21 / 0.22)`         | `0 0 0 3px rgb(253 152 67 / 0.30)`         |
| `--ds-shadow-xs`                              | `0 1px 1px 0 rgb(10 10 11 / 0.03)`         | `0 1px 2px 0 rgb(0 0 0 / 0.3)`             |
| `--ds-letter-spacing-tight` / `-tighter`      | `-0.02em` / `-0.03em`                      | (same)                                     |

### Brand tokens (fixed, non-inverting)

These are not redefined in the dark block:

- `--ds-brand-mark`, `--ds-brand-accent-mark`, `--ds-cta-gradient`: `linear-gradient(135deg, #fd9843 0%, #e86a00 100%)`
  (the orange logo tile); `--ds-cta-shadow` is its orange glow.
- `--ds-brand-hero` / `--ds-hero-bg`: an ink panel with a single ember radial wash; `--ds-hero-sub: #b9bac2`.
- `--ds-brand-ink-900` / `-800` / `-500`: `#0a0a0b` / `#131418` / `#54555d`.
- **Deprecated:** `--ds-brand-navy-900` / `-800` / `-500` remain as aliases of `var(--ds-brand-ink-*)` so
  existing consumer CSS keeps working. Use the `--ds-brand-ink-*` names in new code.
- Icon rail: `--ds-rail-bg` (ink in light, translucent glass in dark), `--ds-rail-active-bg` /
  `--ds-rail-active-icon` / `--ds-rail-active-ring` use ember.

## Typography

| Role        | Font Family    | Usage                                                        |
|-------------|----------------|--------------------------------------------------------------|
| **Body**    | Inter          | All body text and UI labels (400 / 500 / 600 / 700)          |
| **Display** | Inter Tight    | Headings and display text, weight 600, tight negative tracking |
| **Code**    | JetBrains Mono | Monospace, code blocks, `kbd` (400 / 500)                    |

```css
--ds-font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
--ds-font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
--ds-font-display: "Inter Tight", var(--ds-font-sans);
--ds-font-mono: "JetBrains Mono", "SF Mono", SFMono-Regular, Consolas, monospace;
--ds-letter-spacing-tight: -0.02em;   /* headings */
--ds-letter-spacing-tighter: -0.03em; /* h1 / hero */
```

`app/globals.css` imports the three families from Google Fonts. Body text runs at
`--ds-body-font-size: 0.875rem` for density. Heading sizes use the `--ds-font-size-*` scale (xs 0.75rem
… 4xl 2.25rem).

## Radius

| Token             | Value            | Usage                 | Mantine |
|-------------------|------------------|-----------------------|---------|
| `--ds-radius-sm`  | 0.375rem (6px)   | tooltips, small controls | `xs`  |
| `--ds-radius`     | 0.5rem (8px)     | inputs (default)      | `sm` (`defaultRadius`) |
| `--ds-radius-md`  | 0.625rem (10px)  | Paper                 | `md`    |
| `--ds-radius-lg`  | 0.75rem (12px)   | popovers, menus       | `lg`    |
| `--ds-radius-xl`  | 1rem (16px)      | modals                | `xl`    |
| `--ds-radius-card`| 16px             | cards                 |         |
| `--ds-radius-hero`| 24px             | large surfaces        |         |
| `--ds-radius-rail`| 16px             | icon rail             |         |
| `--ds-radius-pill`| 999px            | buttons, badges       |         |

## Shadows

Ink-tinted, soft and long (light mode). Dark mode uses black-based shadows.

| Token              | Light                                                                                       | Usage            |
|--------------------|---------------------------------------------------------------------------------------------|------------------|
| `--ds-shadow-xs`   | `0 1px 1px 0 rgb(10 10 11 / 0.03)`                                                          | hairline lift    |
| `--ds-shadow-sm`   | `0 1px 2px 0 rgb(10 10 11 / 0.06)`                                                          | small controls   |
| `--ds-shadow`      | `0 1px 2px 0 rgb(10 10 11 / 0.05), 0 2px 8px -2px rgb(10 10 11 / 0.08)`                     | raised elements  |
| `--ds-shadow-md`   | `0 1px 2px 0 rgb(10 10 11 / 0.04), 0 8px 24px -8px rgb(10 10 11 / 0.14)`                    | hover elevation  |
| `--ds-shadow-lg`   | `0 2px 4px 0 rgb(10 10 11 / 0.04), 0 18px 40px -16px rgb(10 10 11 / 0.22)`                  | popovers, menus  |
| `--ds-shadow-xl`   | `0 2px 4px 0 rgb(10 10 11 / 0.04), 0 40px 80px -40px rgb(10 10 11 / 0.30), 0 0 0 1px rgb(10 10 11 / 0.05)` | modals |
| `--ds-card-shadow` | `0 1px 1px 0 rgb(10 10 11 / 0.03), 0 18px 40px -30px rgb(10 10 11 / 0.28)`                  | cards            |

Mantine `shadows` map `xs`–`xl` to `--ds-shadow-xs` … `--ds-shadow-xl`. Transitions are
`--ds-transition-fast: 150ms cubic-bezier(0.2, 0, 0, 1)` and `--ds-transition-normal: 200ms cubic-bezier(0.2, 0, 0, 1)`.

## Token Strategy

Tokens are defined with the `--ds-` prefix and use CSS custom properties so themes can be swapped without
rebuilding.

```css
:root {
  --ds-primary: #e86a00;
  --ds-secondary: #2a2b31;
  --ds-gray-500: #6b6c75;
  --ds-spacing-4: 1rem;
  --ds-radius: 0.5rem;
  --ds-shadow-sm: 0 1px 2px 0 rgb(10 10 11 / 0.06);
  --ds-cta-bg: #0a0a0b;
  --ds-focus-ring: 0 0 0 3px rgb(253 127 21 / 0.22);
  --ds-transition-fast: 150ms cubic-bezier(0.2, 0, 0, 1);
  --ds-body-bg: #fafbfc;
}
```

## Mantine Theme Mapping

`lib/theme.ts` maps token values into Mantine, so all components inherit the system defaults
automatically. Palettes are `var(--ds-*)` arrays; `red`, `green`, `yellow`, `blue`, `orange` and `accent`
are the same arrays as their semantic scale.

```ts
import { createTheme } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "primary",
  primaryShade: 6,
  defaultRadius: "sm",
  fontFamily: "var(--ds-font-family)",
  headings: { fontFamily: "var(--ds-font-display)", fontWeight: "600" },
  spacing: {
    sm: "var(--ds-spacing-3)",
    md: "var(--ds-spacing-4)",
  },
});
```

`primaryShade` is a single number (6) because `design-tokens.css` mirrors the `--ds-*` variables
themselves in dark mode — index 6 resolves to the lighter tone there, so a per-scheme shade would
double-invert. Keep `primaryShade` and that mirroring in sync.

### Component defaults

| Component | Default |
|-----------|---------|
| **Button** | Pill radius, weight 500. With no `color` and a `filled` (or unset) variant, it renders as the **ink CTA** (`--button-bg: var(--ds-cta-bg)`, hover `--ds-cta-bg-hover`, text `--ds-cta-color`) via a `Button.extend({ vars })` resolver. `color="primary"` keeps the orange brand CTA. Other variants are unchanged. |
| **Badge** | `variant="light"`, pill radius, weight 500, no text transform, `xs` text. |
| **Inputs** | `--ds-radius` (8px), gray-300 border; focus = `--ds-focus-border` + `--ds-focus-ring`. Labels: `sm`, weight 500, gray-700, 4px bottom margin. |
| **Card** | `--ds-radius-card` (16px), `--ds-card-border`, `--ds-card-bg`, `--ds-card-shadow`. |
| **Paper** | `--ds-radius-md`. |
| **Modal** | `--ds-radius-xl` (16px), `shadow-xl`, divider under the header, title in the display font (600). |
| **Popover / Menu / Combobox** | `--ds-radius-lg` (12px), `shadow-lg`, 1px `--ds-border-color` border. |
| **Tooltip** | Ink background with white text in light; inverted in dark; `sm` radius, `xs` text. |
| **Tabs** | Weight 500, gray-100 hover; active tab = `--ds-ink` text, weight 600, `--ds-primary-500` underline. |
| **Table** | `th` at `xs`, weight 600, gray-500; `withTableBorder` on by default. |
| **Anchor** | `--ds-accent-text`, underline on hover. |
| **Notifications** | Semantic left-border accents. |

### App shell (`.bp-*` classes)

- Header: 12px backdrop blur on translucent white (light) / translucent ink (dark), hairline bottom border.
- Navbar: `--ds-gray-50` (light) / `#0a0a0b` (dark), hairline right border.
- Nav link: 8px radius, `--ds-ink-secondary` text, gray-100 hover. **Active** = `--ds-primary-50` wash,
  `--ds-ink` text at weight 600, an inset `--ds-primary-200` ring and a `--ds-primary-600` icon.
- Brand tile (`.bp-brand-icon`): `--ds-brand-mark` with `--ds-cta-shadow`, 10px radius, white glyph.
- Search button: pill, gray-50 background, hairline border, `kbd` in the mono font.
- Login page: dark brand panel on `--ds-brand-hero` with ember accents.

### Mantine CSS Variable Conventions

When referencing colors in component code, always use **theme-aware variables** rather than color-specific
ones:

| Use                                | Don't use                        |
|------------------------------------|----------------------------------|
| `--mantine-primary-color-6`        | `--mantine-color-blue-6`         |
| `--mantine-primary-color-light`    | `--mantine-color-blue-light`     |
| `--mantine-primary-color-0`        | `--mantine-color-blue-0`         |
| `--mantine-font-family-monospace`  | Hardcoded `Monaco, Menlo, ...`   |
| `--mantine-font-family`            | Hardcoded system font stacks     |

This ensures components adapt automatically when the primary color or fonts change.

## Dark Mode

Dark mode is handled with the `[data-mantine-color-scheme="dark"]` selector in `design-tokens.css`.
Mantine uses `ColorSchemeScript` and `defaultColorScheme="auto"` in the root layout.

- The numbered `--ds-*` stops flip so tokens authored for light backgrounds stay legible: success, info,
  warning and danger mirror exactly (50↔950, 100↔900, …, 500 stays), so each main becomes the light-mode
  400 tone.
- Primary moves to `#fd9843`; ink (secondary) inverts to light greys (main `#d7d9df`).
- The gray scale is hand-tuned rather than a strict mirror, so muted text stays AA on `#0a0a0b`.
- Surfaces move to ink: `#0a0a0b` page, opaque `#131418` cards, `#23242a` hairlines. The CTA flips to a
  light pill with ink text.
- Mantine's `dark` palette is set to the matching static ink greys (in both themes) for body, input and
  border surfaces.
- Filled variants (explicit `color`, checkboxes, switches) draw white on Mantine's index 6, which the
  mirror makes a light tone. `globals.css` repoints `--mantine-color-{c}-filled` to index 4 (index 3 for
  green/amber), so the fill is the light-mode 600/700 stop (e.g. `#c25400`) and white stays ≥ 4.5:1.
- Brand tokens (`--ds-brand-*`, `--ds-cta-gradient`) do not change between schemes.

## Storybook Enterprise Theme

All package Storybooks share the same brand look via three shared files at the `packages/` root:

- `storybook-enterprise-theme.ts` — re-exports the shipped `lib/theme.ts` (from
  `packages/cli/templates/`) as `enterpriseTheme`, so the canvas renders the exact theme `buildpad init`
  installs. It also exports static primitives for the manager chrome, which cannot read CSS variables:
  `FONT_BODY` (Inter), `FONT_MONO`, `COLOR_BORDER` (`#e8e9ec`) and `COLOR_MUTED` (`#6b6c75`).
- `storybook-enterprise-manager.ts` — Storybook UI chrome (sidebar, toolbar): `#fafbfc` app background,
  white content, `#e8e9ec` borders, ink text, ember selection, brand link to buildpad.ai.
- `storybook-enterprise-preview.css` — imports the shipped `app/design-tokens.css` and `app/globals.css`
  (tokens in both schemes, variant contrast fixes, tabs, cards, form fields, dark-mode overrides) and adds
  only the Storybook wrapper layout. Storybooks with a colour-scheme toolbar switch get the real dark theme.

## How To Customize

1. Update token values in `app/design-tokens.css` (keep the light and dark blocks in step).
2. Extend `lib/theme.ts` for component-level defaults.
3. Add any global overrides in `app/globals.css`.
4. Storybook picks up `lib/theme.ts`, `design-tokens.css` and `globals.css` automatically; only the
   manager chrome (`packages/storybook-enterprise-manager.ts` and the primitives it imports) uses
   hardcoded values and needs updating by hand.

To re-brand, change the primary and secondary scales and `--ds-cta-*`; the hue aliases, focus tokens and
app shell follow automatically.

## Delivery & Upgrades

The design files ship as the **`design-system`** lib module (registry `lib.design-system`):
`app/design-tokens.css`, `app/globals.css`, `lib/theme.ts`, plus the app shell
(`components/ColorSchemeToggle.tsx`, `components/layout/AuthenticatedShell.tsx`). `buildpad init`
installs them from the bundled CLI templates (offline, version-matched) and records them in
`buildpad.json` with per-file checksums. Consumers refresh with `buildpad upgrade --design`
(three-way merge preserves local token edits); `buildpad outdated` reports the module when behind.
Sources live under `packages/cli/templates/` and are CLI-owned (`@buildpad/cli`), so `lastChangedIn`
tracks the CLI package version.

## Notes

- Tokens use the `--ds-` prefix and can be re-themed without touching component code.
- All UI code must use Mantine theme variables (`--mantine-primary-color-*`) or design tokens (`--ds-*`) —
  never hard-coded hex colors or `--mantine-color-blue-*`.
- Monospace references must use `var(--mantine-font-family-monospace)` — never hardcoded font stacks like
  `Monaco, Menlo, "Ubuntu Mono"`.
- Semantic color props (`color="red"` for errors, `color="green"` for success) are acceptable where they
  represent status, not brand; they resolve to the brand danger / success scales.
