'use client';

import React from 'react';
import { Group, Paper, Stack, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useBuildpadTranslations } from '@buildpad/services';
import type { DeepPartial, UsersTranslations } from '@buildpad/utils';

export interface InfoPanelItem {
  label: string;
  value: React.ReactNode;
}

export interface InfoPanelProps {
  /** Panel heading. Default: the dictionary's "Information". */
  title?: string;
  /** Label/value rows, rendered in order. */
  items: InfoPanelItem[];
  /** Optional description shown in a muted callout below the rows. */
  description?: string;
  /** Per-instance overrides of the `users` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<UsersTranslations>;
}

/**
 * Generic label/value info sidebar used by `UserDetail`, `RoleDetail`, and
 * `PolicyDetail` — a merge of the buildpad-daas `InfoSidebar` and
 * `RoleInfoSidebar` components into one reusable shape.
 */
export const InfoPanel: React.FC<InfoPanelProps> = ({
  title,
  items,
  description,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.users, translations);

  return (
    <Paper shadow="xs" p="md" withBorder data-testid="info-panel">
      <Group mb="md">
        <IconInfoCircle size={20} />
        <Text fw={600}>{title ?? t.infoPanel.title}</Text>
      </Group>

      <Stack gap="sm">
        {items.map((item, index) => (
          <div key={index}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              {item.label}
            </Text>
            <Text size="sm">{item.value}</Text>
          </div>
        ))}
      </Stack>

      {description && (
        <Paper mt="md" p="sm" bg="gray.0">
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        </Paper>
      )}
    </Paper>
  );
};

export default InfoPanel;
