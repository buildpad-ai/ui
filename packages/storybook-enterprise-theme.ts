/**
 * Shared Mantine theme for all Storybook previews.
 *
 * Follows the warm, earthy palette from the storybook-host landing page.
 * Each package's .storybook/preview.tsx should import and use this theme
 * so every component renders with the same professional look in the canvas.
 */
import { createTheme } from "@mantine/core";

export const enterpriseTheme = createTheme({
  colors: {
    primary: [
      "#fff7ed",
      "#ffedd5",
      "#fed7aa",
      "#fdba74",
      "#fb923c",
      "#e35b2a",  // main — burnt orange
      "#c2451a",  // strong
      "#9a3412",
      "#7c2d12",
      "#431407",
    ],
    accent: [
      "#eff6ff",
      "#dbeafe",
      "#bfdbfe",
      "#93c5fd",
      "#60a5fa",
      "#3b82f6",
      "#2563eb",
      "#1d4ed8",
      "#1e40af",
      "#1e3a8a",  // deep blue accent
    ],
    success: [
      "#ecfdf5",
      "#dff3e6",
      "#a7f3d0",
      "#6ee7b7",
      "#34d399",
      "#1b7a3f",
      "#15803d",
      "#166534",
      "#14532d",
      "#052e16",
    ],
    info: [
      "#f0f9ff",
      "#e0f2fe",
      "#bae6fd",
      "#7dd3fc",
      "#38bdf8",
      "#0ea5e9",
      "#0284c7",
      "#0369a1",
      "#075985",
      "#082f49",
    ],
    warning: [
      "#fffbeb",
      "#fff1c2",
      "#fde68a",
      "#fcd34d",
      "#fbbf24",
      "#a46b00",
      "#92400e",
      "#78350f",
      "#5c2a0f",
      "#451a03",
    ],
    danger: [
      "#fef2f2",
      "#fdecea",
      "#fecaca",
      "#fca5a5",
      "#f87171",
      "#b4232a",
      "#991b1b",
      "#7f1d1d",
      "#6b1515",
      "#450a0a",
    ],
    gray: [
      "#f7f5ef",  // --bg
      "#f7f1e6",  // --surface-alt
      "#efe7d8",  // --bg-alt
      "#d9cfbe",  // --border
      "#a59e90",
      "#6f6558",  // --text-muted
      "#524a3f",
      "#3a342c",
      "#252118",
      "#191612",  // --text
    ],
  },
  primaryColor: "primary",
  primaryShade: { light: 5, dark: 4 },
  fontFamily:
    '"Space Grotesk", "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace:
    '"JetBrains Mono", "SF Mono", SFMono-Regular, Consolas, monospace',
  headings: {
    fontWeight: "700",
    fontFamily:
      '"Space Grotesk", "Helvetica Neue", Arial, sans-serif',
    sizes: {
      h1: { lineHeight: "1.1" },
      h2: { lineHeight: "1.15" },
      h3: { lineHeight: "1.25" },
    },
  },
  fontSizes: {
    xs: "0.75rem",
    sm: "0.85rem",
    md: "0.9rem",
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
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
  },
  shadows: {
    xs: "0 1px 2px 0 rgba(25, 22, 18, 0.04)",
    sm: "0 2px 4px 0 rgba(25, 22, 18, 0.05)",
    md: "0 4px 6px -1px rgba(25, 22, 18, 0.07), 0 2px 4px -2px rgba(25, 22, 18, 0.05)",
    lg: "0 12px 28px rgba(25, 22, 18, 0.05)",
    xl: "0 20px 40px rgba(25, 22, 18, 0.08)",
  },
  defaultRadius: "md",
  components: {
    Button: {
      defaultProps: { radius: "xl" },
      styles: {
        root: {
          fontWeight: "600",
          fontSize: "0.9rem",
          transition: "transform 0.15s, box-shadow 0.15s, background 0.15s",
        },
      },
    },
    Input: {
      styles: {
        input: {
          borderColor: "#d9cfbe",
          fontSize: "0.9rem",
          borderRadius: "10px",
          transition: "border-color 0.15s, box-shadow 0.15s",
        },
      },
    },
    Card: {
      defaultProps: { radius: "md", shadow: "lg" },
      styles: {
        root: { borderColor: "#d9cfbe" },
      },
    },
    Paper: {
      styles: {
        root: { borderRadius: "12px" },
      },
    },
    Modal: {
      styles: {
        header: {
          borderBottom: "1px solid #d9cfbe",
          padding: "1rem 1.5rem",
          marginBottom: 0,
        },
        title: { fontWeight: 600, fontSize: "1.1rem" },
        body: { padding: "1.5rem" },
        content: {
          borderRadius: "20px",
          boxShadow: "0 20px 40px rgba(25, 22, 18, 0.08)",
        },
        close: { color: "#a59e90" },
      },
    },
    Popover: {
      styles: {
        dropdown: {
          borderRadius: "12px",
          boxShadow: "0 12px 28px rgba(25, 22, 18, 0.05)",
          border: "1px solid #d9cfbe",
        },
      },
    },
    Badge: {
      styles: {
        root: {
          borderRadius: "999px",
          fontSize: "0.75rem",
          fontWeight: "600",
          textTransform: "none" as const,
        },
      },
    },
    TextInput: {
      styles: {
        label: {
          fontSize: "0.85rem",
          fontWeight: "600",
          color: "#191612",
          marginBottom: "4px",
        },
      },
    },
    NumberInput: {
      styles: {
        label: {
          fontSize: "0.85rem",
          fontWeight: "600",
          color: "#191612",
          marginBottom: "4px",
        },
      },
    },
    Select: {
      styles: {
        label: {
          fontSize: "0.85rem",
          fontWeight: "600",
          color: "#191612",
          marginBottom: "4px",
        },
      },
    },
    Table: {
      styles: {
        th: {
          fontWeight: "600",
          fontSize: "0.82rem",
          color: "#6f6558",
        },
      },
    },
    Tabs: {
      styles: {
        tab: {
          fontWeight: "500",
          fontSize: "0.875rem",
          borderRadius: "8px",
          transition: "background 0.15s, color 0.15s",
        },
      },
    },
    Tooltip: {
      defaultProps: { withArrow: true, arrowSize: 6 },
      styles: {
        tooltip: { fontSize: "0.75rem", borderRadius: "8px" },
      },
    },
    Group: { defaultProps: { gap: "sm" } },
    Stack: { defaultProps: { gap: "md" } },
  },
});
