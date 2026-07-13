'use client';

import React from 'react';
import { Group, Pagination, Select, Text } from '@mantine/core';

export interface ListFooterProps {
  /** Rows on the current page. */
  shown: number;
  totalCount: number;
  /** Plural noun for the "Showing N of M {label}" line (e.g. "users"). */
  itemsLabel: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Current page size. */
  limit: number;
  sizeOptions: number[];
  onLimitChange: (limit: number) => void;
  /** Applied to the page-size Select (e.g. `users-manager-page-size`). */
  'data-testid'?: string;
}

/**
 * List footer shared by the three managers, owning the footer contract:
 * rendered only when `totalCount > 0`, "Showing N of M" plus the page-size
 * selector always, the `Pagination` control only when `totalPages > 1`
 * (daas wording parity — keep the copy byte-stable).
 */
export const ListFooter: React.FC<ListFooterProps> = ({
  shown,
  totalCount,
  itemsLabel,
  page,
  totalPages,
  onPageChange,
  limit,
  sizeOptions,
  onLimitChange,
  'data-testid': testId,
}) => {
  if (totalCount <= 0) return null;

  return (
    <Group justify="space-between" px="md" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
      <Group gap="sm">
        <Text size="xs" c="dimmed">
          Showing {shown} of {totalCount} {itemsLabel}
        </Text>
        <Select
          size="xs"
          w={110}
          value={String(limit)}
          onChange={(value) => {
            if (value) onLimitChange(Number(value));
          }}
          data={sizeOptions.map((n) => ({ value: String(n), label: `${n} / page` }))}
          aria-label="Items per page"
          data-testid={testId}
        />
      </Group>
      {totalPages > 1 && <Pagination value={page} onChange={onPageChange} total={totalPages} />}
    </Group>
  );
};

export default ListFooter;
