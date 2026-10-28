/**
 * Shared Storybook Manager theme — "BuildPad brand — Ink & Ember" sidebar.
 *
 * Usage in each package's .storybook/manager.ts:
 *   import { enterpriseManagerTheme } from '../../storybook-enterprise-manager';
 *   addons.setConfig({ theme: enterpriseManagerTheme('Package Name') });
 */
import { create } from "storybook/theming/create";
import { COLOR_BORDER, COLOR_MUTED, FONT_BODY, FONT_MONO } from "./storybook-enterprise-theme";

type StoryTheme = ReturnType<typeof create>;

export function enterpriseManagerTheme(brandTitle: string): StoryTheme {
  return create({
    base: "light",
    brandTitle,
    brandUrl: "https://www.buildpad.ai",

    // UI chrome — flat neutral-cool page, white content, hairline borders
    appBg: "#fafbfc",
    appContentBg: "#ffffff",
    appPreviewBg: "#ffffff",
    appBorderColor: COLOR_BORDER,
    appBorderRadius: 10,

    // Typography — Inter body, JetBrains Mono code
    fontBase: FONT_BODY,
    fontCode: FONT_MONO,

    // Text colors — ink
    textColor: "#0a0a0b",
    textInverseColor: "#ffffff",
    textMutedColor: COLOR_MUTED,

    // Brand colors — ember accent
    colorPrimary: "#fd7f15",
    colorSecondary: "#e86a00",

    // Toolbar
    barTextColor: COLOR_MUTED,
    barSelectedColor: "#e86a00",
    barHoverColor: "#b34d00",
    barBg: "#ffffff",

    // Form inputs in sidebar
    inputBg: "#ffffff",
    inputBorder: COLOR_BORDER,
    inputTextColor: "#0a0a0b",
    inputBorderRadius: 8,
  });
}
