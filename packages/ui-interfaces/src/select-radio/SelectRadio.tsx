'use client';

import React, { useMemo, useState } from 'react';
import { Radio, Text, Stack, Group, TextInput, ActionIcon } from '@mantine/core';
import { IconX } from '@tabler/icons-react';

export interface RadioChoice {
  text: string;
  value: string | number | boolean;
  disabled?: boolean;
}

export interface SelectRadioProps {
  value?: string | number | boolean | null;
  onChange?: (value: string | number | boolean | null) => void;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  choices?: RadioChoice[];
  allowOther?: boolean;
  width?: string;
  iconOn?: string;
  iconOff?: string;
  color?: string;
}

export function SelectRadio({
  value = null,
  onChange,
  label,
  disabled = false,
  required = false,
  error,
  choices = [],
  allowOther = false,
  width,
  iconOn: _iconOn = 'radio_button_checked',
  iconOff: _iconOff = 'radio_button_unchecked',
  color = 'blue',
}: SelectRadioProps) {
  const [otherValue, setOtherValue] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);

  // Determine if current value is in predefined choices.
  // Uses `value == null` (not `!value`) so falsy-but-real values like `0`
  // and `false` aren't treated as "no value" — and stringifies both sides
  // (like the highlight/emit logic below already does) so a choice
  // authored as `'3'` still matches a stored integer `3`.
  const isValueInChoices = useMemo(() => {
    if (value == null || !choices || choices.length === 0) {
      return false;
    }
    return choices.some(choice => String(choice.value) === String(value));
  }, [value, choices]);

  // Check if we're using "other" option
  const usesOtherValue = useMemo(() => {
    return allowOther && value != null && !isValueInChoices;
  }, [allowOther, value, isValueInChoices]);

  // Initialize other value when component mounts with existing "other" value
  React.useEffect(() => {
    if (usesOtherValue && value != null) {
      setOtherValue(String(value));
      setShowOtherInput(true);
    }
  }, [usesOtherValue, value]);

  // Calculate grid columns based on choice text length and width
  const gridColumns = useMemo(() => {
    if (!choices || choices.length === 0) {
      return 1;
    }

    const widestOptionLength = choices.reduce((acc, val) => {
      if (val.text.length > acc.length) {
        return val.text;
      }
      return acc;
    }, '').length;

    if (width?.startsWith('half')) {
      if (widestOptionLength <= 10) {
        return 2;
      }
      return 1;
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

  // Grid styles
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '12px 32px',
    gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
  };

  // Handle radio button change
  const handleChange = (newValue: string) => {
    if (newValue === '__other__') {
      setShowOtherInput(true);
      if (otherValue) {
        onChange?.(otherValue);
      }
    } else {
      setShowOtherInput(false);
      const choice = choices.find(c => String(c.value) === newValue);
      onChange?.(choice ? choice.value : newValue);
    }
  };

  // Handle other input change
  const handleOtherChange = (newOtherValue: string) => {
    setOtherValue(newOtherValue);
    if (showOtherInput || usesOtherValue) {
      onChange?.(newOtherValue);
    }
  };

  // Handle other input focus
  const handleOtherFocus = () => {
    setShowOtherInput(true);
    handleChange('__other__');
  };

  // Show choices validation message
  if (!choices || choices.length === 0) {
    return (
      <Stack gap="xs" w={width}>
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

  // Determine current value for radio group.
  // `value == null ? '' : String(value)` (not `String(value || '')`) so a
  // stored `0` or `false` still stringifies to a real, matchable value
  // instead of collapsing to the same empty string as "no value".
  const currentValue = usesOtherValue ? '__other__' : (value == null ? '' : String(value));

  return (
    <Stack gap="xs" w={width}>
      <Radio.Group
        value={currentValue}
        onChange={handleChange}
        label={label}
        description={null}
        error={error}
        required={required}
        size="sm"
      >
        <Stack gap="sm" mt={label ? "xs" : 0} style={gridStyle}>
          {choices.map((choice) => (
            <Radio
              key={String(choice.value)}
              value={String(choice.value)}
              label={choice.text}
              disabled={disabled || choice.disabled}
              size="sm"
              styles={{
                radio: {
                  cursor: disabled || choice.disabled ? 'not-allowed' : 'pointer',
                  '&[data-checked]': {
                    borderColor: `var(--mantine-color-${color}-6)`,
                    backgroundColor: `var(--mantine-color-${color}-6)`,
                  },
                },
                label: {
                  cursor: disabled || choice.disabled ? 'not-allowed' : 'pointer',
                  color: disabled || choice.disabled ? 'var(--mantine-color-gray-6)' : undefined,
                },
              }}
            />
          ))}

          {/* Other option */}
          {allowOther && (
            <Stack gap="xs">
              <Radio
                value="__other__"
                label="Other"
                disabled={disabled}
                size="sm"
                styles={{
                  radio: {
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    '&[data-checked]': {
                      borderColor: `var(--mantine-color-${color}-6)`,
                      backgroundColor: `var(--mantine-color-${color}-6)`,
                    },
                  },
                  label: {
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    color: disabled ? 'var(--mantine-color-gray-6)' : undefined,
                  },
                }}
              />
              
              {(showOtherInput || usesOtherValue) && (
                <Group gap="xs" align="flex-end" pl="md">
                  <TextInput
                    placeholder="Enter custom value"
                    value={otherValue}
                    onChange={(event) => handleOtherChange(event.currentTarget.value)}
                    onFocus={handleOtherFocus}
                    disabled={disabled}
                    size="sm"
                    style={{ flex: 1 }}
                    styles={{
                      input: {
                        border: '2px dashed var(--mantine-color-gray-4)',
                        backgroundColor: 'transparent',
                        '&:focus': {
                          borderColor: `var(--mantine-color-${color}-6)`,
                          backgroundColor: `var(--mantine-color-${color}-0)`,
                        },
                      },
                    }}
                  />
                  {otherValue && (
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => {
                        setOtherValue('');
                        setShowOtherInput(false);
                        onChange?.(null);
                      }}
                      disabled={disabled}
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  )}
                </Group>
              )}
            </Stack>
          )}
        </Stack>
      </Radio.Group>
    </Stack>
  );
}

export default SelectRadio;
