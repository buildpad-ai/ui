'use client';

import React from 'react';
import { Group, Table, UnstyledButton, type TableThProps } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconSelector } from '@tabler/icons-react';

export interface SortableThProps extends Omit<TableThProps, 'onClick'> {
  /** Column header label. */
  label: React.ReactNode;
  /** Whitelisted API sort field this column maps to (Directus `field`/`-field` format). */
  field: string;
  /** The list's current sort value: `field`, `-field`, or null when unsorted. */
  sort: string | null;
  /** Called with the column's field when the header is clicked (see `toggleSort`). */
  onSort: (field: string) => void;
  'data-testid'?: string;
}

/**
 * Clickable table header cell for server-side sorting. Shows a chevron for
 * the active direction and a neutral selector icon when the column is not
 * sorted; exposes the state via `aria-sort`. Sort fields must be whitelisted
 * real columns — invalid fields error server-side.
 */
export const SortableTh: React.FC<SortableThProps> = ({
  label,
  field,
  sort,
  onSort,
  'data-testid': testId,
  ...props
}) => {
  const direction = sort === field ? 'asc' : sort === `-${field}` ? 'desc' : null;
  const Icon = direction === 'asc' ? IconChevronUp : direction === 'desc' ? IconChevronDown : IconSelector;

  return (
    <Table.Th
      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
      {...props}
    >
      <UnstyledButton
        onClick={() => onSort(field)}
        data-testid={testId}
        style={{ font: 'inherit', fontWeight: 'inherit', color: 'inherit' }}
      >
        <Group gap={4} wrap="nowrap">
          <span>{label}</span>
          <Icon size={14} stroke={1.5} style={{ opacity: direction ? 1 : 0.5, flexShrink: 0 }} />
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
};

export default SortableTh;
