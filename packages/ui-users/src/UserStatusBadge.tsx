'use client';

import React from 'react';
import { Badge, type BadgeProps } from '@mantine/core';
import type { UserStatus } from '@buildpad/types';

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
}

/**
 * Small dot-badge rendering a user's account status with its reference color.
 */
export const UserStatusBadge: React.FC<UserStatusBadgeProps> = ({ status, ...props }) => {
  return (
    <Badge
      color={USER_STATUS_COLORS[status]}
      variant="dot"
      size="sm"
      data-testid="user-status-badge"
      {...props}
    >
      {status}
    </Badge>
  );
};

export default UserStatusBadge;
