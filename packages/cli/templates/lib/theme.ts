"use client";

import { createTheme } from "@mantine/core";

export const theme = createTheme({
  colors: {
    primary: [
      "var(--ds-primary-100, #fff7ed)",
      "var(--ds-primary-200, #ffedd5)",
      "var(--ds-primary-300, #fed7aa)",
      "var(--ds-primary-400, #fdba74)",
      "var(--ds-primary, #fb923c)",
      "var(--ds-primary, #e35b2a)",
      "var(--ds-primary-600, #c2451a)",
      "var(--ds-primary-700, #9a3412)",
      "var(--ds-primary-800, #7c2d12)",
      "var(--ds-primary-900, #431407)"
    ],
    accent: [
      "var(--ds-accent-100, #eff6ff)",
      "var(--ds-accent-200, #dbeafe)",
      "var(--ds-accent-300, #bfdbfe)",
      "var(--ds-accent-400, #93c5fd)",
      "var(--ds-accent, #60a5fa)",
      "var(--ds-accent, #3b82f6)",
      "var(--ds-accent-600, #2563eb)",
      "var(--ds-accent-700, #1d4ed8)",
      "var(--ds-accent-800, #1e40af)",
      "var(--ds-accent-900, #1e3a8a)"
    ],
    success: [
      "var(--ds-success-100, #ecfdf5)",
      "var(--ds-success-200, #dff3e6)",
      "var(--ds-success-300, #a7f3d0)",
      "var(--ds-success-400, #6ee7b7)",
      "var(--ds-success-500, #34d399)",
      "var(--ds-success, #1b7a3f)",
      "var(--ds-success-700, #15803d)",
      "var(--ds-success-800, #166534)",
      "var(--ds-success-900, #14532d)",
      "var(--ds-success-950, #052e16)"
    ],
    info: [
      "var(--ds-info-100, #f0f9ff)",
      "var(--ds-info-200, #e0f2fe)",
      "var(--ds-info-300, #bae6fd)",
      "var(--ds-info-400, #7dd3fc)",
      "var(--ds-info-500, #38bdf8)",
      "var(--ds-info, #0ea5e9)",
      "var(--ds-info-700, #0284c7)",
      "var(--ds-info-800, #0369a1)",
      "var(--ds-info-900, #075985)",
      "var(--ds-info-950, #082f49)"
    ],
    warning: [
      "var(--ds-warning-100, #fffbeb)",
      "var(--ds-warning-200, #fff1c2)",
      "var(--ds-warning-300, #fde68a)",
      "var(--ds-warning-400, #fcd34d)",
      "var(--ds-warning-500, #fbbf24)",
      "var(--ds-warning, #a46b00)",
      "var(--ds-warning-700, #92400e)",
      "var(--ds-warning-800, #78350f)",
      "var(--ds-warning-900, #5c2a0f)",
      "var(--ds-warning-950, #451a03)"
    ],
    danger: [
      "var(--ds-danger-100, #fef2f2)",
      "var(--ds-danger-200, #fdecea)",
      "var(--ds-danger-300, #fecaca)",
      "var(--ds-danger-400, #fca5a5)",
      "var(--ds-danger-500, #f87171)",
      "var(--ds-danger, #b4232a)",
      "var(--ds-danger-700, #991b1b)",
      "var(--ds-danger-800, #7f1d1d)",
      "var(--ds-danger-900, #6b1515)",
      "var(--ds-danger-950, #450a0a)"
    ],
    gray: [
      "var(--ds-gray-100, #f7f5ef)",
      "var(--ds-gray-200, #f7f1e6)",
      "var(--ds-gray-300, #efe7d8)",
      "var(--ds-gray-400, #d9cfbe)",
      "var(--ds-gray-500, #6f6558)",
      "var(--ds-gray-600, #524a3f)",
      "var(--ds-gray-700, #3a342c)",
      "var(--ds-gray-800, #252118)",
      "var(--ds-gray-900, #191612)",
      "var(--ds-gray-950, #0d0b08)"
    ]
  },
  primaryColor: "primary",
  primaryShade: { light: 5, dark: 4 },
  fontFamily: "var(--ds-font-family)",
  fontFamilyMonospace:
    "var(--ds-font-mono, 'JetBrains Mono', SFMono-Regular, Consolas, monospace)",
  headings: {
    fontWeight: "700",
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
    sm: "var(--ds-font-size-sm)",
    md: "var(--ds-font-size-base)",
    lg: "var(--ds-font-size-lg)",
    xl: "var(--ds-font-size-2xl)"
  },
  spacing: {
    xs: "var(--ds-spacing-2)",
    sm: "var(--ds-spacing-3)",
    md: "var(--ds-spacing-4)",
    lg: "var(--ds-spacing-6)",
    xl: "var(--ds-spacing-8)"
  },
  radius: {
    xs: "var(--ds-radius-sm, 4px)",
    sm: "var(--ds-radius, 8px)",
    md: "var(--ds-radius-md, 12px)",
    lg: "var(--ds-radius-lg, 16px)",
    xl: "var(--ds-radius-xl, 20px)"
  },
  shadows: {
    xs: "var(--ds-shadow-sm)",
    sm: "var(--ds-shadow-sm)",
    md: "var(--ds-shadow)",
    lg: "var(--ds-shadow-lg)",
    xl: "var(--ds-shadow-xl)"
  },
  components: {
    Button: {
      defaultProps: {
        radius: "xl",
      },
      styles: {
        root: {
          fontWeight: "600",
          fontSize: "var(--mantine-font-size-sm)",
          transition: "transform 0.15s, box-shadow 0.15s, background 0.15s"
        }
      }
    },
    Input: {
      styles: {
        input: {
          borderRadius: "10px",
          borderColor: "var(--ds-gray-400, #d9cfbe)",
          fontSize: "var(--mantine-font-size-sm)",
          transition: "border-color var(--ds-transition-fast, 150ms ease), box-shadow var(--ds-transition-fast, 150ms ease)"
        }
      }
    },
    Card: {
      defaultProps: {
        radius: "md",
        shadow: "lg",
      },
      styles: {
        root: {
          borderColor: "var(--ds-gray-400, #d9cfbe)",
        }
      }
    },
    Paper: {
      styles: {
        root: {
          borderRadius: "var(--ds-radius-md, 12px)"
        }
      }
    },
    Modal: {
      styles: {
        header: {
          borderBottom: "1px solid var(--ds-gray-400, #d9cfbe)",
          padding: "var(--ds-spacing-4) var(--ds-spacing-6)",
          marginBottom: 0
        },
        title: {
          fontWeight: 600,
          fontSize: "var(--ds-font-size-lg)"
        },
        body: {
          padding: "var(--ds-spacing-6)"
        },
        content: {
          borderRadius: "var(--ds-radius-xl, 20px)",
          boxShadow: "var(--ds-shadow-xl)"
        },
        close: {
          color: "var(--ds-gray-500, #6f6558)"
        }
      }
    },
    Popover: {
      styles: {
        dropdown: {
          borderRadius: "var(--ds-radius-md, 12px)",
          boxShadow: "var(--mantine-shadow-lg)",
          border: "1px solid var(--ds-gray-400, #d9cfbe)"
        }
      }
    },
    Badge: {
      styles: {
        root: {
          borderRadius: "999px",
          fontSize: "var(--ds-font-size-xs)",
          fontWeight: "600",
          textTransform: "none" as const
        }
      }
    },
    TextInput: {
      styles: {
        label: {
          fontSize: "var(--mantine-font-size-sm)",
          fontWeight: "600",
          color: "var(--ds-gray-900, #191612)",
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
          fontWeight: "600",
          color: "var(--ds-gray-900, #191612)",
          marginBottom: "4px"
        }
      }
    },
    Select: {
      styles: {
        label: {
          fontSize: "var(--mantine-font-size-sm)",
          fontWeight: "600",
          color: "var(--ds-gray-900, #191612)",
          marginBottom: "4px"
        }
      }
    },
    Table: {
      styles: {
        table: {
          fontSize: "var(--mantine-font-size-sm)"
        },
        th: {
          fontWeight: "600",
          fontSize: "var(--ds-font-size-xs)",
          color: "var(--ds-gray-500, #6f6558)"
        }
      }
    },
    Tabs: {
      styles: {
        tab: {
          fontWeight: "500",
          fontSize: "var(--mantine-font-size-sm)",
          borderRadius: "8px",
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
          borderRadius: "var(--mantine-radius-sm)"
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
