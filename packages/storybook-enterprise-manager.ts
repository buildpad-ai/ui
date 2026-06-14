/**
 * Shared Storybook Manager theme — modern neutral sidebar.
 *
 * Usage in each package's .storybook/manager.ts:
 *   import { enterpriseManagerTheme } from '../../storybook-enterprise-manager';
 *   addons.setConfig({ theme: enterpriseManagerTheme('Package Name') });
 */
import { create } from "storybook/theming/create";

type StoryTheme = ReturnType<typeof create>;

export function enterpriseManagerTheme(brandTitle: string): StoryTheme {
  return create({
    base: "light",
    brandTitle,
    brandUrl: "https://github.com/buildpad",

    // UI chrome — slate neutrals
    appBg: "#f8fafc",
    appContentBg: "#ffffff",
    appPreviewBg: "#ffffff",
    appBorderColor: "#e2e8f0",
    appBorderRadius: 8,

    // Typography
    fontBase:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    fontCode:
      '"JetBrains Mono", "SF Mono", SFMono-Regular, Consolas, monospace',

    // Text colors
    textColor: "#0f172a",
    textInverseColor: "#ffffff",
    textMutedColor: "#64748b",

    // Brand colors
    colorPrimary: "#ea580c",
    colorSecondary: "#ea580c",

    // Toolbar
    barTextColor: "#64748b",
    barSelectedColor: "#ea580c",
    barHoverColor: "#c2410c",
    barBg: "#ffffff",

    // Form inputs in sidebar
    inputBg: "#ffffff",
    inputBorder: "#cbd5e1",
    inputTextColor: "#0f172a",
    inputBorderRadius: 6,
  });
}
