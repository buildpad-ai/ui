/**
 * FileManager unit tests: the library view, its RBAC gates, and what it asks
 * its data hooks for. `@buildpad/hooks` is mocked so no backend is required;
 * the upload zone is the real `Upload` interface from ui-interfaces.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileManager } from '../src/FileManager';
import { mockFiles, mockFolders } from '../src/_fixtures';

const mocks = vi.hoisted(() => ({
  uploadFiles: vi.fn(),
  fetchFiles: vi.fn(),
  importFromUrl: vi.fn(),
  deleteFile: vi.fn(),
  deleteFiles: vi.fn(),
  getDownloadUrl: vi.fn(),
  fetchFolders: vi.fn(),
  fetchFolder: vi.fn(),
  createFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn(),
  usePermissions: vi.fn(),
}));

vi.mock('@buildpad/hooks', async () => {
  // The URL-persistence helpers and the i18n hooks are used as they are.
  const url = await import('../../hooks/src/useUrlListParams');
  const i18n = await import('../../hooks/src/useBuildpadI18n');
  return {
    useUrlListParams: url.useUrlListParams,
    useHydrated: url.useHydrated,
    readUrlParam: url.readUrlParam,
    readUrlIntParam: url.readUrlIntParam,
    useBuildpadTranslations: i18n.useBuildpadTranslations,
    useBuildpadI18n: i18n.useBuildpadI18n,
    useFiles: () => ({
      uploadFiles: mocks.uploadFiles,
      fetchFiles: mocks.fetchFiles,
      importFromUrl: mocks.importFromUrl,
      deleteFile: mocks.deleteFile,
      deleteFiles: mocks.deleteFiles,
      getDownloadUrl: mocks.getDownloadUrl,
    }),
    useFolders: () => ({
      fetchFolders: mocks.fetchFolders,
      fetchFolder: mocks.fetchFolder,
      createFolder: mocks.createFolder,
      updateFolder: mocks.updateFolder,
      deleteFolder: mocks.deleteFolder,
    }),
    usePermissions: mocks.usePermissions,
  };
});

type Props = React.ComponentProps<typeof FileManager>;

function ui(props: Partial<Props> = {}) {
  return (
    <MantineProvider>
      <FileManager urlParams={false} {...props} />
    </MantineProvider>
  );
}

/** What the permissions hook answers: an administrator, or the listed actions on every collection. */
function grant(actions: string[], isAdmin = false, loading = false) {
  mocks.usePermissions.mockReturnValue({
    canPerform: (_collection: string, action: string) => isAdmin || actions.includes(action),
    isAdmin,
    loading,
  });
}

const listed = () => waitFor(() => expect(screen.getAllByTestId('file-card')).toHaveLength(mockFiles.length));
const png = () => new File(['x'], 'drop.png', { type: 'image/png' });

let show: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mocks.fetchFiles.mockReset().mockResolvedValue({ files: mockFiles, total: mockFiles.length });
  mocks.fetchFolders.mockReset().mockResolvedValue(mockFolders);
  mocks.fetchFolder.mockReset().mockImplementation(async (id: string) => mockFolders.find((f) => f.id === id));
  mocks.uploadFiles.mockReset().mockResolvedValue([mockFiles[0]]);
  mocks.importFromUrl.mockReset().mockResolvedValue(mockFiles[0]);
  mocks.deleteFile.mockReset().mockResolvedValue(undefined);
  mocks.deleteFiles.mockReset().mockResolvedValue(undefined);
  mocks.getDownloadUrl.mockReset().mockResolvedValue('https://example.test/download');
  mocks.createFolder.mockReset().mockResolvedValue({ id: 'f-new', name: 'New', parent: null });
  mocks.updateFolder.mockReset().mockResolvedValue(mockFolders[0]);
  mocks.deleteFolder.mockReset().mockResolvedValue(undefined);
  grant([], true);
  show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
});

afterEach(() => {
  show.mockRestore();
});

describe('FileManager', () => {
  describe('the library', () => {
    it('lists the folders and the files of the root, with the upload zone and New Folder for an administrator', async () => {
      render(ui());
      await listed();
      expect(screen.getAllByTestId('folder-card')).toHaveLength(mockFolders.length);
      expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument();
      expect(screen.getByTestId('files-new-folder')).toBeInTheDocument();
      expect(screen.getByTestId('file-manager-count')).toHaveTextContent('Showing 1–5');
      expect(mocks.fetchFiles).toHaveBeenCalledWith({
        page: 1,
        limit: 24,
        search: undefined,
        filter: { folder: { _null: true } },
      });
      expect(mocks.fetchFolders).toHaveBeenCalledWith({ parent: null });
    });

    it('uploads what is dropped on the zone into the open folder, and lists again', async () => {
      render(ui());
      await listed();
      fireEvent.drop(screen.getByTestId('upload-dropzone'), { dataTransfer: { files: [png()] } });
      await waitFor(() => expect(mocks.uploadFiles).toHaveBeenCalledTimes(1));
      expect(mocks.uploadFiles.mock.calls[0][0]).toHaveLength(1);
      await waitFor(() => expect(mocks.fetchFiles).toHaveBeenCalledTimes(2));
    });

    it('selecting a file shows the bulk bar, and its Delete asks before deleting', async () => {
      render(ui());
      await listed();
      fireEvent.click(screen.getAllByTestId('file-card-checkbox')[0]);
      expect(screen.getByTestId('files-bulk-actions')).toHaveTextContent('1 selected');
      fireEvent.click(screen.getByTestId('files-bulk-delete'));
      expect(await screen.findByText('Are you sure you want to delete 1 file? This action cannot be undone.')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('files-delete-confirm-btn'));
      await waitFor(() => expect(mocks.deleteFiles).toHaveBeenCalledWith([mockFiles[0].id]));
    });

    it('creates a folder in the open folder from the New Folder dialog', async () => {
      render(ui());
      await listed();
      fireEvent.click(screen.getByTestId('files-new-folder'));
      fireEvent.change(await screen.findByTestId('new-folder-name'), { target: { value: 'Campaigns' } });
      fireEvent.click(screen.getByTestId('new-folder-submit'));
      await waitFor(() => expect(mocks.createFolder).toHaveBeenCalledWith({ name: 'Campaigns', parent: null }));
    });

    it('says there is nothing, and how to add, in an empty library', async () => {
      mocks.fetchFiles.mockResolvedValue({ files: [], total: 0 });
      mocks.fetchFolders.mockResolvedValue([]);
      render(ui());
      expect(
        await screen.findByText('No files here yet. Drag files above or use the upload button to get started.'),
      ).toBeInTheDocument();
    });
  });

  describe('permissions', () => {
    it('shows a user with read access the library and nothing that writes', async () => {
      grant(['read']);
      render(ui({ defaultView: 'list' }));
      await waitFor(() => expect(screen.getAllByTestId('files-list-file-row')).toHaveLength(mockFiles.length));
      expect(screen.queryByTestId('upload-component')).not.toBeInTheDocument();
      expect(screen.queryByTestId('files-new-folder')).not.toBeInTheDocument();
      // The row menu keeps Download, without Edit and Delete
      fireEvent.click(screen.getAllByTestId('files-list-row-menu')[0]);
      expect(await screen.findByText('Download')).toBeInTheDocument();
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });

    it('tells a reader of an empty library that there is nothing', async () => {
      grant(['read']);
      mocks.fetchFiles.mockResolvedValue({ files: [], total: 0 });
      mocks.fetchFolders.mockResolvedValue([]);
      render(ui());
      expect(await screen.findByText('No files here yet. No files are available.')).toBeInTheDocument();
    });
  });
});
