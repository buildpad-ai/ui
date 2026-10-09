'use client';

import React from 'react';
import { Group, Pagination, Select, Text } from '@mantine/core';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import { interpolate, type DeepPartial, type PluralForms, type UsersTranslations } from '@buildpad/utils';

export interface ListFooterProps {
  /** Rows on the current page. */
  shown: number;
  totalCount: number;
  /**
   * The noun of the "Showing N of M {label}" line, one form per plural
   * category of M (`{ one: 'user', other: 'users' }`): one user is not
   * "1 users". A plain string is shown as it is: a host that renders this
   * footer itself may pass one, and so does a dictionary written before the
   * managers' entries had forms.
   */
  itemsLabel: PluralForms | string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Current page size. */
  limit: number;
  sizeOptions: number[];
  onLimitChange: (limit: number) => void;
  /** Applied to the page-size Select (e.g. `users-manager-page-size`). */
  'data-testid'?: string;
  /** Per-instance overrides of the `users` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<UsersTranslations>;
}

/**
 * List footer shared by the three managers, owning the footer contract:
 * rendered only when `totalCount > 0`, "Showing N of M" plus the page-size
 * selector always, the `Pagination` control only when `totalPages > 1`
 * (daas wording parity — keep the copy byte-stable; the noun alone follows
 * the total: "Showing 1 of 1 user").
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
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.users, translations);
  const { formatCount } = useBuildpadI18n();

  if (totalCount <= 0) return null;

  // The noun follows the total, as the number beside it does: "1 of 1 user",
  // "1 of 26 users". `formatCount` picks the form the locale's plural rules
  // give that number (Indonesian has one form for every number).
  const noun = typeof itemsLabel === 'string' ? itemsLabel : formatCount(totalCount, itemsLabel);

  return (
    <Group justify="space-between" px="md" py="sm" style={{ borderTop: 'var(--ds-table-border, 1px solid #e8ebf1)' }}>
      <Group gap="sm">
        <Text size="xs" c="dimmed">
          {interpolate(t.listFooter.showing, { shown, totalCount, itemsLabel: noun })}
        </Text>
        <Select
          size="xs"
          w={110}
          value={String(limit)}
          onChange={(value) => {
            if (value) onLimitChange(Number(value));
          }}
          data={sizeOptions.map((n) => ({ value: String(n), label: interpolate(t.listFooter.perPage, { n }) }))}
          aria-label={t.listFooter.itemsPerPageAriaLabel}
          data-testid={testId}
        />
      </Group>
      {totalPages > 1 && <Pagination value={page} onChange={onPageChange} total={totalPages} />}
    </Group>
  );
};

export default ListFooter;
