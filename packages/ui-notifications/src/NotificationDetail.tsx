'use client';
/**
 * One notification in full: icon, title, type, date, the message, and slots where the app puts a
 * preview of the source record, actions, and a reply box (e.g. the ui-comments Composer).
 */
import React from 'react';
import { Badge, Box, Button, Group, Stack, Text, Title } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import type { DeepPartial, NotificationsTranslations } from '@buildpad/utils';
import { useBuildpadI18n } from '@buildpad/services';
import { useNotificationsStrings } from './useNotificationsStrings';
import { mentionsToPlainText } from './core/mentions';
import { timeAgo } from './core/time';
import type { TypeStyles } from './core/typeStyles';
import type { Notification } from './core/types';
import { defaultNavigate, defaultResolveLink, styleFor, TypeIconBadge, type Navigate, type ResolveLink } from './shared';

export interface NotificationDetailSlots {
  /** A preview of the source record, under the message. */
  renderPreview?: (n: Notification) => React.ReactNode;
  /** Buttons for acting on the notification (approve, assign, ...). */
  renderActions?: (n: Notification) => React.ReactNode;
  /** A reply box, e.g. the ui-comments `Composer` bound to the source record. */
  renderReply?: (n: Notification) => React.ReactNode;
}

export interface NotificationDetailProps extends NotificationDetailSlots {
  notification: Notification;
  onNavigate?: Navigate;
  resolveLink?: ResolveLink;
  typeStyles?: TypeStyles;
  /** Heading level of the title (default 2). */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Mark read / unread toggle; leave out to hide it. */
  onToggleRead?: (n: Notification) => void;
  translations?: DeepPartial<NotificationsTranslations>;
}

function DetailBody({
  notification: n,
  onNavigate = defaultNavigate,
  resolveLink = defaultResolveLink,
  typeStyles,
  headingLevel = 2,
  onToggleRead,
  renderPreview,
  renderActions,
  renderReply,
  translations,
}: NotificationDetailProps) {
  const strings = useNotificationsStrings(translations);
  const { locale } = useBuildpadI18n();
  const style = styleFor(n, strings, typeStyles);
  const link = resolveLink(n);
  const date = new Date(n.created_at);
  const message = mentionsToPlainText(n.message);
  const preview = renderPreview?.(n);
  const actions = renderActions?.(n);
  const reply = renderReply?.(n);

  return (
    <Stack gap="md" data-testid="bp-nt-detail">
      <Group align="flex-start" wrap="nowrap" gap="sm">
        <TypeIconBadge style={style} size={40} />
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Title order={headingLevel} size="h4" style={{ overflowWrap: 'anywhere' }}>
            {n.title}
          </Title>
          <Group gap="xs" mt={4}>
            <Badge variant="light" color={style.color} size="sm">
              {style.label}
            </Badge>
            <Text size="xs" c="dimmed" style={{ flex: '1 1 12rem', minWidth: 0 }}>
              <time dateTime={n.created_at} title={date.toLocaleString(locale)}>
                {date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
              </time>
              {` · ${timeAgo(n.created_at, new Date(), strings.time, locale)}`}
              {n.actor_name ? ` · ${n.actor_name}` : null}
            </Text>
          </Group>
        </Box>
      </Group>
      <Group gap="xs">
        {link ? (
          <Button
            component="a"
            href={link}
            size="xs"
            variant="light"
            leftSection={<IconExternalLink size={14} />}
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              onNavigate(link, n);
            }}
          >
            {strings.detail.openFullPage}
          </Button>
        ) : null}
        {onToggleRead ? (
          <Button size="xs" variant="default" onClick={() => onToggleRead(n)}>
            {n.read_at ? strings.detail.markUnread : strings.detail.markRead}
          </Button>
        ) : null}
      </Group>
      {message ? (
        <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} data-testid="bp-nt-message">
          {message}
        </Text>
      ) : null}
      {preview ? <Box data-testid="bp-nt-preview">{preview}</Box> : null}
      {actions ? (
        <Group gap="xs" data-testid="bp-nt-actions">
          {actions}
        </Group>
      ) : null}
      {reply ? <Box w="100%" data-testid="bp-nt-reply">{reply}</Box> : null}
    </Stack>
  );
}

/** Keyed by id, so the slots (a half-typed reply) never carry over to another notification. */
export function NotificationDetail(props: NotificationDetailProps) {
  return <DetailBody key={props.notification.id} {...props} />;
}
