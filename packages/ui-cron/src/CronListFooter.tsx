'use client';

import React from 'react';
import { Group, Pagination, Select, Text } from '@mantine/core';
import { useBuildpadTranslations } from '@buildpad/services';
import { interpolate, type DeepPartial, type CronTranslations } from '@buildpad/utils';

export interface CronListFooterProps {
  /** Rows on the current page. */
  shown: number;
  totalCount: number;
  /** Plural noun for the "Showing N of M {label}" line (e.g. "jobs"). */
  itemsLabel: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Current page size. */
  limit: number;
  sizeOptions: number[];
  onLimitChange: (limit: number) => void;
  /** Applied to the page-size Select (e.g. `cron-jobs-manager-page-size`). */
  'data-testid'?: string;
  /** Per-instance overrides of the `cron` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<CronTranslations>;
}

/**
 * Footer of the cron lists (jobs and runs), owning the footer contract: rendered
 * only when `totalCount > 0`, "Showing N of M" plus the page-size selector
 * always, the `Pagination` control only when `totalPages > 1`.
 *
 * Package-local copy of ui-workflows' `WorkflowListFooter` reading the `cron`
 * namespace; not exported from the package.
 */
export const CronListFooter: React.FC<CronListFooterProps> = ({
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
  const t = useBuildpadTranslations((d) => d.cron, translations);

  if (totalCount <= 0) return null;

  return (
    <Group
      justify="space-between"
      px="md"
      py="sm"
      style={{ borderTop: 'var(--ds-table-border, 1px solid var(--mantine-color-default-border))' }}
    >
      <Group gap="sm">
        <Text size="xs" c="dimmed">
          {interpolate(t.listFooter.showing, { shown, totalCount, itemsLabel })}
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

export default CronListFooter;
