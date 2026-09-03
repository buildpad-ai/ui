import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Group, Stack, Text, Paper, Badge, Tooltip, Pagination, Menu, ActionIcon, Loader } from '@mantine/core';
import { IconTrash, IconDownload, IconExternalLink, IconDotsVertical, IconUpload, IconFolderOpen } from '@tabler/icons-react';
import { FileThumbnail, LibraryPickerModal, type FileUpload } from '../upload';
import '../upload/Upload.css';
import { daasAPI, type DaaSFile } from '@buildpad/hooks';
import { useFiles, useFolders } from '@buildpad/hooks';
import { isNewItem, type DeepPartial, type InterfacesTranslations } from '@buildpad/utils';
import { useBuildpadTranslations } from '@buildpad/services';

/**
 * Convert DaaSFile to FileUpload type (adds fallback for nullable fields)
 */
function toFileUpload(file: DaaSFile): FileUpload {
  return {
    id: file.id,
    filename_download: file.filename_download,
    filename_disk: file.filename_disk || file.filename_download,
    type: file.type || 'application/octet-stream',
    filesize: file.filesize,
    width: file.width ?? undefined,
    height: file.height ?? undefined,
    title: file.title ?? undefined,
    description: file.description ?? undefined,
    folder: file.folder ?? undefined,
    uploaded_on: file.uploaded_on || new Date().toISOString(),
    uploaded_by: file.uploaded_by || 'unknown',
    modified_on: file.modified_on,
  };
}

export interface FilesProps {
  value?: Array<string | FileUpload> | null;
  onChange?: (value: Array<string> | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  /**
   * camelCase alias for `readonly`. This is the casing @buildpad/ui-form passes,
   * so it must be accepted here or the read-only affordances are unreachable.
   */
  readOnly?: boolean;
  enableCreate?: boolean;
  enableSelect?: boolean;
  folder?: string;
  limit?: number;
  collection?: string;
  field?: string;
  /** Primary key of the parent item - used to fetch junction table data for M2M */
  primaryKey?: string | number;
  /** Junction table configuration - if provided, fetches files from junction table */
  junctionConfig?: {
    junctionCollection: string;
    junctionFieldCurrent: string;
    junctionFieldRelated: string;
  };
  /** Per-instance overrides of the dictionary strings (`interfaces.files`) */
  translations?: DeepPartial<InterfacesTranslations['files']>;
}

export const Files: React.FC<FilesProps> = ({
  value,
  onChange,
  label,
  placeholder,
  disabled = false,
  readonly: readonlyProp = false,
  readOnly: readOnlyProp = false,
  enableCreate = true,
  enableSelect = true,
  folder,
  limit = 15,
  collection,
  field,
  primaryKey,
  junctionConfig,
  translations,
}) => {
  // Accept either casing — @buildpad/ui-form passes camelCase `readOnly`.
  const readonly = readonlyProp || readOnlyProp;
  const t = useBuildpadTranslations((d) => d.interfaces.files, translations);
  // Local state for hydrated files
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [junctionLoaded, setJunctionLoaded] = useState(false);
  
  // Library picker state (search/pagination live inside LibraryPickerModal)
  const [libraryOpen, setLibraryOpen] = useState(false);
  
  // Permissions
  const [createAllowed, setCreateAllowed] = useState(true);
  const [selectAllowed, setSelectAllowed] = useState(true);
  const [deleteAllowed, setDeleteAllowed] = useState(true);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hydratedIdsRef = useRef<Set<string>>(new Set());

  // API hooks
  const { uploadFiles, fetchFiles } = useFiles();
  const { fetchFolders } = useFolders();

  // Extract file ID from various formats (string, object, junction table format)
  const extractFileId = useCallback((item: unknown): string | null => {
    if (!item) return null;
    if (typeof item === 'string') return item;
    if (typeof item === 'number') return String(item);
    if (typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      // Junction table format: { daas_files_id: 'file-id' }
      if (obj.daas_files_id) {
        if (typeof obj.daas_files_id === 'string') return obj.daas_files_id;
        if (typeof obj.daas_files_id === 'object' && obj.daas_files_id) {
          return (obj.daas_files_id as Record<string, unknown>).id as string;
        }
      }
      // Direct format: { id: 'file-id' }
      if (obj.id) return obj.id as string;
    }
    return null;
  }, []);

  // Check if item is already a hydrated file object
  const isHydratedFile = useCallback((item: unknown): item is FileUpload => {
    if (!item || typeof item !== 'object') return false;
    const obj = item as Record<string, unknown>;
    return !!(obj.id && (obj.filename_download || obj.filename_disk));
  }, []);

  // Fetch files from junction table when we have a primaryKey and junction config
  useEffect(() => {
    // Only fetch if we have the necessary info and haven't loaded yet
    if (isNewItem(primaryKey) || junctionLoaded) {
      return;
    }

    // Try to infer junction config from field name if not provided
    // Convention: {collection}_daas_files (e.g., interfaces_daas_files)
    const jc = junctionConfig || (collection && field ? {
      junctionCollection: `${collection}_daas_files`,
      junctionFieldCurrent: `${collection}_id`,
      junctionFieldRelated: 'daas_files_id',
    } : null);

    if (!jc) return;

    const fetchJunctionFiles = async () => {
      setLoading(true);
      try {
        // Fetch junction table records for this item
        const junctionData = await daasAPI.getItems<Record<string, unknown>>(jc.junctionCollection, {
          filter: { [jc.junctionFieldCurrent]: { _eq: primaryKey } },
          limit: 100,
        });
        
        if (!junctionData || junctionData.length === 0) {
          setFiles([]);
          setJunctionLoaded(true);
          return;
        }

        // Extract file IDs from junction records
        const fileIds = junctionData
          .map((j: Record<string, unknown>) => extractFileId(j))
          .filter(Boolean) as string[];

        if (fileIds.length === 0) {
          setFiles([]);
          setJunctionLoaded(true);
          return;
        }

        // Fetch actual file data
        const hydratedFiles: FileUpload[] = [];
        for (const fileId of fileIds) {
          try {
            const file = await daasAPI.getFile(fileId);
            if (file) {
              hydratedFiles.push(toFileUpload(file));
              hydratedIdsRef.current.add(fileId);
            }
          } catch (err) {
            console.error('Failed to fetch file:', fileId, err);
          }
        }

        setFiles(hydratedFiles);
        setJunctionLoaded(true);

        // Notify parent of the loaded values (file IDs)
        if (onChange && hydratedFiles.length > 0) {
          onChange(hydratedFiles.map(f => f.id));
        }
      } catch (err) {
        console.error('Failed to fetch junction files:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchJunctionFiles();
  }, [primaryKey, collection, field, junctionConfig, junctionLoaded, extractFileId, onChange]);

  // Hydrate value to FileUpload[] - runs when value prop changes
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const arr = Array.isArray(value) ? value : [];
      
      if (arr.length === 0) {
        // Don't clear files if we haven't loaded junction data yet
        if (junctionLoaded || isNewItem(primaryKey)) {
          setFiles([]);
          hydratedIdsRef.current.clear();
        }
        return;
      }

      // Check if we need to hydrate
      const currentIds = arr.map(extractFileId).filter(Boolean) as string[];
      
      // If all IDs are already hydrated, skip
      const allHydrated = currentIds.every(id => hydratedIdsRef.current.has(id));
      if (allHydrated && files.length === currentIds.length) {
        return;
      }

      setLoading(true);

      try {
        const results: FileUpload[] = [];

        for (const item of arr) {
          // If already hydrated, use it directly
          if (isHydratedFile(item)) {
            results.push(item);
            hydratedIdsRef.current.add(item.id);
            continue;
          }

          // Check junction table format with nested file object
          if (typeof item === 'object' && item !== null) {
            const obj = item as Record<string, unknown>;
            if (obj.daas_files_id && isHydratedFile(obj.daas_files_id)) {
              results.push(obj.daas_files_id as FileUpload);
              hydratedIdsRef.current.add((obj.daas_files_id as FileUpload).id);
              continue;
            }
          }

          // Need to fetch from API
          const fileId = extractFileId(item);
          if (fileId) {
            // Check if already in our current files
            const existing = files.find(f => f.id === fileId);
            if (existing) {
              results.push(existing);
              continue;
            }

            try {
              const file = await daasAPI.getFile(fileId);
              if (!cancelled) {
                results.push(toFileUpload(file));
                hydratedIdsRef.current.add(fileId);
              }
            } catch (err) {
              console.error('Failed to fetch file:', fileId, err);
              // Create stub for failed fetch
              results.push({
                id: fileId,
                filename_disk: fileId,
                filename_download: fileId,
                type: 'application/octet-stream',
                filesize: 0,
                uploaded_on: new Date().toISOString(),
                uploaded_by: 'system',
              });
            }
          }
        }

        if (!cancelled) {
          setFiles(results);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
    // Note: We intentionally omit 'files' from deps to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, extractFileId, isHydratedFile, junctionLoaded, primaryKey]);

  // Check permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const [canCreate, canRead, canDelete] = await Promise.all([
          daasAPI.checkPermission('daas_files', 'create'),
          daasAPI.checkPermission('daas_files', 'read'),
          daasAPI.checkPermission('daas_files', 'delete'),
        ]);
        setCreateAllowed(canCreate);
        setSelectAllowed(canRead);
        setDeleteAllowed(canDelete);
      } catch {
        setCreateAllowed(true);
        setSelectAllowed(true);
        setDeleteAllowed(true);
      }
    };
    checkPermissions();
  }, []);

  // Pagination - ensure limit is valid
  const effectiveLimit = limit && limit > 0 ? limit : 15;
  const totalItemCount = files.length;
  const pageCount = Math.max(1, Math.ceil(totalItemCount / effectiveLimit));
  const pagedFiles = useMemo(() => {
    const start = (page - 1) * effectiveLimit;
    return files.slice(start, start + effectiveLimit);
  }, [files, page, effectiveLimit]);

  // Get the junction config (either provided or inferred)
  const getJunctionConfig = useCallback(() => {
    if (junctionConfig) return junctionConfig;
    if (collection && field) {
      return {
        junctionCollection: `${collection}_daas_files`,
        junctionFieldCurrent: `${collection}_id`,
        junctionFieldRelated: 'daas_files_id',
      };
    }
    return null;
  }, [junctionConfig, collection, field]);

  // Sync junction table with current files
  const syncJunctionTable = useCallback(async (newFiles: FileUpload[]) => {
    // Only sync if we have a primary key (existing record) and junction config
    if (isNewItem(primaryKey)) {
      return;
    }

    const jc = getJunctionConfig();
    if (!jc) return;

    const newFileIds = new Set(newFiles.map(f => f.id));
    const currentFileIds = new Set(files.map(f => f.id));

    try {
      // Find files to add (in newFiles but not in current)
      const toAdd = newFiles.filter(f => !currentFileIds.has(f.id));
      
      // Find files to remove (in current but not in newFiles)
      const toRemove = files.filter(f => !newFileIds.has(f.id));

      // Add new junction records
      for (let i = 0; i < toAdd.length; i++) {
        const file = toAdd[i];
        await daasAPI.createItem(jc.junctionCollection, {
          [jc.junctionFieldCurrent]: primaryKey,
          [jc.junctionFieldRelated]: file.id,
        });
      }

      // Remove junction records for removed files
      for (const file of toRemove) {
        // Find and delete the junction record
        const junctionRecords = await daasAPI.getItems<{ id?: string | number }>(jc.junctionCollection, {
          filter: {
            [jc.junctionFieldCurrent]: { _eq: primaryKey },
            [jc.junctionFieldRelated]: { _eq: file.id },
          },
          limit: 1,
        });
        
        for (const record of junctionRecords) {
          if (record.id) {
            await daasAPI.deleteItem(jc.junctionCollection, record.id);
          }
        }
      }

    } catch (err) {
      console.error('[Files] Failed to sync junction table:', err);
    }
  }, [primaryKey, files, getJunctionConfig]);

  // Emit change to parent
  const emitChange = useCallback((newFiles: FileUpload[]) => {
    // Sync junction table for M2M relationship (for existing records)
    syncJunctionTable(newFiles);
    
    // Update local state immediately
    setFiles(newFiles);
    // Update hydrated IDs ref
    hydratedIdsRef.current = new Set(newFiles.map(f => f.id));
    // Notify parent with just IDs
    onChange?.(newFiles.length > 0 ? newFiles.map(f => f.id) : null);
  }, [onChange, syncJunctionTable]);

  // Remove a file
  const handleRemove = useCallback((id: string) => {
    if (readonly || disabled) return;
    const newFiles = files.filter(f => f.id !== id);
    emitChange(newFiles);
  }, [files, emitChange, readonly, disabled]);

  // Add files (from upload or library selection)
  const handleAddFiles = useCallback((newFiles: FileUpload[]) => {
    // Merge with existing, dedupe by id
    const existingIds = new Set(files.map(f => f.id));
    const toAdd = newFiles.filter(f => !existingIds.has(f.id));
    const merged = [...files, ...toAdd];
    emitChange(merged);
  }, [files, emitChange]);

  // Native file upload
  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    try {
      const uploaded = await uploadFiles(Array.from(fileList), { folder });
      handleAddFiles(uploaded);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      e.target.value = '';
    }
  }, [uploadFiles, folder, handleAddFiles]);

  // Open library picker. The picker owns its own search/pagination state and
  // fetching, so this only flips it open.
  const handleOpenLibrary = useCallback(() => {
    setLibraryOpen(true);
  }, []);

  // Page fetcher handed to the shared picker.
  const handleFetchLibraryFiles = useCallback(
    (params: { page: number; limit: number; search: string; folder?: string }) =>
      fetchFiles({
        page: params.page,
        limit: params.limit,
        search: params.search,
        folder: params.folder,
      }),
    [fetchFiles]
  );

  // Folder browsing for the picker.
  const handleFetchLibraryFolders = useCallback(
    (params: { parent: string | null; search?: string }) =>
      fetchFolders({ parent: params.parent, search: params.search }),
    [fetchFolders]
  );

  // Select file from library
  const handleSelectFromLibrary = useCallback((file: FileUpload) => {
    handleAddFiles([file]);
    setLibraryOpen(false);
  }, [handleAddFiles]);

  // Render file item
  const renderFileItem = (file: FileUpload) => (
    <Paper
      key={file.id}
      withBorder
      p="sm"
      style={{
        borderRadius: 0,
        marginTop: -1,
      }}
    >
      <Group gap="sm" align="center" wrap="nowrap">
        {/* Thumbnail for images, category icon otherwise — previously every
            attached file rendered as a folder glyph regardless of its type. */}
        <div className="library-row-thumb" data-testid="files-item-thumb">
          <FileThumbnail file={file} size={32} />
        </div>

        {/* File name */}
        <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
          {file.title || file.filename_download || file.filename_disk || file.id}
        </Text>

        {/* Actions */}
        {!readonly && (
          <Group gap={4}>
            <Tooltip label={t.actions.remove}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => handleRemove(file.id)}
                disabled={!deleteAllowed || disabled}
                aria-label={t.actions.removeFile}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>

            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label={t.actions.moreOptions}
                >
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconExternalLink size={14} />}
                  component="a"
                  href={`/api/assets/${file.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.actions.openInNewTab}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconDownload size={14} />}
                  component="a"
                  href={`/api/assets/${file.id}?download=true`}
                  download={file.filename_download || file.id}
                >
                  {t.actions.downloadFile}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        )}
      </Group>
    </Paper>
  );

  return (
    <Stack gap="xs">
      {/* Label */}
      {label && (
        <Group gap={6} align="center">
          <Text fw={500} size="sm">{label}</Text>
          {readonly && <Badge size="xs" variant="light">{t.readOnly}</Badge>}
        </Group>
      )}

      {/* Loading state */}
      {loading && (
        <Paper withBorder p="md">
          <Group justify="center">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">{t.loading}</Text>
          </Group>
        </Paper>
      )}

      {/* Empty state */}
      {!loading && totalItemCount === 0 && (
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed">{placeholder ?? t.placeholder}</Text>
        </Paper>
      )}

      {/* File list */}
      {!loading && totalItemCount > 0 && (
        <Stack gap={0}>
          {pagedFiles.map(renderFileItem)}
          
          {pageCount > 1 && (
            <Group justify="flex-end" mt="xs">
              <Pagination total={pageCount} value={page} onChange={setPage} size="sm" />
            </Group>
          )}
        </Stack>
      )}

      {/* Action buttons */}
      {!readonly && (
        <Group mt="xs">
          {enableCreate && createAllowed && !disabled && (
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={() => fileInputRef.current?.click()}
            >
              {t.uploadFile}
            </Button>
          )}
          {enableSelect && selectAllowed && !disabled && (
            <Button
              variant="default"
              leftSection={<IconFolderOpen size={16} />}
              onClick={handleOpenLibrary}
            >
              {t.addExisting}
            </Button>
          )}
        </Group>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={handleFileInputChange}
      />

      {/* Library picker — shared implementation (search, pagination,
          thumbnails, grid/list) from the upload interface. */}
      <LibraryPickerModal
        opened={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={handleSelectFromLibrary}
        folder={folder}
        onFetchFiles={handleFetchLibraryFiles}
        onFetchFolders={handleFetchLibraryFolders}
      />
    </Stack>
  );
};

export default Files;
