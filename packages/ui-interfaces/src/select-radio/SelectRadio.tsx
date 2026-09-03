'use client';

import React, { useMemo, useState } from 'react';
import { Radio, Text, Stack, Group, TextInput, ActionIcon, ColorSwatch } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useBuildpadTranslations } from '@buildpad/services';
import type { DeepPartial, InterfacesTranslations } from '@buildpad/utils';
import { IconDisplay } from '../select-icon/SelectIcon';

export interface RadioChoice {
  text: string;
  value: string | number | boolean;
  disabled?: boolean;
  /** Icon name (Material Design name, resolved via the shared ICON_MAP), shown before the label */
  icon?: string | null;
  /** Theme color name or CSS color, applied to the checked state and an optional swatch */
  color?: string | null;
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
  /**
   * Value is visible but not editable. Unlike `disabled` this keeps the control
   * in the tab order and un-greyed; Mantine's Radio has no native readOnly, so
   * it is enforced by gating the handlers and suppressing pointer events.
   */
  readOnly?: boolean;
  'aria-label'?: string;
  /** Per-instance overrides of the dictionary strings (`interfaces.selectRadio`) */
  translations?: DeepPartial<InterfacesTranslations['selectRadio']>;
}

export function SelectRadio({
  value = null,
  onChange,
  label,
  disabled = false,
  readOnly = false,
  required = false,
  error,
  choices = [],
  allowOther = false,
  width,
  iconOn: _iconOn = 'radio_button_checked',
  iconOff: _iconOff = 'radio_button_unchecked',
  color = 'blue',
  'aria-label': ariaLabel,
  translations,
}: SelectRadioProps) {
  const t = useBuildpadTranslations((d) => d.interfaces.selectRadio, translations);
  const [otherValue, setOtherValue] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);

  // Radio.Group's native `value` must be globally-unique per rendered
  // <Radio>, and two choices whose values stringify identically (e.g.
  // number 1 vs string '1') otherwise share one native radio value —
  // selecting one visually checks both (bug S3.7). Drop the second
  // occurrence: handleChange below already resolves to the *first*
  // matching choice by stringified value, so the dropped choice was never
  // independently selectable anyway (same treatment SelectDropdown already
  // got for the equivalent collision).
  const dedupedChoices = useMemo(() => {
    const seen = new Set<string>();
    const result: RadioChoice[] = [];
    for (const choice of choices) {
      const strValue = String(choice.value);
      if (seen.has(strValue)) continue;
      seen.add(strValue);
      result.push(choice);
    }
    return result;
  }, [choices]);

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

    // A choice missing `text` (malformed/seed data) previously crashed here
    // via val.text.length — guard with `?? ''` so it's treated as the empty
    // string for width-measurement purposes instead of throwing.
    const widestOptionLength = choices.reduce((acc, val) => {
      const text = val.text ?? '';
      if (text.length > acc.length) {
        return text;
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
    if (disabled || readOnly) return;
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
    if (disabled || readOnly) return;
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
          {t.misconfigured}
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
  const currentValue = (usesOtherValue || showOtherInput)
    ? '__other__'
    : (value == null ? '' : String(value));

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
        aria-label={!label ? ariaLabel : undefined}
        {...(readOnly && {
          style: { pointerEvents: 'none' as const, opacity: 0.8 },
          'aria-readonly': true,
        })}
      >
        <Stack gap="sm" mt={label ? "xs" : 0} style={gridStyle}>
          {dedupedChoices.map((choice) => (
            <Radio
              key={String(choice.value)}
              value={String(choice.value)}
              // Mantine v8's `styles` prop is applied as an inline DOM style
              // attribute and doesn't support nested selectors like
              // `&[data-checked]` — the old approach silently did nothing for
              // every color. Radio's native `color` prop is the real checked
              // state here, resolved per-choice so choice.color can override
              // the group default.
              color={choice.color ?? color}
              label={
                <Group gap={6} wrap="nowrap">
                  {choice.icon && <IconDisplay icon={choice.icon} size={14} />}
                  {choice.color && !choice.icon && (
                    <ColorSwatch color={choice.color} size={12} />
                  )}
                  <Text size="sm" span>{choice.text ?? String(choice.value)}</Text>
                </Group>
              }
              disabled={disabled || choice.disabled}
              size="sm"
              styles={{
                radio: {
                  cursor: disabled || choice.disabled ? 'not-allowed' : 'pointer',
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
                label={t.other}
                color={color}
                disabled={disabled}
                size="sm"
                styles={{
                  radio: {
                    cursor: disabled ? 'not-allowed' : 'pointer',
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
                    placeholder={t.customValuePlaceholder}
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
                        if (disabled || readOnly) return;
                        setOtherValue('');
                        setShowOtherInput(false);
                        onChange?.(null);
                      }}
                      disabled={disabled || readOnly}
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
