/**
 * RolesManager unit tests: headerless mode, page-size selector, and the
 * deliberate absence of column sorting (the roles API ignores `sort`,
 * hardcoding name-asc — Req 20.6). `@buildpad/hooks` is mocked.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RolesManager } from '../src/RolesManager';
import { mockRoles } from '../src/_fixtures';

const { fetchRolesMock, deleteRoleMock, usePermissionsMock } = vi.hoisted(() => ({
  fetchRolesMock: vi.fn(),
  deleteRoleMock: vi.fn(),
  usePermissionsMock: vi.fn(),
}));

vi.mock('@buildpad/hooks', async () => {
  // The URL-persistence helpers are pure; use the real ones so the managers'
  // URL wiring is exercised, not stubbed.
  const url = await import('../../hooks/src/useUrlListParams');
  return {
    useUrlListParams: url.useUrlListParams,
    useHydrated: url.useHydrated,
    readUrlParam: url.readUrlParam,
    readUrlIntParam: url.readUrlIntParam,
  useRoles: () => ({ fetchRoles: fetchRolesMock, deleteRole: deleteRoleMock }),
  usePermissions: usePermissionsMock,
  };
});

function renderManager(props: Partial<React.ComponentProps<typeof RolesManager>> = {}) {
  return render(
    <MantineProvider>
      <RolesManager {...props} />
    </MantineProvider>
  );
}

beforeEach(() => {
  fetchRolesMock.mockReset().mockResolvedValue({ roles: mockRoles, total: mockRoles.length, totalPages: 1 });
  deleteRoleMock.mockReset().mockResolvedValue(undefined);
  usePermissionsMock.mockReset().mockReturnValue({ canPerform: () => true, isAdmin: true, loading: false });
});

describe('RolesManager', () => {
  it('renders the roles list from fetchRoles', async () => {
    renderManager();
    await waitFor(() => expect(screen.getByText('Administrator')).toBeInTheDocument());
    expect(screen.getByText('Editor')).toBeInTheDocument();
  });

  it('names the rows in its footer by their number: one role, three roles', async () => {
    const { unmount } = renderManager();
    expect(await screen.findByText('Showing 3 of 3 roles')).toBeInTheDocument();
    unmount();

    fetchRolesMock.mockResolvedValue({ roles: mockRoles.slice(0, 1), total: 1, totalPages: 1 });
    renderManager();
    expect(await screen.findByText('Showing 1 of 1 role')).toBeInTheDocument();
    expect(screen.getByText('1 role')).toBeInTheDocument();
  });

  it('hideHeader hides the heading + subtitle but keeps the Add button', async () => {
    renderManager({ hideHeader: true, onCreateRole: vi.fn() });
    await waitFor(() => expect(fetchRolesMock).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Roles' })).not.toBeInTheDocument();
    expect(
      screen.queryByText('Define roles to group users and assign permissions')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('roles-manager-add-btn')).toBeInTheDocument();
  });

  it('offers no column sorting (roles API hardcodes name-asc)', async () => {
    const { container } = renderManager();
    await waitFor(() => expect(screen.getByText('Administrator')).toBeInTheDocument());
    expect(container.querySelector('th[aria-sort]')).toBeNull();
  });

  it('changing the page size refetches with the new limit at page 1', async () => {
    renderManager();
    await waitFor(() => expect(fetchRolesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('roles-manager-page-size'));
    // hidden: true — the dropdown stays display:none in jsdom (no transitions).
    fireEvent.click(await screen.findByRole('option', { name: '50 / page', hidden: true }));

    await waitFor(() =>
      expect(fetchRolesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 50, page: 1 })
      )
    );
  });

  // IconDisplay's default fallback is the generic unknown-icon glyph, which
  // reads as broken data for the ordinary case of a role with no icon set.
  // This column passes an explicit users-group fallback instead — the same
  // reasoning behind the policy surfaces passing IconShield.
  it('renders a users-group glyph, not the unknown-icon glyph, for a role with no icon', async () => {
    fetchRolesMock.mockResolvedValue({
      roles: [{ id: 'role-no-icon', name: 'No Icon Role', icon: null }],
      total: 1,
      totalPages: 1,
    });

    const { container } = renderManager();
    await waitFor(() => expect(screen.getByText('No Icon Role')).toBeInTheDocument());

    expect(container.querySelector('svg.tabler-icon-users-group')).not.toBeNull();
    expect(container.querySelector('svg.tabler-icon-question-mark')).toBeNull();
  });

  it('still renders the mapped glyph for a role that does have an icon', async () => {
    fetchRolesMock.mockResolvedValue({
      roles: [{ id: 'role-shield', name: 'Shielded', icon: 'shield' }],
      total: 1,
      totalPages: 1,
    });

    const { container } = renderManager();
    await waitFor(() => expect(screen.getByText('Shielded')).toBeInTheDocument());

    expect(container.querySelector('svg.tabler-icon-shield')).not.toBeNull();
  });

  it('surfaces a load failure as an error empty state plus a toast (not "no roles yet")', async () => {
    const show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
    fetchRolesMock.mockRejectedValue(new Error('service unavailable'));

    renderManager();

    await waitFor(() =>
      expect(screen.getByText('Failed to load roles — service unavailable')).toBeInTheDocument()
    );
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Failed to load roles', color: 'red' })
    );
    show.mockRestore();
  });

  it('toasts a delete failure and keeps the confirm modal open for retry', async () => {
    const show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
    deleteRoleMock.mockRejectedValue(new Error('role is in use'));

    renderManager();
    await waitFor(() => expect(screen.getByText('Administrator')).toBeInTheDocument());

    fireEvent.click(screen.getAllByLabelText('Row actions')[0]);
    fireEvent.click(await screen.findByText('Delete'));
    fireEvent.click(await screen.findByTestId('users-delete-confirm-btn'));

    await waitFor(() =>
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to delete role', color: 'red' })
      )
    );
    expect(screen.getByTestId('users-delete-confirm-modal')).toBeInTheDocument();
    show.mockRestore();
  });

  describe('while the permissions are not known', () => {
    const rerender = (
      view: ReturnType<typeof renderManager>,
      props: Partial<React.ComponentProps<typeof RolesManager>>,
    ) =>
      view.rerender(
        <MantineProvider>
          <RolesManager {...props} />
        </MantineProvider>,
      );

    it('draws no write control while permissions load, and the allowed ones once they are known', async () => {
      // What a user who will turn out to be an administrator gets meanwhile
      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: true });
      const onClick = vi.fn();
      const props = { onRoleClick: onClick, onCreateRole: vi.fn() };
      const view = renderManager(props);
      await waitFor(() => expect(screen.getByText('Administrator')).toBeInTheDocument());

      expect(screen.queryByTestId('roles-manager-add-btn')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
      // A row opens the editor for a user who may update: not before that is known
      fireEvent.click(screen.getByText('Administrator'));
      expect(onClick).not.toHaveBeenCalled();
      // Reading does not wait: the rows are there, and counted
      expect(screen.getByText(`${mockRoles.length} roles`)).toBeInTheDocument();

      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: false });
      rerender(view, props);
      expect(await screen.findByTestId('roles-manager-add-btn')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Row actions')).toHaveLength(mockRoles.length);
      fireEvent.click(screen.getByText('Administrator'));
      expect(onClick).toHaveBeenCalledWith(mockRoles[0]);
      // The list was loaded once: the permissions arriving do not fetch it again
      expect(fetchRolesMock).toHaveBeenCalledTimes(1);
    });

    it('a reader is never shown a write control, not even while permissions load', async () => {
      usePermissionsMock.mockReturnValue({ canPerform: () => false, isAdmin: false, loading: true });
      const onClick = vi.fn();
      const props = { onRoleClick: onClick, onCreateRole: vi.fn() };
      const view = renderManager(props);
      await waitFor(() => expect(screen.getByText('Administrator')).toBeInTheDocument());
      expect(screen.queryByTestId('roles-manager-add-btn')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();

      usePermissionsMock.mockReturnValue({
        canPerform: (_collection: string, action: string) => action === 'read',
        isAdmin: false,
        loading: false,
      });
      rerender(view, props);
      expect(screen.getByText('Administrator')).toBeInTheDocument();
      expect(screen.queryByTestId('roles-manager-add-btn')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('Administrator'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('a later refresh of the permissions does not take the controls away meanwhile', async () => {
      const props = { onRoleClick: vi.fn(), onCreateRole: vi.fn() };
      const view = renderManager(props);
      await waitFor(() => expect(screen.getByText('Administrator')).toBeInTheDocument());
      expect(screen.getByTestId('roles-manager-add-btn')).toBeInTheDocument();

      // The hook loads again (a renewed token, another scope) and answers from what it knew meanwhile
      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: true });
      rerender(view, props);
      expect(screen.getByTestId('roles-manager-add-btn')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Row actions')).toHaveLength(mockRoles.length);
    });
  });

  // The point of these is the COUNT of requests: a change of search, filter,
  // sort or page size on a later page is one request (the new filter on page
  // 1), not one for the old page of the new filter followed by one for page 1.
  describe('requests from a later page', () => {
    /** What the list asked for since the last `mockClear()`, in order. */
    const requests = () =>
      fetchRolesMock.mock.calls.map(([params]) => ({
        page: params.page,
        limit: params.limit,
        search: params.search,
      }));
    /** Long enough for the 300 ms search debounce and for any request it would start after it. */
    const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 500)));
    const none = {};

    /** Three pages of 25, whatever is asked for; the list is left on page 2. */
    async function onPageTwo(props: Partial<React.ComponentProps<typeof RolesManager>> = {}) {
      fetchRolesMock.mockImplementation(async () => ({ roles: mockRoles, total: 60, totalPages: 3 }));
      renderManager({ urlParams: false, ...props });
      await waitFor(() => expect(fetchRolesMock).toHaveBeenCalledTimes(1));
      fireEvent.click(await screen.findByRole('button', { name: '2' }));
      await waitFor(() => expect(fetchRolesMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
      await settle();
      fetchRolesMock.mockClear();
    }

    it('a search typed on page 2 is ONE request: that search, on page 1', async () => {
      await onPageTwo();
      fireEvent.change(screen.getByTestId('roles-manager-search'), { target: { value: 'report' } });
      await settle();
      // Not [{ page: 2, search: 'report' }, { page: 1, search: 'report' }]
      expect(requests()).toEqual([{ page: 1, limit: 25, search: 'report', ...none }]);
    });

    it('clearing a search on a later page is one request as well', async () => {
      fetchRolesMock.mockImplementation(async () => ({ roles: mockRoles, total: 60, totalPages: 3 }));
      renderManager({ urlParams: false });
      await waitFor(() => expect(fetchRolesMock).toHaveBeenCalledTimes(1));
      fireEvent.change(screen.getByTestId('roles-manager-search'), { target: { value: 'report' } });
      await settle();
      fireEvent.click(await screen.findByRole('button', { name: '3' }));
      await waitFor(() => expect(fetchRolesMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, search: 'report' })));
      await settle();
      fetchRolesMock.mockClear();

      fireEvent.change(screen.getByTestId('roles-manager-search'), { target: { value: '' } });
      await settle();
      expect(requests()).toEqual([{ page: 1, limit: 25, search: undefined, ...none }]);
    });

    it('a page-size change on page 2 is ONE request: that size, on page 1', async () => {
      await onPageTwo();
      fireEvent.click(screen.getByTestId('roles-manager-page-size'));
      // hidden: true — the dropdown stays display:none in jsdom (no transitions).
      fireEvent.click(await screen.findByRole('option', { name: '50 / page', hidden: true }));
      await settle();
      expect(requests()).toEqual([{ page: 1, limit: 50, search: undefined, ...none }]);
    });

    it('what is typed sends nothing until the debounce has passed, and keeps the page until then', async () => {
      await onPageTwo();
      // Typed and taken back within the debounce: the list never searched for it
      fireEvent.change(screen.getByTestId('roles-manager-search'), { target: { value: 'rep' } });
      fireEvent.change(screen.getByTestId('roles-manager-search'), { target: { value: '' } });
      await settle();
      expect(requests()).toEqual([]);
      expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    });

    it('a page and a search restored from the URL are one request, and the page is kept', async () => {
      window.history.replaceState(null, '', '/?search=report&page=2');
      fetchRolesMock.mockImplementation(async () => ({ roles: mockRoles, total: 60, totalPages: 3 }));
      try {
        renderManager();
        await waitFor(() => expect(fetchRolesMock).toHaveBeenCalled());
        await settle();
        expect(requests()).toEqual([{ page: 2, limit: 25, search: 'report', ...none }]);
        expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');

        // A new search drops the page, in the list and in the URL
        fetchRolesMock.mockClear();
        fireEvent.change(screen.getByTestId('roles-manager-search'), { target: { value: 'audit' } });
        await settle();
        expect(requests()).toEqual([{ page: 1, limit: 25, search: 'audit', ...none }]);
        expect(window.location.search).toBe('?search=audit');
      } finally {
        window.history.replaceState(null, '', '/');
      }
    });
  });
});
