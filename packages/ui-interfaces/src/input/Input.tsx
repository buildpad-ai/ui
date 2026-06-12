import React, { forwardRef } from 'react';
import { TextInput, NumberInput, PasswordInput, ActionIcon, Group } from '@mantine/core';
import { IconEye, IconEyeOff, IconX } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';

export interface InputProps {
  /** Input value */
  value?: string | number | null;
  /** Change handler */
  onChange?: (value: string | number | null) => void;
  /** Field label */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Input type - determines which input component to use */
  type?: 'string' | 'uuid' | 'bigInteger' | 'integer' | 'float' | 'decimal' | 'text';
  /** Whether field is required */
  required?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Whether field is readonly */
  readonly?: boolean;
  /** Error message */
  error?: string;
  /** Left section icon */
  iconLeft?: React.ReactNode;
  /** Right section icon */
  iconRight?: React.ReactNode;
  /** Font family */
  font?: 'sans-serif' | 'monospace' | 'serif';
  /** Soft length limit (visual indicator) */
  softLength?: number;
  /** Whether to trim whitespace */
  trim?: boolean;
  /** Whether to mask the input (password style) */
  masked?: boolean;
  /** Whether to show clear button */
  clear?: boolean;
  /** Whether to convert to slug format */
  slug?: boolean;
  /** Minimum value (for numeric types) */
  min?: number;
  /** Maximum value (for numeric types) */
  max?: number;
  /** Step interval (for numeric types) */
  step?: number;
  /** Maximum length */
  maxLength?: number;
  /** Description/help text */
  description?: string;
  // DaaS schema metadata props — destructured and discarded to prevent forwarding
  // to DOM elements (which would trigger React unknown-prop warnings).
  primaryKey?: string | number | null;
  nullable?: boolean;
  autofocus?: boolean;
  defaultValue?: string | number | null;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  value,
  onChange,
  label,
  placeholder,
  type = 'string',
  required = false,
  disabled = false,
  readonly = false,
  error,
  iconLeft,
  iconRight,
  font = 'sans-serif',
  softLength,
  trim = false,
  masked = false,
  clear = false,
  slug = false,
  min,
  max,
  step = 1,
  maxLength,
  description,
  // Destructure DaaS schema metadata props to prevent them from being forwarded
  // to DOM elements (which causes React unknown-prop warnings).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  primaryKey: _primaryKey,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nullable: _nullable,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  autofocus: _autofocus,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  defaultValue: _defaultValue,
  ...props
}, ref) => {
  const [showPassword, { toggle }] = useDisclosure(false);
  
  // Determine if this is a numeric type
  const isNumeric = ['bigInteger', 'integer', 'float', 'decimal'].includes(type);
  
  // Handle value changes with type-specific transformations
  const handleChange = (newValue: string | number | null | undefined) => {
    let processedValue = newValue;
    
    if (typeof processedValue === 'string') {
      // Trim whitespace if enabled
      if (trim) {
        processedValue = processedValue.trim();
      }
      
      // Convert to slug format if enabled
      if (slug) {
        processedValue = processedValue
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }
    }
    
    onChange?.(processedValue as string | number | null);
  };
  
  // Get font family style
  const getFontFamily = () => {
    switch (font) {
      case 'monospace':
        return 'var(--mantine-font-family-monospace, monospace)';
      case 'serif':
        return 'var(--mantine-font-family-headings, Georgia, serif)';
      default:
        return 'var(--mantine-font-family, sans-serif)';
    }
  };
  
  // Common props for all input types
  const commonProps = {
    label,
    placeholder,
    required,
    disabled,
    readOnly: readonly,
    error,
    description,
    style: { fontFamily: getFontFamily() },
    maxLength,
    ...props,
  };
  
  // Clear button functionality
  const clearButton = clear && value ? (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="sm"
      onClick={() => handleChange(null)}
      disabled={disabled || readonly}
      aria-label="Clear input"
    >
      <IconX size={16} />
    </ActionIcon>
  ) : undefined;
  
  // Render numeric input for numeric types
  if (isNumeric) {
    const decimalScale = type === 'decimal' || type === 'float' ? 2 : 0;
    const allowDecimal = type === 'decimal' || type === 'float';
    
    return (
      <NumberInput
        {...commonProps}
        ref={ref as any}
        value={typeof value === 'number' ? value : undefined}
        onChange={(val) => handleChange(val)}
        leftSection={iconLeft}
        rightSection={iconRight || clearButton}
        min={min}
        max={max}
        step={step}
        decimalScale={decimalScale}
        allowDecimal={allowDecimal}
        allowNegative
        thousandSeparator=","
        hideControls={false}
      />
    );
  }
  
  // Render password input for masked text
  if (masked) {
    const passwordRightSection = (
      <Group gap={4}>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={toggle}
          disabled={disabled || readonly}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <IconEyeOff size={16} />
          ) : (
            <IconEye size={16} />
          )}
        </ActionIcon>
        {clearButton}
      </Group>
    );
    
    return (
      <PasswordInput
        {...commonProps}
        ref={ref as any}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => handleChange(e.currentTarget.value)}
        leftSection={iconLeft}
        rightSection={passwordRightSection}
        visible={showPassword}
        onVisibilityChange={toggle}
      />
    );
  }
  
  // Render regular text input for string types
  return (
    <TextInput
      {...commonProps}
      ref={ref}
      value={value == null ? '' : String(value)}
      onChange={(e) => handleChange(e.currentTarget.value)}
      leftSection={iconLeft}
      rightSection={iconRight || clearButton}
      type={type === 'uuid' ? 'text' : 'text'}
    />
  );
});

Input.displayName = 'Input';

export default Input;
