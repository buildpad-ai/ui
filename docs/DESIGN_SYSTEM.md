# Design System Architecture

This workspace ships an enterprise-grade, token-based design system built for professional applications. The palette is built on the Tailwind reference scales—an orange accent on slate neutrals with crisp white surfaces and Inter typography—for a modern, polished look.

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
| **Primary** | `#ea580c` | `#fb923c`  | Orange (Tailwind orange-600) |
| **Accent**  | `#2563eb` | `#60a5fa`  | Blue (Tailwind blue-600)     |
| **Success** | `#16a34a` | `#4ade80`  | Green                        |
| **Info**    | `#0284c7` | `#38bdf8`  | Sky                          |
| **Warning** | `#d97706` | `#fbbf24`  | Amber                        |
| **Danger**  | `#dc2626` | `#f87171`  | Red                          |
| **Gray**    | Slate     | Slate (inverted) | Tailwind slate neutrals |

### Gray Scale (Slate)

| Token          | Light       | Dark (inverted) |
|----------------|-------------|-----------------|
| `--ds-gray-50` | `#f8fafc`   | `#020617`       |
| `--ds-gray-100`| `#f1f5f9`   | `#0f172a`       |
| `--ds-gray-200`| `#e2e8f0`   | `#1e293b`       |
| `--ds-gray-300`| `#cbd5e1`   | `#334155`       |
| `--ds-gray-400`| `#94a3b8`   | `#475569`       |
| `--ds-gray-500`| `#64748b`   | `#94a3b8`       |
| `--ds-gray-900`| `#0f172a`   | `#f8fafc`       |

## Typography

| Role       | Font Family     | Usage                    |
|------------|-----------------|--------------------------|
| **Body**   | Inter           | All body text, UI labels |
| **Display**| Inter           | Headings, hero text      |
| **Code**   | JetBrains Mono  | Monospace, code blocks   |

```css
--ds-font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
--ds-font-display: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
--ds-font-mono: "JetBrains Mono", "SF Mono", SFMono-Regular, Consolas, monospace;
```

## Token Strategy

Tokens are defined with the `--ds-` prefix and use CSS custom properties so themes can be swapped without rebuilding.

```css
:root {
  --ds-primary: #ea580c;
  --ds-gray-500: #64748b;
  --ds-spacing-4: 1rem;
  --ds-radius: 0.375rem;
  --ds-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --ds-focus-ring: 0 0 0 3px rgba(234, 88, 12, 0.25);
  --ds-transition-fast: 150ms ease;
  --ds-body-bg: #ffffff;
}
```

## Mantine Theme Mapping

`lib/theme.ts` maps token values into Mantine, so all components inherit the system defaults automatically.

```ts
import { createTheme } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "primary",
  primaryShade: 6,
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

Dark mode is handled with the `[data-mantine-color-scheme="dark"]` selector in `design-tokens.css`. Mantine uses `ColorSchemeScript` and `defaultColorScheme="auto"` in the root layout. In dark mode every hue's numbered scale is mirrored (50↔950, 100↔900, …), the primary shifts to a lighter orange (`#fb923c`), and surfaces move to slate-950/900.

## Storybook Enterprise Theme

All package Storybooks share a consistent enterprise look via three shared files at the `packages/` root:

- `storybook-enterprise-theme.ts` — Mantine theme for the canvas (preview), with hardcoded Tailwind palette values (no CSS variables, since Storybook renders in isolation)
- `storybook-enterprise-manager.ts` — Storybook UI chrome theme (sidebar, toolbar)
- `storybook-enterprise-preview.css` — Shared CSS for preview wrappers

## How To Customize

1. Update token values in `app/design-tokens.css`.
2. Extend `lib/theme.ts` for component-level defaults.
3. Add any global overrides in `app/globals.css`.
4. Update `packages/storybook-enterprise-theme.ts` to match (uses hardcoded values).

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

- Tokens use the `--ds-` prefix and are brand-neutral so they can be re-themed.
- All UI code must use Mantine theme variables (`--mantine-primary-color-*`) or design tokens (`--ds-*`) — never hard-coded hex colors or `--mantine-color-blue-*`.
- Monospace references must use `var(--mantine-font-family-monospace)` — never hardcoded font stacks like `Monaco, Menlo, "Ubuntu Mono"`.
- Semantic color props (`color="red"` for errors, `color="green"` for success) are acceptable where they represent status, not brand.
