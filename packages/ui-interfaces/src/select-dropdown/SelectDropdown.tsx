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
    const base = processedChoices.map((choice) => ({
      value: String(choice.value),
      label: choice.text,
      disabled: choice.disabled || false,
      // Store original choice for rendering
      icon: choice.icon,
      color: choice.color,
    }));

    // allowOther: a previously-committed custom value won't be in `choices`,
    // so Mantine's <Select> (which only highlights/displays values present
    // in `data`) would otherwise show it blank. Inject it as a synthetic
    // option so the current value round-trips correctly.
    if (allowOther && value !== null && value !== undefined && value !== '') {
      const strValue = String(value);
      if (!base.some((item) => item.value === strValue)) {
        return [...base, { value: strValue, label: strValue, disabled: false, icon: null, color: null }];
      }
    }

    return base;
  }, [processedChoices, allowOther, value]);

  // allowOther: track the live search text so a typed value that matches no
  // existing choice can be committed on Enter/blur. Mantine v8's <Select>
  // has no built-in "creatable" mode, so this is done manually.
  const [otherSearchValue, setOtherSearchValue] = React.useState('');

  const commitOtherValue = React.useCallback(() => {
    if (!allowOther || !onChange) return;
    const trimmed = otherSearchValue.trim();
    if (!trimmed) return;
    // Only commit free text — an exact match to an existing choice's label
    // was already handled by onChange via the normal option-select path.
    const matchesExistingChoice = choices.some(
      (choice) => choice.text === trimmed || String(choice.value) === trimmed,
    );
    if (!matchesExistingChoice) {
      onChange(trimmed);
    }
  }, [allowOther, onChange, otherSearchValue, choices]);

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
        // Reachable when the user clicks the synthetic "current custom
        // value" option injected into selectData above (re-selecting an
        // already-committed other-value); new free text is committed via
        // commitOtherValue (search + Enter/blur), not through this path,
        // since Mantine's onChange never fires for text with no matching
        // option.
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
      // allowOther: Mantine v8's <Select> has no built-in "creatable" mode,
      // so free text is committed manually — track the live search text and
      // emit it as the value on Enter or on blur when it matches no choice.
      // Removed the old dead `else if (allowOther)` branch in handleChange:
      // Mantine's onChange only ever fires with an existing option's value
      // (or null), so typed-but-uncommitted text never reached it.
      {...(allowOther
        ? {
            searchValue: otherSearchValue,
            onSearchChange: setOtherSearchValue,
            onBlur: commitOtherValue,
            onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') commitOtherValue();
            },
          }
        : {})}
      {...selectProps}
    />
  );
};

export default SelectDropdown;
