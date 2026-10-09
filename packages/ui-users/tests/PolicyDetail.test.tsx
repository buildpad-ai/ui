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
  SystemPermissions: ({
    primaryKey,
    disabled,
    onChange,
  }: {
    primaryKey: string;
    disabled?: boolean;
    onChange: (alterations: { create: unknown[]; update: unknown[]; delete: unknown[] }) => void;
  }) => (
    <div data-testid="policy-detail-permissions" data-policy={primaryKey} data-disabled={disabled ? 'true' : 'false'}>
      <button
        type="button"
        data-testid="matrix-grant"
        onClick={() => onChange({ create: [{ collection: 'articles', action: 'read' }], update: [], delete: [] })}
      >
        grant
      </button>
    </div>
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

  describe('after a create', () => {
    const created: Policy = {
      id: 'policy-new',
      name: 'Reviewers',
      icon: 'security',
      description: '',
      admin_access: false,
      app_access: false,
      delegate_access: false,
      userCount: 0,
      roleCount: 0,
      created_at: stamp,
      updated_at: stamp,
    };

    /** A promise the test settles when it chooses to. */
    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    }

    it('goes on as the editor of the policy it created: a further Save updates that policy', async () => {
      mocks.createPolicy.mockResolvedValue(created);
      mocks.updatePolicy.mockResolvedValue({ ...created, name: 'Reviewers 2' });
      // A host that does not navigate
      const onSaved = vi.fn();
      render(ui({ id: 'new', onSaved }));
      expect(screen.getByRole('heading', { name: 'New Policy' })).toBeInTheDocument();
      expect(screen.queryByTestId('policy-detail-permissions')).not.toBeInTheDocument();
      fireEvent.change(input('policy-detail-name'), { target: { value: 'Reviewers' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));

      // The stored policy's editor: its title, its sidebar, its matrix, Delete, and a Save that waits for an edit
      expect(await screen.findByRole('heading', { name: 'Edit Policy' })).toBeInTheDocument();
      expect(screen.getByText(created.id)).toBeInTheDocument();
      expect(matrix()).toHaveAttribute('data-policy', created.id);
      expect(screen.getByTestId('policy-detail-delete-btn')).toBeInTheDocument();
      expect(saveButton()).toHaveTextContent('Save');
      expect(saveButton()).toBeDisabled();

      fireEvent.change(input('policy-detail-name'), { target: { value: 'Reviewers 2' } });
      fireEvent.click(saveButton());
      await waitFor(() =>
        expect(mocks.updatePolicy).toHaveBeenCalledWith(created.id, expect.objectContaining({ name: 'Reviewers 2' })),
      );
      expect(mocks.createPolicy).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
      // It was never loaded: the create's answer is the record
      expect(mocks.getPolicy).not.toHaveBeenCalled();
    });

    it('a second click does not create a second policy', async () => {
      mocks.createPolicy.mockResolvedValue(created);
      const onSaved = vi.fn();
      render(ui({ id: 'new', onSaved }));
      fireEvent.change(input('policy-detail-name'), { target: { value: 'Reviewers' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

      fireEvent.click(saveButton());
      fireEvent.click(saveButton());
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mocks.createPolicy).toHaveBeenCalledTimes(1);
      expect(mocks.updatePolicy).not.toHaveBeenCalled();
    });

    it('keeps what was typed while the create was in flight, as an unsaved edit', async () => {
      const answer = deferred<Policy>();
      mocks.createPolicy.mockReturnValue(answer.promise);
      mocks.updatePolicy.mockResolvedValue({ ...created, name: 'Typed later' });
      const onSaved = vi.fn();
      render(ui({ id: 'new', onSaved }));
      fireEvent.change(input('policy-detail-name'), { target: { value: 'Reviewers' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(mocks.createPolicy).toHaveBeenCalledTimes(1));

      fireEvent.change(input('policy-detail-name'), { target: { value: 'Typed later' } });
      answer.resolve(created);
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));

      expect(input('policy-detail-name').value).toBe('Typed later');
      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
      await waitFor(() => expect(saveButton()).not.toBeDisabled());
      fireEvent.click(saveButton());
      await waitFor(() =>
        expect(mocks.updatePolicy).toHaveBeenCalledWith(created.id, expect.objectContaining({ name: 'Typed later' })),
      );
      expect(mocks.createPolicy).toHaveBeenCalledTimes(1);
    });

    it('a save answered after the host opened another policy is not drawn over that policy', async () => {
      const other = mockPolicies[1];
      const answer = deferred<Policy>();
      mocks.updatePolicy.mockReturnValue(answer.promise);
      mocks.getPolicy.mockImplementation(async (id: string) => (id === other.id ? other : stored));
      const onSaved = vi.fn();
      const view = render(ui({ onSaved }));
      await loaded();
      fireEvent.change(input('policy-detail-name'), { target: { value: 'Content Editors' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(mocks.updatePolicy).toHaveBeenCalledTimes(1));

      // The host opens another policy in the same component while the request is out
      view.rerender(ui({ id: other.id, onSaved }));
      await waitFor(() => expect(input('policy-detail-name').value).toBe(other.name));
      const saved = { ...stored, name: 'Content Editors' };
      answer.resolve(saved);
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));

      expect(input('policy-detail-name').value).toBe(other.name);
      expect(screen.getByText(other.id)).toBeInTheDocument();
      expect(matrix()).toHaveAttribute('data-policy', other.id);
      // Nothing of the first policy is an unsaved edit of the second
      expect(screen.queryByText('Unsaved Changes')).not.toBeInTheDocument();
      await waitFor(() => expect(saveButton()).toBeDisabled());
    });

    it('matrix edits made on one policy are not carried to the next one opened in the same component', async () => {
      const other = mockPolicies[1];
      mocks.getPolicy.mockImplementation(async (id: string) => (id === other.id ? other : stored));
      const view = render(ui());
      await loaded();
      fireEvent.click(screen.getByTestId('matrix-grant'));
      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
      expect(saveButton()).not.toBeDisabled();

      view.rerender(ui({ id: other.id }));
      await waitFor(() => expect(input('policy-detail-name').value).toBe(other.name));
      // A Save here would have written the first policy's grant to the second
      expect(screen.queryByText('Unsaved Changes')).not.toBeInTheDocument();
      expect(saveButton()).toBeDisabled();
    });

    it('the new route opened in the same component is an empty form', async () => {
      const view = render(ui());
      await loaded();
      view.rerender(ui({ id: 'new' }));
      await waitFor(() => expect(input('policy-detail-name').value).toBe(''));
      expect(screen.getByRole('heading', { name: 'New Policy' })).toBeInTheDocument();
      expect(input('policy-detail-app-access')).not.toBeChecked();
      expect(screen.queryByTestId('policy-detail-permissions')).not.toBeInTheDocument();
      expect(saveButton()).toHaveTextContent('Create');
    });

    it('a change of language does not empty a new form, or let go of the policy it created', async () => {
      mocks.createPolicy.mockResolvedValue(created);
      const onSaved = vi.fn();
      const view = render(ui({ id: 'new', onSaved }));
      fireEvent.change(input('policy-detail-name'), { target: { value: 'Reviewers' } });
      // Other texts arrive (a language switch, a new `translations` override)
      view.rerender(ui({ id: 'new', onSaved, translations: { policyDetail: { titleNew: 'Add a policy' } } }));
      expect(screen.getByRole('heading', { name: 'Add a policy' })).toBeInTheDocument();
      expect(input('policy-detail-name').value).toBe('Reviewers');

      fireEvent.click(saveButton());
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));
      view.rerender(ui({ id: 'new', onSaved, translations: { policyDetail: { titleEdit: 'Change the policy' } } }));
      expect(await screen.findByRole('heading', { name: 'Change the policy' })).toBeInTheDocument();
      expect(input('policy-detail-name').value).toBe('Reviewers');
      expect(matrix()).toHaveAttribute('data-policy', created.id);
    });

    it('a record opened after a create is loaded, not taken for the created one', async () => {
      mocks.createPolicy.mockResolvedValue(created);
      const onSaved = vi.fn();
      const view = render(ui({ id: 'new', onSaved }));
      fireEvent.change(input('policy-detail-name'), { target: { value: 'Reviewers' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));

      // The host navigates to the stored policy's own route (as the generated page does)
      mocks.getPolicy.mockResolvedValue({ ...created, description: 'From the server' });
      view.rerender(ui({ id: created.id, onSaved }));
      expect(await screen.findByDisplayValue('From the server')).toBeInTheDocument();
      expect(mocks.getPolicy).toHaveBeenCalledWith(created.id);
      expect(matrix()).toHaveAttribute('data-policy', created.id);
    });
  });
});
