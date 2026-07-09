'use client';

import React from 'react';
import { Avatar, Text, type AvatarProps } from '@mantine/core';
import type { UserStatus } from '@buildpad/types';
import { getUserInitials, type UserDisplayFields } from './userDisplay';

export interface UserAvatarProps extends Omit<AvatarProps, 'children'> {
  user: UserDisplayFields & { status?: UserStatus };
  /** Highlight active users with the primary color (default: derived from `user.status` when present). */
  active?: boolean;
}

/**
 * Circular avatar showing a user's initials (first+last, or the first two
 * characters of the email as a fallback). Active users render in the
 * primary color; everyone else in neutral gray.
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({ user, active, size = 32, ...props }) => {
  const isActive = active ?? user.status === 'active';

  return (
    <Avatar
      size={size}
      radius="xl"
      color={isActive ? 'primary' : 'gray'}
      variant="light"
      data-testid="user-avatar"
      {...props}
    >
      <Text size="xs" fw={600}>
        {getUserInitials(user)}
      </Text>
    </Avatar>
  );
};

export default UserAvatar;
