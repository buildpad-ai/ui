'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ActionIcon, Alert, Box, CopyButton, Group, TextInput, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy, IconKey, IconPlus, IconRefresh, IconX } from '@tabler/icons-react';
import { generateToken, isConcealedToken } from './accessUtils';

export interface TokenInputProps {
  /** Current value: `null` (no token), a plaintext token, or the backend-concealed asterisks. */
  value: string | null;
  /** Called with the newly generated token, or `null` to revoke. */
  onChange: (value: string | null) => void;
  /** Field label. Default: "Token". */
  label?: string;
  /** Field description shown under the label. */
  description?: string;
  /** Disables all actions and renders the field inert. */
  disabled?: boolean;
  /** Error message. */
  error?: string;
  'data-testid'?: string;
}

/**
 * Static access token field, ported from the buildpad-daas `system-token`
 * interface (Directus behavior): the input is read-only — a token is either
 * generated (shown in plaintext exactly once, with a Copy affordance and a
 * can't-view-again notice), securely saved (the backend conceals it as
 * asterisks → "Value Securely Saved"), or cleared (`onChange(null)` = revoke).
 * Generation happens client-side via `generateToken()`.
 */
export const TokenInput: React.FC<TokenInputProps> = ({
  value,
  onChange,
  label = 'Token',
  description,
  disabled = false,
  error,
  'data-testid': testId,
}) => {
  // Plaintext shown after an in-session generation; never derived from a
  // concealed value, which by contract can't be displayed again.
  const [localValue, setLocalValue] = useState<string | null>(null);

  const isConcealed = isConcealedToken(value);
  const hasToken = !!value;

  // External value change (save/reload) — drop the plaintext once the
  // backend has concealed it, or when the token was removed elsewhere.
  useEffect(() => {
    if (!value || isConcealed) setLocalValue(null);
  }, [value, isConcealed]);

  const placeholder =
    hasToken && !localValue
      ? 'Value Securely Saved'
      : 'Click "Generate Token" to create a new static access token';

  const handleGenerate = useCallback(() => {
    const token = generateToken();
    setLocalValue(token);
    onChange(token);
  }, [onChange]);

  const handleClear = useCallback(() => {
    setLocalValue(null);
    onChange(null);
  }, [onChange]);

  return (
    <Box>
      <TextInput
        label={label}
        description={description}
        placeholder={disabled && !hasToken ? undefined : placeholder}
        value={localValue || ''}
        readOnly
        disabled={disabled}
        error={error}
        data-lpignore="true"
        data-1p-ignore="true"
        styles={{
          input: {
            fontFamily: 'var(--mantine-font-family-monospace)',
            ...(hasToken && !localValue
              ? { '&::placeholder': { color: 'var(--mantine-color-blue-6)' } }
              : {}),
          },
        }}
        rightSectionWidth="auto"
        rightSectionPointerEvents="auto"
        rightSection={
          <Group align="center" gap={4} pr={4} wrap="nowrap">
            {localValue && (
              <CopyButton value={localValue} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copied!' : 'Copy token'} withArrow>
                    <ActionIcon
                      variant="subtle"
                      color={copied ? 'teal' : 'gray'}
                      size="sm"
                      onClick={copy}
                      data-testid={testId ? `${testId}-copy` : undefined}
                    >
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            )}

            {!disabled && (
              <Tooltip label={hasToken ? 'Regenerate token' : 'Generate token'} withArrow>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={handleGenerate}
                  aria-label={hasToken ? 'Regenerate token' : 'Generate token'}
                  data-testid={testId ? `${testId}-generate` : undefined}
                >
                  {hasToken ? <IconRefresh size={16} /> : <IconPlus size={16} />}
                </ActionIcon>
              </Tooltip>
            )}

            {!disabled && hasToken && (
              <Tooltip label="Remove token" withArrow>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  onClick={handleClear}
                  aria-label="Remove token"
                  data-testid={testId ? `${testId}-clear` : undefined}
                >
                  <IconX size={16} />
                </ActionIcon>
              </Tooltip>
            )}

            <IconKey
              size={16}
              style={{
                color:
                  hasToken && !localValue
                    ? 'var(--mantine-color-blue-6)'
                    : 'var(--mantine-color-gray-5)',
              }}
            />
          </Group>
        }
        data-testid={testId}
      />

      {localValue && (
        <Alert color="blue" mt="sm" data-testid={testId ? `${testId}-notice` : undefined}>
          Make sure to back up and copy the token above. For security reasons, you will not be
          able to view it again after saving.
        </Alert>
      )}
    </Box>
  );
};

export default TokenInput;
