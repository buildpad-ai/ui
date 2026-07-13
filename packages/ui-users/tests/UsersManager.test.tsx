/**
 * UsersManager unit tests
 *
 * Covers RBAC gating (Add User button + row action menu + bulk checkboxes),
 * empty-state messaging, headerless mode, column sorting, the page-size
 * selector, and the bulk actions (roles/status/delete). `@buildpad/hooks` is
 * mocked so no network/backend is required; `useSelection` is re-implemented
 * faithfully inside the mock.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersManager } from '../src/UsersManager';
import { mockUsers, mockRoles } from '../src/_fixtures';

const {
  fetchUsersMock,
  updateUserMock,
  deleteUserMock,
  bulkUpdateUsersMock,
  fetchRolesMock,
  usePermissionsMock,
} = vi.hoisted(() => ({
  fetchUsersMock: vi.fn(),
  updateUserMock: vi.fn(),
  deleteUserMock: vi.fn(),
  bulkUpdateUsersMock: vi.fn(),
  fetchRolesMock: vi.fn(),
  usePermissionsMock: vi.fn(),
}));

vi.mock('@buildpad/hooks', async () => {
  const { useState, useCallback } = await import('react');
  return {
    useUsers: () => ({
      fetchUsers: fetchUsersMock,
      updateUser: updateUserMock,
      deleteUser: deleteUserMock,
      bulkUpdateUsers: bulkUpdateUsersMock,
    }),
    useRoles: () => ({ fetchRoles: fetchRolesMock }),
    usePermissions: usePermissionsMock,
    // Faithful re-implementation of @buildpad/hooks' useSelection.
    useSelection: () => {
      const [selection, setSelectionState] = useState<string[]>([]);
      const setSelection = useCallback((items: string[]) => setSelectionState(items), []);
      const toggleSelection = useCallback((item: string) => {
        setSelectionState((prev) =>
          prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
        );
      }, []);
      const clearSelection = useCallback(() => setSelectionState([]), []);
      return {
        selection,
        setSelection,
        toggleSelection,
        selectAll: setSelection,
        clearSelection,
        isSelected: (item: string) => selection.includes(item),
        selectionCount: selection.length,
        hasSelection: selection.length > 0,
      };
    },
  };
});

function renderManager(props: Partial<React.ComponentProps<typeof UsersManager>> = {}) {
  return render(
    <MantineProvider>
      <UsersManager {...props} />
    </MantineProvider>
  );
}

beforeEach(() => {
  fetchUsersMock.mockReset().mockResolvedValue({ users: mockUsers, total: mockUsers.length, totalPages: 1 });
  updateUserMock.mockReset().mockResolvedValue(mockUsers[0]);
  deleteUserMock.mockReset().mockResolvedValue(undefined);
  bulkUpdateUsersMock.mockReset().mockResolvedValue(undefined);
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

  it('hideHeader hides the heading + subtitle but keeps the Add button', async () => {
    renderManager({ hideHeader: true, onCreateUser: vi.fn() });
    await waitFor(() => expect(fetchUsersMock).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Users' })).not.toBeInTheDocument();
    expect(
      screen.queryByText('Manage user accounts, roles, and access permissions')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('users-manager-add-btn')).toBeInTheDocument();
  });

  it('cycles column sort asc → desc → none, refetching at page 1', async () => {
    renderManager();
    await waitFor(() => expect(fetchUsersMock).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('users-manager-sort-email'));
    await waitFor(() =>
      expect(fetchUsersMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'email', page: 1 })
      )
    );

    fireEvent.click(screen.getByTestId('users-manager-sort-email'));
    await waitFor(() =>
      expect(fetchUsersMock).toHaveBeenLastCalledWith(expect.objectContaining({ sort: '-email' }))
    );

    fireEvent.click(screen.getByTestId('users-manager-sort-email'));
    await waitFor(() =>
      expect(fetchUsersMock).toHaveBeenLastCalledWith(expect.objectContaining({ sort: undefined }))
    );
  });

  it('hides selection checkboxes for read-only viewers but keeps sortable headers', async () => {
    usePermissionsMock.mockReturnValue({ canPerform: () => false, isAdmin: false, loading: false });
    renderManager();
    await waitFor(() => expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument());
    expect(screen.queryByTestId('users-manager-select-all')).not.toBeInTheDocument();
    expect(screen.queryByTestId('users-manager-select-user-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('users-manager-sort-email')).toBeInTheDocument();
  });

  it('selecting rows shows the bulk toolbar with a count; select-all and Clear work', async () => {
    renderManager();
    await waitFor(() => expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('users-manager-select-user-1'));
    expect(screen.getByTestId('users-manager-bulk-toolbar')).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('users-manager-select-all'));
    expect(screen.getByText(`${mockUsers.length} selected`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('users-manager-bulk-clear'));
    expect(screen.queryByTestId('users-manager-bulk-toolbar')).not.toBeInTheDocument();
  });

  it('clears the selection when a filter changes', async () => {
    renderManager();
    await waitFor(() => expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('users-manager-select-user-1'));
    expect(screen.getByTestId('users-manager-bulk-toolbar')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('users-manager-status-filter'));
    // hidden: true — the dropdown stays display:none in jsdom (no transitions).
    fireEvent.click(await screen.findByRole('option', { name: 'Active', hidden: true }));
    await waitFor(() =>
      expect(screen.queryByTestId('users-manager-bulk-toolbar')).not.toBeInTheDocument()
    );
  });

  it('bulk Update roles issues exactly one bulkUpdateUsers call', async () => {
    renderManager();
    await waitFor(() => expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('users-manager-select-user-1'));
    fireEvent.click(screen.getByTestId('users-manager-bulk-roles'));
    await screen.findByText(/Add and\/or remove roles/);

    fireEvent.click(screen.getByTestId('users-manager-bulk-roles-add'));
    // hidden: true — the dropdown stays display:none in jsdom (no transitions).
    // Scoped to the "Add roles" listbox: the role-filter Select also has an "Editor" option.
    const addListbox = await screen.findByRole('listbox', { name: 'Add roles', hidden: true });
    fireEvent.click(within(addListbox).getByRole('option', { name: 'Editor', hidden: true }));
    fireEvent.click(screen.getByTestId('users-manager-bulk-roles-apply'));

    await waitFor(() => expect(bulkUpdateUsersMock).toHaveBeenCalledTimes(1));
    expect(bulkUpdateUsersMock).toHaveBeenCalledWith(['user-1'], {
      addRoles: ['role-editor'],
      removeRoles: undefined,
    });
    await waitFor(() =>
      expect(screen.queryByTestId('users-manager-bulk-toolbar')).not.toBeInTheDocument()
    );
  });

  it('bulk Set status fans out updateUser per selected user and clears the selection', async () => {
    renderManager();
    await waitFor(() => expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('users-manager-select-user-1'));
    fireEvent.click(screen.getByTestId('users-manager-select-user-2'));
    fireEvent.click(screen.getByTestId('users-manager-bulk-status'));
    fireEvent.click(await screen.findByTestId('users-manager-bulk-status-suspended'));

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledTimes(2));
    expect(updateUserMock).toHaveBeenCalledWith('user-1', { status: 'suspended' });
    expect(updateUserMock).toHaveBeenCalledWith('user-2', { status: 'suspended' });
    await waitFor(() =>
      expect(screen.queryByTestId('users-manager-bulk-toolbar')).not.toBeInTheDocument()
    );
  });

  it('bulk Delete confirms with the count and fans out deleteUser', async () => {
    renderManager();
    await waitFor(() => expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('users-manager-select-user-3'));
    fireEvent.click(screen.getByTestId('users-manager-select-user-4'));
    fireEvent.click(screen.getByTestId('users-manager-bulk-delete'));

    expect(await screen.findByText(/delete 2 users/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('users-delete-confirm-btn'));

    await waitFor(() => expect(deleteUserMock).toHaveBeenCalledTimes(2));
    expect(deleteUserMock).toHaveBeenCalledWith('user-3');
    expect(deleteUserMock).toHaveBeenCalledWith('user-4');
  });

  it('changing the page size refetches with the new limit at page 1', async () => {
    renderManager();
    await waitFor(() => expect(fetchUsersMock).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('users-manager-page-size'));
    // hidden: true — the dropdown stays display:none in jsdom (no transitions).
    fireEvent.click(await screen.findByRole('option', { name: '50 / page', hidden: true }));

    await waitFor(() =>
      expect(fetchUsersMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 50, page: 1 })
      )
    );
  });

  it('surfaces a load failure as an error empty state plus a toast (not "no users yet")', async () => {
    const show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
    fetchUsersMock.mockRejectedValue(new Error('service unavailable'));

    renderManager();

    await waitFor(() => expect(screen.getByText('Failed to load users')).toBeInTheDocument());
    expect(screen.getByText('service unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No users found')).not.toBeInTheDocument();
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Failed to load users', color: 'red' })
    );
    show.mockRestore();
  });
});
