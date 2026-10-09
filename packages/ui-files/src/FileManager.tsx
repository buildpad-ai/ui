'use client';

import './FileManager.css';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  useBuildpadTranslations,
  useFiles,
  useFolders,
  usePermissions,
  type FileUpload,
  type Folder,
} from '@buildpad/hooks';
import { interpolate, type DeepPartial, type FilesTranslations } from '@buildpad/utils';
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
  /**
   * Per-instance overrides of the `files` dictionary namespace, forwarded to
   * every sub-component (prop > `BuildpadI18nProvider` > English defaults).
   */
  translations?: DeepPartial<FilesTranslations>;
}

/**
 * Full file-management surface: drag-and-drop upload, import-from-URL,
 * folder navigation, grid/list views, search, selection, and bulk delete.
 * Composes the existing `Upload` interface for the upload affordance and
 * the `useFiles` / `useFolders` hooks for data. Actions are gated by DaaS
 * permissions via `usePermissions`: the upload zone, New Folder, the folder
 * menus, Edit / Delete in a row menu and the bulk bar are drawn once the
 * permissions are known, so they do not flash for a user who has none of
 * them. The library itself does not wait.
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
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.files, translations);
  const { uploadFiles, fetchFiles, importFromUrl, deleteFile, deleteFiles, getDownloadUrl } =
    useFiles();
  const { fetchFolders, fetchFolder, createFolder, updateFolder, deleteFolder } = useFolders();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [filesCollection],
  });

  // No write control until the permissions are known: a reader must not be
  // shown the upload zone (and be able to drop a file on it), New Folder, the
  // folder menus, Edit / Delete in a row menu and the bulk bar for the length
  // of that request. Known once is known: a later refresh (a renewed token,
  // another scope) answers from what was known until its own answer is in, so
  // the controls do not blink and an upload in flight keeps its zone. Admins
  // bypass.
  const permsKnownRef = useRef(false);
  if (!permsLoading) permsKnownRef.current = true;
  const permsKnown = permsKnownRef.current;
  const createAllowed = permsKnown && (isAdmin || canPerform(filesCollection, 'create'));
  const updateAllowed = permsKnown && (isAdmin || canPerform(filesCollection, 'update'));
  const deleteAllowed = permsKnown && (isAdmin || canPerform(filesCollection, 'delete'));

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
  // A page belongs to the search and the folder it was reached under: it is
  // kept with them, and a page kept under another search or folder is page 1.
  // The reset is decided while rendering, not in an effect after it, so the
  // load below sees the new listing and page 1 as one change and sends one
  // request. (An effect ran after the load had already asked for the old page
  // of the new listing; and with the URL in step, the old page was written
  // back over the reset.) A page restored from the URL is kept: it is stored
  // with the listing of the first render.
  const filtersKey = JSON.stringify([debouncedSearch, currentFolder]);
  const [pageState, setPageState] = useState(() => ({
    page: urlParams ? readUrlIntParam(param('page'), 1) : 1,
    filtersKey,
  }));
  let page = pageState.page;
  if (pageState.filtersKey !== filtersKey) {
    page = 1;
    setPageState({ page: 1, filtersKey });
  }
  const setPage = useCallback((next: number) => {
    setPageState((current) => (current.page === next ? current : { ...current, page: next }));
  }, []);
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
    : files.length === pageSize // NOSONAR: idiomatic tri-state ternary, not confusing nesting
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
        ? fetchFolders(searching ? { search: debouncedSearch } : { parent: currentFolder }) // NOSONAR: idiomatic tri-state ternary, not confusing nesting
        : Promise.resolve<Folder[]>([]);

      const [folderRes, fileRes] = await Promise.all([folderPromise, fetchFiles(fileParams)]);

      setFolders(folderRes);

      // Overshot the end (a deletion, or a page from the URL that is not
      // there)? Step back instead of showing an empty page.
      if (fileRes.files.length === 0 && page > 1) {
        setPage(page - 1);
        return;
      }

      setFiles(fileRes.files);
      setTotal(fileRes.total);
    } catch (err) {
      notifications.show({
        color: 'red',
        title: t.fileManager.notifications.loadFailedTitle,
        message: err instanceof Error ? err.message : t.unknownError,
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
    setPage,
    t,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

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
        setPage(nextPage);
      },
      [param, enableFolders, rebuildPath, setPage],
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
          notifications.show({ color: 'green', message: t.fileManager.notifications.folderRenamed });
        } else {
          await createFolder({ name, parent: currentFolder });
          notifications.show({
            color: 'green',
            message: interpolate(t.fileManager.notifications.folderCreated, { name }),
          });
        }
        setFolderDialogOpen(false);
        setRenameTarget(null);
        await load();
      } catch (err) {
        notifications.show({
          color: 'red',
          title: renameTarget
            ? t.fileManager.notifications.renameFolderFailedTitle
            : t.fileManager.notifications.createFolderFailedTitle,
          message: err instanceof Error ? err.message : t.unknownError,
        });
      } finally {
        setFolderSaving(false);
      }
    },
    [renameTarget, updateFolder, createFolder, currentFolder, load, t]
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
        notifications.show({ color: 'green', message: t.fileManager.notifications.folderDeleted });
      } else if (filePendingDelete) {
        await deleteFile(filePendingDelete.id);
        notifications.show({ color: 'green', message: t.fileManager.notifications.fileDeleted });
      } else {
        await deleteFiles([...selectedIds]);
        notifications.show({ color: 'green', message: t.fileManager.notifications.filesDeleted });
        setSelectedIds(new Set());
      }
      setDeleteOpen(false);
      setFolderPendingDelete(null);
      setFilePendingDelete(null);
      await load();
    } catch (err) {
      notifications.show({
        color: 'red',
        title: t.fileManager.notifications.deleteFailedTitle,
        message: err instanceof Error ? err.message : t.unknownError,
      });
    } finally {
      setDeleting(false);
    }
  }, [folderPendingDelete, filePendingDelete, deleteFolder, deleteFile, deleteFiles, selectedIds, load, t]);

  const handleRowDownload = useCallback(
    async (file: FileUpload) => {
      try {
        const url = await getDownloadUrl(file.id);
        window.open(url, '_blank', 'noopener');
      } catch {
        notifications.show({ color: 'red', message: t.fileManager.notifications.downloadFailed });
      }
    },
    [getDownloadUrl, t]
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
            notifications.show({ color: 'green', message: t.fileManager.notifications.uploadComplete });
            void load();
          }}
        />
      ) : null,
    [createAllowed, currentFolder, uploadFiles, importFromUrl, load, t]
  );

  const isEmpty = !listLoading && folders.length === 0 && files.length === 0;
  const deleteCount = folderPendingDelete || filePendingDelete ? 1 : selectedIds.size;
  const deleteNoun = folderPendingDelete ? 'folder' : 'file';

  return (
    <Stack gap="md" className="bp-file-manager" data-testid="file-manager">
      {enableFolders && (
        <FolderBreadcrumb path={path} onNavigate={navigateTo} translations={translations} />
      )}

      <FilesToolbar
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
        onNewFolder={enableFolders && createAllowed ? openCreateFolder : undefined}
        translations={translations}
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
            translations={translations}
          />
        </Paper>
      )}

      {listLoading ? (
        <Center mih={240}>
          <Loader />
        </Center>
      ) : isEmpty ? ( // NOSONAR: idiomatic loading/empty/view-mode JSX ladder, not confusing nesting
        <Center mih={200}>
          <Text c="dimmed" size="sm">
            {t.fileManager.emptyState.title}
            {/* Neither hint before the permissions are known: nobody is
                promised an upload, or called a reader, before the answer */}
            {permsKnown && ' '}
            {permsKnown &&
              (createAllowed
                ? t.fileManager.emptyState.uploadHint
                : t.fileManager.emptyState.readOnlyHint)}
          </Text>
        </Center>
      ) : view === 'grid' ? ( // NOSONAR: idiomatic loading/empty/view-mode JSX ladder, not confusing nesting
        <FilesGrid
          folders={folders}
          files={files}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onOpenFolder={openFolder}
          onOpenFile={(file) => onFileClick?.(file)}
          onRenameFolder={enableFolders && updateAllowed ? openRenameFolder : undefined}
          onDeleteFolder={enableFolders && deleteAllowed ? requestFolderDelete : undefined}
          translations={translations}
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
          translations={translations}
        />
      )}

      {files.length > 0 && (
        <Group justify="space-between" wrap="wrap" gap="sm">
          {/* The total is omitted while filtering — see the totalPages note. */}
          <Text size="xs" c="dimmed" data-testid="file-manager-count">
            {totalIsTrustworthy
              ? interpolate(t.fileManager.pagination.showingOfTotal, {
                  from: (page - 1) * pageSize + 1,
                  to: Math.min(page * pageSize, total),
                  total,
                })
              : interpolate(t.fileManager.pagination.showingRange, {
                  from: (page - 1) * pageSize + 1,
                  to: (page - 1) * pageSize + files.length,
                })}
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
        title={
          renameTarget ? t.fileManager.folderDialog.renameTitle : t.fileManager.folderDialog.createTitle
        }
        submitLabel={
          renameTarget ? t.fileManager.folderDialog.renameSubmit : t.fileManager.folderDialog.createSubmit
        }
        onSubmit={handleFolderSubmit}
        onClose={() => {
          setFolderDialogOpen(false);
          setRenameTarget(null);
        }}
        translations={translations}
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
        translations={translations}
      />
    </Stack>
  );
};

export default FileManager;
