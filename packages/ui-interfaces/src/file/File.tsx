import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Box, 
  Text, 
  Group, 
  ActionIcon, 
  Menu, 
  Button, 
  Stack,
  TextInput,
  Textarea,
  Paper,
  Image,
  Drawer,
  Skeleton,
  Badge
} from '@mantine/core';
import { 
  IconFolderOpen, 
  IconDownload,
  IconEdit,
  IconX,
  IconInfoCircle,
  IconDotsVertical
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { Upload, type FileUpload } from '../upload';
import { daasAPI, type DaaSFile } from '@buildpad/hooks';
import { useFiles } from '@buildpad/hooks';

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

/**
 * Token-based styles for file components matching DaaS file.vue interface
 */
const fileStyles = {
  preview: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 'var(--mantine-radius-sm)',
    backgroundColor: 'var(--mantine-color-gray-1)',
    border: '1px solid var(--mantine-color-gray-3)',
    overflow: 'hidden',
  },
  previewHasFile: {
    backgroundColor: 'var(--mantine-primary-color-1)',
    borderColor: 'var(--mantine-primary-color-3)',
  },
  previewSvg: {
    backgroundColor: 'transparent',
  },
  extension: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--mantine-color-gray-7)',
    textTransform: 'uppercase' as const,
  },
  inputContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }
};

// Utility functions
function getFileExtension(type: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/svg+xml': 'SVG',
    'image/webp': 'WEBP',
    'application/pdf': 'PDF',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
    'application/zip': 'ZIP',
    'application/x-zip-compressed': 'ZIP',
    'video/mp4': 'MP4',
    'video/webm': 'WEBM',
    'audio/mpeg': 'MP3',
    'audio/wav': 'WAV',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/json': 'JSON',
    'application/xml': 'XML',
  };
  
  return mimeToExt[type] || type.split('/')[1]?.toUpperCase()?.slice(0, 4) || 'FILE';
}

function getAssetUrl(fileId: string, download = false): string {
  const params = download ? '?download=true' : '';
  return `/api/assets/${fileId}${params}`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export interface FileProps {
  value?: string | FileUpload | null;
  onChange?: (value: string | FileUpload | null) => void;
  disabled?: boolean;
  folder?: string;
  collection?: string;
  field?: string;
  placeholder?: string;
  readonly?: boolean;
  label?: string;
  accept?: string;
  fromUser?: boolean;
  fromUrl?: boolean;
  fromLibrary?: boolean;
}

/**
 * File interface component matching DaaS file.vue
 * Provides the same UI and functionality as the Vue component
 */
export const File: React.FC<FileProps> = ({
  value,
  onChange,
  disabled = false,
  folder,
  // collection and field are kept for API parity with DaaS interfaces
  placeholder = "No file selected",
  readonly = false,
  label,
  accept,
  fromUser = true,
  fromUrl = true,
  fromLibrary = true,
}) => {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<FileUpload | null>(null);
  const [editDrawerActive, setEditDrawerActive] = useState(false);
  const [menuOpened, setMenuOpened] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [createAllowed, setCreateAllowed] = useState(true);
  const [updateAllowed, setUpdateAllowed] = useState(true);
  const [fileError, setFileError] = useState<string | null>(null);

  // Use the files hook for real API operations
  const { uploadFiles, fetchFiles, importFromUrl } = useFiles();

  // Normalize value to id
  const fileId = useMemo(() => (typeof value === 'string' ? value : value?.id || null), [value]);

  // Fetch file data when value changes
  useEffect(() => {
    let mounted = true;
    const fetchFileData = async () => {
      if (!fileId) {
        setFile(null);
        return;
      }
      setLoading(true);
      setFileError(null);
      try {
        if (typeof value === 'object' && value) {
          setFile(value as FileUpload);
          setEditTitle((value as FileUpload).title || '');
          setEditDescription((value as FileUpload).description || '');
        } else {
          const fetchedFile = await daasAPI.getFile(fileId);
          if (!mounted) return;
          setFile(toFileUpload(fetchedFile));
          setEditTitle(fetchedFile.title || '');
          setEditDescription(fetchedFile.description || '');
        }
      } catch {
        if (mounted) {
          setFile(null);
          setFileError('Failed to load file');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    fetchFileData();
    return () => {
      mounted = false;
    };
  }, [fileId, value]);

  // Check permissions
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const canCreate = await daasAPI.checkPermission('daas_files', 'create');
        const canUpdate = await daasAPI.checkPermission('daas_files', 'update');
        setCreateAllowed(canCreate);
        setUpdateAllowed(canUpdate);
      } catch {
        // Default to true if we can't check permissions
        setCreateAllowed(true);
        setUpdateAllowed(true);
      }
    };
    checkPermissions();
  }, []);

  // File preview functionality
  const isImage = !!file?.type?.startsWith('image');
  const isSvg = !!file?.type?.includes('svg');
  
  const imageThumbnail = useMemo(() => {
    if (!file) return null;
    if (isSvg) {
      return getAssetUrl(file.id);
    }
    if (isImage) {
      const cacheBuster = (file as FileUpload & { modified_on?: string }).modified_on || file.uploaded_on || '';
      return `${getAssetUrl(file.id)}?key=system-small-cover&cache-buster=${encodeURIComponent(cacheBuster)}`;
    }
    return null;
  }, [file, isImage, isSvg]);

  const fileExtension = useMemo(() => {
    if (!file || !file.type) return null;
    return getFileExtension(file.type);
  }, [file]);

  // Handlers
  const handleRemove = useCallback(() => {
    if (disabled || readonly) return;
    setFile(null);
    onChange?.(null);
  }, [disabled, readonly, onChange]);

  const handleUploadInput = useCallback(
    (fileOrFiles: FileUpload | FileUpload[] | null) => {
      if (!fileOrFiles) return;
      const f = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
      setFile(f);
      onChange?.(f.id);
    },
    [onChange]
  );

  const handleDownload = useCallback(async () => {
    if (!file) return;
    try {
      const response = await daasAPI.get(`/assets/${file.id}`, {
        responseType: 'blob',
        params: { download: 'true' },
      });
      const blob = response.data instanceof Blob 
        ? response.data 
        : new Blob([response.data], { type: response.headers['content-type'] || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename_download || `${file.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      notifications.show({ title: 'Download failed', message: 'Unable to download file', color: 'red' });
    }
  }, [file]);

  const handleSaveDetails = useCallback(async () => {
    if (!file) return;
    try {
      const updated = await daasAPI.updateFile(file.id, {
        title: editTitle,
        description: editDescription,
      });
      setFile({ ...file, ...toFileUpload(updated) });
      setEditDrawerActive(false);
      notifications.show({ title: 'Saved', message: 'File details updated', color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to update file details', color: 'red' });
    }
  }, [file, editTitle, editDescription]);

  // Handler for uploading files to the server (real API)
  const handleUploadFiles = useCallback(async (
    files: File[],
    options: { folder?: string; preset?: string }
  ): Promise<FileUpload[]> => {
    return await uploadFiles(files, { folder: options.folder });
  }, [uploadFiles]);

  // Handler for fetching library files (real API)
  const handleFetchLibraryFiles = useCallback(async (params: {
    page: number;
    limit: number;
    search: string;
    folder?: string;
  }): Promise<{ files: FileUpload[]; total: number }> => {
    return await fetchFiles({
      page: params.page,
      limit: params.limit,
      search: params.search,
      folder: params.folder,
    });
  }, [fetchFiles]);

  // Handler for importing file from URL (real API)
  const handleImportFromUrl = useCallback(async (
    url: string,
    options: { folder?: string }
  ): Promise<FileUpload> => {
    return await importFromUrl(url, { folder: options.folder });
  }, [importFromUrl]);

  // Readonly display
  if (readonly) {
    if (!file) {
      return (
        <Stack gap="xs">
          {label && (
            <Group gap={6} align="center">
              <Text fw={500} size="sm">{label}</Text>
              <Badge size="xs" variant="light">Read only</Badge>
            </Group>
          )}
          <Text c="dimmed" size="sm" data-testid="file-placeholder">{placeholder}</Text>
        </Stack>
      );
    }

    return (
      <Stack gap="xs">
        {label && (
          <Group gap={6} align="center">
            <Text fw={500} size="sm">{label}</Text>
            <Badge size="xs" variant="light">Read only</Badge>
          </Group>
        )}
        <Paper 
          withBorder 
          p="sm" 
          data-testid="file-readonly-display"
        >
          <Group gap="sm">
            <Box style={fileStyles.preview}>
              {imageThumbnail ? (
                <Image
                  src={imageThumbnail}
                  alt={file.title || file.filename_download}
                  w={40}
                  h={40}
                  fit="cover"
                />
              ) : fileExtension ? (
                <Text style={fileStyles.extension}>{fileExtension}</Text>
              ) : (
                <IconFolderOpen size={16} color="var(--mantine-color-gray-6)" />
              )}
            </Box>
            <Box style={{ flex: 1 }}>
              <Text size="sm" fw={500}>{file.title || file.filename_download}</Text>
              <Text size="xs" c="dimmed">{file.type} • {formatFileSize(file.filesize || 0)}</Text>
            </Box>
          </Group>
        </Paper>
      </Stack>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Stack gap="xs">
        {label && <Text fw={500} size="sm">{label}</Text>}
        <Skeleton height={60} radius="sm" data-testid="file-loading" />
      </Stack>
    );
  }

  // Disabled without file
  if (disabled && !file) {
    return (
      <Stack gap="xs">
        {label && <Text fw={500} size="sm">{label}</Text>}
        <Paper 
          withBorder 
          p="md" 
          style={{ backgroundColor: 'var(--mantine-color-gray-1)' }}
          data-testid="file-disabled"
        >
          <Group gap={8} c="dimmed" justify="center">
            <IconX size={16} />
            <Text size="sm">Disabled</Text>
          </Group>
        </Paper>
      </Stack>
    );
  }

  // File selected - show file display with actions
  if (file) {
    return (
      <Stack gap="xs">
        {label && <Text fw={500} size="sm">{label}</Text>}
        <Paper 
          withBorder 
          p="sm"
          data-testid="file-display"
        >
          <Group justify="space-between">
            <Group gap="sm">
              {/* File preview */}
              <Box 
                style={{
                  ...fileStyles.preview,
                  ...fileStyles.previewHasFile,
                  ...(isSvg ? fileStyles.previewSvg : {})
                }}
                data-testid="file-preview"
              >
                {imageThumbnail ? (
                  <Image
                    src={imageThumbnail}
                    alt={file.title || file.filename_download}
                    w={40}
                    h={40}
                    fit="cover"
                    data-testid="file-thumbnail"
                  />
                ) : fileExtension ? (
                  <Text style={fileStyles.extension} data-testid="file-extension">{fileExtension}</Text>
                ) : (
                  <IconFolderOpen size={16} color="var(--mantine-color-gray-6)" />
                )}
              </Box>
              
              {/* File info */}
              <Box>
                <Text size="sm" fw={500} data-testid="file-name">
                  {file.title || file.filename_download}
                </Text>
                <Text size="xs" c="dimmed" data-testid="file-meta">
                  {file.type} • {formatFileSize(file.filesize || 0)}
                </Text>
              </Box>
            </Group>

            {/* Action menu */}
            <Group gap="xs">
              <Menu opened={menuOpened} onChange={setMenuOpened} position="bottom-end">
                <Menu.Target>
                  <ActionIcon 
                    variant="subtle" 
                    size="sm"
                    data-testid="file-menu-trigger"
                  >
                    <IconDotsVertical size={16} />
                  </ActionIcon>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconDownload size={16} />}
                    onClick={handleDownload}
                    data-testid="file-download-btn"
                  >
                    Download
                  </Menu.Item>
                  
                  <Menu.Item
                    leftSection={<IconEdit size={16} />}
                    onClick={() => setEditDrawerActive(true)}
                    disabled={!updateAllowed}
                    data-testid="file-edit-btn"
                  >
                    Edit details
                  </Menu.Item>
                  
                  {!disabled && (
                    <>
                      <Menu.Divider />
                      <Menu.Item
                        leftSection={<IconX size={16} />}
                        color="red"
                        onClick={handleRemove}
                        data-testid="file-remove-btn"
                      >
                        Remove
                      </Menu.Item>
                    </>
                  )}
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </Paper>

        {/* Edit drawer */}
        <Drawer
          opened={editDrawerActive}
          onClose={() => setEditDrawerActive(false)}
          title="Edit File Details"
          position="right"
          size="md"
        >
          <Stack>
            <Paper withBorder p="sm">
              <Group>
                <Box style={fileStyles.preview}>
                  {imageThumbnail ? (
                    <Image
                      src={imageThumbnail}
                      alt={file.title || file.filename_download}
                      w={40}
                      h={40}
                      fit="cover"
                    />
                  ) : (
                    <Text style={fileStyles.extension}>{fileExtension}</Text>
                  )}
                </Box>
                <Box>
                  <Text fw={500}>{file.filename_download}</Text>
                  <Text size="xs" c="dimmed">{file.type} • {formatFileSize(file.filesize || 0)}</Text>
                </Box>
              </Group>
            </Paper>
            
            <TextInput
              label="Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.currentTarget.value)}
              disabled={!updateAllowed}
              data-testid="file-edit-title"
            />
            
            <Textarea
              label="Description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.currentTarget.value)}
              disabled={!updateAllowed}
              minRows={3}
              data-testid="file-edit-description"
            />
            
            <Group justify="flex-end" mt="md">
              <Button 
                variant="outline" 
                onClick={() => setEditDrawerActive(false)}
                data-testid="file-edit-cancel"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveDetails}
                disabled={!updateAllowed}
                data-testid="file-edit-save"
              >
                Save
              </Button>
            </Group>
          </Stack>
        </Drawer>
      </Stack>
    );
  }

  // No file selected - show uploader
  return (
    <Stack gap="xs">
      {label && <Text fw={500} size="sm">{label}</Text>}
      <Box data-testid="file-uploader">
        <Upload
          multiple={false}
          fromUser={fromUser && createAllowed}
          fromLibrary={fromLibrary}
          fromUrl={fromUrl && createAllowed}
          folder={folder}
          accept={accept}
          onInput={handleUploadInput}
          onUploadFiles={handleUploadFiles}
          onFetchLibraryFiles={handleFetchLibraryFiles}
          onImportFromUrl={handleImportFromUrl}
        />
      </Box>
      {fileError && (
        <Group gap={4} c="red">
          <IconInfoCircle size={14} />
          <Text size="xs">{fileError}</Text>
        </Group>
      )}
    </Stack>
  );
};

export default File;
