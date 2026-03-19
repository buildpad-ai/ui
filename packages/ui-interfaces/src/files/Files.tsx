import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Group, Stack, Text, Paper, Badge, Tooltip, Pagination, Menu, ActionIcon, Modal, TextInput, Loader } from '@mantine/core';
import { IconTrash, IconDownload, IconExternalLink, IconFolder, IconDotsVertical, IconPhoto, IconUpload, IconFolderOpen } from '@tabler/icons-react';
import { type FileUpload } from '../upload';
import { daasAPI, type DaaSFile } from '@buildpad/hooks';
import { useFiles } from '@buildpad/hooks';
import { isNewItem } from '@buildpad/utils';

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
}

export const Files: React.FC<FilesProps> = ({
  value,
  onChange,
  label,
  placeholder = 'No items',
  disabled = false,
  readonly = false,
  enableCreate = true,
  enableSelect = true,
  folder,
  limit = 15,
  collection,
  field,
  primaryKey,
  junctionConfig,
}) => {
  // Local state for hydrated files
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [junctionLoaded, setJunctionLoaded] = useState(false);
  
  // Library picker state
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState<FileUpload[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  
  // Permissions
  const [createAllowed, setCreateAllowed] = useState(true);
  const [selectAllowed, setSelectAllowed] = useState(true);
  const [deleteAllowed, setDeleteAllowed] = useState(true);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hydratedIdsRef = useRef<Set<string>>(new Set());

  // API hooks
  const { uploadFiles, fetchFiles } = useFiles();

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
          sort: ['sort'],
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
          sort: files.length + i + 1,
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

      console.log('[Files] Junction table synced:', { added: toAdd.length, removed: toRemove.length });
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

  // Open library picker
  const handleOpenLibrary = useCallback(async () => {
    setLibraryOpen(true);
    setLibraryLoading(true);
    try {
      const result = await fetchFiles({ page: 1, limit: 20, search: '', folder });
      setLibraryFiles(result.files || []);
    } catch (err) {
      console.error('Failed to fetch library files:', err);
      setLibraryFiles([]);
    } finally {
      setLibraryLoading(false);
    }
  }, [fetchFiles, folder]);

  // Search library
  const handleLibrarySearch = useCallback(async (search: string) => {
    setLibrarySearch(search);
    setLibraryLoading(true);
    try {
      const result = await fetchFiles({ page: 1, limit: 20, search, folder });
      setLibraryFiles(result.files || []);
    } catch (err) {
      console.error('Failed to search library:', err);
    } finally {
      setLibraryLoading(false);
    }
  }, [fetchFiles, folder]);

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
        {/* File icon */}
        <Box
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--mantine-radius-sm)',
            backgroundColor: 'var(--mantine-color-gray-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconFolder size={18} color="var(--mantine-color-gray-6)" />
        </Box>

        {/* File name */}
        <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
          {file.title || file.filename_download || file.filename_disk || file.id}
        </Text>

        {/* Actions */}
        {!readonly && (
          <Group gap={4}>
            <Tooltip label="Remove">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => handleRemove(file.id)}
                disabled={!deleteAllowed || disabled}
                aria-label="Remove file"
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
                  aria-label="More options"
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
                  Open in new tab
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconDownload size={14} />}
                  component="a"
                  href={`/api/assets/${file.id}?download=true`}
                  download={file.filename_download || file.id}
                >
                  Download file
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
          {readonly && <Badge size="xs" variant="light">Read only</Badge>}
        </Group>
      )}

      {/* Loading state */}
      {loading && (
        <Paper withBorder p="md">
          <Group justify="center">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">Loading files...</Text>
          </Group>
        </Paper>
      )}

      {/* Empty state */}
      {!loading && totalItemCount === 0 && (
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed">{placeholder}</Text>
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
              color="violet"
              leftSection={<IconUpload size={16} />}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload File
            </Button>
          )}
          {enableSelect && selectAllowed && !disabled && (
            <Button
              variant="default"
              leftSection={<IconFolderOpen size={16} />}
              onClick={handleOpenLibrary}
            >
              Add Existing
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

      {/* Library picker modal */}
      <Modal
        opened={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title="Choose from library"
        size="lg"
      >
        <Stack>
          <TextInput
            placeholder="Search files..."
            value={librarySearch}
            onChange={(e) => handleLibrarySearch(e.target.value)}
          />

          <Box style={{ minHeight: 200 }}>
            {libraryLoading ? (
              <Stack align="center" justify="center" style={{ height: 200 }}>
                <Loader size="sm" />
                <Text size="sm" c="dimmed">Loading files...</Text>
              </Stack>
            ) : libraryFiles.length === 0 ? (
              <Stack align="center" justify="center" style={{ height: 200 }}>
                <IconFolderOpen size={48} color="var(--mantine-color-gray-5)" />
                <Text c="dimmed">No files found</Text>
              </Stack>
            ) : (
              <Stack gap="xs">
                {libraryFiles.map((file) => (
                  <Paper
                    key={file.id}
                    p="sm"
                    withBorder
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSelectFromLibrary(file)}
                  >
                    <Group>
                      <Box
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 'var(--mantine-radius-sm)',
                          backgroundColor: 'var(--mantine-color-gray-1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {file.type?.startsWith('image/') ? (
                          <IconPhoto size={20} color="var(--mantine-primary-color-6)" />
                        ) : (
                          <IconFolderOpen size={20} color="var(--mantine-color-gray-6)" />
                        )}
                      </Box>
                      <Box style={{ flex: 1 }}>
                        <Text size="sm" fw={500}>{file.title || file.filename_download}</Text>
                        <Text size="xs" c="dimmed">
                          {file.type} • {Math.round((file.filesize || 0) / 1024)} KB
                        </Text>
                      </Box>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default Files;
