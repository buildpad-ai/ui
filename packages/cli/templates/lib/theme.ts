"use client";

import { Button, Pagination, createTheme, type MantineColorsTuple } from "@mantine/core";

/*
 * BuildPad brand — "Ink & Ember". Ink is the primary action colour (the
 * default Button), ember orange is the brand accent (primaryColor, so it
 * drives checkboxes, switches, focus, progress and other interactive state).
 *
 * Palette arrays map Mantine indices 0–9 to the 50–900 stops of each hue
 * (the 950 stop is intentionally dropped). primaryShade is a single number
 * (6) because design-tokens.css mirrors the --ds-* variables themselves in
 * dark mode — index 6 resolves to the 400 stop there, so a per-scheme shade
 * would double-invert. Keep primaryShade and that mirroring in sync.
 */
const STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

/*
 * Builds a palette of var(--ds-<name>-<stop>, <fallback>) entries. Index 6
 * points at the unsuffixed main token (e.g. --ds-primary) so it follows the
 * token's dark-mode remap; gray has no unsuffixed main and uses its 600 stop.
 */
function dsScale(
  name: string,
  fallbacks: MantineColorsTuple,
  main = `--ds-${name}`
): MantineColorsTuple {
  return fallbacks.map(
    (hex, i) => `var(${i === 6 ? main : `--ds-${name}-${STOPS[i]}`}, ${hex})`
  ) as unknown as MantineColorsTuple;
}

const primary = dsScale("primary", [
  "#fff8f2", "#ffeee1", "#ffd9b8", "#feaa6b", "#fd9843",
  "#fd7f15", "#e86a00", "#b34d00", "#8f3d00", "#6b2e00"
]);
const secondary = dsScale("secondary", [
  "#f4f4f6", "#e8e9ec", "#d7d9df", "#b9bac2", "#8a8b94",
  "#54555d", "#2a2b31", "#18191d", "#131418", "#0a0a0b"
]);
const success = dsScale("success", [
  "#ecfdf5", "#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399",
  "#10b981", "#059669", "#047857", "#065f46", "#064e3b"
]);
const info = dsScale("info", [
  "#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa",
  "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a"
]);
const warning = dsScale("warning", [
  "#fffbeb", "#fef3c7", "#fde68a", "#fcd34d", "#fbbf24",
  "#f59e0b", "#d97706", "#b45309", "#92400e", "#78350f"
]);
const danger = dsScale("danger", [
  "#fef3f2", "#fee4e2", "#fecdca", "#fda29b", "#f97066",
  "#f04438", "#d92d20", "#b42318", "#912018", "#7a271a"
]);
const gray = dsScale(
  "gray",
  [
    "#fafbfc", "#f4f4f6", "#e8e9ec", "#d7d9df", "#9b9ca6",
    "#6b6c75", "#54555d", "#3a3b42", "#2a2b31", "#131418"
  ],
  "--ds-gray-600"
);

/*
 * Mantine's built-in `dark` palette only applies in the dark scheme (body,
 * input and border surfaces). Static hex because it is never mirrored;
 * these are the brand's ink surfaces, lightest first.
 */
const dark: MantineColorsTuple = [
  "#e8e9ec", "#d7d9df", "#9b9ca6", "#6b6c75", "#34353c",
  "#2a2b31", "#1c1d22", "#131418", "#0f1013", "#0a0a0b"
];

// Every field label, via InputWrapper (which all inputs and groups render).
const fieldLabel = {
  fontSize: "var(--mantine-font-size-sm)",
  fontWeight: "var(--ds-font-weight-medium, 500)",
  color: "var(--ds-gray-700, #3a3b42)",
  marginBottom: "4px"
};

// Popover, Menu and Combobox dropdowns share one floating-surface look.
const dropdownSurface = {
  dropdown: {
    borderRadius: "var(--ds-radius-lg, 0.75rem)",
    boxShadow: "var(--ds-shadow-lg)",
    border: "1px solid var(--ds-border-color, #e8e9ec)"
  }
};

const transitionFast = "var(--ds-transition-fast, 150ms ease)";

export const theme = createTheme({
  colors: {
    primary,
    // "secondary" matches the --ds-secondary-* token naming used throughout
    // design-tokens.css and app code.
    secondary,
    success,
    info,
    warning,
    danger,
    gray,
    dark,
    // Built-in hue aliases: consumer code that says color="red" (or the
    // scaffolded components that still say "accent") gets the matching brand
    // scale. accent is the brand accent, i.e. primary.
    red: danger,
    green: success,
    yellow: warning,
    blue: info,
    orange: primary,
    accent: primary
  },
  primaryColor: "primary",
  primaryShade: 6,
  fontFamily: "var(--ds-font-family)",
  fontFamilyMonospace:
    "var(--ds-font-mono, 'JetBrains Mono', SFMono-Regular, Consolas, monospace)",
  headings: {
    fontWeight: "var(--ds-font-weight-semibold, 600)",
    fontFamily: "var(--ds-font-display, 'Inter Tight', var(--ds-font-family))",
    sizes: {
      h1: { lineHeight: "1.2" },
      h2: { lineHeight: "1.25" },
      h3: { lineHeight: "1.3" },
      h4: { lineHeight: "1.35" },
    }
  },
  fontSizes: {
    xs: "var(--ds-font-size-xs)",
    sm: "0.8125rem",
    md: "var(--ds-body-font-size)",
    lg: "var(--ds-font-size-base)",
    xl: "var(--ds-font-size-xl)"
  },
  spacing: {
    xs: "var(--ds-spacing-2)",
    sm: "var(--ds-spacing-3)",
    md: "var(--ds-spacing-4)",
    lg: "var(--ds-spacing-6)",
    xl: "var(--ds-spacing-8)"
  },
  radius: {
    xs: "var(--ds-radius-sm, 0.375rem)",
    sm: "var(--ds-radius, 0.5rem)",
    md: "var(--ds-radius-md, 0.625rem)",
    lg: "var(--ds-radius-lg, 0.75rem)",
    xl: "var(--ds-radius-xl, 1rem)"
  },
  shadows: {
    xs: "var(--ds-shadow-xs)",
    sm: "var(--ds-shadow-sm)",
    md: "var(--ds-shadow-md)",
    lg: "var(--ds-shadow-lg)",
    xl: "var(--ds-shadow-xl)"
  },
  defaultRadius: "sm",
  components: {
    Button: Button.extend({
      defaultProps: {
        radius: "var(--ds-radius-pill)",
      },
      // The default button (no color prop, filled variant) is the ink CTA.
      // An explicit color — e.g. color="primary" for the ember brand CTA —
      // and every other variant keep Mantine's own colour resolution.
      vars: (_theme, props) => {
        const isFilled = props.variant === undefined || props.variant === "filled";
        if (props.color !== undefined || !isFilled) {
          return { root: {} };
        }
        return {
          root: {
            "--button-bg": "var(--ds-cta-bg)",
            "--button-hover": "var(--ds-cta-bg-hover)",
            "--button-color": "var(--ds-cta-color)",
            "--button-bd": "1px solid transparent"
          }
        };
      },
      styles: {
        root: {
          fontWeight: "var(--ds-font-weight-medium, 500)",
          fontSize: "var(--mantine-font-size-md)",
          transition: `background-color ${transitionFast}, border-color ${transitionFast}`
        }
      }
    }),
    Input: {
      // Border colour and focus treatment live in globals.css as --input-bd
      // overrides; an inline borderColor here would also mask the error and
      // focus borders.
      styles: {
        input: {
          fontSize: "var(--mantine-font-size-md)",
          transition: `border-color ${transitionFast}, box-shadow ${transitionFast}`
        }
      }
    },
    InputWrapper: {
      styles: {
        label: fieldLabel
      }
    },
    Card: {
      defaultProps: {
        radius: "xl",
      },
      styles: {
        root: {
          borderColor: "var(--ds-card-border, #e8e9ec)",
          borderRadius: "var(--ds-radius-card, 16px)",
          background: "var(--ds-card-bg, #ffffff)",
        }
      }
    },
    Paper: {
      styles: {
        root: {
          borderRadius: "var(--ds-radius-md, 0.625rem)"
        }
      }
    },
    Modal: {
      styles: {
        header: {
          borderBottom: "1px solid var(--ds-divider, #eeeff2)",
          padding: "var(--ds-spacing-4) var(--ds-spacing-6)",
          marginBottom: 0
        },
        title: {
          fontFamily: "var(--ds-font-display)",
          fontWeight: "var(--ds-font-weight-semibold, 600)",
          fontSize: "var(--ds-font-size-base)",
          letterSpacing: "var(--ds-letter-spacing-tight, -0.02em)"
        },
        body: {
          padding: "var(--ds-spacing-6)"
        },
        content: {
          borderRadius: "var(--ds-radius-xl, 1rem)",
          boxShadow: "var(--ds-shadow-xl)"
        },
        close: {
          color: "var(--ds-gray-500, #6b6c75)"
        }
      }
    },
    Popover: {
      styles: dropdownSurface
    },
    Menu: {
      styles: dropdownSurface
    },
    Combobox: {
      styles: dropdownSurface
    },
    Badge: {
      defaultProps: {
        variant: "light",
        radius: "var(--ds-radius-pill)",
      },
      styles: {
        root: {
          fontSize: "var(--ds-font-size-xs)",
          fontWeight: "var(--ds-font-weight-medium, 500)",
          textTransform: "none" as const
        }
      }
    },
    TextInput: {
      styles: {
        input: {
          fontFamily: "var(--mantine-font-family)"
        }
      }
    },
    // Mantine's first/previous/next/last controls are icon-only and unnamed.
    Pagination: Pagination.extend({
      defaultProps: {
        getControlProps: (control) => ({
          "aria-label": {
            first: "First page",
            previous: "Previous page",
            next: "Next page",
            last: "Last page"
          }[control]
        })
      }
    }),
    Table: {
      defaultProps: { withTableBorder: true },
      styles: {
        table: {
          fontSize: "var(--mantine-font-size-md)"
        },
        th: {
          fontWeight: "var(--ds-font-weight-semibold, 600)",
          fontSize: "var(--ds-font-size-xs)",
          color: "var(--ds-gray-500, #6b6c75)"
        }
      }
    },
    Tabs: {
      // Rail, hover and active tab (ink text + ember indicator) are styled in
      // globals.css. No borderRadius here: Mantine rounds only the top corners
      // of a default-variant tab, which keeps the indicator square-ended.
      styles: {
        tab: {
          fontWeight: "var(--ds-font-weight-medium, 500)",
          fontSize: "var(--mantine-font-size-md)",
          transition: `background ${transitionFast}, color ${transitionFast}`
        }
      }
    },
    Tooltip: {
      // Colours come from --tooltip-bg / --tooltip-color in globals.css so
      // the light (ink) and dark (inverted) schemes can differ.
      defaultProps: {
        withArrow: true,
        arrowSize: 6,
      },
      styles: {
        tooltip: {
          fontSize: "var(--ds-font-size-xs)",
          borderRadius: "var(--ds-radius, 0.5rem)"
        }
      }
    },
    Anchor: {
      // Colour comes from --mantine-color-anchor (→ --ds-accent-text) in
      // globals.css.
      defaultProps: {
        underline: "hover"
      }
    },
    Group: {
      defaultProps: {
        gap: "sm"
      }
    },
    Stack: {
      defaultProps: {
        gap: "md"
      }
    }
  }
});
