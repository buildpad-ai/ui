'use client';

import './FileManager.css';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Center,
  Group,
  Loader,
  Pagination,
  Paper,
  Progress,
  Stack,
  Text,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { readUrlIntParam, readUrlParam, useHydrated, useUrlListParams } from '@buildpad/hooks';
import { notifications } from '@mantine/notifications';
import {
  useFiles,
  useFolders,
  usePermissions,
  type FileUpload,
  type Folder,
} from '@buildpad/hooks';
import { Upload } from '@buildpad/ui-interfaces/upload';
import { FilesToolbar, type FilesView } from './FilesToolbar';
import { FolderBreadcrumb, type FolderPathItem } from './FolderBreadcrumb';
import { FilesGrid } from './FilesGrid';
import { FilesList } from './FilesList';
import { BulkActionsBar } from './BulkActionsBar';
import { NewFolderDialog } from './NewFolderDialog';
import { DeleteConfirmModal } from './DeleteConfirmModal';

export interface FileManagerProps {
  /** Called when a file is opened (e.g. to navigate to its detail page). */
  onFileClick?: (file: FileUpload) => void;
  /** Items per page for the file list. */
  pageSize?: number;
  /** Initial view mode. */
  defaultView?: FilesView;
  /** Enable folder organization. */
  enableFolders?: boolean;
  /** DaaS collection used for RBAC checks. */
  filesCollection?: string;
  /**
   * Persist search, the open folder, and the page in the URL query string
   * (`?search=…&folder=…&page=…`) so the library view is shareable and
   * reload-safe. Writes ride the existing 300 ms search debounce and go through
   * the app's registered URL writer (Next.js App Router: `router.replace`,
   * registered by the `DaaSProviderWrapper` template — required there);
   * outside a router they fall back to `history.replaceState`. Set `false` for embedded surfaces. Default: true.
   */
  urlParams?: boolean;
  /** Prefix for the managed URL parameters when two lists share a page. Default: ''. */
  urlParamPrefix?: string;
}

/**
 * Full file-management surface: drag-and-drop upload, import-from-URL,
 * folder navigation, grid/list views, search, selection, and bulk delete.
 * Composes the existing `Upload` interface for the upload affordance and
 * the `useFiles` / `useFolders` hooks for data. Actions are gated by DaaS
 * permissions via `usePermissions`.
 */
/**
 * Client-only gate. The body seeds its state from the URL in `useState`
 * initializers, which renders differently on the server (no URL) and on the
 * client — a hydration mismatch on every deep link. Until hydrated, render the
 * same loading shell the body shows before its first fetch, so server HTML and
 * the hydration render agree; the body then mounts once with the URL in hand.
 * Skipped when URL persistence is off, since then initial state is
 * URL-independent and the body can server-render as before.
 */
export const FileManager: React.FC<FileManagerProps> = (props) => {
  const hydrated = useHydrated();
  if (props.urlParams !== false && !hydrated) {
    return (
      <Center mih={240}>
        <Loader />
      </Center>
    );
  }
  return <FileManagerBody {...props} />;
};

const FileManagerBody: React.FC<FileManagerProps> = ({
  onFileClick,
  pageSize = 24,
  defaultView = 'grid',
  enableFolders = true,
  filesCollection = 'daas_files',
  urlParams = true,
  urlParamPrefix = '',
}) => {
  const { uploadFiles, fetchFiles, importFromUrl, deleteFile, deleteFiles, getDownloadUrl } =
    useFiles();
  const { fetchFolders, fetchFolder, createFolder, updateFolder, deleteFolder } = useFolders();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [filesCollection],
  });

  // Optimistic while permissions resolve, then enforce; admins bypass.
  const createAllowed = permsLoading || isAdmin || canPerform(filesCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(filesCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(filesCollection, 'delete');

  const param = useCallback((name: string) => urlParamPrefix + name, [urlParamPrefix]);

  const [view, setView] = useState<FilesView>(defaultView);
  const [search, setSearch] = useState(() => (urlParams ? (readUrlParam(param('search')) ?? '') : ''));
  const [debouncedSearch] = useDebouncedValue(search, 300);

  // A folder from the URL arrives as a bare id; its breadcrumb path is
  // reconstructed by the effect below once fetchFolder can walk the parents.
  const [currentFolder, setCurrentFolder] = useState<string | null>(() =>
    urlParams && enableFolders ? readUrlParam(param('folder')) : null,
  );
  const [path, setPath] = useState<FolderPathItem[]>([]);

  const [files, setFiles] = useState<FileUpload[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => (urlParams ? readUrlIntParam(param('page'), 1) : 1));
  const [listLoading, setListLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Folder dialog (create + rename share one dialog).
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderSaving, setFolderSaving] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Folder | null>(null);

  // Deletion (bulk files, single file, or a folder share one confirm modal).
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [folderPendingDelete, setFolderPendingDelete] = useState<Folder | null>(null);
  const [filePendingDelete, setFilePendingDelete] = useState<FileUpload | null>(null);

  /**
   * DaaS cannot report a *filtered* total: `meta.total_count` is always the
   * unfiltered collection count, `meta.filter_count` only ever reflects the rows
   * in the current page, and `aggregate[count]` is ignored. So `total` is only
   * meaningful when nothing narrows the query — and note that with folders
   * enabled even the root listing is narrowed (`folder._null`).
   *
   * Trusting it produced phantom pages: searching a 32-file library for ".md"
   * returns 18 rows, yet `total_count` 32 over a 24-row page rendered a second
   * page that was always empty.
   *
   * So the page count is derived from what we can actually observe: a full page
   * implies at least one more, a short page means this is the last one. The
   * pager can therefore understate how many pages exist until you walk forward,
   * but it never offers a page that isn't there.
   */
  const totalIsTrustworthy = !debouncedSearch && !currentFolder && !enableFolders;
  const totalPages = totalIsTrustworthy
    ? Math.max(1, Math.ceil(total / pageSize))
    : files.length === pageSize
      ? page + 1
      : page;

  const load = useCallback(async () => {
    setListLoading(true);
    try {
      const searching = Boolean(debouncedSearch);

      const fileParams: Parameters<typeof fetchFiles>[0] = {
        page,
        limit: pageSize,
        search: searching ? debouncedSearch : undefined,
      };
      if (!searching) {
        if (currentFolder) fileParams.folder = currentFolder;
        else if (enableFolders) fileParams.filter = { folder: { _null: true } };
      }

      const folderPromise = enableFolders
        ? fetchFolders(searching ? { search: debouncedSearch } : { parent: currentFolder })
        : Promise.resolve<Folder[]>([]);

      const [folderRes, fileRes] = await Promise.all([folderPromise, fetchFiles(fileParams)]);

      setFolders(folderRes);

      // Overshot the end (deletion, or a stale page after a filter change)?
      // Step back instead of showing an empty page.
      if (fileRes.files.length === 0 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
        return;
      }

      setFiles(fileRes.files);
      setTotal(fileRes.total);
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Failed to load files',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setListLoading(false);
    }
  }, [
    currentFolder,
    debouncedSearch,
    page,
    pageSize,
    enableFolders,
    fetchFiles,
    fetchFolders,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset to first page whenever the search term or folder CHANGES — not on
  // mount, or a ?page=2 restored from the URL would be clobbered.
  // StrictMode-safe: compare against the previous values rather than "has
  // mounted". StrictMode re-runs mount effects with refs intact, so a
  // has-mounted flag fires setPage(1) on the second run and clobbers a
  // ?page= restored from the URL in development.
  const filtersKey = JSON.stringify([debouncedSearch, currentFolder]);
  const previousFiltersKeyRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (previousFiltersKeyRef.current !== null && previousFiltersKeyRef.current !== filtersKey) {
      setPage(1);
    }
    previousFiltersKeyRef.current = filtersKey;
  }, [filtersKey]);

  /**
   * Rebuild the breadcrumb for a folder that arrived as a bare id (deep link,
   * Back/Forward, or a bridge-driven URL rewrite) by walking `parent` links.
   * An unreadable folder (deleted, or no permission) falls back to the root
   * rather than stranding the view.
   */
  // Latest folder as of the last render, for event-time reads and for
  // discarding a rebuild that finishes after the user has moved on.
  const currentFolderRef = React.useRef(currentFolder);
  currentFolderRef.current = currentFolder;

  const rebuildPath = useCallback(
    async (folderId: string) => {
      try {
        const chain: FolderPathItem[] = [];
        let cursor: string | null = folderId;
        for (let depth = 0; cursor && depth < 15; depth += 1) {
          const folder = await fetchFolder(cursor);
          chain.unshift({ id: folder.id, name: folder.name });
          cursor = folder.parent;
        }
        if (currentFolderRef.current !== folderId) return; // superseded meanwhile
        setPath(chain);
      } catch {
        if (currentFolderRef.current !== folderId) return;
        setPath([]);
        setCurrentFolder(null);
      }
    },
    [fetchFolder],
  );

  // The URL-restored folder has no path yet; rebuild it once on mount.
  const initialFolderRef = React.useRef(currentFolder);
  useEffect(() => {
    if (initialFolderRef.current) void rebuildPath(initialFolderRef.current);
  }, [rebuildPath]);

  // Keep the URL following the settled state, and the state following the URL
  // on Back/Forward or a bridge-driven rewrite (see useUrlListParams).
  useUrlListParams({
    enabled: urlParams,
    params: {
      [param('search')]: debouncedSearch || null,
      [param('folder')]: enableFolders ? currentFolder : null,
      [param('page')]: page > 1 ? String(page) : null,
    },
    onExternalChange: useCallback(
      (get: (name: string) => string | null) => {
        const nextSearch = get(param('search')) ?? '';
        setSearch((current) => (current === nextSearch ? current : nextSearch));

        if (enableFolders) {
          const nextFolder = get(param('folder'));
          // Compare against the ref, not inside a setState updater: updaters
          // must be pure (StrictMode double-invokes them), and this one
          // kicks off a fetch chain.
          if (currentFolderRef.current !== nextFolder) {
            setCurrentFolder(nextFolder);
            if (nextFolder) void rebuildPath(nextFolder);
            else setPath([]);
          }
        }

        const rawPage = get(param('page'));
        const nextPage = (() => {
          const value = rawPage ? Number.parseInt(rawPage, 10) : 1;
          return Number.isInteger(value) && value > 0 ? value : 1;
        })();
        setPage((current) => (current === nextPage ? current : nextPage));
      },
      [param, enableFolders, rebuildPath],
    ),
  });

  const openFolder = useCallback((folder: Folder) => {
    setPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setCurrentFolder(folder.id);
    setSelectedIds(new Set());
  }, []);

  const navigateTo = useCallback((folderId: string | null) => {
    if (folderId === null) {
      setPath([]);
      setCurrentFolder(null);
    } else {
      setPath((prev) => {
        const idx = prev.findIndex((p) => p.id === folderId);
        return idx >= 0 ? prev.slice(0, idx + 1) : prev;
      });
      setCurrentFolder(folderId);
    }
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set(files.map((f) => f.id)) : new Set());
    },
    [files]
  );

  const openCreateFolder = useCallback(() => {
    setRenameTarget(null);
    setFolderDialogOpen(true);
  }, []);

  const openRenameFolder = useCallback((folder: Folder) => {
    setRenameTarget(folder);
    setFolderDialogOpen(true);
  }, []);

  const handleFolderSubmit = useCallback(
    async (name: string) => {
      setFolderSaving(true);
      try {
        if (renameTarget) {
          await updateFolder(renameTarget.id, { name });
          notifications.show({ color: 'green', message: 'Folder renamed' });
        } else {
          await createFolder({ name, parent: currentFolder });
          notifications.show({ color: 'green', message: `Folder “${name}” created` });
        }
        setFolderDialogOpen(false);
        setRenameTarget(null);
        await load();
      } catch (err) {
        notifications.show({
          color: 'red',
          title: renameTarget ? 'Could not rename folder' : 'Could not create folder',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setFolderSaving(false);
      }
    },
    [renameTarget, updateFolder, createFolder, currentFolder, load]
  );

  const requestBulkDelete = useCallback(() => {
    setFolderPendingDelete(null);
    setFilePendingDelete(null);
    setDeleteOpen(true);
  }, []);

  const requestFolderDelete = useCallback((folder: Folder) => {
    setFolderPendingDelete(folder);
    setFilePendingDelete(null);
    setDeleteOpen(true);
  }, []);

  const requestFileDelete = useCallback((file: FileUpload) => {
    setFilePendingDelete(file);
    setFolderPendingDelete(null);
    setDeleteOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleting(true);
    try {
      if (folderPendingDelete) {
        await deleteFolder(folderPendingDelete.id);
        notifications.show({ color: 'green', message: 'Folder deleted' });
      } else if (filePendingDelete) {
        await deleteFile(filePendingDelete.id);
        notifications.show({ color: 'green', message: 'File deleted' });
      } else {
        await deleteFiles([...selectedIds]);
        notifications.show({ color: 'green', message: 'Files deleted' });
        setSelectedIds(new Set());
      }
      setDeleteOpen(false);
      setFolderPendingDelete(null);
      setFilePendingDelete(null);
      await load();
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Delete failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setDeleting(false);
    }
  }, [folderPendingDelete, filePendingDelete, deleteFolder, deleteFile, deleteFiles, selectedIds, load]);

  const handleRowDownload = useCallback(
    async (file: FileUpload) => {
      try {
        const url = await getDownloadUrl(file.id);
        window.open(url, '_blank', 'noopener');
      } catch {
        notifications.show({ color: 'red', message: 'Could not start download' });
      }
    },
    [getDownloadUrl]
  );

  const uploadAffordance = useMemo(
    () =>
      createAllowed ? (
        <Upload
          multiple
          fromUser
          fromUrl
          fromLibrary={false}
          folder={currentFolder ?? undefined}
          onUploadFiles={(filesToUpload) =>
            uploadFiles(filesToUpload, {
              folder: currentFolder ?? undefined,
              onProgress: (p) => setUploadProgress(p),
            })
          }
          onImportFromUrl={(url) => importFromUrl(url, { folder: currentFolder ?? undefined })}
          onInput={() => {
            setUploadProgress(null);
            notifications.show({ color: 'green', message: 'Upload complete' });
            void load();
          }}
        />
      ) : null,
    [createAllowed, currentFolder, uploadFiles, importFromUrl, load]
  );

  const isEmpty = !listLoading && folders.length === 0 && files.length === 0;
  const deleteCount = folderPendingDelete || filePendingDelete ? 1 : selectedIds.size;
  const deleteNoun = folderPendingDelete ? 'folder' : 'file';

  return (
    <Stack gap="md" className="bp-file-manager" data-testid="file-manager">
      {enableFolders && <FolderBreadcrumb path={path} onNavigate={navigateTo} />}

      <FilesToolbar
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
        onNewFolder={enableFolders && createAllowed ? openCreateFolder : undefined}
      />

      {uploadAffordance && (
        <Box className="bp-file-manager__upload">
          {uploadAffordance}
          {uploadProgress !== null && (
            <Progress value={uploadProgress} mt="xs" size="sm" animated />
          )}
        </Box>
      )}

      {deleteAllowed && selectedIds.size > 0 && (
        <Paper withBorder p="xs" radius="md" className="bp-file-manager__bulk">
          <BulkActionsBar
            count={selectedIds.size}
            deleting={deleting}
            onDelete={requestBulkDelete}
            onClear={() => setSelectedIds(new Set())}
          />
        </Paper>
      )}

      {listLoading ? (
        <Center mih={240}>
          <Loader />
        </Center>
      ) : isEmpty ? (
        <Center mih={200}>
          <Text c="dimmed" size="sm">
            No files here yet.{' '}
            {createAllowed
              ? 'Drag files above or use the upload button to get started.'
              : 'No files are available.'}
          </Text>
        </Center>
      ) : view === 'grid' ? (
        <FilesGrid
          folders={folders}
          files={files}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onOpenFolder={openFolder}
          onOpenFile={(file) => onFileClick?.(file)}
          onRenameFolder={enableFolders && updateAllowed ? openRenameFolder : undefined}
          onDeleteFolder={enableFolders && deleteAllowed ? requestFolderDelete : undefined}
        />
      ) : (
        <FilesList
          folders={folders}
          files={files}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleAll={toggleSelectAll}
          onOpenFolder={openFolder}
          onOpenFile={(file) => onFileClick?.(file)}
          onDownloadFile={handleRowDownload}
          onDeleteFile={requestFileDelete}
          canUpdate={updateAllowed}
          canDelete={deleteAllowed}
        />
      )}

      {files.length > 0 && (
        <Group justify="space-between" wrap="wrap" gap="sm">
          {/* The total is omitted while filtering — see the totalPages note. */}
          <Text size="xs" c="dimmed" data-testid="file-manager-count">
            {totalIsTrustworthy
              ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
              : `Showing ${(page - 1) * pageSize + 1}–${(page - 1) * pageSize + files.length}`}
          </Text>
          {totalPages > 1 && (
            <Pagination
              value={page}
              onChange={setPage}
              total={totalPages}
              data-testid="file-manager-pagination"
            />
          )}
        </Group>
      )}

      <NewFolderDialog
        opened={folderDialogOpen}
        loading={folderSaving}
        initialName={renameTarget?.name ?? ''}
        title={renameTarget ? 'Rename Folder' : 'New Folder'}
        submitLabel={renameTarget ? 'Rename' : 'Create'}
        onSubmit={handleFolderSubmit}
        onClose={() => {
          setFolderDialogOpen(false);
          setRenameTarget(null);
        }}
      />

      <DeleteConfirmModal
        opened={deleteOpen}
        count={deleteCount}
        loading={deleting}
        noun={deleteNoun}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteOpen(false);
          setFolderPendingDelete(null);
          setFilePendingDelete(null);
        }}
      />
    </Stack>
  );
};

export default FileManager;
