/**
 * FileManager unit tests: the library view, its RBAC gates, and what it asks
 * its data hooks for. `@buildpad/hooks` is mocked so no backend is required;
 * the upload zone is the real `Upload` interface from ui-interfaces.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FileUpload, Folder } from '@buildpad/hooks';
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

/** The breadcrumb's first crumb: back to the root of the library. */
const rootCrumb = () => within(screen.getByTestId('folder-breadcrumb')).getByText('Files');
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

    it('Enter pressed again while the folder is being created does not create it twice', async () => {
      let finish!: (folder: Folder) => void;
      mocks.createFolder.mockReturnValue(new Promise<Folder>((resolve) => (finish = resolve)));
      render(ui());
      await listed();
      fireEvent.click(screen.getByTestId('files-new-folder'));
      const name = await screen.findByTestId('new-folder-name');
      fireEvent.change(name, { target: { value: 'Campaigns' } });
      fireEvent.keyDown(name, { key: 'Enter' });
      await waitFor(() => expect(mocks.createFolder).toHaveBeenCalledTimes(1));

      // The request is out, and the key is pressed again (or held)
      fireEvent.keyDown(name, { key: 'Enter' });
      fireEvent.keyDown(name, { key: 'Enter' });
      await act(async () => finish({ id: 'f-new', name: 'Campaigns', parent: null }));
      await waitFor(() => expect(mocks.fetchFiles).toHaveBeenCalledTimes(2));
      expect(mocks.createFolder).toHaveBeenCalledTimes(1);
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

  // The point of these is the COUNT of requests: a search or a folder opened
  // from a later page is one request (the new listing on page 1), not one for
  // the old page of the new listing followed by one for page 1.
  describe('requests from a later page', () => {
    type FileParams = { page?: number; search?: string; folder?: string; filter?: unknown };
    /** What the list asked for since the last `mockClear()`, in order. */
    const fileRequests = () =>
      mocks.fetchFiles.mock.calls.map(([params]: [FileParams]) => ({
        page: params.page,
        search: params.search,
        folder: params.folder,
      }));
    /** Long enough for the 300 ms search debounce and for any request it would start after it. */
    const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 500)));
    /** A full page of two whatever is asked for, so every page of every listing has a next one. */
    const pageOfTwo = async ({ page = 1 }: FileParams) => ({
      files: mockFiles.slice(0, 2).map((file) => ({ ...file, id: `${file.id}-p${page}` })),
      total: 60,
    });
    const inner: Folder = { id: 'f-inner', name: 'Inner', parent: 'f-marketing' };

    /** Lists two files a page and leaves the list on page 2 (of the root, or of what `props` say). */
    async function onPageTwo(props: Partial<Props> = {}) {
      mocks.fetchFiles.mockImplementation(pageOfTwo);
      const view = render(ui({ pageSize: 2, ...props }));
      await waitFor(() => expect(mocks.fetchFiles).toHaveBeenCalledTimes(1));
      fireEvent.click(await screen.findByRole('button', { name: '2' }));
      await waitFor(() => expect(mocks.fetchFiles).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
      await settle();
      mocks.fetchFiles.mockClear();
      mocks.fetchFolders.mockClear();
      return view;
    }

    it('a search typed on page 2 is ONE request: that search, on page 1', async () => {
      await onPageTwo();
      fireEvent.change(screen.getByTestId('files-search'), { target: { value: 'report' } });
      await settle();
      // Not [{ page: 2, search: 'report' }, { page: 1, search: 'report' }]
      expect(fileRequests()).toEqual([{ page: 1, search: 'report', folder: undefined }]);
      expect(mocks.fetchFolders).toHaveBeenCalledTimes(1);
    });

    it('clearing a search on a later page is one request as well', async () => {
      mocks.fetchFiles.mockImplementation(pageOfTwo);
      render(ui({ pageSize: 2 }));
      await waitFor(() => expect(mocks.fetchFiles).toHaveBeenCalledTimes(1));
      fireEvent.change(screen.getByTestId('files-search'), { target: { value: 'report' } });
      await settle();
      fireEvent.click(await screen.findByRole('button', { name: '2' }));
      await waitFor(() =>
        expect(mocks.fetchFiles).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, search: 'report' })),
      );
      await settle();
      mocks.fetchFiles.mockClear();

      fireEvent.change(screen.getByTestId('files-search'), { target: { value: '' } });
      await settle();
      expect(fileRequests()).toEqual([{ page: 1, search: undefined, folder: undefined }]);
    });

    it('a folder opened from page 2 is ONE request: that folder, on page 1', async () => {
      await onPageTwo();
      fireEvent.click(screen.getByText('Marketing'));
      await settle();
      // Not [{ page: 2, folder }, { page: 1, folder }]
      expect(fileRequests()).toEqual([{ page: 1, search: undefined, folder: 'f-marketing' }]);
      expect(mocks.fetchFolders.mock.calls).toEqual([[{ parent: 'f-marketing' }]]);
    });

    it('going back up from page 2 of a folder is one request', async () => {
      mocks.fetchFiles.mockImplementation(pageOfTwo);
      render(ui({ pageSize: 2 }));
      await waitFor(() => expect(mocks.fetchFiles).toHaveBeenCalledTimes(1));
      fireEvent.click(await screen.findByText('Marketing'));
      await waitFor(() =>
        expect(mocks.fetchFiles).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, folder: 'f-marketing' })),
      );
      await settle();
      fireEvent.click(await screen.findByRole('button', { name: '2' }));
      await waitFor(() =>
        expect(mocks.fetchFiles).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, folder: 'f-marketing' })),
      );
      await settle();
      mocks.fetchFiles.mockClear();

      fireEvent.click(rootCrumb());
      await settle();
      expect(fileRequests()).toEqual([{ page: 1, search: undefined, folder: undefined }]);
    });

    it('what is typed sends nothing until the debounce has passed, and keeps the page until then', async () => {
      await onPageTwo();
      // Typed and taken back within the debounce: the list never searched for it
      fireEvent.change(screen.getByTestId('files-search'), { target: { value: 'rep' } });
      fireEvent.change(screen.getByTestId('files-search'), { target: { value: '' } });
      await settle();
      expect(fileRequests()).toEqual([]);
      expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    });

    // With the URL in step (the default) the old page was written back over
    // the reset: the list stayed on page 2 of the new search.
    it('with the URL in step, a search typed on page 2 lands on page 1, in the list and in the URL', async () => {
      window.history.replaceState(null, '', '/');
      try {
        await onPageTwo({ urlParams: true });
        expect(window.location.search).toBe('?page=2');
        fireEvent.change(screen.getByTestId('files-search'), { target: { value: 'report' } });
        await settle();
        expect(fileRequests()).toEqual([{ page: 1, search: 'report', folder: undefined }]);
        expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
        expect(window.location.search).toBe('?search=report');
      } finally {
        window.history.replaceState(null, '', '/');
      }
    });

    it('a folder and a page restored from the URL are one request, and the page is kept', async () => {
      window.history.replaceState(null, '', '/?folder=f-inner&page=2');
      mocks.fetchFiles.mockImplementation(pageOfTwo);
      mocks.fetchFolder.mockImplementation(async (id: string) => (id === inner.id ? inner : mockFolders[0]));
      try {
        render(ui({ pageSize: 2, urlParams: true }));
        await waitFor(() => expect(mocks.fetchFiles).toHaveBeenCalled());
        await settle();
        expect(fileRequests()).toEqual([{ page: 2, search: undefined, folder: 'f-inner' }]);
        expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');

        // Leaving the folder drops the page, in the list and in the URL
        mocks.fetchFiles.mockClear();
        fireEvent.click(rootCrumb());
        await settle();
        expect(fileRequests()).toEqual([{ page: 1, search: undefined, folder: undefined }]);
        expect(window.location.search).toBe('');
      } finally {
        window.history.replaceState(null, '', '/');
      }
    });
  });
});
