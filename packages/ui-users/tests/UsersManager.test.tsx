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
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  // The URL-persistence helpers are pure; use the real ones so the managers'
  // URL wiring is exercised, not stubbed.
  const url = await import('../../hooks/src/useUrlListParams');
  return {
    useUrlListParams: url.useUrlListParams,
    useHydrated: url.useHydrated,
    readUrlParam: url.readUrlParam,
    readUrlIntParam: url.readUrlIntParam,
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
    await waitFor(() =>
      expect(
        screen.getByText('No users found — get started by adding your first user')
      ).toBeInTheDocument()
    );
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

    fireEvent.click(screen.getByRole('columnheader', { name: 'Email' }));
    await waitFor(() =>
      expect(fetchUsersMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'email', page: 1 })
      )
    );

    fireEvent.click(screen.getByRole('columnheader', { name: 'Email' }));
    await waitFor(() =>
      expect(fetchUsersMock).toHaveBeenLastCalledWith(expect.objectContaining({ sort: '-email' }))
    );

    fireEvent.click(screen.getByRole('columnheader', { name: 'Email' }));
    await waitFor(() =>
      expect(fetchUsersMock).toHaveBeenLastCalledWith(expect.objectContaining({ sort: undefined }))
    );
  });

  it('hides selection checkboxes for read-only viewers but keeps sortable headers', async () => {
    usePermissionsMock.mockReturnValue({ canPerform: () => false, isAdmin: false, loading: false });
    renderManager();
    await waitFor(() => expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument());
    expect(screen.queryByLabelText('Select all')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Select row')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();
  });

  it('selecting rows shows the bulk toolbar with a count; select-all and Clear work', async () => {
    renderManager();
    await waitFor(() => expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument());

    fireEvent.click(screen.getAllByLabelText('Select row')[0]);
    expect(screen.getByTestId('users-manager-bulk-toolbar')).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Select all'));
    expect(screen.getByText(`${mockUsers.length} selected`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('users-manager-bulk-clear'));
    expect(screen.queryByTestId('users-manager-bulk-toolbar')).not.toBeInTheDocument();
  });

  it('clears the selection when a filter changes', async () => {
    renderManager();
    await waitFor(() => expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument());

    fireEvent.click(screen.getAllByLabelText('Select row')[0]);
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

    fireEvent.click(screen.getAllByLabelText('Select row')[0]);
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

    fireEvent.click(screen.getAllByLabelText('Select row')[0]);
    fireEvent.click(screen.getAllByLabelText('Select row')[1]);
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

    fireEvent.click(screen.getAllByLabelText('Select row')[2]);
    fireEvent.click(screen.getAllByLabelText('Select row')[3]);
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

    await waitFor(() =>
      expect(
        screen.getByText('Failed to load users — service unavailable')
      ).toBeInTheDocument()
    );
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Failed to load users', color: 'red' })
    );
    show.mockRestore();
  });

  describe('while the permissions are not known', () => {
    const rerender = (
      view: ReturnType<typeof renderManager>,
      props: Partial<React.ComponentProps<typeof UsersManager>>,
    ) =>
      view.rerender(
        <MantineProvider>
          <UsersManager {...props} />
        </MantineProvider>,
      );

    it('draws no write control while permissions load, and the allowed ones once they are known', async () => {
      // What a user who will turn out to be an administrator gets meanwhile
      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: true });
      const onUserClick = vi.fn();
      const props = { onUserClick, onCreateUser: vi.fn() };
      const view = renderManager(props);
      await waitFor(() => expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument());

      expect(screen.queryByTestId('users-manager-add-btn')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Select all')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Select row')).not.toBeInTheDocument();
      // A row opens the editor for a user who may update: not before that is known
      fireEvent.click(screen.getByText('jane.doe@example.com'));
      expect(onUserClick).not.toHaveBeenCalled();
      // Reading does not wait: the rows are there, and counted
      expect(screen.getByText(`${mockUsers.length} users`)).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();

      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: false });
      rerender(view, props);
      expect(await screen.findByTestId('users-manager-add-btn')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Row actions')).toHaveLength(mockUsers.length);
      expect(screen.getAllByLabelText('Select row')).toHaveLength(mockUsers.length);
      fireEvent.click(screen.getByText('jane.doe@example.com'));
      expect(onUserClick).toHaveBeenCalledWith(mockUsers[0]);
      // The list was loaded once: the permissions arriving do not fetch it again
      expect(fetchUsersMock).toHaveBeenCalledTimes(1);
    });

    it('a reader is never shown a write control, not even while permissions load', async () => {
      usePermissionsMock.mockReturnValue({ canPerform: () => false, isAdmin: false, loading: true });
      const onUserClick = vi.fn();
      const props = { onUserClick, onCreateUser: vi.fn() };
      const view = renderManager(props);
      await waitFor(() => expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument());
      expect(screen.queryByTestId('users-manager-add-btn')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Select row')).not.toBeInTheDocument();

      usePermissionsMock.mockReturnValue({
        canPerform: (_collection: string, action: string) => action === 'read',
        isAdmin: false,
        loading: false,
      });
      rerender(view, props);
      expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument();
      expect(screen.queryByTestId('users-manager-add-btn')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Select row')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('jane.doe@example.com'));
      expect(onUserClick).not.toHaveBeenCalled();
    });

    it('a later refresh of the permissions does not take the controls away meanwhile', async () => {
      const props = { onUserClick: vi.fn(), onCreateUser: vi.fn() };
      const view = renderManager(props);
      await waitFor(() => expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument());
      fireEvent.click(screen.getAllByLabelText('Select row')[0]);
      expect(screen.getByTestId('users-manager-bulk-roles')).toBeInTheDocument();

      // The hook loads again (a renewed token, another scope) and answers from what it knew meanwhile
      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: true });
      rerender(view, props);
      expect(screen.getByTestId('users-manager-add-btn')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Row actions')).toHaveLength(mockUsers.length);
      // The selection and its bulk actions stay as well
      expect(screen.getByText('1 selected')).toBeInTheDocument();
      expect(screen.getByTestId('users-manager-bulk-roles')).toBeInTheDocument();
      expect(screen.getByTestId('users-manager-bulk-delete')).toBeInTheDocument();
    });
  });

  // The point of these is the COUNT of requests: a change of search, filter,
  // sort or page size on a later page is one request (the new filter on page
  // 1), not one for the old page of the new filter followed by one for page 1.
  describe('requests from a later page', () => {
    /** What the list asked for since the last `mockClear()`, in order. */
    const requests = () =>
      fetchUsersMock.mock.calls.map(([params]) => ({
        page: params.page,
        limit: params.limit,
        search: params.search, role: params.role, status: params.status, sort: params.sort,
      }));
    /** Long enough for the 300 ms search debounce and for any request it would start after it. */
    const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 500)));
    const none = { role: undefined, status: undefined, sort: undefined };

    /** Three pages of 25, whatever is asked for; the list is left on page 2. */
    async function onPageTwo(props: Partial<React.ComponentProps<typeof UsersManager>> = {}) {
      fetchUsersMock.mockImplementation(async () => ({ users: mockUsers, total: 60, totalPages: 3 }));
      renderManager({ urlParams: false, ...props });
      await waitFor(() => expect(fetchUsersMock).toHaveBeenCalledTimes(1));
      fireEvent.click(await screen.findByRole('button', { name: '2' }));
      await waitFor(() => expect(fetchUsersMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
      await settle();
      fetchUsersMock.mockClear();
    }

    it('a search typed on page 2 is ONE request: that search, on page 1', async () => {
      await onPageTwo();
      fireEvent.change(screen.getByTestId('users-manager-search'), { target: { value: 'report' } });
      await settle();
      // Not [{ page: 2, search: 'report' }, { page: 1, search: 'report' }]
      expect(requests()).toEqual([{ page: 1, limit: 25, search: 'report', ...none }]);
    });

    it('clearing a search on a later page is one request as well', async () => {
      fetchUsersMock.mockImplementation(async () => ({ users: mockUsers, total: 60, totalPages: 3 }));
      renderManager({ urlParams: false });
      await waitFor(() => expect(fetchUsersMock).toHaveBeenCalledTimes(1));
      fireEvent.change(screen.getByTestId('users-manager-search'), { target: { value: 'report' } });
      await settle();
      fireEvent.click(await screen.findByRole('button', { name: '3' }));
      await waitFor(() => expect(fetchUsersMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, search: 'report' })));
      await settle();
      fetchUsersMock.mockClear();

      fireEvent.change(screen.getByTestId('users-manager-search'), { target: { value: '' } });
      await settle();
      expect(requests()).toEqual([{ page: 1, limit: 25, search: undefined, ...none }]);
    });

    it('a page-size change on page 2 is ONE request: that size, on page 1', async () => {
      await onPageTwo();
      fireEvent.click(screen.getByTestId('users-manager-page-size'));
      // hidden: true — the dropdown stays display:none in jsdom (no transitions).
      fireEvent.click(await screen.findByRole('option', { name: '50 / page', hidden: true }));
      await settle();
      expect(requests()).toEqual([{ page: 1, limit: 50, search: undefined, ...none }]);
    });

    it('a status filter picked on page 2 is one request', async () => {
      await onPageTwo();
      fireEvent.click(screen.getByTestId('users-manager-status-filter'));
      fireEvent.click(await screen.findByRole('option', { name: 'Active', hidden: true }));
      await settle();
      expect(requests()).toEqual([{ page: 1, limit: 25, search: undefined, ...none, status: 'active' }]);
    });

    it('a role filter picked on page 2 is one request', async () => {
      await onPageTwo();
      fireEvent.click(screen.getByTestId('users-manager-role-filter'));
      fireEvent.click(await screen.findByRole('option', { name: 'Editor', hidden: true }));
      await settle();
      expect(requests()).toEqual([{ page: 1, limit: 25, search: undefined, ...none, role: 'role-editor' }]);
    });

    it('a sort picked on page 2 is one request', async () => {
      await onPageTwo();
      fireEvent.click(screen.getByRole('columnheader', { name: 'Email' }));
      await settle();
      expect(requests()).toEqual([{ page: 1, limit: 25, search: undefined, ...none, sort: 'email' }]);
    });

    it('what is typed sends nothing until the debounce has passed, and keeps the page until then', async () => {
      await onPageTwo();
      // Typed and taken back within the debounce: the list never searched for it
      fireEvent.change(screen.getByTestId('users-manager-search'), { target: { value: 'rep' } });
      fireEvent.change(screen.getByTestId('users-manager-search'), { target: { value: '' } });
      await settle();
      expect(requests()).toEqual([]);
      expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    });

    it('a page and a search restored from the URL are one request, and the page is kept', async () => {
      window.history.replaceState(null, '', '/?search=report&page=2');
      fetchUsersMock.mockImplementation(async () => ({ users: mockUsers, total: 60, totalPages: 3 }));
      try {
        renderManager();
        await waitFor(() => expect(fetchUsersMock).toHaveBeenCalled());
        await settle();
        expect(requests()).toEqual([{ page: 2, limit: 25, search: 'report', ...none }]);
        expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');

        // A new search drops the page, in the list and in the URL
        fetchUsersMock.mockClear();
        fireEvent.change(screen.getByTestId('users-manager-search'), { target: { value: 'audit' } });
        await settle();
        expect(requests()).toEqual([{ page: 1, limit: 25, search: 'audit', ...none }]);
        expect(window.location.search).toBe('?search=audit');
      } finally {
        window.history.replaceState(null, '', '/');
      }
    });
  });
});
