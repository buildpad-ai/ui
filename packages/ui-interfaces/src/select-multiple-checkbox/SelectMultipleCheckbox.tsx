'use client';

import React, { useState, useMemo } from 'react';
import {
  Stack,
  Text,
  Checkbox,
  Grid,
  Button,
  Group,
  ActionIcon,
  TextInput,
} from '@mantine/core';
import { IconPlus, IconX } from '@tabler/icons-react';

export interface Option {
  text: string;
  value: string | number | boolean;
}

export interface SelectMultipleCheckboxProps {
  value?: (string | number | boolean)[];
  onChange?: (value: (string | number | boolean)[] | null) => void;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  choices?: Option[];
  allowOther?: boolean;
  width?: string;
  iconOn?: string;
  iconOff?: string;
  color?: string;
  itemsShown?: number;
}

export function SelectMultipleCheckbox({
  value = [],
  onChange,
  label,
  disabled = false,
  required = false,
  error,
  choices = [],
  allowOther = false,
  width,
  iconOn: _iconOn = 'check_box',
  iconOff: _iconOff = 'check_box_outline_blank',
  color = 'blue',
  itemsShown = 8,
}: SelectMultipleCheckboxProps) {
  const [showAll, setShowAll] = useState(false);
  const [otherValues, setOtherValues] = useState<{ key: string; value: string }[]>([]);

  // Parse color prop to work with Mantine's color system
  const mantineColor = useMemo(() => {
    if (color.startsWith('var(--mantine-color-')) {
      return color.replace('var(--mantine-color-', '').replace(')', '').replace('-6', '');
    }
    return color;
  }, [color]);

  // Handle displaying limited choices or all choices
  const hideChoices = useMemo(() => choices.length > itemsShown, [choices.length, itemsShown]);
  
  const choicesDisplayed = useMemo(() => {
    if (showAll || !hideChoices) {
      return choices;
    }
    return choices.slice(0, itemsShown);
  }, [choices, showAll, hideChoices, itemsShown]);

  const hiddenCount = useMemo(() => choices.length - itemsShown, [choices.length, itemsShown]);

  // Calculate grid columns based on text length and width
  const gridColumns = useMemo(() => {
    if (!choices.length) {
      return 1;
    }

    const widestOptionLength = choices.reduce((acc, val) => {
      return val.text.length > acc ? val.text.length : acc;
    }, 0);

    if (width?.startsWith('half')) {
      return widestOptionLength <= 10 ? 2 : 1;
    }

    if (widestOptionLength <= 10) {
      return 4;
    }
    if (widestOptionLength > 10 && widestOptionLength <= 15) {
      return 3;
    }
    if (widestOptionLength > 15 && widestOptionLength <= 25) {
      return 2;
    }
    return 1;
  }, [choices, width]);

  // Handle checkbox change for predefined choices
  const handleCheckboxChange = (optionValue: string | number | boolean, checked: boolean) => {
    if (disabled) {
      return;
    }

    const currentValue = value || [];
    let newValue: (string | number | boolean)[];

    if (checked) {
      // Add value if checked and not already present
      if (!currentValue.includes(optionValue)) {
        newValue = [...currentValue, optionValue];
      } else {
        newValue = currentValue;
      }
    } else {
      // Remove value if unchecked
      newValue = currentValue.filter(v => v !== optionValue);
    }

    onChange?.(newValue.length > 0 ? newValue : null);
  };

  // Handle other value changes
  const handleOtherValueChange = (key: string, newValue: string) => {
    setOtherValues(prev => 
      prev.map(item => 
        item.key === key ? { ...item, value: newValue } : item
      )
    );
  };

  // Handle other value checkbox change
  const handleOtherCheckboxChange = (otherValue: string, checked: boolean) => {
    if (disabled) {
      return;
    }

    const currentValue = value || [];
    let newValue: (string | number | boolean)[];

    if (checked) {
      if (!currentValue.includes(otherValue)) {
        newValue = [...currentValue, otherValue];
      } else {
        newValue = currentValue;
      }
    } else {
      newValue = currentValue.filter(v => v !== otherValue);
    }

    onChange?.(newValue.length > 0 ? newValue : null);
  };

  // Add new other value input
  const addOtherValue = () => {
    const newKey = `other_${Date.now()}`;
    setOtherValues(prev => [...prev, { key: newKey, value: '' }]);
  };

  // Remove other value input
  const removeOtherValue = (key: string) => {
    setOtherValues(prev => prev.filter(item => item.key !== key));
  };

  // Get other values that are in the current selection
  const otherValuesInSelection = useMemo(() => {
    if (!value || !allowOther) {
      return [];
    }
    
    const choiceValues = choices.map(c => c.value);
    return value.filter(v => !choiceValues.includes(v));
  }, [value, choices, allowOther]);

  // Show choices validation message
  if (!choices || choices.length === 0) {
    return (
      <Stack gap="xs" style={{ width }}>
        {label && (
          <Text size="sm" fw={500}>
            {label}
            {required && <Text component="span" c="red">*</Text>}
          </Text>
        )}
        <Text size="sm" c="orange">
          Choices option configured incorrectly
        </Text>
        {error && (
          <Text size="xs" c="red">
            {error}
          </Text>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="xs" style={{ width }}>
      {label && (
        <Text size="sm" fw={500}>
          {label}
          {required && <Text component="span" c="red">*</Text>}
        </Text>
      )}

      <Grid gutter="md">
        {choicesDisplayed.map((item, index) => (
          // Index-qualified: choices whose values stringify identically
          // (e.g. number 1 vs string '1') would otherwise collide on
          // key={String(item.value)} — a React "duplicate key" warning.
          // Selection state itself is unaffected (checked/onChange below
          // compare item.value directly, not its string form).
          <Grid.Col span={12 / gridColumns} key={`${index}-${String(item.value)}`}>
            <Checkbox
              label={item.text}
              checked={(value || []).includes(item.value)}
              onChange={(event) => handleCheckboxChange(item.value, event.currentTarget.checked)}
              disabled={disabled}
              size="sm"
              color={mantineColor}
              aria-label={`Select ${item.text}`}
              wrapperProps={{
                style: {
                  width: '100%',
                  padding: '12px',
                  backgroundColor: 'var(--mantine-color-gray-0)',
                  border: '1px solid var(--mantine-color-gray-3)',
                  borderRadius: 'var(--mantine-radius-xs)', // Tokenized border radius
                  transition: 'all 200ms ease',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                },
              }}
            />
          </Grid.Col>
        ))}
      </Grid>

      {/* Show more button */}
      {hideChoices && !showAll && (
        <Button
          variant="subtle"
          size="xs"
          onClick={() => setShowAll(true)}
          disabled={disabled}
        >
          Show {hiddenCount} more option{hiddenCount !== 1 ? 's' : ''}
        </Button>
      )}

      {/* Other values section */}
      {allowOther && (
        <Stack gap="xs" mt="sm">
          {/* Existing other values that are selected */}
          {otherValuesInSelection.map((otherVal) => (
            <Checkbox
              key={String(otherVal)}
              label={String(otherVal)}
              checked
              onChange={(event) => handleOtherCheckboxChange(String(otherVal), event.currentTarget.checked)}
              disabled={disabled}
              size="sm"
              color={mantineColor}
              aria-label={`Selected custom value: ${String(otherVal)}`}
              wrapperProps={{
                style: {
                  padding: '12px',
                  backgroundColor: `var(--mantine-color-${mantineColor}-light)`,
                  border: `1px solid var(--mantine-color-${mantineColor}-6)`,
                  borderRadius: 'var(--mantine-radius-sm)',
                },
              }}
            />
          ))}

          {/* Dynamic other value inputs */}
          {otherValues.map((otherItem) => (
            <Group key={otherItem.key} gap="xs" align="flex-end">
              <Checkbox
                checked={(value || []).includes(otherItem.value)}
                onChange={(event) => handleOtherCheckboxChange(otherItem.value, event.currentTarget.checked)}
                disabled={disabled || !otherItem.value.trim()}
                size="sm"
                color={mantineColor}
                aria-label={`Custom value checkbox: ${otherItem.value || 'empty'}`}
              />
              <TextInput
                placeholder="Enter custom value"
                value={otherItem.value}
                onChange={(event) => handleOtherValueChange(otherItem.key, event.currentTarget.value)}
                disabled={disabled}
                size="sm"
                style={{ flex: 1 }}
              />
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={() => removeOtherValue(otherItem.key)}
                disabled={disabled}
              >
                <IconX size={16} />
              </ActionIcon>
            </Group>
          ))}

          {/* Add other button */}
          <Button
            variant="default"
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={addOtherValue}
            disabled={disabled}
            style={{
              justifyContent: 'flex-start',
              border: '2px dashed var(--mantine-color-gray-4)',
              backgroundColor: 'transparent',
              color: 'var(--mantine-color-gray-6)',
            }}
          >
            Other
          </Button>
        </Stack>
      )}

      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
    </Stack>
  );
}

export default SelectMultipleCheckbox;
