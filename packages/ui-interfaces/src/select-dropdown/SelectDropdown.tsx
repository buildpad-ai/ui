import React from 'react';
import { Select, SelectProps, Group, ColorSwatch, Text, ComboboxItem, ComboboxLikeRenderOptionInput } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

/**
 * Interface option type matching DaaS select-dropdown interface
 * Supports icon and color properties like DaaS
 */
export interface SelectOption {
  text: string;
  value: string | number | boolean;
  icon?: string | null;
  color?: string | null;
  disabled?: boolean;
  children?: SelectOption[];
}

/**
 * Props for the SelectDropdown component
 */
export interface SelectDropdownProps {
  /** Current selected value */
  value?: string | number | boolean | null;
  /** Callback fired when value changes */
  onChange?: (value: string | number | boolean | null) => void;
  /** Array of choice options */
  choices?: SelectOption[];
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Icon to display in the left section (global icon for all options) */
  icon?: string;
  /** Whether to allow clearing the selection */
  allowNone?: boolean;
  /** Whether to allow entering custom values not in the choices */
  allowOther?: boolean;
  /** Field label */
  label?: string;
  /** Field description */
  description?: string;
  /** Error message */
  error?: string | boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is read-only */
  readOnly?: boolean;
  /** Whether to enable search functionality */
  searchable?: boolean;
  /** Maximum height of the dropdown */
  maxDropdownHeight?: number;
  /** Additional Mantine Select props */
  selectProps?: Partial<SelectProps>;
}

/**
 * SelectDropdown component implementing DaaS select-dropdown interface
 * 
 * This component provides a dropdown selection interface compatible with DaaS
 * select-dropdown interface, built using Mantine's Select component.
 * 
 * Features:
 * - Single value selection from predefined choices
 * - Optional custom value input (allowOther)
 * - Clearable selection (allowNone)
 * - Search functionality
 * - Icon and color support (like DaaS)
 * - Validation and error states
 * - Accessibility compliant
 * 
 * @example
 * ```tsx
 * <SelectDropdown
 *   value="react"
 *   onChange={handleChange}
 *   choices={[
 *     { text: 'React', value: 'react', icon: 'code', color: '#61dafb' },
 *     { text: 'Vue', value: 'vue', icon: 'code', color: '#42b883' },
 *     { text: 'Angular', value: 'angular', icon: 'code', color: '#dd0031' }
 *   ]}
 *   label="Your favorite framework"
 *   placeholder="Choose a framework"
 *   allowNone
 *   searchable
 * />
 * ```
 */
export const SelectDropdown: React.FC<SelectDropdownProps> = ({
  value = null,
  onChange,
  choices = [],
  disabled = false,
  placeholder = 'Select an option',
  icon,
  allowNone = false,
  allowOther = false,
  label,
  description,
  error,
  required = false,
  readOnly = false,
  searchable = false,
  maxDropdownHeight = 200,
  selectProps = {},
}) => {
  // Check if any choice has an icon - used for global icon display logic (like DaaS)
  const applyGlobalIcon = React.useMemo(() => 
    choices?.some((choice) => choice.icon), 
    [choices]
  );

  // Apply global icon to choices that don't have one (DaaS behavior)
  const processedChoices = React.useMemo(() => {
    if (!choices || choices.length === 0) {
      return [];
    }

    if (!applyGlobalIcon) {
      return choices;
    }

    return choices.map((choice) => {
      const choiceCopy = { ...choice };
      if (!choiceCopy.icon && !choiceCopy.color) {
        choiceCopy.icon = icon ?? null;
      }
      return choiceCopy;
    });
  }, [choices, applyGlobalIcon, icon]);

  // Determine if we should show global icon (DaaS behavior)
  const showGlobalIcon = React.useMemo(() => {
    if (!icon) {
      return false;
    }
    if (!applyGlobalIcon) {
      return true;
    }
    if (value === null || value === undefined || value === '') {
      return true;
    }
    return false;
  }, [icon, applyGlobalIcon, value]);

  // Convert choices to Mantine Select format with icon/color support
  const selectData = React.useMemo(() => {
    // Mantine's <Select> requires globally-unique string `value`s in `data`
    // and throws "Duplicate options are not supported" otherwise. Choices
    // with different typed values that stringify identically (e.g. number 1
    // vs string '1') would collide here — drop the second occurrence so the
    // field renders (matching handleChange below, which already resolves
    // the *first* matching choice by stringified value, so the dropped
    // choice was never independently selectable anyway).
    const seen = new Set<string>();
    const data: { value: string; label: string; disabled: boolean; icon: string | null | undefined; color: string | null | undefined }[] = [];
    for (const choice of processedChoices) {
      const strValue = String(choice.value);
      if (seen.has(strValue)) continue;
      seen.add(strValue);
      data.push({
        value: strValue,
        label: choice.text,
        disabled: choice.disabled || false,
        // Store original choice for rendering
        icon: choice.icon,
        color: choice.color,
      });
    }
    return data;
  }, [processedChoices]);

  // Handle value changes
  const handleChange = React.useCallback(
    (selectedValue: string | null) => {
      if (!onChange) {
        return;
      }

      if (selectedValue === null) {
        onChange(null);
        return;
      }

      // Find the original choice to get the correct value type
      const originalChoice = choices.find((choice) => String(choice.value) === selectedValue);
      if (originalChoice) {
        onChange(originalChoice.value);
      } else if (allowOther) {
        // If allowing other values and not found in choices, treat as string
        onChange(selectedValue);
      }
    },
    [onChange, choices, allowOther]
  );

  // Convert current value to string for Mantine Select
  const selectValue = React.useMemo(() => {
    if (value === null || value === undefined) {
      return null;
    }
    return String(value);
  }, [value]);

  // Determine if we should show no data message
  const showNoData = selectData.length === 0;

  // Left section icon rendering
  const leftSection = React.useMemo(() => {
    if (!showGlobalIcon || !icon) {
      return undefined;
    }
    
    // For now, we'll just show the icon name as text
    // In a real implementation, you might want to use an icon library
    return (
      <Text size="sm" c="dimmed">
        {icon}
      </Text>
    );
  }, [showGlobalIcon, icon]);

  // Custom render option component for icon/color support
  const renderOption = React.useCallback(
    ({ option, checked }: ComboboxLikeRenderOptionInput<ComboboxItem & { icon?: string | null; color?: string | null }>) => {
      return (
        <Group gap="sm" wrap="nowrap">
          {option.color && (
            <ColorSwatch color={option.color} size={14} />
          )}
          {option.icon && !option.color && (
            <Text size="sm" c="dimmed">
              {option.icon}
            </Text>
          )}
          <Text size="sm">{option.label}</Text>
          {checked && <IconCheck size={14} />}
        </Group>
      );
    },
    []
  );

  if (showNoData && !allowOther) {
    return (
      <Text c="red" size="sm" p="xs">
        Choices option configured incorrectly
      </Text>
    );
  }

  return (
    <Select
      data={selectData}
      value={selectValue}
      onChange={handleChange}
      label={label}
      description={description}
      placeholder={placeholder}
      error={error}
      disabled={disabled}
      required={required}
      readOnly={readOnly}
      clearable={allowNone}
      allowDeselect={allowNone}
      searchable={searchable || allowOther}
      leftSection={leftSection}
      maxDropdownHeight={maxDropdownHeight}
      nothingFoundMessage={allowOther ? undefined : 'No options found'}
      renderOption={renderOption}
      data-testid="select-dropdown"
      // For allowOther functionality, we need to implement custom behavior
      // since Mantine Select doesn't support creating new options directly
      {...selectProps}
    />
  );
};

export default SelectDropdown;
