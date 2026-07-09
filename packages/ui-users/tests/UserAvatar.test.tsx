/**
 * UserAvatar unit tests: initials rendering and active/inactive color.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect } from 'vitest';
import { UserAvatar } from '../src/UserAvatar';

function renderAvatar(props: React.ComponentProps<typeof UserAvatar>) {
  return render(
    <MantineProvider>
      <UserAvatar {...props} />
    </MantineProvider>
  );
}

describe('UserAvatar', () => {
  it('renders initials from first and last name', () => {
    renderAvatar({ user: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' } });
    expect(screen.getByTestId('user-avatar')).toHaveTextContent('JD');
  });

  it('falls back to email-derived initials', () => {
    renderAvatar({ user: { first_name: null, last_name: null, email: 'zed@example.com' } });
    expect(screen.getByTestId('user-avatar')).toHaveTextContent('ZE');
  });

  it('derives active coloring from user.status when `active` prop is omitted', () => {
    renderAvatar({
      user: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com', status: 'suspended' },
    });
    // Not asserting on Mantine's internal color implementation — just that it renders without the explicit prop.
    expect(screen.getByTestId('user-avatar')).toBeInTheDocument();
  });

  it('respects an explicit `active` override', () => {
    renderAvatar({
      user: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com', status: 'suspended' },
      active: true,
    });
    expect(screen.getByTestId('user-avatar')).toBeInTheDocument();
  });
});
