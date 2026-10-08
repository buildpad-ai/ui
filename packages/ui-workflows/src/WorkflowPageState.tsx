'use client';

import React from 'react';
import { Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle, IconFileUnknown, IconLock } from '@tabler/icons-react';
import { useBuildpadTranslations } from '@buildpad/services';

export interface WorkflowPageStateProps {
  /**
   * What happened instead of the page:
   *   - `notFound`     — the record does not exist (or the caller's row rule hides it);
   *   - `accessDenied` — the caller may not read it;
   *   - `error`        — the load failed.
   */
  variant: 'notFound' | 'accessDenied' | 'error';
  title: string;
  description?: string;
  /** Shows a Back button (`common.back`). */
  onBack?: () => void;
  /** Shows a Retry button (`common.retry`); meant for `error`. */
  onRetry?: () => void;
  'data-testid'?: string;
}

const ICONS = {
  notFound: IconFileUnknown,
  accessDenied: IconLock,
  error: IconAlertTriangle,
} as const;

/**
 * What a workflow page draws in place of its content when there is no content
 * to draw: a missing record, a refusal, or a failed load — three different
 * things, and none of them an empty form or an empty list.
 *
 * Shared by the list managers and the detail surfaces of this package; not
 * exported from it. Titles and descriptions are passed in.
 */
export const WorkflowPageState: React.FC<WorkflowPageStateProps> = ({
  variant,
  title,
  description,
  onBack,
  onRetry,
  'data-testid': testId,
}) => {
  const common = useBuildpadTranslations((d) => d.common);
  const Icon = ICONS[variant];

  return (
    <Paper withBorder p="xl" radius="md" role="alert" data-testid={testId}>
      <Stack align="center" gap="xs">
        <Icon
          size={40}
          stroke={1}
          color={variant === 'error' ? 'var(--mantine-color-error)' : 'var(--mantine-color-dimmed)'}
        />
        <Title order={4} ta="center">
          {title}
        </Title>
        {description && (
          <Text size="sm" c="dimmed" ta="center">
            {description}
          </Text>
        )}
        {(onBack || onRetry) && (
          <Group gap="sm" mt="sm">
            {onBack && (
              <Button variant="default" onClick={onBack}>
                {common.back}
              </Button>
            )}
            {onRetry && <Button onClick={onRetry}>{common.retry}</Button>}
          </Group>
        )}
      </Stack>
    </Paper>
  );
};

export default WorkflowPageState;
