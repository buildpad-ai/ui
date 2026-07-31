/**
 * SelectMultipleDropdown Interface Component
 * Dropdown-based multi-select with search support
 * 
 * Based on DaaS select-multiple-dropdown interface
 * Uses Mantine MultiSelect for dropdown functionality
 */

'use client';

import React, { useMemo } from 'react';
import { MultiSelect, Text, Stack } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';

export interface DropdownChoice {
  text: string;
  value: string | number | boolean;
  disabled?: boolean;
}

export interface SelectMultipleDropdownProps {
  /**
   * Registered for `types: ['json', 'csv']` — a `csv`-typed field delivers a
   * raw comma-separated string, not an array. `type` lets this component
   * normalize on read and re-serialize on write when used standalone
   * (outside the FormFieldInterface pipeline, which already normalizes this
   * for its own three multi-select leaves but can't help a direct consumer
   * of this exported component).
   */
  type?: 'csv' | 'json';
  value?: (string | number | boolean)[] | string | null;
  onChange?: (value: (string | number | boolean)[] | string | null) => void;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  choices?: DropdownChoice[];
  allowNone?: boolean;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  maxValues?: number;
  hidePickedOptions?: boolean;
  width?: string;
  color?: string;
  'aria-label'?: string;
}

export function SelectMultipleDropdown({
  type,
  value = [],
  onChange,
  label,
  disabled = false,
  required = false,
  error,
  choices = [],
  allowNone = false,
  placeholder,
  searchable = true,
  clearable = true,
  maxValues,
  hidePickedOptions = false,
  width,
  color = 'blue',
  'aria-label': ariaLabel,
}: SelectMultipleDropdownProps) {
  // Normalize a raw csv-string value to an array before anything below reads
  // it. `type === 'csv'` is the documented signal, but also trust what was
  // actually observed (a string) — some backends report the underlying
  // column type instead of the abstract 'csv' interface type.
  const normalizedValue = useMemo(() => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return value ?? [];
  }, [value]);
  const isCsvStorage = type === 'csv' || typeof value === 'string';
  // Transform choices for Mantine MultiSelect
  const data = useMemo(() => {
    if (!choices || choices.length === 0) {
      return [];
    }

    // Mantine's <MultiSelect> requires globally-unique string `value`s in
    // `data` and throws "Duplicate options are not supported" otherwise.
    // Choices with different typed values that stringify identically (e.g.
    // number 1 vs string '1') would collide here — drop the second
    // occurrence so the field renders, same fix as SelectDropdown.
    const seen = new Set<string>();
    const result: { value: string; label: string; disabled: boolean }[] = [];
    for (const choice of choices) {
      const strValue = String(choice.value);
      if (seen.has(strValue)) continue;
      seen.add(strValue);
      result.push({
        value: strValue,
        label: choice.text,
        disabled: choice.disabled || false,
      });
    }
    return result;
  }, [choices]);

  // Emit an array or, for csv storage, join it back to a comma-string —
  // Mantine's MultiSelect always hands us an array regardless of how the
  // value is actually stored.
  const emit = (next: (string | number | boolean)[] | null) => {
    if (isCsvStorage && Array.isArray(next)) {
      onChange?.(next.join(','));
    } else {
      onChange?.(next);
    }
  };

  // Handle value changes with proper sorting
  const handleChange = (newValue: string[]) => {
    if (!newValue || newValue.length === 0) {
      emit(allowNone ? null : []);
      return;
    }

    // If no choices available, just pass through the values
    if (!choices || choices.length === 0) {
      emit(newValue);
      return;
    }

    // Sort values based on their position in the original choices array
    // (copy first — Array.prototype.sort mutates in place, and this is
    // Mantine's own array reference)
    const sortedValue = [...newValue].sort((a, b) => {
      const indexA = choices.findIndex(choice => String(choice.value) === a);
      const indexB = choices.findIndex(choice => String(choice.value) === b);

      // If not found in choices (custom values), put them at the end
      if (indexA === -1 && indexB === -1) {
        return 0;
      }
      if (indexA === -1) {
        return 1;
      }
      if (indexB === -1) {
        return -1;
      }

      return indexA - indexB;
    });

    // Convert back to original value types
    const convertedValue = sortedValue.map(stringValue => {
      const originalChoice = choices.find(choice => String(choice.value) === stringValue);
      return originalChoice ? originalChoice.value : stringValue;
    });

    emit(convertedValue);
  };

  // Show choices validation message
  if (!choices || choices.length === 0) {
    return (
      <Stack gap="xs" style={{ width }}>
        {label && (
          <Text size="sm" fw={500}>
            {label}
            {required && <Text component="span" c="red" ml={4}>*</Text>}
          </Text>
        )}
        <Text size="sm" c="orange" role="alert">
          Choices option configured incorrectly
        </Text>
        {error && (
          <Text size="xs" c="red" role="alert" aria-live="polite">
            {error}
          </Text>
        )}
      </Stack>
    );
  }

  // Convert value to string array for Mantine
  const stringValue = normalizedValue.map(v => String(v));

  return (
    <Stack gap="xs" style={{ width }}>
      <MultiSelect
        label={label}
        placeholder={placeholder}
        data={data}
        value={stringValue}
        onChange={handleChange}
        disabled={disabled}
        error={error}
        required={required}
        searchable={searchable}
        clearable={clearable}
        maxValues={maxValues}
        hidePickedOptions={hidePickedOptions}
        withAsterisk={required}
        nothingFoundMessage="No options found"
        maxDropdownHeight={300}
        comboboxProps={{
          transitionProps: { transition: 'pop', duration: 200 },
          shadow: 'var(--mantine-shadow-md)',
        }}
        rightSection={<IconChevronDown size={16} />}
        aria-label={ariaLabel || label || 'Multiple select dropdown'}
        styles={{
          input: {
            cursor: disabled ? 'not-allowed' : 'pointer',
          },
          pill: {
            backgroundColor: `var(--mantine-color-${color}-light)`,
            color: `var(--mantine-color-${color}-filled)`,
          },
        }}
        filter={searchable ? undefined : () => data} // Disable filtering if not searchable
      />
    </Stack>
  );
}

export default SelectMultipleDropdown;
