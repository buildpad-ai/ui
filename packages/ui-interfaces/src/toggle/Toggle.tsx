import { Box, Switch, SwitchProps, Text, useMantineTheme } from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";
import React from "react";
import { useBuildpadTranslations } from "@buildpad/services";
import type { DeepPartial, InterfacesTranslations } from "@buildpad/utils";

/**
 * Props for the Toggle interface component
 * Based on DaaS boolean interface with toggle-specific styling
 */
export interface ToggleProps {
  /** Current boolean value */
  value?: boolean | null;

  /** Whether the toggle is disabled */
  disabled?: boolean;

  /** Whether the toggle is readonly */
  readOnly?: boolean;

  /** Whether the field is required */
  required?: boolean;

  /** Label displayed next to the toggle */
  label?: string;

  /** Description text displayed below the label */
  description?: string;

  /** Error message to display */
  error?: string;

  /** Icon to show when toggle is on (ReactNode for JSX; string values from backend options are ignored) */
  iconOn?: string | React.ReactNode;

  /** Icon to show when toggle is off (ReactNode for JSX; string values from backend options are ignored) */
  iconOff?: string | React.ReactNode;

  /** Color when toggle is on */
  colorOn?: string;

  /** Color when toggle is off */
  colorOff?: string;

  /** Size of the toggle */
  size?: SwitchProps["size"];

  /** Callback fired when value changes */
  onChange?: (value: boolean) => void;

  /** Label for the 'on' state */
  labelOn?: string;

  /** Label for the 'off' state */
  labelOff?: string;

  /** Show state labels beside the toggle */
  showStateLabels?: boolean;

  /** Additional props to pass to the Switch component */
  switchProps?: Omit<
    SwitchProps,
    "checked" | "onChange" | "disabled" | "label" | "size"
  >;

  /** Test ID for testing */
  "data-testid"?: string;

  /** Per-instance overrides of the dictionary strings (`interfaces.toggle`) */
  translations?: DeepPartial<InterfacesTranslations["toggle"]>;
}

/**
 * Toggle Interface Component
 *
 * A toggle switch interface that provides a more visual on/off toggle compared to the
 * standard Boolean component. Matches the DaaS toggle interface functionality.
 *
 * Uses Mantine's Switch component with enhanced styling for toggle behavior:
 * - Visual on/off state with icons
 * - Custom colors for states
 * - Optional state labels (On/Off text)
 * - DaaS-compatible API
 *
 * Features:
 * - Boolean value handling with null state support
 * - Custom icons for on/off states
 * - Color customization for both states
 * - State labels (e.g., "On" / "Off")
 * - Disabled and readonly states
 * - Error handling
 * - Accessibility support (ARIA)
 *
 * @param props - Toggle interface props
 * @returns React component
 *
 * @example
 * ```tsx
 * <Toggle
 *   label="Enable notifications"
 *   value={true}
 *   labelOn="Enabled"
 *   labelOff="Disabled"
 *   onChange={(value) => console.log('Toggle changed:', value)}
 * />
 * ```
 */
export const Toggle: React.FC<ToggleProps> = ({
  value,
  disabled = false,
  readOnly = false,
  required = false,
  label,
  description,
  error,
  iconOn,
  iconOff,
  colorOn,
  colorOff,
  size = "md",
  onChange,
  labelOn,
  labelOff,
  showStateLabels = false,
  switchProps = {},
  "data-testid": testId,
  translations,
  ...rest
}) => {
  const theme = useMantineTheme();
  // Dictionary strings; the `labelOn` / `labelOff` props win over both the
  // `translations` prop and the provider dictionary.
  const t = useBuildpadTranslations((d) => d.interfaces.toggle, translations, { on: labelOn, off: labelOff });

  // Handle the change event
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || readOnly) {
      return;
    }

    const newValue = event.currentTarget.checked;
    onChange?.(newValue);
  };

  // Determine the checked state
  // null values are treated as unchecked (false)
  const checked = value === true;

  // Default colors based on DaaS theme
  const defaultColorOn = colorOn || theme.colors.green[6];
  const defaultColorOff = colorOff || theme.colors.gray[5];

  // Default icons - toggle style icons or check/x for clarity
  // String values from backend options are ignored since we cannot resolve icon names
  // to React components at runtime — the components use their built-in defaults instead.
  const resolvedIconOn = typeof iconOn === "string" ? undefined : iconOn;
  const resolvedIconOff = typeof iconOff === "string" ? undefined : iconOff;
  const defaultIconOn = resolvedIconOn || <IconCheck size={12} stroke={3} />;
  const defaultIconOff = resolvedIconOff || <IconX size={12} stroke={3} />;

  // Build the Switch props with potential test ID
  const baseProps: SwitchProps = {
    ...switchProps,
    checked,
    onChange: handleChange,
    disabled,
    label: label ? (required ? `${label} *` : label) : undefined,
    description,
    error,
    size,
    onLabel: defaultIconOn,
    offLabel: defaultIconOff,
    "aria-label": switchProps?.["aria-label"] || label || t.ariaLabel,
    ...(readOnly && { 'aria-readonly': true }),
    ...rest,
  };

  // Create props object with test ID support
  const switchComponentProps = testId
    ? { ...baseProps, "data-testid": testId }
    : baseProps;

  // Apply custom styling for colors
  const customStyles: SwitchProps["styles"] = {
    track: {
      backgroundColor: checked ? defaultColorOn : defaultColorOff,
      borderColor: checked ? defaultColorOn : defaultColorOff,
      cursor: disabled ? "not-allowed" : readOnly ? "default" : "pointer",
      pointerEvents: readOnly ? "none" as const : undefined,
    },
    thumb: {
      backgroundColor: "white",
      borderColor: checked ? defaultColorOn : defaultColorOff,
    },
    label: {
      cursor: disabled ? "not-allowed" : readOnly ? "default" : "pointer",
    },
  };

  switchComponentProps.styles = customStyles;

  // Render with or without state labels
  if (showStateLabels) {
    return (
      <Box data-testid={testId ? `${testId}-container` : undefined}>
        <Box style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Text
            size="sm"
            c={!checked ? "dimmed" : undefined}
            fw={!checked ? 500 : 400}
            data-testid={testId ? `${testId}-label-off` : undefined}
          >
            {t.off}
          </Text>
          <Switch {...switchComponentProps} label={undefined} />
          <Text
            size="sm"
            c={checked ? undefined : "dimmed"}
            fw={checked ? 500 : 400}
            data-testid={testId ? `${testId}-label-on` : undefined}
          >
            {t.on}
          </Text>
        </Box>
        {label && (
          <Text size="sm" mt={4}>
            {required ? `${label} *` : label}
          </Text>
        )}
        {description && (
          <Text size="xs" c="dimmed" mt={2}>
            {description}
          </Text>
        )}
        {error && (
          <Text size="xs" c="red" mt={2}>
            {error}
          </Text>
        )}
      </Box>
    );
  }

  return <Switch {...switchComponentProps} />;
};

export default Toggle;
