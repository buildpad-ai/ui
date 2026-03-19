import React, { forwardRef, useState, useEffect, useCallback } from 'react';
import { TextInput, ActionIcon, Alert, Group, Loader } from '@mantine/core';
import { IconCopy, IconPlus, IconRefresh, IconX, IconKey } from '@tabler/icons-react';
import { apiRequest } from '@buildpad/services';
import { useClipboard } from '@buildpad/hooks';
import './SystemToken.css';

export interface SystemTokenProps {
  /** Current token value (masked as asterisks from server, or actual token after generation) */
  value?: string | null;
  /** Change handler - emits token value or null */
  onChange?: (value: string | null) => void;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Field label */
  label?: string;
  /** Description/help text */
  description?: string;
  /** Error message */
  error?: string;
  /** data-testid for testing */
  'data-testid'?: string;
}

/** Regex to detect masked/asterisk tokens from the server */
const MASKED_REGEX = /^\*+$/;

export const SystemToken = forwardRef<HTMLInputElement, SystemTokenProps>(({
  value,
  onChange,
  disabled = false,
  label,
  description,
  error,
  'data-testid': testId,
}, ref) => {
  const [localValue, setLocalValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isNewTokenGenerated, setIsNewTokenGenerated] = useState(false);

  const { isCopySupported, copyToClipboard } = useClipboard({
    copySuccessMessage: 'Token copied to clipboard',
    copyFailMessage: 'Failed to copy token',
  });

  // Sync local state when external value changes
  useEffect(() => {
    if (!value) {
      setLocalValue(null);
      return;
    }

    // If the server sends back masked asterisks, clear local display
    if (MASKED_REGEX.test(value)) {
      setLocalValue(null);
      setIsNewTokenGenerated(false);
    }
  }, [value]);

  const placeholder = disabled && !value
    ? undefined
    : value
      ? 'Token securely saved'
      : 'No token set — click generate to create one';

  const generateToken = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest<{ data: string }>('/api/utils/random/string');
      const token = response.data;
      setLocalValue(token);
      setIsNewTokenGenerated(true);
      onChange?.(token);
    } catch (err) {
      console.error('Failed to generate token:', err);
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  const emitValue = useCallback((newValue: string | null) => {
    onChange?.(newValue);
    setLocalValue(newValue);
    if (newValue === null) {
      setIsNewTokenGenerated(false);
    }
  }, [onChange]);

  const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    if (localValue) {
      event.target.select();
    }
  }, [localValue]);

  const handleBlur = useCallback(() => {
    window.getSelection()?.removeAllRanges();
  }, []);

  const hasToken = !!value;
  const showCopy = !!localValue && isCopySupported;
  const showClear = !disabled && hasToken;

  return (
    <div data-testid={testId ? `${testId}-container` : undefined}>
      <TextInput
        ref={ref}
        value={localValue ?? ''}
        type={!isNewTokenGenerated ? 'password' : 'text'}
        placeholder={placeholder}
        disabled={disabled}
        readOnly
        label={label}
        description={description}
        error={error}
        data-testid={testId}
        style={{ fontFamily: 'var(--mantine-font-family-monospace, monospace)' }}
        classNames={value && !localValue ? { input: 'system-token-saved' } : undefined}
        onFocus={handleFocus}
        onBlur={handleBlur}
        rightSection={
          <Group gap={4} wrap="nowrap">
            {showCopy && (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => copyToClipboard(localValue)}
                aria-label="Copy token"
                data-testid={testId ? `${testId}-copy` : undefined}
              >
                <IconCopy size={16} />
              </ActionIcon>
            )}
            {!disabled && (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={generateToken}
                disabled={disabled || loading}
                aria-label={hasToken ? 'Regenerate token' : 'Generate token'}
                data-testid={testId ? `${testId}-generate` : undefined}
              >
                {loading ? (
                  <Loader size={16} />
                ) : hasToken ? (
                  <IconRefresh size={16} />
                ) : (
                  <IconPlus size={16} />
                )}
              </ActionIcon>
            )}
            {showClear ? (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => emitValue(null)}
                disabled={loading}
                aria-label="Remove token"
                data-testid={testId ? `${testId}-clear` : undefined}
                className="system-token-clear-icon"
              >
                <IconX size={16} />
              </ActionIcon>
            ) : (
              <IconKey
                size={16}
                style={{ color: hasToken ? 'var(--mantine-primary-color-6)' : 'var(--mantine-color-gray-5)' }}
                data-testid={testId ? `${testId}-key-icon` : undefined}
              />
            )}
          </Group>
        }
        rightSectionWidth={showCopy ? 100 : showClear ? 68 : 52}
      />

      {isNewTokenGenerated && value && (
        <Alert
          color="info"
          mt="sm"
          data-testid={testId ? `${testId}-notice` : undefined}
        >
          Make sure to copy the token now — you won&apos;t be able to see it again.
        </Alert>
      )}
    </div>
  );
});

SystemToken.displayName = 'SystemToken';

export default SystemToken;
