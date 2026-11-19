'use client';
/**
 * The inbox page: tabs, a list grouped by day (380px) and the detail pane. Both panes scroll, not
 * the page. On narrow screens (<= 768px) one pane shows at a time, with a back button.
 * Keys: j / ArrowDown next, k / ArrowUp previous, u toggles read.
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, Box, Button, Center, Group, Loader, Stack, Tabs, Text, Title, UnstyledButton } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconArrowLeft, IconBellOff } from '@tabler/icons-react';
import type { DeepPartial, NotificationsTranslations } from '@buildpad/utils';
import { useBuildpadI18n } from '@buildpad/services';
import { useNotifications } from './NotificationsProvider';
import { useNotificationsPage } from './useNotificationsPage';
import { useNotificationsStrings } from './useNotificationsStrings';
import { NotificationDetail, type NotificationDetailSlots } from './NotificationDetail';
import { findTab, resolveTabs, type NotificationTab } from './core/filters';
import { mentionsToPlainText } from './core/mentions';
import { dayGroupLabel, dayKey, timeAgo } from './core/time';
import type { TypeStyles } from './core/typeStyles';
import type { Notification } from './core/types';
import { useLocalUrlState, type InboxUrlState } from './urlState';
import { countText, styleFor, TypeIconBadge, UnreadDot, type Navigate, type ResolveLink } from './shared';

export const MOBILE_QUERY = '(max-width: 768px)';

export interface NotificationsInboxProps extends NotificationDetailSlots {
  /** App tabs on top of `all` and `unread`, e.g. `{ key: 'mentions', label: 'Mentions', clause: { type: { _eq: 'mention' } } }`. */
  tabs?: NotificationTab[];
  /** Where `?filter=` and `?id=` live; see `nextUrlState`. Default: in memory. */
  urlState?: InboxUrlState;
  onNavigate?: Navigate;
  resolveLink?: ResolveLink;
  typeStyles?: TypeStyles;
  pageSize?: number;
  /** Height of the two panes (default `calc(100dvh - 120px)`). */
  height?: number | string;
  /** Heading level of the page title (default 1); the detail title is one below. */
  headingLevel?: 1 | 2 | 3 | 4 | 5;
  translations?: DeepPartial<NotificationsTranslations>;
}

const isTyping = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"]')) return true;
  return target.isContentEditable;
};

export function NotificationsInbox({
  tabs: extraTabs,
  urlState: urlStateProp,
  onNavigate,
  resolveLink,
  typeStyles,
  pageSize,
  height = 'calc(100dvh - 120px)',
  headingLevel = 1,
  translations,
  renderPreview,
  renderActions,
  renderReply,
}: NotificationsInboxProps) {
  const strings = useNotificationsStrings(translations);
  const { locale } = useBuildpadI18n();
  const localUrl = useLocalUrlState();
  const url = urlStateProp ?? localUrl;
  const tabs = useMemo(() => resolveTabs(extraTabs), [extraTabs]);
  const tab = findTab(tabs, url.filter);
  const { unreadCount, isLoading: countLoading, error: countError, markRead, markUnread, markAllRead, adapter } = useNotifications();
  // Until a count resolves (or when it failed), say nothing rather than a false "All caught up".
  const countPending = (countLoading || !!countError) && !unreadCount;
  const page = useNotificationsPage(tab.key, { tabs: extraTabs, selectedId: url.id, pageSize });
  const { items, selected, patchLocal } = page;
  const mobile = useMediaQuery(MOBILE_QUERY, false, { getInitialValueInEffect: false }) ?? false;

  const select = useCallback((id: string | null) => url.replace({ filter: url.filter, id }), [url]);

  // Opening a notification marks it read (once per selection, so "mark unread" sticks).
  const autoMarked = useRef<string | null>(null);
  useEffect(() => {
    if (!selected || autoMarked.current === selected.id) return;
    autoMarked.current = selected.id;
    if (!selected.read_at) {
      patchLocal([selected.id], { read_at: new Date().toISOString() });
      void markRead([selected.id]);
    }
  }, [selected, markRead, patchLocal]);

  const toggleRead = useCallback(
    (n: Notification) => {
      if (n.read_at) {
        if (!adapter.markUnread) return;
        patchLocal([n.id], { read_at: null });
        void markUnread([n.id]);
      } else {
        patchLocal([n.id], { read_at: new Date().toISOString() });
        void markRead([n.id]);
      }
    },
    [adapter, markRead, markUnread, patchLocal],
  );

  // Keyboard.
  const stateRef = useRef({ items, selected, select, toggleRead, id: url.id });
  stateRef.current = { items, selected, select, toggleRead, id: url.id };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const s = stateRef.current;
      const index = s.items.findIndex((n) => n.id === s.id);
      const move = (delta: number) => {
        const next = index < 0 ? s.items[0] : s.items[Math.min(s.items.length - 1, Math.max(0, index + delta))];
        if (next && next.id !== s.id) s.select(next.id);
        e.preventDefault();
      };
      if (e.key === 'j' || e.key === 'ArrowDown') move(1);
      else if (e.key === 'k' || e.key === 'ArrowUp') move(-1);
      else if (e.key === 'u' && s.selected) {
        e.preventDefault();
        s.toggleRead(s.selected);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Keep the active row in view.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!url.id) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(url.id)}"]`);
    row?.scrollIntoView?.({ block: 'nearest' });
  }, [url.id]);

  // Infinite scroll: a sentinel near the end of the list.
  const sentinel = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(page.loadMore);
  loadMoreRef.current = page.loadMore;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !page.hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMoreRef.current();
      },
      { root: listRef.current, rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [page.hasMore, items.length]);

  const groups = useMemo(() => {
    const out: Array<{ key: string; label: string; rows: Notification[] }> = [];
    const now = new Date();
    for (const n of items) {
      const key = dayKey(n.created_at);
      const last = out.at(-1);
      if (last && last.key === key) last.rows.push(n);
      else out.push({ key, label: dayGroupLabel(n.created_at, now, strings.time, locale), rows: [n] });
    }
    return out;
  }, [items, strings.time, locale]);

  const tabLabel = (t: NotificationTab) =>
    t.label ?? (strings.tabs as unknown as Record<string, string>)[t.key] ?? t.key.replace(/_/g, ' ');
  const emptyText = (strings.inbox.empty as Record<string, string>)[tab.key] ?? strings.inbox.empty.other;
  const showList = !mobile || !url.id;
  const showDetail = !mobile || !!url.id;
  const now = new Date();

  const list = (
    <Box
      ref={listRef}
      style={{ width: mobile ? '100%' : 380, flex: 'none', overflowY: 'auto', minHeight: 0, borderRight: mobile ? undefined : '1px solid var(--mantine-color-default-border)' }}
      data-testid="bp-nt-list"
    >
      {page.error ? (
        <Alert color="red" title={strings.inbox.errorTitle} m="sm" role="alert">
          <Text size="sm">{page.error.message}</Text>
          <Button size="xs" variant="light" mt="xs" onClick={() => void page.refetch()}>
            {strings.inbox.retry}
          </Button>
        </Alert>
      ) : null}
      {page.isLoading && !items.length ? (
        <Center p="xl">
          <Loader size="sm" role="status" aria-label={strings.inbox.loading} />
        </Center>
      ) : !items.length && !page.error ? (
        <Stack align="center" p="xl" gap="xs">
          <IconBellOff size={32} stroke={1.5} color="var(--mantine-color-dimmed)" aria-hidden />
          <Text size="sm" c="dimmed" ta="center">
            {emptyText}
          </Text>
        </Stack>
      ) : (
        <Box component="ul" aria-label={strings.inbox.listLabel} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {groups.map((g) => (
            <li key={g.key}>
              <Text
                size="xs"
                fw={600}
                c="dimmed"
                tt="uppercase"
                px="sm"
                py={6}
                role="heading"
                aria-level={headingLevel + 1}
                style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--mantine-color-body)' }}
              >
                {g.label}
              </Text>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {g.rows.map((n) => {
                  const active = n.id === url.id;
                  const style = styleFor(n, strings, typeStyles);
                  return (
                    <li key={n.id}>
                      <UnstyledButton
                        data-id={n.id}
                        aria-current={active ? 'true' : undefined}
                        data-unread={!n.read_at || undefined}
                        onClick={() => select(n.id)}
                        w="100%"
                        px="sm"
                        py="xs"
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          borderLeft: `3px solid ${active ? 'var(--mantine-primary-color-filled)' : 'transparent'}`,
                          background: active ? 'var(--mantine-primary-color-light)' : undefined,
                        }}
                      >
                        <TypeIconBadge style={style} size={28} />
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Group justify="space-between" wrap="nowrap" gap="xs">
                            <Text size="sm" fw={n.read_at ? 400 : 700} lineClamp={1}>
                              {n.title}
                            </Text>
                            <Text size="xs" c="dimmed" style={{ flex: 'none' }}>
                              {timeAgo(n.created_at, now, strings.time, locale)}
                            </Text>
                          </Group>
                          {n.message ? (
                            <Text size="xs" c="dimmed" lineClamp={2}>
                              {mentionsToPlainText(n.message)}
                            </Text>
                          ) : null}
                        </Box>
                        {!n.read_at ? <UnreadDot label={strings.row.unread} /> : null}
                      </UnstyledButton>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </Box>
      )}
      {page.hasMore ? (
        <Center p="sm">
          <div ref={sentinel} aria-hidden style={{ height: 1 }} />
          <Button variant="subtle" size="xs" loading={page.isLoadingMore} onClick={() => void page.loadMore()}>
            {page.isLoadingMore ? strings.inbox.loadingMore : strings.inbox.loadMore}
          </Button>
        </Center>
      ) : null}
    </Box>
  );

  const detail = (
    <Box style={{ flex: 1, minWidth: 0, overflowY: 'auto', minHeight: 0 }} py="md" pl={mobile ? 0 : 'md'} data-testid="bp-nt-detail-pane">
      {mobile ? (
        <Button variant="subtle" size="xs" mb="sm" leftSection={<IconArrowLeft size={14} />} onClick={() => select(null)}>
          {strings.inbox.back}
        </Button>
      ) : null}
      {selected ? (
        <NotificationDetail
          notification={selected}
          onNavigate={onNavigate}
          resolveLink={resolveLink}
          typeStyles={typeStyles}
          headingLevel={(headingLevel + 1) as 2}
          onToggleRead={selected.read_at && !adapter.markUnread ? undefined : toggleRead}
          renderPreview={renderPreview}
          renderActions={renderActions}
          renderReply={renderReply}
          translations={translations}
        />
      ) : url.id && page.selectedLoading ? (
        <Center p="xl">
          <Loader size="sm" role="status" aria-label={strings.inbox.loading} />
        </Center>
      ) : (
        <Center p="xl">
          <Text size="sm" c="dimmed">
            {url.id ? strings.detail.notFound : strings.inbox.selectPrompt}
          </Text>
        </Center>
      )}
    </Box>
  );

  return (
    <Stack gap={0} style={{ height, minHeight: 0 }} data-testid="bp-nt-inbox">
      <Group justify="space-between" px="md" py="sm" wrap="wrap" gap="xs">
        <Group gap="sm" align="baseline">
          <Title order={headingLevel} size="h3">
            {strings.title}
          </Title>
          <Text size="sm" c="dimmed" aria-live="polite">
            {countPending ? null : unreadCount ? countText(locale, unreadCount, strings.inbox.unreadCount) : strings.inbox.allCaughtUp}
          </Text>
        </Group>
        <Button
          size="xs"
          variant="light"
          disabled={countPending || !unreadCount}
          onClick={() => void markAllRead()}
        >
          {strings.inbox.markAllRead}
        </Button>
      </Group>
      <Tabs value={tab.key} onChange={(key) => key && url.replace({ filter: key === 'all' ? null : key, id: null })} px="md">
        <Tabs.List aria-label={strings.tabs.label}>
          {tabs.map((t) => (
            <Tabs.Tab key={t.key} value={t.key}>
              {tabLabel(t)}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
      {/* Same gutter as the header and tabs, so row backgrounds line up with the title and tab edge. */}
      <Box px="md" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {showList ? list : null}
        {showDetail ? detail : null}
      </Box>
    </Stack>
  );
}

