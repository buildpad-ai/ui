import React, { forwardRef, useState, useEffect } from 'react';
import { TextInput, PasswordInput, Box } from '@mantine/core';
import { IconLock, IconLockOpen } from '@tabler/icons-react';
import './InputHash.css';

export interface InputHashProps {
  /** Current value (hashed string from server, or null) */
  value?: string | null;
  /** Change handler - emits raw (unhashed) input for server-side hashing */
  onChange?: (value: string | null) => void;
  /** Field label */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether to mask the input (password style) */
  masked?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Whether field is readonly / non-editable */
  readonly?: boolean;
  /** Whether field is required */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Description/help text */
  description?: string;
  /** HTML autocomplete attribute */
  autocomplete?: string;
  /** data-testid for testing */
  'data-testid'?: string;
}

export const InputHash = forwardRef<HTMLInputElement, InputHashProps>(({
  value,
  onChange,
  label,
  placeholder,
  masked = false,
  disabled = false,
  readonly = false,
  required = false,
  error,
  description,
  autocomplete,
  'data-testid': testId,
}, ref) => {
  const isHashed = !!(value && value.length > 0);
  const [localValue, setLocalValue] = useState<string>('');

  // Reset local value when external value changes (e.g. on save/reset)
  useEffect(() => {
    if (value === null || value === undefined) {
      setLocalValue('');
    }
  }, [value]);

  const resolvedAutocomplete = autocomplete ?? (masked ? 'new-password' : 'off');

  const internalPlaceholder = isHashed && !localValue
    ? 'Value securely stored'
    : placeholder;

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    onChange?.(newValue || null);
  };

  const lockIcon = (
    <Box
      component="span"
      data-testid={testId ? `${testId}-lock-icon` : undefined}
      style={{ display: 'flex', alignItems: 'center' }}
    >
      {isHashed && !localValue ? (
        <IconLock size={16} style={{ color: 'var(--mantine-primary-color-6)' }} />
      ) : (
        <IconLockOpen size={16} style={{ color: 'var(--mantine-color-yellow-6)' }} />
      )}
    </Box>
  );

  // Match DaaS: placeholder text in primary blue when hashed, monospace font always
  const isShowingHashedState = isHashed && !localValue;
  const commonProps = {
    label,
    placeholder: internalPlaceholder,
    required,
    disabled,
    readOnly: readonly,
    error,
    description,
    autoComplete: resolvedAutocomplete,
    'data-testid': testId,
    style: { fontFamily: 'var(--mantine-font-family-monospace, monospace)' },
    classNames: isShowingHashedState ? { input: 'input-hash-hashed' } : undefined,
  };

  if (masked) {
    return (
      <PasswordInput
        {...commonProps}
        ref={ref as React.Ref<HTMLInputElement>}
        value={localValue}
        onChange={(e) => handleChange(e.currentTarget.value)}
        rightSection={lockIcon}
        visibilityToggleIcon={({ reveal }) =>
          reveal ? (
            <IconLockOpen size={16} />
          ) : (
            <IconLock size={16} />
          )
        }
      />
    );
  }

  return (
    <TextInput
      {...commonProps}
      ref={ref}
      value={localValue}
      onChange={(e) => handleChange(e.currentTarget.value)}
      rightSection={lockIcon}
    />
  );
});

InputHash.displayName = 'InputHash';

export default InputHash;
