'use client';

import React from 'react';
import { Badge, Text, type MantineSize } from '@mantine/core';
import { useBuildpadTranslations } from '@buildpad/services';
import type { CronRunStatus } from '@buildpad/types';
import type { CronTranslations, DeepPartial } from '@buildpad/utils';

const COLORS: Record<CronRunStatus, string> = {
  success: 'green',
  error: 'red',
  timeout: 'orange',
  running: 'blue',
};

export interface CronRunStatusBadgeProps {
  /**
   * How the run ended, or `running`. `null` / `undefined` (a job that has not
   * run yet) draws the missing-value marker instead of a badge.
   */
  status: CronRunStatus | null | undefined;
  /** Badge size. Default: `sm`. */
  size?: MantineSize;
  'data-testid'?: string;
  /** Per-instance overrides of the `cron` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<CronTranslations>;
}

/**
 * The outcome of a run: Success (green), Error (red), Timeout (orange) or
 * Running (blue). Used for a run in the history tables and the run log, and
 * for a job's Last Status. A value that is none of the four is shown as it is
 * stored, in gray.
 */
export const CronRunStatusBadge: React.FC<CronRunStatusBadgeProps> = ({
  status,
  size = 'sm',
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
    <Badge color={COLORS[status] ?? 'gray'} variant="light" size={size} data-testid={testId}>
      {t.runStatus[status] ?? status}
    </Badge>
  );
};

export default CronRunStatusBadge;
