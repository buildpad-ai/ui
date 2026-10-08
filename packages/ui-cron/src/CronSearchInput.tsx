'use client';

import React from 'react';
import { ActionIcon, TextInput, type MantineSize } from '@mantine/core';
import { IconSearch, IconX } from '@tabler/icons-react';
import { useBuildpadTranslations } from '@buildpad/services';
import type { DeepPartial, CronTranslations } from '@buildpad/utils';

export interface CronSearchInputProps {
  value: string;
  /** Called with the new text; called with `''` by the clear affordance. */
  onChange: (value: string) => void;
  /** Default: the dictionary's "Search..." (`common.searchPlaceholder`). */
  placeholder?: string;
  size?: MantineSize;
  style?: React.CSSProperties;
  'data-testid'?: string;
  /** Per-instance overrides of the `cron` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<CronTranslations>;
}

/**
 * Debounce-agnostic search box of the jobs list: leading search
 * icon plus a clear affordance while non-empty. Callers own the state (and any
 * debouncing of the fetch).
 *
 * Package-local copy of ui-workflows' `WorkflowSearchInput` reading the `cron`
 * namespace; not exported from the package, so the generic name stays free.
 */
export const CronSearchInput: React.FC<CronSearchInputProps> = ({
  value,
  onChange,
  placeholder,
  size = 'sm',
  style,
  'data-testid': testId,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.cron, translations);
  const common = useBuildpadTranslations((d) => d.common);

  return (
    <TextInput
      placeholder={placeholder ?? common.searchPlaceholder}
      leftSection={<IconSearch size={15} stroke={1.5} />}
      rightSection={
        value ? (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="xs"
            onClick={() => onChange('')}
            aria-label={t.searchInput.clearAriaLabel}
          >
            <IconX size={12} />
          </ActionIcon>
        ) : null
      }
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      size={size}
      style={style}
      data-testid={testId}
    />
  );
};

export default CronSearchInput;
