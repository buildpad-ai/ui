'use client';
import React from 'react';
import { Box, ThemeIcon } from '@mantine/core';
import { interpolate, selectPlural, type NotificationsTranslations, type PluralForms } from '@buildpad/utils';
import { typeStyle, type TypeStyle, type TypeStyles } from './core/typeStyles';
import type { Notification } from './core/types';

/**
 * True only for an app-relative path: it starts with one `/` and is not protocol-relative (`//host`)
 * or a backslash trick (`/\\host`, which browsers treat as `//host`). Anything else (`javascript:`,
 * `https://…`, `//evil`) is not a link a notification may lead to. Control characters are refused too.
 */
export function isAppRelativeLink(link: unknown): link is string {
  if (typeof link !== 'string' || !link.startsWith('/')) return false;
  if (link[1] === '/' || link[1] === '\\') return false;
  // eslint-disable-next-line no-control-regex
  return !/[\\\u0000-\u001f\u007f]/.test(link);
}

/** Where a notification leads. Default: its `link`, when it is app-relative (see `isAppRelativeLink`). */
export type ResolveLink = (n: Notification) => string | null | undefined;
export const defaultResolveLink: ResolveLink = (n) => (isAppRelativeLink(n.link) ? n.link : null);

/** Called to go somewhere. Default: `window.location.assign`. */
export type Navigate = (href: string, n?: Notification) => void;
export const defaultNavigate: Navigate = (href) => {
  window.location.assign(href);
};

export function styleFor(n: Notification, strings: NotificationsTranslations, overrides?: TypeStyles): TypeStyle {
  return typeStyle(n.type, overrides, strings.types as unknown as Record<string, string>);
}

export function TypeIconBadge({ style, size = 32 }: { style: TypeStyle; size?: number }) {
  const Icon = style.icon;
  return (
    <ThemeIcon variant="light" color={style.color} size={size} radius="xl" aria-hidden>
      <Icon size={Math.round(size * 0.55)} stroke={1.75} />
    </ThemeIcon>
  );
}

export function UnreadDot({ label }: { label: string }) {
  return (
    <Box
      component="span"
      role="img"
      aria-label={label}
      data-testid="bp-nt-unread-dot"
      style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--mantine-color-blue-6)', flex: 'none', display: 'inline-block' }}
    />
  );
}

/** "9+" style cap for a badge. */
export const capCount = (count: number, max: number) => (count > max ? `${max}+` : String(count));

/** A plural string with `{count}` capped ("99+"). */
export const countText = (locale: string, count: number, forms: PluralForms, cap = 99) =>
  interpolate(selectPlural(locale, count, forms), { count: capCount(count, cap) });
