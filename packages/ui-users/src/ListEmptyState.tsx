'use client';

import React from 'react';
import { Box, Text } from '@mantine/core';
import { IconAlertTriangle, IconSearch } from '@tabler/icons-react';

export interface ListEmptyStateProps {
  title: string;
  hint?: string;
  /** Failed-to-load variant: warning icon instead of the search glass. */
  error?: boolean;
  'data-testid'?: string;
}

/**
 * Empty-table body shared by the three list managers, covering "no rows"
 * (optionally distinguishing filtered vs pristine via `hint`) and the
 * load-failure state (`error`), so an API outage doesn't masquerade as
 * "no data yet".
 */
export const ListEmptyState: React.FC<ListEmptyStateProps> = ({
  title,
  hint,
  error = false,
  'data-testid': testId,
}) => (
  <Box ta="center" py="xl" data-testid={testId}>
    {error ? (
      <IconAlertTriangle size={40} stroke={1} color="var(--mantine-color-red-5)" />
    ) : (
      <IconSearch size={40} stroke={1} color="var(--mantine-color-gray-4)" />
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

export default ListEmptyState;
