'use client';
/** The header bell: unread badge and a popover with the latest notifications. */
import React, { useState } from 'react';
import { ActionIcon, Anchor, Box, Button, Group, Indicator, Loader, Popover, ScrollArea, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconBell } from '@tabler/icons-react';
import { type DeepPartial, type NotificationsTranslations } from '@buildpad/utils';
import { useBuildpadI18n } from '@buildpad/services';
import { useNotifications } from './NotificationsProvider';
import { useNotificationsStrings } from './useNotificationsStrings';
import { mentionsToPlainText } from './core/mentions';
import { timeAgo } from './core/time';
import type { TypeStyles } from './core/typeStyles';
import type { Notification } from './core/types';
import {
  capCount,
  countText,
  defaultNavigate,
  defaultResolveLink,
  styleFor,
  TypeIconBadge,
  UnreadDot,
  type Navigate,
  type ResolveLink,
} from './shared';

export interface NotificationBellProps {
  /** The inbox page (default `/notifications`). */
  href?: string;
  onNavigate?: Navigate;
  resolveLink?: ResolveLink;
  typeStyles?: TypeStyles;
  /** Popover width (default 360). */
  width?: number;
  translations?: DeepPartial<NotificationsTranslations>;
}

export function NotificationBell({
  href = '/notifications',
  onNavigate = defaultNavigate,
  resolveLink = defaultResolveLink,
  typeStyles,
  width = 360,
  translations,
}: NotificationBellProps) {
  const { latest, unreadCount, isLoading, markRead, markAllRead } = useNotifications();
  const strings = useNotificationsStrings(translations);
  const { locale } = useBuildpadI18n();
  const [opened, setOpened] = useState(false);
  const label = unreadCount
    ? countText(locale, unreadCount, strings.bell.labelUnread)
    : strings.bell.label;

  const open = (n: Notification) => {
    if (!n.read_at) void markRead([n.id]);
    setOpened(false);
    const target = resolveLink(n);
    onNavigate(target || `${href}?id=${encodeURIComponent(n.id)}`, n);
  };

  return (
    <Popover width={width} position="bottom-end" shadow="md" opened={opened} onChange={setOpened} withinPortal>
      <Popover.Target>
        <Indicator
          label={capCount(unreadCount, 9)}
          size={16}
          disabled={!unreadCount}
          color="red"
          offset={4}
          data-testid="bp-nt-bell-badge"
        >
          <ActionIcon variant="subtle" size="lg" aria-label={label} onClick={() => setOpened((o) => !o)} aria-expanded={opened}>
            <IconBell size={20} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <Group justify="space-between" px="sm" py="xs" wrap="nowrap">
          <Text fw={600} size="sm">
            {strings.title}
          </Text>
          <Button variant="subtle" size="compact-xs" disabled={!unreadCount} onClick={() => void markAllRead()}>
            {strings.bell.markAllRead}
          </Button>
        </Group>
        <ScrollArea.Autosize mah={420} type="auto">
          {isLoading && !latest.length ? (
            <Group justify="center" p="md">
              <Loader size="sm" role="status" aria-label={strings.bell.loading} />
            </Group>
          ) : !latest.length ? (
            <Text size="sm" c="dimmed" p="md" ta="center">
              {strings.bell.empty}
            </Text>
          ) : (
            <Stack gap={0} component="ul" role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {latest.map((n) => {
                const style = styleFor(n, strings, typeStyles);
                return (
                  <Box component="li" key={n.id}>
                    <UnstyledButton
                      onClick={() => open(n)}
                      w="100%"
                      px="sm"
                      py="xs"
                      data-unread={!n.read_at || undefined}
                      style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
                    >
                      <TypeIconBadge style={style} size={28} />
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" fw={n.read_at ? 400 : 600} lineClamp={1}>
                          {n.title}
                        </Text>
                        {n.message ? (
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {mentionsToPlainText(n.message)}
                          </Text>
                        ) : null}
                        <Text size="xs" c="dimmed">
                          {timeAgo(n.created_at, new Date(), strings.time, locale)}
                        </Text>
                      </Box>
                      {!n.read_at ? <UnreadDot label={strings.row.unread} /> : null}
                    </UnstyledButton>
                  </Box>
                );
              })}
            </Stack>
          )}
        </ScrollArea.Autosize>
        <Box px="sm" py="xs" ta="center" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
          <Anchor
            href={href}
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              setOpened(false);
              onNavigate(href);
            }}
          >
            {strings.bell.seeAll}
          </Anchor>
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}
