/**
 * Shared Mantine theme for all Storybook previews.
 *
 * "BuildPad brand — Ink & Ember" — black ink primary actions, ember orange
 * brand accent, neutral-cool greys, Inter body + Inter Tight display type,
 * pill-shaped controls, 16px hairline cards with a soft long shadow.
 * Static-hex mirror of the --ds-* tokens in cli/templates/app/design-tokens.css
 * (light scales only — Storybook renders light). Palette arrays map Mantine
 * indices 0–9 to stops 50–900.
 * Each package's .storybook/preview.tsx should import and use this theme
 * so every component renders with the same professional look in the canvas.
 */
import {
  Badge,
  Button,
  createTheme,
  Tooltip,
  type MantineColorsTuple,
} from "@mantine/core";

// Shared primitives — reused here and in storybook-enterprise-manager.ts so
// the Storybook canvas and its surrounding chrome never drift apart.
export const FONT_BODY =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
export const FONT_HEADING = `"Inter Tight", ${FONT_BODY}`;
export const FONT_MONO =
  '"JetBrains Mono", "SF Mono", SFMono-Regular, Consolas, monospace';

export const COLOR_BORDER = "#e8e9ec"; // card/table border — mirrors --ds-card-border
export const COLOR_INPUT_BORDER = "#d7d9df"; // gray-3
export const COLOR_DIVIDER = "#eeeff2"; // mirrors --ds-divider
export const COLOR_MUTED = "#6b6c75"; // gray-5 — muted text
export const COLOR_LABEL = "#3a3b42"; // gray-7 — field labels
export const COLOR_DIMMED = "#9b9ca6"; // gray-4

// Ink CTA — mirrors --ds-cta-bg / --ds-cta-bg-hover / --ds-cta-color.
const CTA_BG = "#0a0a0b";
const CTA_BG_HOVER = "#2a2b31";
const CTA_COLOR = "#ffffff";

// Soft, long, ink-tinted shadows — mirror --ds-shadow-* / --ds-card-shadow.
const SHADOW_LG =
  "0 2px 4px 0 rgb(10 10 11 / 0.04), 0 18px 40px -16px rgb(10 10 11 / 0.22)";
const SHADOW_XL =
  "0 2px 4px 0 rgb(10 10 11 / 0.04), 0 40px 80px -40px rgb(10 10 11 / 0.30), 0 0 0 1px rgb(10 10 11 / 0.05)";
const CARD_SHADOW =
  "0 1px 1px 0 rgb(10 10 11 / 0.03), 0 18px 40px -30px rgb(10 10 11 / 0.28)";

const primary: MantineColorsTuple = [
  "#fff8f2",
  "#ffeee1",
  "#ffd9b8",
  "#feaa6b",
  "#fd9843",
  "#fd7f15", // brand accent — focus ring, active underline
  "#e86a00", // main — ember-600
  "#b34d00", // accent text — AA on white and on primary[1]
  "#8f3d00",
  "#6b2e00",
];

const secondary: MantineColorsTuple = [
  "#f4f4f6",
  "#e8e9ec",
  "#d7d9df",
  "#b9bac2",
  "#8a8b94",
  "#54555d",
  "#2a2b31", // main — ink-soft
  "#18191d",
  "#131418",
  "#0a0a0b", // ink
];

const success: MantineColorsTuple = [
  "#ecfdf5",
  "#d1fae5",
  "#a7f3d0",
  "#6ee7b7",
  "#34d399",
  "#10b981",
  "#059669", // main — emerald-600
  "#047857",
  "#065f46",
  "#064e3b",
];

const info: MantineColorsTuple = [
  "#eff6ff",
  "#dbeafe",
  "#bfdbfe",
  "#93c5fd",
  "#60a5fa",
  "#3b82f6",
  "#2563eb", // main — blue-600
  "#1d4ed8",
  "#1e40af",
  "#1e3a8a",
];

const warning: MantineColorsTuple = [
  "#fffbeb",
  "#fef3c7",
  "#fde68a",
  "#fcd34d",
  "#fbbf24",
  "#f59e0b",
  "#d97706", // main — amber-600
  "#b45309",
  "#92400e",
  "#78350f",
];

const danger: MantineColorsTuple = [
  "#fef3f2",
  "#fee4e2",
  "#fecdca",
  "#fda29b",
  "#f97066",
  "#f04438",
  "#d92d20", // main — red-600
  "#b42318",
  "#912018",
  "#7a271a",
];

const gray: MantineColorsTuple = [
  "#fafbfc", // page bg
  "#f4f4f6",
  "#e8e9ec", // border
  "#d7d9df", // input border
  "#9b9ca6",
  "#6b6c75", // muted text
  "#54555d",
  "#3a3b42",
  "#2a2b31",
  "#131418", // text
];

// Only consumed in the dark scheme (body/input/border surfaces); Storybook is
// light-only but the palette is kept in sync with the CLI theme.
const dark: MantineColorsTuple = [
  "#e8e9ec",
  "#d7d9df",
  "#9b9ca6",
  "#6b6c75",
  "#34353c",
  "#2a2b31",
  "#1c1d22",
  "#131418",
  "#0f1013",
  "#0a0a0b",
];

const labelStyles = {
  label: {
    fontSize: "0.8125rem",
    fontWeight: "500",
    color: COLOR_LABEL,
    marginBottom: "4px",
  },
};

const dropdownStyles = {
  dropdown: {
    borderRadius: "0.75rem",
    boxShadow: SHADOW_LG,
    border: `1px solid ${COLOR_BORDER}`,
  },
};

export const enterpriseTheme = createTheme({
  colors: {
    primary,
    secondary,
    success,
    info,
    warning,
    danger,
    gray,
    dark,
    // Built-in hue names resolve to the matching semantic scale, so
    // `color="red"` in component code gets the brand danger red.
    red: danger,
    green: success,
    yellow: warning,
    blue: info,
    orange: primary,
    accent: primary,
  },
  primaryColor: "primary",
  primaryShade: { light: 6, dark: 4 },
  fontFamily: FONT_BODY,
  fontFamilyMonospace: FONT_MONO,
  headings: {
    fontWeight: "600",
    fontFamily: FONT_HEADING,
    sizes: {
      h1: { lineHeight: "1.2" },
      h2: { lineHeight: "1.25" },
      h3: { lineHeight: "1.3" },
      h4: { lineHeight: "1.35" },
    },
  },
  fontSizes: {
    xs: "0.75rem",
    sm: "0.8125rem",
    md: "0.875rem",
    lg: "1rem",
    xl: "1.25rem",
  },
  spacing: {
    xs: "0.5rem",
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
  },
  radius: {
    xs: "0.375rem",
    sm: "0.5rem",
    md: "0.625rem",
    lg: "0.75rem",
    xl: "1rem",
  },
  shadows: {
    xs: "0 1px 1px 0 rgb(10 10 11 / 0.03)",
    sm: "0 1px 2px 0 rgb(10 10 11 / 0.06)",
    md: "0 1px 2px 0 rgb(10 10 11 / 0.04), 0 8px 24px -8px rgb(10 10 11 / 0.14)",
    lg: SHADOW_LG,
    xl: SHADOW_XL,
  },
  defaultRadius: "sm",
  components: {
    Button: Button.extend({
      defaultProps: { radius: 999 },
      // The default filled button (no `color`) is the ink CTA; an explicit
      // `color="primary"` keeps the orange brand CTA. Other variants untouched.
      vars: (_theme, props) =>
        props.color === undefined &&
        (props.variant === undefined || props.variant === "filled")
          ? {
              root: {
                "--button-bg": CTA_BG,
                "--button-hover": CTA_BG_HOVER,
                "--button-color": CTA_COLOR,
                "--button-bd": "1px solid transparent",
              },
            }
          : { root: {} },
      styles: {
        root: {
          fontWeight: "500",
          fontSize: "0.875rem",
          transition: "background-color 0.15s, border-color 0.15s",
        },
      },
    }),
    Input: {
      styles: {
        input: {
          fontSize: "0.875rem",
          borderRadius: "0.5rem",
          transition: "border-color 0.15s, box-shadow 0.15s",
        },
      },
    },
    Card: {
      defaultProps: { radius: 16, shadow: undefined },
      styles: {
        root: {
          border: `1px solid ${COLOR_BORDER}`,
          borderRadius: "16px",
          background: "#ffffff",
          boxShadow: CARD_SHADOW,
        },
      },
    },
    Paper: {
      styles: {
        root: { borderRadius: "0.625rem" },
      },
    },
    Modal: {
      styles: {
        header: {
          borderBottom: `1px solid ${COLOR_DIVIDER}`,
          padding: "1rem 1.5rem",
          marginBottom: 0,
        },
        title: {
          fontFamily: FONT_HEADING,
          fontWeight: 600,
          fontSize: "1rem",
          letterSpacing: "-0.02em",
        },
        body: { padding: "1.5rem" },
        content: {
          borderRadius: "1rem",
          boxShadow: SHADOW_XL,
        },
        close: { color: COLOR_MUTED },
      },
    },
    Popover: { styles: dropdownStyles },
    Menu: { styles: dropdownStyles },
    Combobox: { styles: dropdownStyles },
    Badge: Badge.extend({
      defaultProps: { variant: "light", radius: 999 },
      styles: {
        root: {
          fontSize: "0.75rem",
          fontWeight: "500",
          textTransform: "none" as const,
        },
      },
    }),
    TextInput: { styles: labelStyles },
    NumberInput: { styles: labelStyles },
    Select: { styles: labelStyles },
    Anchor: {
      // Accent text (primary[7]) — AA on white; underline on hover.
      defaultProps: { c: "primary.7", underline: "hover" },
    },
    Table: {
      defaultProps: { withTableBorder: true },
      styles: {
        table: {
          fontSize: "0.875rem",
        },
        th: {
          fontWeight: "600",
          fontSize: "0.75rem",
          color: COLOR_MUTED,
        },
      },
    },
    Tabs: {
      styles: {
        tab: {
          fontWeight: "500",
          fontSize: "0.875rem",
          borderRadius: "0.375rem",
          transition: "background 0.15s, color 0.15s",
        },
      },
    },
    Tooltip: Tooltip.extend({
      defaultProps: { withArrow: true, arrowSize: 6 },
      // Ink tooltip unless a story passes an explicit `color`.
      vars: (_theme, props) =>
        props.color === undefined
          ? { tooltip: { "--tooltip-bg": CTA_BG, "--tooltip-color": CTA_COLOR } }
          : { tooltip: {} },
      styles: {
        tooltip: { fontSize: "0.75rem", borderRadius: "0.5rem" },
      },
    }),
    Group: { defaultProps: { gap: "sm" } },
    Stack: { defaultProps: { gap: "md" } },
  },
});
