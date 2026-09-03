'use client';

import React from 'react';
import { Box, Text, Group, Slider as MantineSlider, SliderProps as MantineSliderProps } from '@mantine/core';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import { interpolate, type DeepPartial, type InterfacesTranslations } from '@buildpad/utils';

export type SliderValueType = 'integer' | 'bigInteger' | 'decimal' | 'float';

export interface SliderProps {
  /** Current value of the slider */
  value?: number | string | null;
  /** Value type for parsing and formatting */
  type?: SliderValueType;
  /** Whether the slider is disabled */
  disabled?: boolean;
  /** Whether the slider is read-only */
  readOnly?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Minimum value */
  minValue?: number;
  /** Maximum value */
  maxValue?: number;
  /** Step interval for the slider */
  stepInterval?: number;
  /** Whether to always show the value label on the slider */
  alwaysShowValue?: boolean;
  /** Field label */
  label?: string;
  /** Description text */
  description?: string;
  /** Error message */
  error?: string;
  /** Size of the slider */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Color of the slider track */
  color?: string;
  /** Whether to show tick marks */
  showTicks?: boolean;
  /** Custom marks for the slider */
  marks?: { value: number; label?: string }[];
  /** Callback when value changes */
  onChange?: (value: number | string) => void;
  /** Callback when value change ends (on mouse up) */
  onChangeEnd?: (value: number | string) => void;
  /** Additional Mantine Slider props */
  sliderProps?: Partial<MantineSliderProps>;
  /** Test ID for testing */
  'data-testid'?: string;
  /** Per-instance overrides of the dictionary strings (`interfaces.slider`) */
  translations?: DeepPartial<InterfacesTranslations['slider']>;
}

/**
 * Slider Interface Component
 * 
 * A slider input interface that matches the DaaS slider interface functionality.
 * Supports various numeric types including integers, big integers, decimals, and floats.
 * 
 * Features:
 * - Configurable min/max values and step intervals
 * - Support for different numeric types (integer, bigInteger, decimal, float)
 * - Optional always-visible value label
 * - Custom tick marks
 * - Value display with min/max indicators
 * - Read-only and disabled states
 * 
 * @param props - Slider interface props
 * @returns React component
 * 
 * @example
 * ```tsx
 * <Slider
 *   label="Volume"
 *   value={50}
 *   minValue={0}
 *   maxValue={100}
 *   stepInterval={5}
 *   onChange={(value) => console.log('Slider changed:', value)}
 * />
 * ```
 */
export const Slider: React.FC<SliderProps> = ({
  value,
  type = 'integer',
  disabled = false,
  readOnly = false,
  required = false,
  minValue = 0,
  maxValue = 100,
  stepInterval = 1,
  alwaysShowValue = false,
  label,
  description,
  error,
  size = 'md',
  color = 'blue',
  showTicks = false,
  marks,
  onChange,
  onChangeEnd,
  sliderProps = {},
  'data-testid': testId,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.interfaces.slider, translations);
  const { formatNumber } = useBuildpadI18n();

  /**
   * Parse the value to a number based on the type
   */
  const parseValue = (val: number | string | null | undefined): number | undefined => {
    if (val === null || val === undefined) {
      return undefined;
    }
    
    if (typeof val === 'number') {
      return val;
    }
    
    // Handle string values for bigInteger and decimal types
    if (type === 'decimal' || type === 'float') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? undefined : parsed;
    }
    
    // Integer and bigInteger types
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? undefined : parsed;
  };

  /**
   * Format the value for output based on the type
   */
  const formatValue = (val: number): number | string => {
    // For bigInteger and decimal, return as string to preserve precision
    if (type === 'bigInteger' || type === 'decimal') {
      return val.toString();
    }
    
    // For integer and float, return as number
    return val;
  };

  /**
   * Handle value change from the slider
   */
  const handleChange = (newValue: number) => {
    if (disabled || readOnly) {
      return;
    }
    
    const formattedValue = formatValue(newValue);
    onChange?.(formattedValue);
  };

  /**
   * Handle change end (when user releases the slider)
   */
  const handleChangeEnd = (newValue: number) => {
    if (disabled || readOnly) {
      return;
    }
    
    const formattedValue = formatValue(newValue);
    onChangeEnd?.(formattedValue);
  };

  // Parse the current value
  const numericValue = parseValue(value);
  
  // Generate default marks if showTicks is enabled
  const defaultMarks = showTicks && !marks ? [
    { value: minValue, label: String(minValue) },
    { value: maxValue, label: String(maxValue) },
  ] : marks;

  // Determine the label format function based on type. Locale-aware decimal
  // separator; no digit grouping, so the label reads like the raw value.
  const getLabelFormat = (val: number): string => {
    if (type === 'decimal' || type === 'float') {
      // Show decimal places based on step interval
      const decimalPlaces = stepInterval < 1
        ? Math.max(2, String(stepInterval).split('.')[1]?.length || 0)
        : 0;
      return formatNumber(val, {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
        useGrouping: false,
      });
    }
    return formatNumber(Math.round(val), { useGrouping: false });
  };

  // Build slider props
  const baseSliderProps: MantineSliderProps = {
    ...sliderProps,
    value: numericValue ?? minValue,
    onChange: handleChange,
    onChangeEnd: handleChangeEnd,
    // Don't use Mantine's disabled prop as it hides the thumb (display: none),
    // removing it from the accessibility tree. Instead, prevent interaction
    // via onChange handlers and style it visually as disabled.
    disabled: false,
    min: minValue,
    max: maxValue,
    step: stepInterval,
    size,
    color,
    marks: defaultMarks,
    label: alwaysShowValue ? getLabelFormat : (val) => getLabelFormat(val),
    labelAlwaysOn: alwaysShowValue,
    thumbLabel: alwaysShowValue ? undefined : t.thumbLabel,
    'aria-label': label || t.ariaLabel,
    styles: {
      root: {
        marginTop: alwaysShowValue ? '24px' : '12px',
        opacity: disabled || readOnly ? 0.6 : 1,
        pointerEvents: disabled || readOnly ? 'none' as const : undefined,
      },
      track: {
        cursor: disabled || readOnly ? 'not-allowed' : 'pointer',
      },
      thumb: {
        cursor: disabled || readOnly ? 'not-allowed' : 'grab',
      },
    },
  };

  return (
    <Box data-testid={testId}>
      {label && (
        <Text fw={500} size="sm" mb={4}>
          {label}
          {required && <Text component="span" c="red" ml={4}>*</Text>}
        </Text>
      )}
      
      {description && (
        <Text size="xs" c="dimmed" mb="sm">
          {description}
        </Text>
      )}

      <Box px="xs">
        <MantineSlider
          {...baseSliderProps}
          data-testid={testId ? `${testId}-input` : undefined}
        />
      </Box>

      {/* Value display */}
      <Group justify="space-between" mt="xs">
        <Text size="xs" c="dimmed">
          {interpolate(t.min, { min: minValue })}
        </Text>
        <Text
          size="sm"
          fw={500}
          data-testid={testId ? `${testId}-value` : undefined}
        >
          {interpolate(t.value, { value: numericValue !== undefined ? getLabelFormat(numericValue) : '—' })}
        </Text>
        <Text size="xs" c="dimmed">
          {interpolate(t.max, { max: maxValue })}
        </Text>
      </Group>

      {error && (
        <Text size="xs" c="red" mt="xs">
          {error}
        </Text>
      )}
    </Box>
  );
};

export default Slider;
