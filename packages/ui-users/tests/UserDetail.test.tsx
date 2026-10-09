/**
 * UserDetail unit tests: the create/edit form, its RBAC gates and what it
 * does around a save. `@buildpad/hooks` is mocked so no backend is required.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { User } from '@buildpad/types';
import { UserDetail } from '../src/UserDetail';
import { mockRoles, mockUsers } from '../src/_fixtures';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  fetchUserPolicies: vi.fn(),
  attachUserPolicy: vi.fn(),
  detachUserPolicy: vi.fn(),
  fetchRoles: vi.fn(),
  fetchPolicies: vi.fn(),
  usePermissions: vi.fn(),
}));

vi.mock('@buildpad/hooks', async () => ({
  // The token field's copy affordance is used as it is
  useClipboard: (await import('../../hooks/src/useClipboard')).useClipboard,
  useUsers: () => ({
    getUser: mocks.getUser,
    createUser: mocks.createUser,
    updateUser: mocks.updateUser,
    deleteUser: mocks.deleteUser,
    fetchUserPolicies: mocks.fetchUserPolicies,
    attachUserPolicy: mocks.attachUserPolicy,
    detachUserPolicy: mocks.detachUserPolicy,
  }),
  useRoles: () => ({ fetchRoles: mocks.fetchRoles }),
  usePolicies: () => ({ fetchPolicies: mocks.fetchPolicies }),
  usePermissions: mocks.usePermissions,
}));

/** Sam Lee: an editor with no token. */
const stored = mockUsers[1];

type Props = React.ComponentProps<typeof UserDetail>;

function ui(props: Partial<Props> = {}) {
  return (
    <MantineProvider>
      <UserDetail id={stored.id} {...props} />
    </MantineProvider>
  );
}

const input = (testId: string) => screen.getByTestId(testId) as HTMLInputElement;
const form = () => screen.getByTestId('user-detail-form');
/** The overlay of the form, not the one of the Policies tab's list. */
const overlay = () => form().parentElement?.querySelector('.mantine-LoadingOverlay-root') ?? null;
const loaded = () => waitFor(() => expect(input('user-detail-email').value).toBe(stored.email));
const saveButton = () => screen.getByTestId('user-detail-save-btn');

/** What the permissions hook answers: an administrator, or the listed actions on every collection. */
function grant(actions: string[], isAdmin = false, loading = false) {
  mocks.usePermissions.mockReturnValue({
    canPerform: (_collection: string, action: string) => isAdmin || actions.includes(action),
    isAdmin,
    loading,
  });
}

let show: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue(stored);
  mocks.createUser.mockReset();
  mocks.updateUser.mockReset();
  mocks.deleteUser.mockReset().mockResolvedValue(undefined);
  mocks.fetchUserPolicies.mockReset().mockResolvedValue([]);
  mocks.attachUserPolicy.mockReset().mockResolvedValue(undefined);
  mocks.detachUserPolicy.mockReset().mockResolvedValue(undefined);
  mocks.fetchRoles.mockReset().mockResolvedValue({ roles: mockRoles, total: mockRoles.length, totalPages: 1 });
  mocks.fetchPolicies.mockReset().mockResolvedValue({ policies: [], total: 0, totalPages: 1 });
  grant([], true);
  show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
});

afterEach(() => {
  show.mockRestore();
});

describe('UserDetail', () => {
  describe('the form', () => {
    it('loads the user into the form, with Save waiting for an edit', async () => {
      render(ui());
      await loaded();
      expect(screen.getByRole('heading', { name: 'Edit User' })).toBeInTheDocument();
      expect(input('user-detail-first-name').value).toBe('Sam');
      expect(saveButton()).toHaveTextContent('Save');
      expect(saveButton()).toBeDisabled();
      expect(screen.getByTestId('user-detail-delete-btn')).toBeInTheDocument();
      expect(mocks.getUser).toHaveBeenCalledWith(stored.id, { fields: '*,roles.*' });
    });

    it('saves only what changed, and calls onSaved with the stored user', async () => {
      const saved: User = { ...stored, first_name: 'Samuel' };
      mocks.updateUser.mockResolvedValue(saved);
      const onSaved = vi.fn();
      render(ui({ onSaved }));
      await loaded();

      fireEvent.change(input('user-detail-first-name'), { target: { value: 'Samuel' } });
      fireEvent.click(saveButton());

      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
      expect(mocks.updateUser).toHaveBeenCalledWith(stored.id, { first_name: 'Samuel' });
      expect(mocks.createUser).not.toHaveBeenCalled();
      await waitFor(() => expect(saveButton()).toBeDisabled());
    });

    it('refuses a new user without an email or a password', async () => {
      render(ui({ id: 'new' }));
      fireEvent.click(saveButton());
      expect(await screen.findByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required for new users')).toBeInTheDocument();
      expect(mocks.createUser).not.toHaveBeenCalled();
    });
  });

  describe('permissions', () => {
    it('shows a user with read access the record without Save or Delete', async () => {
      grant(['read']);
      render(ui());
      await loaded();
      expect(screen.queryByTestId('user-detail-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('user-detail-delete-btn')).not.toBeInTheDocument();
    });

    it('offers Save without Delete to a user who may update', async () => {
      grant(['read', 'update']);
      render(ui());
      await loaded();
      expect(saveButton()).toBeInTheDocument();
      expect(screen.queryByTestId('user-detail-delete-btn')).not.toBeInTheDocument();
    });
  });

  describe('while the permissions are not known', () => {
    it('offers nothing that writes: no Save, no Delete, a covered form that takes no edit', async () => {
      // What a user who will turn out to be an administrator gets meanwhile
      grant([], true, true);
      const view = render(ui());
      await loaded();

      expect(screen.queryByTestId('user-detail-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('user-detail-delete-btn')).not.toBeInTheDocument();
      expect(overlay()).toBeInTheDocument();
      expect(form()).toBeDisabled();
      expect(input('user-detail-email')).toBeDisabled();
      expect(input('user-detail-first-name')).toBeDisabled();
      expect(input('user-detail-password')).toBeDisabled();
      // Reading does not wait: the record is there, with its sidebar
      expect(input('user-detail-first-name').value).toBe('Sam');
      expect(screen.getByText(stored.id)).toBeInTheDocument();

      grant([], true);
      view.rerender(ui());
      expect(await screen.findByTestId('user-detail-save-btn')).toBeInTheDocument();
      expect(screen.getByTestId('user-detail-delete-btn')).toBeInTheDocument();
      expect(form()).not.toBeDisabled();
      expect(input('user-detail-email')).not.toBeDisabled();
      await waitFor(() => expect(overlay()).not.toBeInTheDocument());
      // The user was loaded once: the permissions arriving do not fetch it again
      expect(mocks.getUser).toHaveBeenCalledTimes(1);
    });

    it('a reader is never offered Save or Delete', async () => {
      grant([], false, true);
      const view = render(ui());
      await loaded();
      expect(screen.queryByTestId('user-detail-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('user-detail-delete-btn')).not.toBeInTheDocument();
      expect(input('user-detail-email')).toBeDisabled();

      grant(['read']);
      view.rerender(ui());
      await waitFor(() => expect(overlay()).not.toBeInTheDocument());
      expect(screen.queryByTestId('user-detail-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('user-detail-delete-btn')).not.toBeInTheDocument();
    });

    it('a new user form is not opened before the answer is in', async () => {
      grant([], false, true);
      const view = render(ui({ id: 'new' }));

      // No Create, and a covered form that takes no edit
      expect(screen.queryByTestId('user-detail-save-btn')).not.toBeInTheDocument();
      expect(overlay()).toBeInTheDocument();
      expect(input('user-detail-email')).toBeDisabled();
      expect(input('user-detail-password')).toBeDisabled();

      // A user who may create gets the form then
      grant(['read', 'create']);
      view.rerender(ui({ id: 'new' }));
      expect(await screen.findByTestId('user-detail-save-btn')).toHaveTextContent('Create');
      expect(saveButton()).not.toBeDisabled();
      expect(input('user-detail-email')).not.toBeDisabled();
      await waitFor(() => expect(overlay()).not.toBeInTheDocument());
    });

    it('a user who may not create never gets Create', async () => {
      grant([], false, true);
      const view = render(ui({ id: 'new' }));
      expect(screen.queryByTestId('user-detail-save-btn')).not.toBeInTheDocument();

      grant(['read', 'update']);
      view.rerender(ui({ id: 'new' }));
      await waitFor(() => expect(overlay()).not.toBeInTheDocument());
      expect(screen.queryByTestId('user-detail-save-btn')).not.toBeInTheDocument();
      expect(mocks.createUser).not.toHaveBeenCalled();
    });

    it('a later refresh of the permissions does not close the form under the user', async () => {
      const view = render(ui());
      await loaded();
      fireEvent.change(input('user-detail-first-name'), { target: { value: 'still typing' } });

      // The hook loads again (a renewed token, another scope) and answers from what it knew meanwhile
      grant([], true, true);
      view.rerender(ui());
      expect(input('user-detail-first-name')).not.toBeDisabled();
      expect(input('user-detail-first-name').value).toBe('still typing');
      expect(saveButton()).not.toBeDisabled();
      expect(screen.getByTestId('user-detail-delete-btn')).toBeInTheDocument();
      expect(overlay()).not.toBeInTheDocument();
    });
  });

  describe('after a create', () => {
    const created: User = {
      ...stored,
      id: 'user-new',
      email: 'new.user@example.com',
      first_name: null,
      last_name: null,
      roles: [],
      policyCount: 0,
    };

    /** A promise the test settles when it chooses to. */
    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    }

    function fillNewUser() {
      fireEvent.change(input('user-detail-email'), { target: { value: created.email } });
      fireEvent.change(input('user-detail-password'), { target: { value: 'secret-1' } });
    }

    it('goes on as the editor of the user it created: a further Save updates that user', async () => {
      mocks.createUser.mockResolvedValue(created);
      mocks.updateUser.mockResolvedValue({ ...created, first_name: 'Nina' });
      // A host that does not navigate
      const onSaved = vi.fn();
      render(ui({ id: 'new', onSaved }));
      expect(screen.getByRole('heading', { name: 'New User' })).toBeInTheDocument();
      fillNewUser();
      fireEvent.click(saveButton());
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));

      // The stored user's editor: its title, its sidebar, its Policies tab, Delete, and a Save that waits for an edit
      expect(await screen.findByRole('heading', { name: 'Edit User' })).toBeInTheDocument();
      expect(screen.getByText(created.id)).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Policies/ })).toBeInTheDocument();
      expect(screen.getByTestId('user-detail-delete-btn')).toBeInTheDocument();
      expect(saveButton()).toHaveTextContent('Save');
      expect(saveButton()).toBeDisabled();
      expect(input('user-detail-password').value).toBe('');
      await waitFor(() => expect(mocks.fetchUserPolicies).toHaveBeenCalledWith(created.id));

      fireEvent.change(input('user-detail-first-name'), { target: { value: 'Nina' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith(created.id, { first_name: 'Nina' }));
      expect(mocks.createUser).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
      // It was never loaded: the create's answer is the record
      expect(mocks.getUser).not.toHaveBeenCalled();
    });

    it('a second click, with the password typed again, does not create a second user', async () => {
      mocks.createUser.mockResolvedValue(created);
      mocks.updateUser.mockResolvedValue(created);
      const onSaved = vi.fn();
      render(ui({ id: 'new', onSaved }));
      fillNewUser();
      fireEvent.click(saveButton());
      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

      fireEvent.change(input('user-detail-password'), { target: { value: 'secret-1' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
      expect(mocks.createUser).toHaveBeenCalledTimes(1);
      expect(mocks.updateUser).toHaveBeenCalledWith(created.id, { password: 'secret-1' });
    });

    it('keeps what was typed while the create was in flight, as an unsaved edit', async () => {
      const answer = deferred<User>();
      mocks.createUser.mockReturnValue(answer.promise);
      mocks.updateUser.mockResolvedValue({ ...created, first_name: 'Typed later' });
      const onSaved = vi.fn();
      render(ui({ id: 'new', onSaved }));
      fillNewUser();
      fireEvent.click(saveButton());
      await waitFor(() => expect(mocks.createUser).toHaveBeenCalledTimes(1));

      fireEvent.change(input('user-detail-first-name'), { target: { value: 'Typed later' } });
      answer.resolve(created);
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));

      expect(input('user-detail-first-name').value).toBe('Typed later');
      expect(input('user-detail-password').value).toBe('');
      await waitFor(() => expect(saveButton()).not.toBeDisabled());
      fireEvent.click(saveButton());
      await waitFor(() =>
        expect(mocks.updateUser).toHaveBeenCalledWith(created.id, { first_name: 'Typed later' }),
      );
      expect(mocks.createUser).toHaveBeenCalledTimes(1);
    });

    it('keeps what was typed while an update was in flight', async () => {
      const answer = deferred<User>();
      mocks.updateUser.mockReturnValue(answer.promise);
      const onSaved = vi.fn();
      render(ui({ onSaved }));
      await loaded();
      fireEvent.change(input('user-detail-first-name'), { target: { value: 'Samuel' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith(stored.id, { first_name: 'Samuel' }));

      fireEvent.change(input('user-detail-last-name'), { target: { value: 'Typed later' } });
      answer.resolve({ ...stored, first_name: 'Samuel' });
      await waitFor(() => expect(onSaved).toHaveBeenCalled());

      expect(input('user-detail-last-name').value).toBe('Typed later');
      await waitFor(() => expect(saveButton()).not.toBeDisabled());
      mocks.updateUser.mockResolvedValue({ ...stored, first_name: 'Samuel', last_name: 'Typed later' });
      fireEvent.click(saveButton());
      await waitFor(() =>
        expect(mocks.updateUser).toHaveBeenLastCalledWith(stored.id, { last_name: 'Typed later' }),
      );
    });

    it('a save answered after the host opened another user is not drawn over that user', async () => {
      const other = mockUsers[3];
      const answer = deferred<User>();
      mocks.updateUser.mockReturnValue(answer.promise);
      mocks.getUser.mockImplementation(async (id: string) => (id === other.id ? other : stored));
      const onSaved = vi.fn();
      const view = render(ui({ onSaved }));
      await loaded();
      fireEvent.change(input('user-detail-first-name'), { target: { value: 'Samuel' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));

      // The host opens another user in the same component while the request is out
      view.rerender(ui({ id: other.id, onSaved }));
      await waitFor(() => expect(input('user-detail-email').value).toBe(other.email));
      const saved = { ...stored, first_name: 'Samuel' };
      answer.resolve(saved);
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));

      expect(input('user-detail-email').value).toBe(other.email);
      expect(input('user-detail-first-name').value).toBe('Alex');
      expect(screen.getByText(other.id)).toBeInTheDocument();
      // Nothing of the first user is an unsaved edit of the second
      await waitFor(() => expect(saveButton()).toBeDisabled());
    });

    it('the new route opened in the same component is an empty form', async () => {
      const view = render(ui());
      await loaded();
      view.rerender(ui({ id: 'new' }));
      await waitFor(() => expect(input('user-detail-email').value).toBe(''));
      expect(input('user-detail-first-name').value).toBe('');
      expect(screen.getByRole('heading', { name: 'New User' })).toBeInTheDocument();
      expect(saveButton()).toHaveTextContent('Create');
    });

    it('a change of language does not empty a new form, or let go of the user it created', async () => {
      mocks.createUser.mockResolvedValue(created);
      const onSaved = vi.fn();
      const view = render(ui({ id: 'new', onSaved }));
      fillNewUser();
      // Other texts arrive (a language switch, a new `translations` override)
      view.rerender(ui({ id: 'new', onSaved, translations: { userDetail: { titleNew: 'Add a user' } } }));
      expect(screen.getByRole('heading', { name: 'Add a user' })).toBeInTheDocument();
      expect(input('user-detail-email').value).toBe(created.email);
      expect(input('user-detail-password').value).toBe('secret-1');

      fireEvent.click(saveButton());
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));
      view.rerender(ui({ id: 'new', onSaved, translations: { userDetail: { titleEdit: 'Change the user' } } }));
      expect(await screen.findByRole('heading', { name: 'Change the user' })).toBeInTheDocument();
      expect(input('user-detail-email').value).toBe(created.email);
      expect(screen.getByText(created.id)).toBeInTheDocument();
    });

    it('a record opened after a create is loaded, not taken for the created one', async () => {
      mocks.createUser.mockResolvedValue(created);
      const onSaved = vi.fn();
      const view = render(ui({ id: 'new', onSaved }));
      fillNewUser();
      fireEvent.click(saveButton());
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));

      // The host navigates to the stored user's own route
      mocks.getUser.mockResolvedValue({ ...created, first_name: 'From the server' });
      view.rerender(ui({ id: created.id, onSaved }));
      await waitFor(() => expect(input('user-detail-first-name').value).toBe('From the server'));
      expect(mocks.getUser).toHaveBeenCalledWith(created.id, { fields: '*,roles.*' });
    });
  });
});
