/**
 * ModuleAccessKeysManager unit tests: the registry tree and its RBAC gates.
 * `@buildpad/hooks` is mocked so no backend is required.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ModuleAccessKey } from '@buildpad/types';
import { ModuleAccessKeysManager } from '../src/ModuleAccessKeysManager';

const { fetchKeysMock, createKeyMock, updateKeyMock, deleteKeyMock, usePermissionsMock } = vi.hoisted(() => ({
  fetchKeysMock: vi.fn(),
  createKeyMock: vi.fn(),
  updateKeyMock: vi.fn(),
  deleteKeyMock: vi.fn(),
  usePermissionsMock: vi.fn(),
}));

vi.mock('@buildpad/hooks', () => ({
  useModuleAccessKeys: () => ({
    fetchKeys: fetchKeysMock,
    createKey: createKeyMock,
    updateKey: updateKeyMock,
    deleteKey: deleteKeyMock,
  }),
  usePermissions: usePermissionsMock,
}));

const stamp = new Date('2026-01-10T09:00:00Z').toISOString();
const leaf: ModuleAccessKey = {
  id: 'key-logs',
  parent_id: 'folder-system',
  display_name: 'View logs',
  description: null,
  key: 'reports:logs',
  sort: 0,
  created_at: stamp,
  updated_at: stamp,
};
const folder: ModuleAccessKey = {
  id: 'folder-system',
  parent_id: null,
  display_name: 'Reports',
  description: null,
  key: null,
  sort: 0,
  created_at: stamp,
  updated_at: stamp,
  children: [leaf],
};
const keys = [folder, leaf];

function ui() {
  return (
    <MantineProvider>
      <ModuleAccessKeysManager />
    </MantineProvider>
  );
}

const listed = () => waitFor(() => expect(screen.getByText('View logs')).toBeInTheDocument());

beforeEach(() => {
  fetchKeysMock.mockReset().mockResolvedValue({ keys, tree: [folder] });
  createKeyMock.mockReset().mockResolvedValue(leaf);
  updateKeyMock.mockReset().mockResolvedValue(leaf);
  deleteKeyMock.mockReset().mockResolvedValue(undefined);
  usePermissionsMock.mockReset().mockReturnValue({ canPerform: () => true, isAdmin: true, loading: false });
});

describe('ModuleAccessKeysManager', () => {
  it('lists the registry as a tree, with Add Folder / Add Key and a row menu for an administrator', async () => {
    render(ui());
    await listed();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('reports:logs')).toBeInTheDocument();
    expect(screen.getByTestId('module-access-add-folder')).toBeInTheDocument();
    expect(screen.getByTestId('module-access-add-key')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Row actions')).toHaveLength(2);
  });

  it('shows a user with read access the tree and nothing that writes', async () => {
    usePermissionsMock.mockReturnValue({
      canPerform: (_collection: string, action: string) => action === 'read',
      isAdmin: false,
      loading: false,
    });
    render(ui());
    await listed();
    expect(screen.queryByTestId('module-access-add-folder')).not.toBeInTheDocument();
    expect(screen.queryByTestId('module-access-add-key')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
  });

  describe('while the permissions are not known', () => {
    it('draws no write control while permissions load, and the allowed ones once they are known', async () => {
      // What a user who will turn out to be an administrator gets meanwhile
      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: true });
      const view = render(ui());
      await listed();

      expect(screen.queryByTestId('module-access-add-folder')).not.toBeInTheDocument();
      expect(screen.queryByTestId('module-access-add-key')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
      // Reading does not wait: the tree is there, and folds
      expect(screen.getByText('reports:logs')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Collapse'));
      expect(screen.queryByText('View logs')).not.toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Expand'));

      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: false });
      view.rerender(ui());
      expect(await screen.findByTestId('module-access-add-key')).toBeInTheDocument();
      expect(screen.getByTestId('module-access-add-folder')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Row actions')).toHaveLength(2);
      // The registry was loaded once: the permissions arriving do not fetch it again
      expect(fetchKeysMock).toHaveBeenCalledTimes(1);
    });

    it('a reader is never shown a write control, not even while permissions load', async () => {
      usePermissionsMock.mockReturnValue({ canPerform: () => false, isAdmin: false, loading: true });
      const view = render(ui());
      await listed();
      expect(screen.queryByTestId('module-access-add-key')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();

      usePermissionsMock.mockReturnValue({
        canPerform: (_collection: string, action: string) => action === 'read',
        isAdmin: false,
        loading: false,
      });
      view.rerender(ui());
      expect(screen.getByText('View logs')).toBeInTheDocument();
      expect(screen.queryByTestId('module-access-add-key')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
    });

    it('a later refresh of the permissions does not close the open form or take the controls away', async () => {
      const view = render(ui());
      await listed();
      fireEvent.click(screen.getByTestId('module-access-add-key'));
      fireEvent.change(await screen.findByTestId('module-access-form-display-name'), {
        target: { value: 'still typing' },
      });

      // The hook loads again (a renewed token, another scope) and answers from what it knew meanwhile
      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: true });
      view.rerender(ui());
      expect((screen.getByTestId('module-access-form-display-name') as HTMLInputElement).value).toBe('still typing');
      expect(screen.getByTestId('module-access-form-save')).toBeInTheDocument();
      expect(screen.getByTestId('module-access-add-key')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Row actions')).toHaveLength(2);
    });
  });
});
