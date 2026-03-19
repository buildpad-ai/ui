# Design System Architecture

This workspace ships an enterprise-grade, token-based design system built for professional applications. The palette uses a warm, earthy aesthetic—burnt orange primary, cream-tinted warm grays, and refined typography—designed to feel approachable yet authoritative.

## Overview

The design system has three layers:

1. **Design tokens** in `app/design-tokens.css` (single source of truth)
2. **Mantine theme mapping** in `lib/theme.ts` (tokens → component defaults)
3. **Global overrides** in `app/globals.css` (Mantine class-level tweaks)

## Files

```
app/design-tokens.css   # Color, typography, spacing, radius, shadow tokens
app/globals.css         # Base styles + Mantine overrides
lib/theme.ts            # Mantine createTheme() using CSS variables
components/ColorSchemeToggle.tsx  # Optional light/dark toggle
```

## Color Palette

| Role        | Light Mode | Dark Mode  | Notes                        |
|-------------|-----------|------------|------------------------------|
| **Primary** | `#e35b2a` | `#fb923c`  | Burnt orange                 |
| **Accent**  | `#1e3a8a` | `#60a5fa`  | Deep blue accent             |
| **Success** | `#1b7a3f` | `#34d399`  | Forest green                 |
| **Info**    | `#0ea5e9` | `#38bdf8`  | Sky blue                     |
| **Warning** | `#a46b00` | `#fbbf24`  | Professional amber           |
| **Danger**  | `#b4232a` | `#f87171`  | Clean red                    |
| **Gray**    | Warm cream | Warm (inverted) | Cream-tinted warm grays |

### Gray Scale (Warm)

| Token          | Light       | Dark (inverted) |
|----------------|-------------|-----------------|
| `--ds-gray-100`| `#f7f5ef`   | `#191612`       |
| `--ds-gray-200`| `#f7f1e6`   | `#252118`       |
| `--ds-gray-300`| `#efe7d8`   | `#3a342c`       |
| `--ds-gray-400`| `#d9cfbe`   | `#524a3f`       |
| `--ds-gray-500`| `#6f6558`   | `#a59e90`       |
| `--ds-gray-900`| `#191612`   | `#f7f5ef`       |

## Typography

| Role       | Font Family     | Usage                    |
|------------|-----------------|--------------------------|
| **Body**   | Space Grotesk   | All body text, UI labels |
| **Display**| Fraunces        | Headings, hero text      |
| **Code**   | JetBrains Mono  | Monospace, code blocks   |

```css
--ds-font-family: "Space Grotesk", "Helvetica Neue", Arial, sans-serif;
--ds-font-display: "Fraunces", "Times New Roman", serif;
--ds-font-mono: "JetBrains Mono", "SF Mono", SFMono-Regular, Consolas, monospace;
```

## Token Strategy

Tokens are defined with the `--ds-` prefix and use CSS custom properties so themes can be swapped without rebuilding.

```css
:root {
  --ds-primary: #e35b2a;
  --ds-gray-500: #6f6558;
  --ds-spacing-4: 1rem;
  --ds-radius: 8px;
  --ds-shadow-sm: 0 1px 2px 0 rgba(25, 22, 18, 0.04);
  --ds-focus-ring: 0 0 0 3px rgba(227, 91, 42, 0.18);
  --ds-transition-fast: 150ms ease;
  --ds-body-bg: #f7f5ef;
}
```

## Mantine Theme Mapping

`lib/theme.ts` maps token values into Mantine, so all components inherit the system defaults automatically.

```ts
import { createTheme } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "primary",
  primaryShade: { light: 4, dark: 3 },
  fontFamily: "var(--ds-font-family)",
  headings: { fontFamily: "var(--ds-font-display)" },
  spacing: {
    sm: "var(--ds-spacing-3)",
    md: "var(--ds-spacing-4)",
  },
});
```

### Mantine CSS Variable Conventions

When referencing colors in component code, always use **theme-aware variables** rather than color-specific ones:

| Use                              | Don't use                        |
|----------------------------------|----------------------------------|
| `--mantine-primary-color-6`     | `--mantine-color-blue-6`        |
| `--mantine-primary-color-light` | `--mantine-color-blue-light`    |
| `--mantine-primary-color-0`     | `--mantine-color-blue-0`        |
| `--mantine-font-family-monospace` | Hardcoded `Monaco, Menlo, ...` |
| `--mantine-font-family`         | Hardcoded system font stacks   |

This ensures components adapt automatically when the primary color or fonts change.

## Dark Mode

Dark mode is handled with the `[data-mantine-color-scheme="dark"]` selector in `design-tokens.css`. Mantine uses `ColorSchemeScript` and `defaultColorScheme="auto"` in the root layout. In dark mode the primary shifts to a lighter orange (`#fb923c`) and grays invert from dark-to-light.

## Storybook Enterprise Theme

All package Storybooks share a consistent enterprise look via three shared files at the `packages/` root:

- `storybook-enterprise-theme.ts` — Mantine theme for the canvas (preview), with hardcoded warm palette values (no CSS variables, since Storybook renders in isolation)
- `storybook-enterprise-manager.ts` — Storybook UI chrome theme (sidebar, toolbar)
- `storybook-enterprise-preview.css` — Shared CSS for preview wrappers

## How To Customize

1. Update token values in `app/design-tokens.css`.
2. Extend `lib/theme.ts` for component-level defaults.
3. Add any global overrides in `app/globals.css`.
4. Update `packages/storybook-enterprise-theme.ts` to match (uses hardcoded values).

## Notes

- Tokens use the `--ds-` prefix and are brand-neutral so they can be re-themed.
- All UI code must use Mantine theme variables (`--mantine-primary-color-*`) or design tokens (`--ds-*`) — never hard-coded hex colors or `--mantine-color-blue-*`.
- Monospace references must use `var(--mantine-font-family-monospace)` — never hardcoded font stacks like `Monaco, Menlo, "Ubuntu Mono"`.
- Semantic color props (`color="red"` for errors, `color="green"` for success) are acceptable where they represent status, not brand.
