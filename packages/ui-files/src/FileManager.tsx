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
}

/**
 * Full file-management surface: drag-and-drop upload, import-from-URL,
 * folder navigation, grid/list views, search, selection, and bulk delete.
 * Composes the existing `Upload` interface for the upload affordance and
 * the `useFiles` / `useFolders` hooks for data. Actions are gated by DaaS
 * permissions via `usePermissions`.
 */
export const FileManager: React.FC<FileManagerProps> = ({
  onFileClick,
  pageSize = 24,
  defaultView = 'grid',
  enableFolders = true,
  filesCollection = 'daas_files',
}) => {
  const { uploadFiles, fetchFiles, importFromUrl, deleteFile, deleteFiles, getDownloadUrl } =
    useFiles();
  const { fetchFolders, createFolder, updateFolder, deleteFolder } = useFolders();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [filesCollection],
  });

  // Optimistic while permissions resolve, then enforce; admins bypass.
  const createAllowed = permsLoading || isAdmin || canPerform(filesCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(filesCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(filesCollection, 'delete');

  const [view, setView] = useState<FilesView>(defaultView);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);

  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [path, setPath] = useState<FolderPathItem[]>([]);

  const [files, setFiles] = useState<FileUpload[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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

  // Reset to first page whenever the search term or folder changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, currentFolder]);

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

      {totalPages > 1 && (
        <Group justify="center">
          <Pagination value={page} onChange={setPage} total={totalPages} />
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
