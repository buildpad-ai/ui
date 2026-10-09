/**
 * FileManager unit tests: the library view, its RBAC gates, and what it asks
 * its data hooks for. `@buildpad/hooks` is mocked so no backend is required;
 * the upload zone is the real `Upload` interface from ui-interfaces.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FileUpload } from '@buildpad/hooks';
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

  describe('while the permissions are not known', () => {
    it('draws no write control while permissions load, and the allowed ones once they are known', async () => {
      // What a user who will turn out to be an administrator gets meanwhile
      grant([], true, true);
      const onFileClick = vi.fn();
      const view = render(ui({ onFileClick }));
      await listed();

      // No upload zone, so nothing to drop a file on, and no New Folder
      expect(screen.queryByTestId('upload-component')).not.toBeInTheDocument();
      expect(screen.queryByTestId('upload-dropzone')).not.toBeInTheDocument();
      expect(screen.queryByTestId('files-new-folder')).not.toBeInTheDocument();
      // No folder menu (Rename, Delete)
      expect(screen.queryByTestId('folder-card-menu')).not.toBeInTheDocument();
      // A selection has no bulk Delete yet
      fireEvent.click(screen.getAllByTestId('file-card-checkbox')[0]);
      expect(screen.queryByTestId('files-bulk-actions')).not.toBeInTheDocument();
      expect(screen.queryByTestId('files-bulk-delete')).not.toBeInTheDocument();
      // Reading does not wait: the folders and the files are there, and a file opens
      expect(screen.getAllByTestId('folder-card')).toHaveLength(mockFolders.length);
      fireEvent.click(screen.getByText('annual-report.pdf'));
      expect(onFileClick).toHaveBeenCalledWith(mockFiles[1]);

      grant([], true);
      view.rerender(ui({ onFileClick }));
      expect(await screen.findByTestId('upload-dropzone')).toBeInTheDocument();
      expect(screen.getByTestId('files-new-folder')).toBeInTheDocument();
      expect(screen.getAllByTestId('folder-card-menu')).toHaveLength(mockFolders.length);
      // The selection made meanwhile gets its bulk bar
      expect(screen.getByTestId('files-bulk-delete')).toBeInTheDocument();
      // The library was loaded once: the permissions arriving do not fetch it again
      expect(mocks.fetchFiles).toHaveBeenCalledTimes(1);
      expect(mocks.fetchFolders).toHaveBeenCalledTimes(1);
    });

    it('the list view has no Edit or Delete in its row menu until then', async () => {
      grant([], true, true);
      const view = render(ui({ defaultView: 'list' }));
      await waitFor(() => expect(screen.getAllByTestId('files-list-file-row')).toHaveLength(mockFiles.length));
      fireEvent.click(screen.getAllByTestId('files-list-row-menu')[0]);
      expect(await screen.findByText('Download')).toBeInTheDocument();
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();

      grant([], true);
      view.rerender(ui({ defaultView: 'list' }));
      expect(await screen.findByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('a reader is never shown a write control, not even while permissions load', async () => {
      grant([], false, true);
      const view = render(ui());
      await listed();
      expect(screen.queryByTestId('upload-dropzone')).not.toBeInTheDocument();
      expect(screen.queryByTestId('files-new-folder')).not.toBeInTheDocument();
      expect(screen.queryByTestId('folder-card-menu')).not.toBeInTheDocument();

      grant(['read']);
      view.rerender(ui());
      expect(screen.getAllByTestId('file-card')).toHaveLength(mockFiles.length);
      expect(screen.queryByTestId('upload-dropzone')).not.toBeInTheDocument();
      expect(screen.queryByTestId('files-new-folder')).not.toBeInTheDocument();
      expect(screen.queryByTestId('folder-card-menu')).not.toBeInTheDocument();
      expect(mocks.uploadFiles).not.toHaveBeenCalled();
    });

    it('an empty library calls nobody a reader, and promises nobody an upload, before the answer is in', async () => {
      grant([], false, true);
      mocks.fetchFiles.mockResolvedValue({ files: [], total: 0 });
      mocks.fetchFolders.mockResolvedValue([]);
      const view = render(ui());
      expect(await screen.findByText('No files here yet.')).toBeInTheDocument();
      expect(screen.queryByText(/No files are available/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Drag files above/)).not.toBeInTheDocument();

      grant(['read', 'create']);
      view.rerender(ui());
      expect(
        await screen.findByText('No files here yet. Drag files above or use the upload button to get started.'),
      ).toBeInTheDocument();
    });

    it('a later refresh of the permissions does not take the controls away, or an upload in flight', async () => {
      let finish!: (files: FileUpload[]) => void;
      mocks.uploadFiles.mockReturnValue(new Promise<FileUpload[]>((resolve) => (finish = resolve)));
      const view = render(ui());
      await listed();
      fireEvent.click(screen.getAllByTestId('file-card-checkbox')[0]);
      fireEvent.drop(screen.getByTestId('upload-dropzone'), { dataTransfer: { files: [png()] } });
      await waitFor(() => expect(mocks.uploadFiles).toHaveBeenCalledTimes(1));

      // The hook loads again (a renewed token, another scope) and answers from what it knew meanwhile
      grant([], true, true);
      view.rerender(ui());
      expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument();
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
      expect(screen.getByTestId('files-new-folder')).toBeInTheDocument();
      expect(screen.getAllByTestId('folder-card-menu')).toHaveLength(mockFolders.length);
      expect(screen.getByTestId('files-bulk-delete')).toBeInTheDocument();

      // The upload that was out is still the zone's to finish
      await act(async () => finish([mockFiles[0]]));
      await waitFor(() => expect(mocks.fetchFiles).toHaveBeenCalledTimes(2));
    });
  });
});
