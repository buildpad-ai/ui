'use client';

import React from 'react';
import { ActionIcon, TextInput, type MantineSize } from '@mantine/core';
import { IconSearch, IconX } from '@tabler/icons-react';

export interface SearchInputProps {
  value: string;
  /** Called with the new text; called with `''` by the clear affordance. */
  onChange: (value: string) => void;
  placeholder?: string;
  size?: MantineSize;
  style?: React.CSSProperties;
  'data-testid'?: string;
}

/**
 * Debounce-agnostic search box shared by the list managers and
 * `PolicyPickerModal`: leading search icon plus a clear affordance while
 * non-empty. Callers own the state (and any debouncing of the fetch).
 */
export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  size = 'sm',
  style,
  'data-testid': testId,
}) => (
  <TextInput
    placeholder={placeholder}
    leftSection={<IconSearch size={15} stroke={1.5} />}
    rightSection={
      value ? (
        <ActionIcon variant="subtle" color="gray" size="xs" onClick={() => onChange('')} aria-label="Clear search">
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

export default SearchInput;
