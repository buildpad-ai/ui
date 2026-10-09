/**
 * PolicyDetail unit tests: the create/edit form, its RBAC gates and what it
 * does around a save. `@buildpad/hooks` is mocked so no backend is required;
 * the permissions matrix (`SystemPermissions`, tested in ui-interfaces) is
 * replaced by a stand-in that shows what it was given.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ModuleAccessKey, Policy } from '@buildpad/types';
import { PolicyDetail } from '../src/PolicyDetail';
import { mockPolicies } from '../src/_fixtures';

const mocks = vi.hoisted(() => ({
  getPolicy: vi.fn(),
  createPolicy: vi.fn(),
  updatePolicy: vi.fn(),
  deletePolicy: vi.fn(),
  fetchKeys: vi.fn(),
  usePermissions: vi.fn(),
}));

vi.mock('@buildpad/hooks', () => ({
  usePolicies: () => ({
    getPolicy: mocks.getPolicy,
    createPolicy: mocks.createPolicy,
    updatePolicy: mocks.updatePolicy,
    deletePolicy: mocks.deletePolicy,
  }),
  useModuleAccessKeys: () => ({ fetchKeys: mocks.fetchKeys }),
  usePermissions: mocks.usePermissions,
}));

vi.mock('@buildpad/ui-interfaces/system-permissions', () => ({
  SystemPermissions: ({ primaryKey, disabled }: { primaryKey: string; disabled?: boolean }) => (
    <div data-testid="policy-detail-permissions" data-policy={primaryKey} data-disabled={disabled ? 'true' : 'false'} />
  ),
}));

/** Content Editor: app access, no admin access. */
const stored: Policy = mockPolicies[2];

const stamp = new Date('2026-01-10T09:00:00Z').toISOString();
const moduleKey: ModuleAccessKey = {
  id: 'key-logs',
  parent_id: null,
  display_name: 'View logs',
  description: null,
  key: 'reports:logs',
  sort: 0,
  created_at: stamp,
  updated_at: stamp,
};

type Props = React.ComponentProps<typeof PolicyDetail>;

function ui(props: Partial<Props> = {}) {
  return (
    <MantineProvider>
      <PolicyDetail id={stored.id} {...props} />
    </MantineProvider>
  );
}

const input = (testId: string) => screen.getByTestId(testId) as HTMLInputElement;
const form = () => screen.getByTestId('policy-detail-form');
const overlay = () => form().parentElement?.querySelector('.mantine-LoadingOverlay-root') ?? null;
const loaded = () => waitFor(() => expect(input('policy-detail-name').value).toBe(stored.name));
const saveButton = () => screen.getByTestId('policy-detail-save-btn');
const matrix = () => screen.getByTestId('policy-detail-permissions');

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
  mocks.getPolicy.mockReset().mockResolvedValue(stored);
  mocks.createPolicy.mockReset();
  mocks.updatePolicy.mockReset();
  mocks.deletePolicy.mockReset().mockResolvedValue(undefined);
  mocks.fetchKeys.mockReset().mockResolvedValue({ keys: [moduleKey], tree: [moduleKey] });
  grant([], true);
  show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
});

afterEach(() => {
  show.mockRestore();
});

describe('PolicyDetail', () => {
  describe('the form', () => {
    it('loads the policy into the form with its permissions matrix, and Save waits for an edit', async () => {
      render(ui());
      await loaded();
      expect(screen.getByRole('heading', { name: 'Edit Policy' })).toBeInTheDocument();
      expect(input('policy-detail-app-access')).toBeChecked();
      expect(input('policy-detail-admin-access')).not.toBeChecked();
      expect(matrix()).toHaveAttribute('data-policy', stored.id);
      expect(saveButton()).toHaveTextContent('Save');
      expect(saveButton()).toBeDisabled();
      expect(screen.getByTestId('policy-detail-delete-btn')).toBeInTheDocument();
    });

    it('saves an edit and calls onSaved with the stored policy', async () => {
      const saved: Policy = { ...stored, name: 'Content Editors' };
      mocks.updatePolicy.mockResolvedValue(saved);
      const onSaved = vi.fn();
      render(ui({ onSaved }));
      await loaded();

      fireEvent.change(input('policy-detail-name'), { target: { value: 'Content Editors' } });
      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
      fireEvent.click(saveButton());

      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
      expect(mocks.updatePolicy).toHaveBeenCalledWith(stored.id, expect.objectContaining({ name: 'Content Editors' }));
      expect(mocks.createPolicy).not.toHaveBeenCalled();
      await waitFor(() => expect(saveButton()).toBeDisabled());
    });

    it('refuses a policy without a name', async () => {
      render(ui({ id: 'new' }));
      fireEvent.click(saveButton());
      await waitFor(() =>
        expect(show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Name is required', color: 'red' })),
      );
      expect(mocks.createPolicy).not.toHaveBeenCalled();
    });
  });

  describe('permissions', () => {
    it('shows a user with read access the policy without Save or Delete', async () => {
      grant(['read']);
      render(ui());
      await loaded();
      expect(screen.queryByTestId('policy-detail-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('policy-detail-delete-btn')).not.toBeInTheDocument();
    });

    it('offers Save without Delete to a user who may update', async () => {
      grant(['read', 'update']);
      render(ui());
      await loaded();
      expect(saveButton()).toBeInTheDocument();
      expect(screen.queryByTestId('policy-detail-delete-btn')).not.toBeInTheDocument();
    });
  });

  describe('while the permissions are not known', () => {
    it('offers nothing that writes: no Save, no Delete, a covered form and a matrix that take no edit', async () => {
      // What a user who will turn out to be an administrator gets meanwhile
      grant([], true, true);
      const view = render(ui());
      await loaded();

      expect(screen.queryByTestId('policy-detail-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('policy-detail-delete-btn')).not.toBeInTheDocument();
      expect(overlay()).toBeInTheDocument();
      expect(form()).toBeDisabled();
      expect(input('policy-detail-name')).toBeDisabled();
      expect(input('policy-detail-admin-access')).toBeDisabled();
      // Reading does not wait: the policy and its matrix are there
      expect(matrix()).toHaveAttribute('data-policy', stored.id);
      expect(matrix()).toHaveAttribute('data-disabled', 'true');
      // The module-level grants are shown, and take no edit either
      fireEvent.click(screen.getByTestId('policy-detail-tab-module'));
      expect(await screen.findByTestId('module-access-toggle-reports:logs')).toBeDisabled();

      grant([], true);
      view.rerender(ui());
      expect(await screen.findByTestId('policy-detail-save-btn')).toBeInTheDocument();
      expect(screen.getByTestId('policy-detail-delete-btn')).toBeInTheDocument();
      expect(form()).not.toBeDisabled();
      expect(input('policy-detail-name')).not.toBeDisabled();
      expect(matrix()).toHaveAttribute('data-disabled', 'false');
      expect(screen.getByTestId('module-access-toggle-reports:logs')).not.toBeDisabled();
      await waitFor(() => expect(overlay()).not.toBeInTheDocument());
      // The policy was loaded once: the permissions arriving do not fetch it again
      expect(mocks.getPolicy).toHaveBeenCalledTimes(1);
    });

    it('a reader is never offered Save or Delete', async () => {
      grant([], false, true);
      const view = render(ui());
      await loaded();
      expect(screen.queryByTestId('policy-detail-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('policy-detail-delete-btn')).not.toBeInTheDocument();
      expect(input('policy-detail-name')).toBeDisabled();

      grant(['read']);
      view.rerender(ui());
      await waitFor(() => expect(overlay()).not.toBeInTheDocument());
      expect(screen.queryByTestId('policy-detail-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('policy-detail-delete-btn')).not.toBeInTheDocument();
    });

    it('a new policy form is not opened before the answer is in', async () => {
      grant([], false, true);
      const view = render(ui({ id: 'new' }));

      // No Create, and a covered form that takes no edit
      expect(screen.queryByTestId('policy-detail-save-btn')).not.toBeInTheDocument();
      expect(overlay()).toBeInTheDocument();
      expect(input('policy-detail-name')).toBeDisabled();

      // A user who may create gets the form then
      grant(['read', 'create']);
      view.rerender(ui({ id: 'new' }));
      expect(await screen.findByTestId('policy-detail-save-btn')).toHaveTextContent('Create');
      expect(saveButton()).not.toBeDisabled();
      expect(input('policy-detail-name')).not.toBeDisabled();
      await waitFor(() => expect(overlay()).not.toBeInTheDocument());
    });

    it('a user who may not create never gets Create', async () => {
      grant([], false, true);
      const view = render(ui({ id: 'new' }));
      expect(screen.queryByTestId('policy-detail-save-btn')).not.toBeInTheDocument();

      grant(['read', 'update']);
      view.rerender(ui({ id: 'new' }));
      await waitFor(() => expect(overlay()).not.toBeInTheDocument());
      expect(screen.queryByTestId('policy-detail-save-btn')).not.toBeInTheDocument();
      expect(mocks.createPolicy).not.toHaveBeenCalled();
    });

    it('a later refresh of the permissions does not close the form under the user', async () => {
      const view = render(ui());
      await loaded();
      fireEvent.change(input('policy-detail-name'), { target: { value: 'still typing' } });

      // The hook loads again (a renewed token, another scope) and answers from what it knew meanwhile
      grant([], true, true);
      view.rerender(ui());
      expect(input('policy-detail-name')).not.toBeDisabled();
      expect(input('policy-detail-name').value).toBe('still typing');
      expect(saveButton()).not.toBeDisabled();
      expect(screen.getByTestId('policy-detail-delete-btn')).toBeInTheDocument();
      expect(matrix()).toHaveAttribute('data-disabled', 'false');
      expect(overlay()).not.toBeInTheDocument();
    });
  });
});
