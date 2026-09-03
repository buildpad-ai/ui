'use client';

import React from 'react';
import { Badge, type BadgeProps } from '@mantine/core';
import { useBuildpadTranslations } from '@buildpad/services';
import type { UserStatus } from '@buildpad/types';
import type { DeepPartial, UsersTranslations } from '@buildpad/utils';

/**
 * status → color map, matching the buildpad-daas reference `STATUS_COLORS`.
 */
export const USER_STATUS_COLORS: Record<UserStatus, string> = {
  active: 'green',
  invited: 'blue',
  draft: 'gray',
  suspended: 'red',
  terminated: 'orange',
};

export interface UserStatusBadgeProps extends Omit<BadgeProps, 'color' | 'children'> {
  status: UserStatus;
  /** Per-instance overrides of the `users` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<UsersTranslations>;
}

/**
 * Small dot-badge rendering a user's account status with its reference color.
 * The label comes from `users.statusBadge` (lowercase — Mantine uppercases
 * badge text via CSS); an unknown status falls back to the raw value.
 */
export const UserStatusBadge: React.FC<UserStatusBadgeProps> = ({ status, translations, ...props }) => {
  const t = useBuildpadTranslations((d) => d.users, translations);
  return (
    <Badge
      color={USER_STATUS_COLORS[status]}
      variant="dot"
      size="sm"
      data-testid="user-status-badge"
      {...props}
    >
      {t.statusBadge[status] ?? status}
    </Badge>
  );
};

export default UserStatusBadge;
