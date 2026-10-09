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

describe('RoleDetail — after a create', () => {
  const created: Role = {
    id: 'role-new',
    name: 'Reviewer',
    icon: 'supervised_user_circle',
    description: '',
    parent: null,
    scope_config: null,
    created_at: new Date('2026-07-01T09:00:00Z').toISOString(),
    updated_at: new Date('2026-07-01T09:00:00Z').toISOString(),
  };

  /** A promise the test settles when it chooses to. */
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  /** Opens the Save menu and picks one of its actions. */
  async function save(label: 'Save & Stay' | 'Save & Quit' | 'Save & Add New') {
    fireEvent.click(screen.getByTestId('role-detail-save-btn'));
    fireEvent.click(await screen.findByText(label));
  }

  it('goes on as the editor of the role it created: a second Save & Stay updates that role', async () => {
    createRoleMock.mockResolvedValue(created);
    updateRoleMock.mockResolvedValue(created);
    getRoleMock.mockResolvedValue(created);
    // A host that does not navigate
    const onSaved = vi.fn();
    renderDetail({ id: 'new', onSaved });
    expect(screen.getByRole('heading', { name: 'New Role' })).toBeInTheDocument();
    fireEvent.change(input('role-detail-name'), { target: { value: 'Reviewer' } });
    await save('Save & Stay');
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created, 'stay'));

    // The stored role's editor: its title, its sidebar, its Users and Policies tabs, Delete
    expect(await screen.findByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    expect(screen.getByText(created.id)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Users (0)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Policies (0)' })).toBeInTheDocument();
    expect(screen.getByTestId('role-detail-delete-btn')).toBeInTheDocument();
    expect(screen.queryByText('Unsaved Changes')).not.toBeInTheDocument();
    await waitFor(() => expect(fetchUsersMock).toHaveBeenCalledWith({ role: created.id, limit: 1000 }));

    await save('Save & Stay');
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
    expect(createRoleMock).toHaveBeenCalledTimes(1);
    expect(updateRoleMock).toHaveBeenCalledWith(created.id, expect.objectContaining({ name: 'Reviewer' }));
  });

  it('Save & Add New on a new role starts an empty form, and does not create the role twice', async () => {
    createRoleMock.mockResolvedValue(created);
    // The page is already on the new route: its navigation to it changes nothing
    const onSaved = vi.fn();
    renderDetail({ id: 'new', onSaved });
    fireEvent.change(input('role-detail-name'), { target: { value: 'Reviewer' } });
    await save('Save & Add New');
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created, 'addNew'));

    await waitFor(() => expect(input('role-detail-name').value).toBe(''));
    expect(screen.getByRole('heading', { name: 'New Role' })).toBeInTheDocument();
    expect(screen.queryByText('Unsaved Changes')).not.toBeInTheDocument();

    // A second click has no name to save
    await save('Save & Add New');
    await waitFor(() =>
      expect(show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Name is required', color: 'red' })),
    );
    expect(createRoleMock).toHaveBeenCalledTimes(1);

    // The next role is a create of its own
    createRoleMock.mockResolvedValue({ ...created, id: 'role-next', name: 'Approver' });
    fireEvent.change(input('role-detail-name'), { target: { value: 'Approver' } });
    await save('Save & Add New');
    await waitFor(() => expect(createRoleMock).toHaveBeenCalledTimes(2));
    expect(createRoleMock).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Approver' }));
    expect(updateRoleMock).not.toHaveBeenCalled();
  });

  it('Save & Add New on the role it created saves that role, then starts an empty form', async () => {
    createRoleMock.mockResolvedValue(created);
    updateRoleMock.mockResolvedValue({ ...created, name: 'Reviewers' });
    const onSaved = vi.fn();
    renderDetail({ id: 'new', onSaved });
    fireEvent.change(input('role-detail-name'), { target: { value: 'Reviewer' } });
    await save('Save & Stay');
    expect(await screen.findByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();

    fireEvent.change(input('role-detail-name'), { target: { value: 'Reviewers' } });
    await save('Save & Add New');
    await waitFor(() => expect(onSaved).toHaveBeenLastCalledWith({ ...created, name: 'Reviewers' }, 'addNew'));
    expect(updateRoleMock).toHaveBeenCalledWith(created.id, expect.objectContaining({ name: 'Reviewers' }));
    expect(createRoleMock).toHaveBeenCalledTimes(1);

    expect(await screen.findByRole('heading', { name: 'New Role' })).toBeInTheDocument();
    expect(input('role-detail-name').value).toBe('');
    expect(screen.queryByTestId('role-detail-delete-btn')).not.toBeInTheDocument();
  });

  it('a second pick while the create is in flight does not create a second role', async () => {
    const answer = deferred<Role>();
    createRoleMock.mockReturnValue(answer.promise);
    const onSaved = vi.fn();
    renderDetail({ id: 'new', onSaved });
    fireEvent.change(input('role-detail-name'), { target: { value: 'Reviewer' } });
    fireEvent.click(screen.getByTestId('role-detail-save-btn'));
    const item = await screen.findByText('Save & Stay');
    // A double click lands twice on the item before the menu has closed
    fireEvent.click(item);
    fireEvent.click(item);
    answer.resolve(created);
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(createRoleMock).toHaveBeenCalledTimes(1);
  });

  it('keeps what was typed while Save & Stay was in flight, as an unsaved edit', async () => {
    const answer = deferred<Role>();
    updateRoleMock.mockReturnValue(answer.promise);
    const onSaved = vi.fn();
    renderDetail({ id: stored.id, onSaved });
    await loaded();
    fireEvent.change(input('role-detail-name'), { target: { value: 'Editors' } });
    await save('Save & Stay');
    await waitFor(() => expect(updateRoleMock).toHaveBeenCalledWith(stored.id, expect.objectContaining({ name: 'Editors' })));

    fireEvent.change(input('role-detail-name'), { target: { value: 'Typed later' } });
    // The role as stored now, which the form reloads after Save & Stay
    getRoleMock.mockResolvedValue({ ...stored, name: 'Editors' });
    answer.resolve({ ...stored, name: 'Editors' });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(input('role-detail-name').value).toBe('Typed later');
    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
  });

  it('Save & Stay shows the role as it is stored when nothing was typed meanwhile', async () => {
    updateRoleMock.mockResolvedValue({ ...stored, name: 'Editors' });
    const onSaved = vi.fn();
    renderDetail({ id: stored.id, onSaved });
    await loaded();
    fireEvent.change(input('role-detail-name'), { target: { value: 'Editors' } });
    // The server trims what it stores
    getRoleMock.mockResolvedValue({ ...stored, name: 'Editors', description: 'As stored' });
    await save('Save & Stay');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(input('role-detail-name').value).toBe('Editors');
    expect(screen.getByDisplayValue('As stored')).toBeInTheDocument();
    expect(screen.queryByText('Unsaved Changes')).not.toBeInTheDocument();
  });

  it('a save answered after the host opened another role is not drawn over that role', async () => {
    const other = mockRoles[2];
    const answer = deferred<Role>();
    updateRoleMock.mockReturnValue(answer.promise);
    getRoleMock.mockImplementation(async (id: string) => (id === other.id ? other : stored));
    const onSaved = vi.fn();
    const view = renderDetail({ id: stored.id, onSaved });
    await loaded();
    fireEvent.change(input('role-detail-name'), { target: { value: 'Editors' } });
    await save('Save & Quit');
    await waitFor(() => expect(updateRoleMock).toHaveBeenCalledTimes(1));

    // The host opens another role in the same component while the request is out
    view.rerender(ui({ id: other.id, onSaved }));
    await waitFor(() => expect(input('role-detail-name').value).toBe(other.name));
    const saved = { ...stored, name: 'Editors' };
    answer.resolve(saved);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved, 'quit'));

    expect(input('role-detail-name').value).toBe(other.name);
    expect(screen.getByText(other.id)).toBeInTheDocument();
    // Nothing of the first role is an unsaved edit of the second
    expect(screen.queryByText('Unsaved Changes')).not.toBeInTheDocument();
  });

  it('the new route opened in the same component is an empty form', async () => {
    const view = renderDetail({ id: stored.id });
    await loaded();
    view.rerender(ui({ id: 'new' }));
    await waitFor(() => expect(input('role-detail-name').value).toBe(''));
    expect(screen.getByRole('heading', { name: 'New Role' })).toBeInTheDocument();
    expect(screen.queryByTestId('role-detail-scope-pattern-0')).not.toBeInTheDocument();
  });

  it('a change of language does not empty a new form, or let go of the role it created', async () => {
    createRoleMock.mockResolvedValue(created);
    const onSaved = vi.fn();
    const view = renderDetail({ id: 'new', onSaved });
    fireEvent.change(input('role-detail-name'), { target: { value: 'Reviewer' } });
    // Other texts arrive (a language switch, a new `translations` override)
    view.rerender(ui({ id: 'new', onSaved, translations: { roleDetail: { titleNew: 'Add a role' } } }));
    expect(screen.getByRole('heading', { name: 'Add a role' })).toBeInTheDocument();
    expect(input('role-detail-name').value).toBe('Reviewer');

    await save('Save & Stay');
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created, 'stay'));
    view.rerender(ui({ id: 'new', onSaved, translations: { roleDetail: { titleEdit: 'Change the role' } } }));
    expect(await screen.findByRole('heading', { name: 'Change the role' })).toBeInTheDocument();
    expect(input('role-detail-name').value).toBe('Reviewer');
    expect(screen.getByText(created.id)).toBeInTheDocument();
  });
});
