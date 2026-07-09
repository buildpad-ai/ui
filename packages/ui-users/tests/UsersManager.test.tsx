/**
 * UsersManager unit tests
 *
 * Covers RBAC gating (Add User button + row action menu visibility) and the
 * empty-state messaging. `@buildpad/hooks` is mocked so no network/backend
 * is required.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersManager } from '../src/UsersManager';
import { mockUsers, mockRoles } from '../src/_fixtures';

const { fetchUsersMock, deleteUserMock, fetchRolesMock, usePermissionsMock } = vi.hoisted(() => ({
  fetchUsersMock: vi.fn(),
  deleteUserMock: vi.fn(),
  fetchRolesMock: vi.fn(),
  usePermissionsMock: vi.fn(),
}));

vi.mock('@buildpad/hooks', () => ({
  useUsers: () => ({ fetchUsers: fetchUsersMock, deleteUser: deleteUserMock }),
  useRoles: () => ({ fetchRoles: fetchRolesMock }),
  usePermissions: usePermissionsMock,
}));

function renderManager(props: Partial<React.ComponentProps<typeof UsersManager>> = {}) {
  return render(
    <MantineProvider>
      <UsersManager {...props} />
    </MantineProvider>
  );
}

beforeEach(() => {
  fetchUsersMock.mockReset().mockResolvedValue({ users: mockUsers, total: mockUsers.length, totalPages: 1 });
  deleteUserMock.mockReset().mockResolvedValue(undefined);
  fetchRolesMock.mockReset().mockResolvedValue({ roles: mockRoles, total: mockRoles.length, totalPages: 1 });
  usePermissionsMock.mockReset().mockReturnValue({ canPerform: () => true, isAdmin: true, loading: false });
});

describe('UsersManager', () => {
  it('renders the user list from fetchUsers', async () => {
    renderManager();
    await waitFor(() => expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument());
    expect(screen.getByText('sam.lee@example.com')).toBeInTheDocument();
  });

  it('shows the Add User button when onCreateUser is provided and create is allowed', async () => {
    const onCreateUser = vi.fn();
    renderManager({ onCreateUser });
    await waitFor(() => expect(fetchUsersMock).toHaveBeenCalled());
    expect(screen.getByTestId('users-manager-add-btn')).toBeInTheDocument();
  });

  it('hides the Add User button when create is not allowed', async () => {
    usePermissionsMock.mockReturnValue({ canPerform: () => false, isAdmin: false, loading: false });
    renderManager({ onCreateUser: vi.fn() });
    await waitFor(() => expect(fetchUsersMock).toHaveBeenCalled());
    expect(screen.queryByTestId('users-manager-add-btn')).not.toBeInTheDocument();
  });

  it('hides the row-action column when neither update nor delete is allowed', async () => {
    usePermissionsMock.mockReturnValue({ canPerform: () => false, isAdmin: false, loading: false });
    renderManager();
    await waitFor(() => expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument());
    expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
  });

  it('shows an empty state distinguishing filtered vs unfiltered', async () => {
    fetchUsersMock.mockResolvedValue({ users: [], total: 0, totalPages: 1 });
    renderManager();
    await waitFor(() => expect(screen.getByText('No users found')).toBeInTheDocument());
    expect(screen.getByText('Get started by adding your first user')).toBeInTheDocument();
  });
});
