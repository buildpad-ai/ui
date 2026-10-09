'use client';

import React from 'react';
import { Group, Pagination, Select, Text } from '@mantine/core';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import { interpolate, type DeepPartial, type PluralForms, type WorkflowsTranslations } from '@buildpad/utils';

export interface WorkflowListFooterProps {
  /** Rows on the current page. */
  shown: number;
  totalCount: number;
  /**
   * The noun of the "Showing N of M {label}" line, one form per plural
   * category of M (`{ one: 'workflow', other: 'workflows' }`): one workflow is
   * not "1 workflows". A plain string is shown as it is: a dictionary written
   * before the entry had forms holds one, and must not break the list.
   */
  itemsLabel: PluralForms | string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Current page size. */
  limit: number;
  sizeOptions: number[];
  onLimitChange: (limit: number) => void;
  /** Applied to the page-size Select (e.g. `workflows-manager-page-size`). */
  'data-testid'?: string;
  /** Per-instance overrides of the `workflows` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<WorkflowsTranslations>;
}

/**
 * Footer of the workflow list managers, owning the footer contract: rendered
 * only when `totalCount > 0`, "Showing N of M" plus the page-size selector
 * always, the `Pagination` control only when `totalPages > 1`.
 *
 * Package-local copy of ui-users' `ListFooter` reading the `workflows`
 * namespace; not exported from the package.
 */
export const WorkflowListFooter: React.FC<WorkflowListFooterProps> = ({
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
  const t = useBuildpadTranslations((d) => d.workflows, translations);
  const { formatCount } = useBuildpadI18n();

  if (totalCount <= 0) return null;

  // The noun follows the total, as the number beside it does: "1 of 1
  // workflow", "1 of 26 workflows". `formatCount` picks the form the locale's
  // plural rules give that number (Indonesian has one form for every number).
  const noun = typeof itemsLabel === 'string' ? itemsLabel : formatCount(totalCount, itemsLabel);

  return (
    <Group
      justify="space-between"
      px="md"
      py="sm"
      style={{ borderTop: 'var(--ds-table-border, 1px solid var(--mantine-color-default-border))' }}
    >
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

export default WorkflowListFooter;
