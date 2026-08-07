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
  value?: (string | number | boolean)[] | null;
  onChange?: (value: (string | number | boolean)[] | null) => void;
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
}

export function SelectMultipleDropdown({
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
}: SelectMultipleDropdownProps) {
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

  // Handle value changes with proper sorting
  const handleChange = (newValue: string[]) => {
    if (!newValue || newValue.length === 0) {
      onChange?.(allowNone ? null : []);
      return;
    }

    // If no choices available, just pass through the values
    if (!choices || choices.length === 0) {
      onChange?.(newValue);
      return;
    }

    // Sort values based on their position in the original choices array
    const sortedValue = newValue.sort((a, b) => {
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

    onChange?.(convertedValue);
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
  const stringValue = Array.isArray(value) ? value.map(v => String(v)) : [];

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
        clearable={clearable && allowNone}
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
        aria-label={label || 'Multiple select dropdown'}
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
