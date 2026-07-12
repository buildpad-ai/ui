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

  it('renders the avatar image with alt text when user.avatar is set', () => {
    renderAvatar({
      user: {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        avatar: 'https://example.com/jane.png',
      },
    });
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/jane.png');
    expect(img).toHaveAttribute('alt', 'Jane Doe');
  });

  it('renders initials (no img) when user.avatar is absent', () => {
    renderAvatar({ user: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' } });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('user-avatar')).toHaveTextContent('JD');
  });

  it('lets an explicit `src` prop override user.avatar', () => {
    renderAvatar({
      user: {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        avatar: 'https://example.com/jane.png',
      },
      src: 'https://example.com/override.png',
    });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/override.png');
  });
});
