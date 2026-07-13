/**
 * UserStatusBadge unit tests: verifies the status -> color map and rendered
 * label for every `UserStatus` value.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect } from 'vitest';
import { UserStatusBadge, USER_STATUS_COLORS } from '../src/UserStatusBadge';
import type { UserStatus } from '@buildpad/types';

function renderBadge(status: UserStatus) {
  return render(
    <MantineProvider>
      <UserStatusBadge status={status} />
    </MantineProvider>
  );
}

describe('USER_STATUS_COLORS', () => {
  it('maps every status to the buildpad-daas reference color', () => {
    expect(USER_STATUS_COLORS).toEqual({
      active: 'green',
      invited: 'blue',
      draft: 'gray',
      suspended: 'red',
      terminated: 'orange',
    });
  });
});

describe('UserStatusBadge', () => {
  it.each<UserStatus>(['active', 'invited', 'draft', 'suspended', 'terminated'])(
    'renders the %s status label',
    (status) => {
      renderBadge(status);
      expect(screen.getByTestId('user-status-badge')).toHaveTextContent(status);
    }
  );
});
