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
});
