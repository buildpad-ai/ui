/**
 * RoleDetail unit tests.
 *
 * Scope pattern list identity: scopePatterns has no natural id (plain
 * strings), so removing a row by index alone would misattribute a later row's
 * typed value/focus to the wrong pattern once indices shift. RoleDetail keeps
 * a parallel patternKeysRef in lockstep with add/remove so each row's React
 * key stays stable across removals — exercised end-to-end via the rendered
 * inputs rather than by inspecting React internals.
 *
 * Also: the RBAC gates, and what the form does around a save.
 * `@buildpad/hooks` is mocked so no backend is required.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Role } from '@buildpad/types';
import { RoleDetail } from '../src/RoleDetail';
import { mockRoles } from '../src/_fixtures';

const {
  fetchRolesMock,
  getRoleMock,
  createRoleMock,
  updateRoleMock,
  deleteRoleMock,
  fetchRolePoliciesMock,
  fetchUsersMock,
  usePermissionsMock,
} = vi.hoisted(() => ({
  fetchRolesMock: vi.fn(),
  getRoleMock: vi.fn(),
  createRoleMock: vi.fn(),
  updateRoleMock: vi.fn(),
  deleteRoleMock: vi.fn(),
  fetchRolePoliciesMock: vi.fn(),
  fetchUsersMock: vi.fn(),
  usePermissionsMock: vi.fn(),
}));

vi.mock('@buildpad/hooks', () => ({
  useRoles: () => ({
    getRole: getRoleMock,
    createRole: createRoleMock,
    updateRole: updateRoleMock,
    deleteRole: deleteRoleMock,
    fetchRoles: fetchRolesMock,
    // The Policies tab of a stored role
    fetchRolePolicies: fetchRolePoliciesMock,
    attachRolePolicy: vi.fn(),
    detachRolePolicy: vi.fn(),
  }),
  // The Users tab of a stored role
  useUsers: () => ({ fetchUsers: fetchUsersMock, bulkUpdateUsers: vi.fn() }),
  usePolicies: () => ({ fetchPolicies: vi.fn().mockResolvedValue({ policies: [], total: 0, totalPages: 1 }) }),
  usePermissions: usePermissionsMock,
}));

type Props = React.ComponentProps<typeof RoleDetail>;

function ui(props: Partial<Props> = {}) {
  return (
    <MantineProvider>
      <RoleDetail id="new" {...props} />
    </MantineProvider>
  );
}

function renderDetail(props: Partial<Props> = {}) {
  return render(ui(props));
}

/** The Editor role: it has a parent and scope rules. */
const stored: Role = mockRoles[1];

const input = (testId: string) => screen.getByTestId(testId) as HTMLInputElement;
const form = () => screen.getByTestId('role-detail-form');
/** The overlay of the form, not the ones of the Users and Policies tabs' lists. */
const overlay = () => form().parentElement?.querySelector('.mantine-LoadingOverlay-root') ?? null;
const loaded = () => waitFor(() => expect(input('role-detail-name').value).toBe(stored.name));

/** What the permissions hook answers: an administrator, or the listed actions on every collection. */
function grant(actions: string[], isAdmin = false, loading = false) {
  usePermissionsMock.mockReturnValue({
    canPerform: (_collection: string, action: string) => isAdmin || actions.includes(action),
    isAdmin,
    loading,
  });
}

let show: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchRolesMock.mockReset().mockResolvedValue({ roles: [], total: 0 });
  getRoleMock.mockReset().mockResolvedValue(stored);
  createRoleMock.mockReset();
  updateRoleMock.mockReset();
  deleteRoleMock.mockReset().mockResolvedValue(undefined);
  fetchRolePoliciesMock.mockReset().mockResolvedValue([]);
  fetchUsersMock.mockReset().mockResolvedValue({ users: [], total: 0, totalPages: 1 });
  usePermissionsMock.mockReset().mockReturnValue({ canPerform: () => true, isAdmin: true, loading: false });
  show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
});

afterEach(() => {
  show.mockRestore();
});

describe('RoleDetail — scope pattern rows', () => {
  it('preserves each remaining row\'s value when a row above it is removed', async () => {
    renderDetail();

    await waitFor(() => expect(fetchRolesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('role-detail-scope-switch'));

    const addButton = screen.getByTestId('role-detail-scope-add-pattern');
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    const inputs = () => [0, 1, 2].map((i) => screen.getByTestId(`role-detail-scope-pattern-${i}`) as HTMLInputElement);

    fireEvent.change(inputs()[0], { target: { value: 'pattern-a' } });
    fireEvent.change(inputs()[1], { target: { value: 'pattern-b' } });
    fireEvent.change(inputs()[2], { target: { value: 'pattern-c' } });

    expect(inputs().map((i) => i.value)).toEqual(['pattern-a', 'pattern-b', 'pattern-c']);

    // Remove the first row (index 0) — the remaining two should shift up as
    // "pattern-b" then "pattern-c", not be corrupted or duplicated.
    fireEvent.click(screen.getByLabelText('Remove pattern 1'));

    await waitFor(() => {
      expect(screen.queryByTestId('role-detail-scope-pattern-2')).not.toBeInTheDocument();
    });

    const remaining = [0, 1].map((i) => screen.getByTestId(`role-detail-scope-pattern-${i}`) as HTMLInputElement);
    expect(remaining.map((i) => i.value)).toEqual(['pattern-b', 'pattern-c']);
  });

  it('adds a new empty pattern row via the Add pattern button', async () => {
    renderDetail();
    await waitFor(() => expect(fetchRolesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('role-detail-scope-switch'));
    expect(screen.queryByTestId('role-detail-scope-pattern-0')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('role-detail-scope-add-pattern'));

    expect((screen.getByTestId('role-detail-scope-pattern-0') as HTMLInputElement).value).toBe('');
  });
});

describe('RoleDetail — permissions', () => {
  it('shows a user with read access the role without Save or Delete', async () => {
    grant(['read']);
    renderDetail({ id: stored.id });
    await loaded();
    expect(screen.queryByTestId('role-detail-save-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('role-detail-delete-btn')).not.toBeInTheDocument();
  });

  it('offers Save without Delete to a user who may update', async () => {
    grant(['read', 'update']);
    renderDetail({ id: stored.id });
    await loaded();
    expect(screen.getByTestId('role-detail-save-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('role-detail-delete-btn')).not.toBeInTheDocument();
  });

  describe('while the permissions are not known', () => {
    it('offers nothing that writes: no Save menu, no Delete, a covered form that takes no edit', async () => {
      // What a user who will turn out to be an administrator gets meanwhile
      grant([], true, true);
      const view = renderDetail({ id: stored.id });
      await loaded();

      expect(screen.queryByTestId('role-detail-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('role-detail-delete-btn')).not.toBeInTheDocument();
      expect(overlay()).toBeInTheDocument();
      expect(form()).toBeDisabled();
      expect(input('role-detail-name')).toBeDisabled();
      expect(input('role-detail-scope-switch')).toBeDisabled();
      expect(input('role-detail-scope-pattern-0')).toBeDisabled();
      expect(screen.getByTestId('role-detail-scope-add-pattern')).toBeDisabled();
      // Reading does not wait: the role is there, with its sidebar
      expect(input('role-detail-scope-pattern-0').value).toBe('^/tenant:.*$');
      expect(screen.getByText(stored.id)).toBeInTheDocument();

      grant([], true);
      view.rerender(ui({ id: stored.id }));
      expect(await screen.findByTestId('role-detail-save-btn')).toBeInTheDocument();
      expect(screen.getByTestId('role-detail-delete-btn')).toBeInTheDocument();
      expect(form()).not.toBeDisabled();
      expect(input('role-detail-name')).not.toBeDisabled();
      await waitFor(() => expect(overlay()).not.toBeInTheDocument());
      // The role was loaded once: the permissions arriving do not fetch it again
      expect(getRoleMock).toHaveBeenCalledTimes(1);
    });

    it('a reader is never offered Save or Delete', async () => {
      grant([], false, true);
      const view = renderDetail({ id: stored.id });
      await loaded();
      expect(screen.queryByTestId('role-detail-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('role-detail-delete-btn')).not.toBeInTheDocument();
      expect(input('role-detail-name')).toBeDisabled();

      grant(['read']);
      view.rerender(ui({ id: stored.id }));
      await waitFor(() => expect(overlay()).not.toBeInTheDocument());
      expect(screen.queryByTestId('role-detail-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('role-detail-delete-btn')).not.toBeInTheDocument();
    });

    it('a new role form is not opened before the answer is in', async () => {
      grant([], false, true);
      const view = renderDetail({ id: 'new' });

      // No Save menu, and a covered form that takes no edit
      expect(screen.queryByTestId('role-detail-save-btn')).not.toBeInTheDocument();
      expect(overlay()).toBeInTheDocument();
      expect(input('role-detail-name')).toBeDisabled();

      // A user who may create gets the form then
      grant(['read', 'create']);
      view.rerender(ui({ id: 'new' }));
      expect(await screen.findByTestId('role-detail-save-btn')).toBeInTheDocument();
      expect(input('role-detail-name')).not.toBeDisabled();
      await waitFor(() => expect(overlay()).not.toBeInTheDocument());
    });

    it('a user who may not create never gets the Save menu', async () => {
      grant([], false, true);
      const view = renderDetail({ id: 'new' });
      expect(screen.queryByTestId('role-detail-save-btn')).not.toBeInTheDocument();

      grant(['read', 'update']);
      view.rerender(ui({ id: 'new' }));
      await waitFor(() => expect(overlay()).not.toBeInTheDocument());
      expect(screen.queryByTestId('role-detail-save-btn')).not.toBeInTheDocument();
      expect(createRoleMock).not.toHaveBeenCalled();
    });

    it('a later refresh of the permissions does not close the form under the user', async () => {
      const view = renderDetail({ id: stored.id });
      await loaded();
      fireEvent.change(input('role-detail-name'), { target: { value: 'still typing' } });

      // The hook loads again (a renewed token, another scope) and answers from what it knew meanwhile
      grant([], true, true);
      view.rerender(ui({ id: stored.id }));
      expect(input('role-detail-name')).not.toBeDisabled();
      expect(input('role-detail-name').value).toBe('still typing');
      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
      expect(screen.getByTestId('role-detail-save-btn')).toBeInTheDocument();
      expect(screen.getByTestId('role-detail-delete-btn')).toBeInTheDocument();
      expect(overlay()).not.toBeInTheDocument();
    });
  });
});
