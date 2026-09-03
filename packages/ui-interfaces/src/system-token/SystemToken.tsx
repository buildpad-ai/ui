import React, { forwardRef, useState, useEffect, useCallback } from 'react';
import { isConcealedValue, type DeepPartial, type InterfacesTranslations } from '@buildpad/utils';
import { TextInput, ActionIcon, Alert, Group, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCopy, IconPlus, IconRefresh, IconX, IconKey } from '@tabler/icons-react';
import { apiRequest, useBuildpadTranslations } from '@buildpad/services';
import { useClipboard } from '@buildpad/hooks';
import './SystemToken.css';

export interface SystemTokenProps {
  /** Current token value (masked as asterisks from server, or actual token after generation) */
  value?: string | null;
  /** Change handler - emits token value or null */
  onChange?: (value: string | null) => void;
  /**
   * Custom token producer replacing the default `GET /api/utils/random/string`
   * backend call — e.g. a client-side generator when that endpoint is not part
   * of the app's API surface. Synchronous producers emit synchronously.
   */
  generate?: () => string | Promise<string>;
  /** Whether the field is disabled */
  disabled?: boolean;
  /**
   * Token is visible but not modifiable. The display input is already hardcoded
   * readOnly; this additionally hides Generate/Regenerate and Clear, which were
   * gated on `disabled` alone and could otherwise rotate a live API token.
   */
  readOnly?: boolean;
  /** Field label */
  label?: string;
  /** Description/help text */
  description?: string;
  /** Error message */
  error?: string;
  /** data-testid for testing */
  'data-testid'?: string;
  /** Accessible name, used when no visible `label` is rendered */
  'aria-label'?: string;
  /** Per-instance overrides of the dictionary strings (`interfaces.systemToken`) */
  translations?: DeepPartial<InterfacesTranslations['systemToken']>;
}

export const SystemToken = forwardRef<HTMLInputElement, SystemTokenProps>(({
  value,
  onChange,
  generate,
  disabled = false,
  readOnly = false,
  label,
  description,
  error,
  'data-testid': testId,
  'aria-label': ariaLabel,
  translations,
}, ref) => {
  const t = useBuildpadTranslations((d) => d.interfaces.systemToken, translations);
  const [localValue, setLocalValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isNewTokenGenerated, setIsNewTokenGenerated] = useState(false);

  const { isCopySupported, copyToClipboard } = useClipboard({
    copySuccessMessage: t.copySuccess,
    copyFailMessage: t.copyFail,
    onNotify: (message, type) =>
      notifications.show({ message, color: type === 'error' ? 'red' : 'green' }),
  });

  // Sync local state when external value changes
  useEffect(() => {
    if (!value) {
      setLocalValue(null);
      // Also clear the fresh-token flag. It used to be reset only on the
      // masked branch, which was safe while every "token is gone" arrived as
      // the mask; a plain null now takes this path, and a stale flag left the
      // credential input rendering as type="text" instead of a password.
      setIsNewTokenGenerated(false);
      return;
    }

    // If the server sends back masked asterisks, clear local display
    if (isConcealedValue(value)) {
      setLocalValue(null);
      setIsNewTokenGenerated(false);
    }
  }, [value]);

  // The empty-state text names the Generate control, which is hidden for a
  // disabled or read-only field — so only offer that instruction when the
  // control is actually there, and still say something when it is not.
  const canGenerate = !disabled && !readOnly;
  const placeholder = value
    ? t.placeholder.saved
    : canGenerate
      ? t.placeholder.generateHint
      : t.placeholder.none;

  const applyGeneratedToken = useCallback((token: string) => {
    setLocalValue(token);
    setIsNewTokenGenerated(true);
    onChange?.(token);
  }, [onChange]);

  const generateToken = useCallback(() => {
    // A synchronous producer emits synchronously (no loading flicker).
    if (generate) {
      const produced = generate();
      if (typeof produced === 'string') {
        applyGeneratedToken(produced);
        return;
      }
      setLoading(true);
      produced
        .then(applyGeneratedToken)
        .catch((err) => console.error('Failed to generate token:', err))
        .finally(() => setLoading(false));
      return;
    }
    setLoading(true);
    apiRequest<{ data: string }>('/api/utils/random/string')
      .then((response) => applyGeneratedToken(response.data))
      .catch((err) => console.error('Failed to generate token:', err))
      .finally(() => setLoading(false));
  }, [generate, applyGeneratedToken]);

  const emitValue = useCallback((newValue: string | null) => {
    if (disabled || readOnly) return;
    onChange?.(newValue);
    setLocalValue(newValue);
    if (newValue === null) {
      setIsNewTokenGenerated(false);
    }
  }, [onChange, disabled, readOnly]);

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
  const showClear = !disabled && !readOnly && hasToken;

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
        // FormField renders the visible label itself and withholds `label`
        // from the leaf, so without this the token input had no accessible
        // name at all — an axe "label" failure on the one field this
        // component exists for.
        aria-label={label ? undefined : ariaLabel}
        description={description}
        error={error}
        data-testid={testId}
        data-lpignore="true"
        data-1p-ignore="true"
        // Scoped to the input element: a root-level style would leak the
        // monospace face into the label/description, and instance styles must
        // outrank the design-system theme's TextInput input font override.
        styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace, monospace)' } }}
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
                aria-label={t.copyToken}
                data-testid={testId ? `${testId}-copy` : undefined}
              >
                <IconCopy size={16} />
              </ActionIcon>
            )}
            {!disabled && !readOnly && (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={generateToken}
                disabled={disabled || loading}
                aria-label={hasToken ? t.regenerateToken : t.generateToken}
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
                aria-label={t.removeToken}
                data-testid={testId ? `${testId}-clear` : undefined}
                className="system-token-clear-icon"
              >
                <IconX size={16} />
              </ActionIcon>
            ) : (
              <IconKey
                size={16}
                style={{ color: hasToken ? 'var(--mantine-primary-color-6)' : 'var(--mantine-color-dimmed)' }}
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
          {t.backupNotice}
        </Alert>
      )}
    </div>
  );
});

SystemToken.displayName = 'SystemToken';

export default SystemToken;
