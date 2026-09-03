import React, { forwardRef, useState, useEffect } from 'react';
import { isConcealedValue, type DeepPartial, type InterfacesTranslations } from '@buildpad/utils';
import { useBuildpadTranslations } from '@buildpad/services';
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
  /**
   * camelCase alias for `readonly`. This is the casing @buildpad/ui-form passes,
   * so it must be accepted here or the read-only path below is unreachable.
   */
  readOnly?: boolean;
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
  /** Accessible name, used when no visible `label` is rendered */
  'aria-label'?: string;
  /** Per-instance overrides of the dictionary strings (`interfaces.inputHash`) */
  translations?: DeepPartial<InterfacesTranslations['inputHash']>;
}

export const InputHash = forwardRef<HTMLInputElement, InputHashProps>(({
  value,
  onChange,
  label,
  placeholder,
  masked = false,
  disabled = false,
  readonly: readonlyProp = false,
  readOnly: readOnlyProp = false,
  required = false,
  error,
  description,
  autocomplete,
  'data-testid': testId,
  'aria-label': ariaLabel,
  translations,
}, ref) => {
  // Accept either casing. @buildpad/ui-form passes camelCase `readOnly`; this
  // component historically read only the lowercase form, so a readonly password
  // field stayed fully typeable and overwrote the stored credential on save.
  const readonly = readonlyProp || readOnlyProp;
  const t = useBuildpadTranslations((d) => d.interfaces.inputHash, translations);
  const isHashed = typeof value === 'string' && value.length > 0;
  const [localValue, setLocalValue] = useState<string>('');

  // Reset local value when external value changes (e.g. on save/reset).
  //
  // The concealed mask counts as a reset: it is the steady state for a stored
  // credential, so a null/undefined-only test could never fire for the case it
  // exists to handle — typed plaintext survived Discard, stayed visible in the
  // input, and was re-submitted on the next save. SystemToken already guards
  // this transition the same way.
  useEffect(() => {
    if (value === null || value === undefined || isConcealedValue(value)) {
      setLocalValue('');
    }
  }, [value]);

  const resolvedAutocomplete = autocomplete ?? (masked ? 'new-password' : 'off');

  const internalPlaceholder = isHashed && !localValue
    ? t.storedPlaceholder
    : placeholder;

  const handleChange = (newValue: string) => {
    // Native readOnly on the control below stops typing in a browser, but this
    // is a stored credential — gate the handler too so no programmatic or
    // synthetic change path can overwrite it.
    if (disabled || readonly) return;
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
    // Only needed as the accessible name when no visible label is rendered
    // (FormField hides the label and relies on this) — an explicit `label`
    // already gives Mantine's input its accessible name via the linked
    // <label for>, so setting both would just be redundant.
    'aria-label': label ? undefined : ariaLabel,
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
