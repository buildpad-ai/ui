/**
 * Shared Storybook Manager theme — branded warm sidebar.
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

    // UI chrome — warm earthy palette
    appBg: "#f7f5ef",
    appContentBg: "#ffffff",
    appPreviewBg: "#ffffff",
    appBorderColor: "#d9cfbe",
    appBorderRadius: 12,

    // Typography
    fontBase:
      '"Space Grotesk", "Helvetica Neue", Arial, sans-serif',
    fontCode:
      '"JetBrains Mono", "SF Mono", SFMono-Regular, Consolas, monospace',

    // Text colors
    textColor: "#191612",
    textInverseColor: "#ffffff",
    textMutedColor: "#6f6558",

    // Brand colors
    colorPrimary: "#e35b2a",
    colorSecondary: "#e35b2a",

    // Toolbar
    barTextColor: "#6f6558",
    barSelectedColor: "#e35b2a",
    barHoverColor: "#c2451a",
    barBg: "#ffffff",

    // Form inputs in sidebar
    inputBg: "#ffffff",
    inputBorder: "#d9cfbe",
    inputTextColor: "#191612",
    inputBorderRadius: 10,
  });
}
