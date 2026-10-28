/**
 * Shared Mantine theme for all Storybook previews.
 *
 * Re-exports the theme `buildpad init` installs (cli/templates/lib/theme.ts)
 * rather than mirroring it, so the canvas always renders exactly what a
 * consumer app gets. Its palette is var(--ds-*) based; the tokens, the
 * light/dark variant fixes and the component rules come from the shipped
 * design-tokens.css and globals.css, which storybook-enterprise-preview.css
 * imports. Each package's .storybook/preview.tsx imports this theme and that
 * stylesheet.
 */
export { theme as enterpriseTheme } from "./cli/templates/lib/theme";

// Static primitives for the Storybook manager chrome
// (storybook-enterprise-manager.ts), which is themed outside the canvas and
// cannot read CSS variables. Hex values of the matching --ds-* tokens.
export const FONT_BODY =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
export const FONT_MONO =
  '"JetBrains Mono", "SF Mono", SFMono-Regular, Consolas, monospace';

export const COLOR_BORDER = "#e8e9ec"; // --ds-card-border
export const COLOR_MUTED = "#6b6c75"; // --ds-gray-500
