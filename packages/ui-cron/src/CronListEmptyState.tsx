'use client';

import React from 'react';
import { Box, Text } from '@mantine/core';
import { IconAlertTriangle, IconSearch } from '@tabler/icons-react';

export interface CronListEmptyStateProps {
  title: string;
  hint?: string;
  /** Failed-to-load variant: warning icon instead of the search glass. */
  error?: boolean;
  'data-testid'?: string;
}

/**
 * Body of a cron list that has no rows to draw: "no rows" (the `hint`
 * tells a search without matches from a list nobody has added to yet) and the
 * load failure (`error`), so an API outage does not read as "no data yet".
 *
 * Package-local copy of ui-workflows' `WorkflowListEmptyState`; not exported from the
 * package. Every string is passed in.
 */
export const CronListEmptyState: React.FC<CronListEmptyStateProps> = ({
  title,
  hint,
  error = false,
  'data-testid': testId,
}) => (
  <Box ta="center" py="xl" px="md" role={error ? 'alert' : undefined} data-testid={testId}>
    {error ? (
      <IconAlertTriangle size={40} stroke={1} color="var(--mantine-color-error)" />
    ) : (
      <IconSearch size={40} stroke={1} color="var(--mantine-color-dimmed)" />
    )}
    <Text fw={500} size="sm" mb={4}>
      {title}
    </Text>
    {hint && (
      <Text size="xs" c="dimmed">
        {hint}
      </Text>
    )}
  </Box>
);

export default CronListEmptyState;
