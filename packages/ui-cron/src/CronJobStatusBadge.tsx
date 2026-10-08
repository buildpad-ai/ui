'use client';

import React from 'react';
import { Badge, Text, type MantineSize } from '@mantine/core';
import { useBuildpadTranslations } from '@buildpad/services';
import type { CronJobStatus } from '@buildpad/types';
import type { CronTranslations, DeepPartial } from '@buildpad/utils';

export interface CronJobStatusBadgeProps {
  /**
   * The job's status. `null` / `undefined` (the caller's grant withholds the
   * column) draws the missing-value marker instead of a badge.
   */
  status: CronJobStatus | null | undefined;
  /** Badge size. Default: Mantine's (`md`). */
  size?: MantineSize;
  'data-testid'?: string;
  /** Per-instance overrides of the `cron` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<CronTranslations>;
}

/**
 * Whether the scheduler fires a job: a green "Active" or a gray "Inactive".
 *
 * One wording for the jobs list and for the editor header. The reference admin
 * UI drew the list's badge from a label and the editor's from the stored value
 * in lower case. A value that is neither (a status a newer backend added) is
 * shown as it is stored.
 */
export const CronJobStatusBadge: React.FC<CronJobStatusBadgeProps> = ({
  status,
  size,
  'data-testid': testId,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.cron, translations);

  if (!status) {
    return (
      <Text size="xs" c="dimmed" data-testid={testId}>
        {t.emptyValue}
      </Text>
    );
  }

  return (
    <Badge color={status === 'active' ? 'green' : 'gray'} variant="light" size={size} data-testid={testId}>
      {t.jobStatus[status] ?? status}
    </Badge>
  );
};

export default CronJobStatusBadge;
