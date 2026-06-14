"use client";

import { createTheme } from "@mantine/core";

/*
 * Palette arrays map Mantine indices 0–9 to the Tailwind 50–900 stops of
 * each hue (the 950 stop is intentionally dropped). primaryShade is a
 * single number (6) because design-tokens.css mirrors the --ds-* variables
 * themselves in dark mode — index 6 resolves to the 400 stop there, so a
 * per-scheme shade would double-invert. Keep primaryShade and that
 * mirroring in sync.
 */
export const theme = createTheme({
  colors: {
    primary: [
      "var(--ds-primary-50, #fff7ed)",
      "var(--ds-primary-100, #ffedd5)",
      "var(--ds-primary-200, #fed7aa)",
      "var(--ds-primary-300, #fdba74)",
      "var(--ds-primary-400, #fb923c)",
      "var(--ds-primary-500, #f97316)",
      "var(--ds-primary, #ea580c)",
      "var(--ds-primary-700, #c2410c)",
      "var(--ds-primary-800, #9a3412)",
      "var(--ds-primary-900, #7c2d12)"
    ],
    accent: [
      "var(--ds-secondary-50, #eff6ff)",
      "var(--ds-secondary-100, #dbeafe)",
      "var(--ds-secondary-200, #bfdbfe)",
      "var(--ds-secondary-300, #93c5fd)",
      "var(--ds-secondary-400, #60a5fa)",
      "var(--ds-secondary-500, #3b82f6)",
      "var(--ds-secondary, #2563eb)",
      "var(--ds-secondary-700, #1d4ed8)",
      "var(--ds-secondary-800, #1e40af)",
      "var(--ds-secondary-900, #1e3a8a)"
    ],
    success: [
      "var(--ds-success-50, #f0fdf4)",
      "var(--ds-success-100, #dcfce7)",
      "var(--ds-success-200, #bbf7d0)",
      "var(--ds-success-300, #86efac)",
      "var(--ds-success-400, #4ade80)",
      "var(--ds-success-500, #22c55e)",
      "var(--ds-success, #16a34a)",
      "var(--ds-success-700, #15803d)",
      "var(--ds-success-800, #166534)",
      "var(--ds-success-900, #14532d)"
    ],
    info: [
      "var(--ds-info-50, #f0f9ff)",
      "var(--ds-info-100, #e0f2fe)",
      "var(--ds-info-200, #bae6fd)",
      "var(--ds-info-300, #7dd3fc)",
      "var(--ds-info-400, #38bdf8)",
      "var(--ds-info-500, #0ea5e9)",
      "var(--ds-info, #0284c7)",
      "var(--ds-info-700, #0369a1)",
      "var(--ds-info-800, #075985)",
      "var(--ds-info-900, #0c4a6e)"
    ],
    warning: [
      "var(--ds-warning-50, #fffbeb)",
      "var(--ds-warning-100, #fef3c7)",
      "var(--ds-warning-200, #fde68a)",
      "var(--ds-warning-300, #fcd34d)",
      "var(--ds-warning-400, #fbbf24)",
      "var(--ds-warning-500, #f59e0b)",
      "var(--ds-warning, #d97706)",
      "var(--ds-warning-700, #b45309)",
      "var(--ds-warning-800, #92400e)",
      "var(--ds-warning-900, #78350f)"
    ],
    danger: [
      "var(--ds-danger-50, #fef2f2)",
      "var(--ds-danger-100, #fee2e2)",
      "var(--ds-danger-200, #fecaca)",
      "var(--ds-danger-300, #fca5a5)",
      "var(--ds-danger-400, #f87171)",
      "var(--ds-danger-500, #ef4444)",
      "var(--ds-danger, #dc2626)",
      "var(--ds-danger-700, #b91c1c)",
      "var(--ds-danger-800, #991b1b)",
      "var(--ds-danger-900, #7f1d1d)"
    ],
    gray: [
      "var(--ds-gray-50, #f8fafc)",
      "var(--ds-gray-100, #f1f5f9)",
      "var(--ds-gray-200, #e2e8f0)",
      "var(--ds-gray-300, #cbd5e1)",
      "var(--ds-gray-400, #94a3b8)",
      "var(--ds-gray-500, #64748b)",
      "var(--ds-gray-600, #475569)",
      "var(--ds-gray-700, #334155)",
      "var(--ds-gray-800, #1e293b)",
      "var(--ds-gray-900, #0f172a)"
    ]
  },
  primaryColor: "primary",
  primaryShade: 6,
  fontFamily: "var(--ds-font-family)",
  fontFamilyMonospace:
    "var(--ds-font-mono, 'JetBrains Mono', SFMono-Regular, Consolas, monospace)",
  headings: {
    fontWeight: "600",
    fontFamily: "var(--ds-font-family)",
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
    xs: "var(--ds-radius-sm, 0.25rem)",
    sm: "var(--ds-radius, 0.375rem)",
    md: "var(--ds-radius-md, 0.5rem)",
    lg: "var(--ds-radius-lg, 0.75rem)",
    xl: "var(--ds-radius-xl, 1rem)"
  },
  shadows: {
    xs: "var(--ds-shadow-sm)",
    sm: "var(--ds-shadow)",
    md: "var(--ds-shadow-md)",
    lg: "var(--ds-shadow-lg)",
    xl: "var(--ds-shadow-xl)"
  },
  defaultRadius: "sm",
  components: {
    Button: {
      defaultProps: {
        radius: "sm",
      },
      styles: {
        root: {
          fontWeight: "500",
          fontSize: "var(--mantine-font-size-md)",
          transition: "background-color var(--ds-transition-fast, 150ms ease), border-color var(--ds-transition-fast, 150ms ease)"
        }
      }
    },
    Input: {
      styles: {
        input: {
          borderRadius: "var(--ds-radius, 0.375rem)",
          borderColor: "var(--ds-gray-300, #cbd5e1)",
          fontSize: "var(--mantine-font-size-md)",
          transition: "border-color var(--ds-transition-fast, 150ms ease), box-shadow var(--ds-transition-fast, 150ms ease)"
        }
      }
    },
    Card: {
      defaultProps: {
        radius: "md",
        shadow: "xs",
      },
      styles: {
        root: {
          borderColor: "var(--ds-border-color, #e2e8f0)",
        }
      }
    },
    Paper: {
      styles: {
        root: {
          borderRadius: "var(--ds-radius-md, 0.5rem)"
        }
      }
    },
    Modal: {
      styles: {
        header: {
          borderBottom: "1px solid var(--ds-border-color, #e2e8f0)",
          padding: "var(--ds-spacing-4) var(--ds-spacing-6)",
          marginBottom: 0
        },
        title: {
          fontWeight: 600,
          fontSize: "var(--ds-font-size-base)"
        },
        body: {
          padding: "var(--ds-spacing-6)"
        },
        content: {
          borderRadius: "var(--ds-radius-lg, 0.75rem)",
          boxShadow: "var(--ds-shadow-xl)"
        },
        close: {
          color: "var(--ds-gray-400, #94a3b8)"
        }
      }
    },
    Popover: {
      styles: {
        dropdown: {
          borderRadius: "var(--ds-radius-md, 0.5rem)",
          boxShadow: "var(--ds-shadow-md)",
          border: "1px solid var(--ds-border-color, #e2e8f0)"
        }
      }
    },
    Badge: {
      styles: {
        root: {
          borderRadius: "999px",
          fontSize: "var(--ds-font-size-xs)",
          fontWeight: "500",
          textTransform: "none" as const
        }
      }
    },
    TextInput: {
      styles: {
        label: {
          fontSize: "var(--mantine-font-size-sm)",
          fontWeight: "500",
          color: "var(--ds-gray-700, #334155)",
          marginBottom: "4px"
        },
        input: {
          fontFamily: "var(--mantine-font-family)"
        }
      }
    },
    NumberInput: {
      styles: {
        label: {
          fontSize: "var(--mantine-font-size-sm)",
          fontWeight: "500",
          color: "var(--ds-gray-700, #334155)",
          marginBottom: "4px"
        }
      }
    },
    Select: {
      styles: {
        label: {
          fontSize: "var(--mantine-font-size-sm)",
          fontWeight: "500",
          color: "var(--ds-gray-700, #334155)",
          marginBottom: "4px"
        }
      }
    },
    Table: {
      defaultProps: { withTableBorder: true },
      styles: {
        table: {
          fontSize: "var(--mantine-font-size-md)"
        },
        th: {
          fontWeight: "500",
          fontSize: "var(--ds-font-size-xs)",
          color: "var(--ds-gray-500, #64748b)"
        }
      }
    },
    Tabs: {
      styles: {
        tab: {
          fontWeight: "500",
          fontSize: "var(--mantine-font-size-md)",
          borderRadius: "var(--ds-radius, 0.375rem)",
          transition: "background var(--ds-transition-fast, 150ms ease), color var(--ds-transition-fast, 150ms ease)"
        }
      }
    },
    Tooltip: {
      defaultProps: {
        withArrow: true,
        arrowSize: 6,
      },
      styles: {
        tooltip: {
          fontSize: "var(--ds-font-size-xs)",
          borderRadius: "var(--ds-radius, 0.375rem)"
        }
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
