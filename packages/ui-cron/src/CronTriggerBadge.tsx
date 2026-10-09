'use client';

import React from 'react';
import { Badge, type MantineSize } from '@mantine/core';
import { useBuildpadTranslations } from '@buildpad/services';
import type { CronTriggeredBy } from '@buildpad/types';
import type { CronTranslations, DeepPartial } from '@buildpad/utils';

export interface CronTriggerBadgeProps {
  /** What started the run: the schedule, a user (Run Now), or stored code. */
  triggeredBy: CronTriggeredBy;
  /** Badge size. Default: `xs`. */
  size?: MantineSize;
  'data-testid'?: string;
  /** Per-instance overrides of the `cron` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<CronTranslations>;
}

/**
 * What started a run — the "By" badge of a history row and of the run log: an
 * outlined badge, violet for a manual run and gray for the others. A value
 * that is none of the three is shown as it is stored.
 */
export const CronTriggerBadge: React.FC<CronTriggerBadgeProps> = ({
  triggeredBy,
  size = 'xs',
  'data-testid': testId,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.cron, translations);

  return (
    <Badge variant="outline" size={size} color={triggeredBy === 'manual' ? 'violet' : 'gray'} data-testid={testId}>
      {t.trigger[triggeredBy] ?? triggeredBy}
    </Badge>
  );
};

export default CronTriggerBadge;
