'use client';

import React, { useCallback, useRef, useState } from 'react';
import './Upload.css';
import {
  Box,
  Button,
  Group,
  Stack,
  Text,
  Paper,
  Modal,
  TextInput,
  Loader,
  ActionIcon,
  FileButton,
} from '@mantine/core';
import {
  IconUpload,
  IconPhoto,
  IconX,
  IconFolderOpen,
  IconLink,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

/**
 * File upload type matching DaaS file structure
 */
export interface FileUpload {
  id: string;
  filename_download: string;
  filename_disk: string;
  type: string;
  filesize: number;
  width?: number;
  height?: number;
  title?: string;
  description?: string;
  folder?: string;
  uploaded_on: string;
  uploaded_by: string;
  modified_on?: string;
}

export interface UploadProps {
  /** Called when files are selected/uploaded */
  onInput?: (files: FileUpload | FileUpload[] | null) => void;
  /** Allow multiple file uploads */
  multiple?: boolean;
  /** Enable upload from device */
  fromUser?: boolean;
  /** Enable import from URL */
  fromUrl?: boolean;
  /** Enable selection from library */
  fromLibrary?: boolean;
  /** Auto-open library browser when component mounts */
  autoOpenLibrary?: boolean;
  /** Target folder for uploads */
  folder?: string;
  /** Accepted file types (e.g., "image/*", ".pdf,.doc") */
  accept?: string | string[];
  /** Upload preset */
  preset?: string;
  /** Function to fetch files from library */
  onFetchLibraryFiles?: (params: {
    page: number;
    limit: number;
    search: string;
    folder?: string;
  }) => Promise<{ files: FileUpload[]; total: number }>;
  /** Function to upload files */
  onUploadFiles?: (files: File[], options: { folder?: string; preset?: string }) => Promise<FileUpload[]>;
  /** Function to import from URL */
  onImportFromUrl?: (url: string, options: { folder?: string }) => Promise<FileUpload>;
}

/**
 * Upload component matching DaaS v-upload functionality
 * Supports upload from device, import from URL, and library selection
 */
export const Upload: React.FC<UploadProps> = ({
  onInput,
  multiple = false,
  fromUser = true,
  fromUrl = true,
  fromLibrary = true,
  autoOpenLibrary = false,
  folder,
  accept,
  preset,
  onFetchLibraryFiles,
  onUploadFiles,
  onImportFromUrl,
}) => {
  const [uploading, setUploading] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(autoOpenLibrary);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState<FileUpload[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  // Fetch library files when modal opens (including on initial mount when autoOpenLibrary is true)
  React.useEffect(() => {
    if (libraryOpen && onFetchLibraryFiles) {
      const fetchFiles = async () => {
        setLibraryLoading(true);
        try {
          const result = await onFetchLibraryFiles({
            page: 1,
            limit: 20,
            search: librarySearch,
            folder,
          });
          // Handle both { files: [...] } and direct array responses
          const files = Array.isArray(result) ? result : (result?.files ?? []);
          setLibraryFiles(Array.isArray(files) ? files : []);
        } catch (error) {
          console.error('Failed to fetch library files:', error);
          setLibraryFiles([]);
        } finally {
          setLibraryLoading(false);
        }
      };
      fetchFiles();
    }
  }, [libraryOpen]); // Only trigger on libraryOpen change, not on search

  // Parse accept prop into string
  const acceptString = React.useMemo(() => {
    if (!accept) return undefined;
    if (Array.isArray(accept)) return accept.join(',');
    return accept;
  }, [accept]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      let uploadedFiles: FileUpload[];

      if (onUploadFiles) {
        uploadedFiles = await onUploadFiles(files, { folder, preset });
      } else {
        // Mock upload for demo - in production, upload to API
        uploadedFiles = files.map((file, index) => ({
          id: `uploaded-${Date.now()}-${index}`,
          filename_download: file.name,
          filename_disk: file.name,
          type: file.type,
          filesize: file.size,
          uploaded_on: new Date().toISOString(),
          uploaded_by: 'current-user',
          folder,
        }));
      }

      if (multiple) {
        onInput?.(uploadedFiles);
      } else {
        onInput?.(uploadedFiles[0] || null);
      }

      notifications.show({
        title: 'Upload complete',
        message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
        color: 'green',
      });
    } catch (error) {
      console.error('Upload error:', error);
      notifications.show({
        title: 'Upload failed',
        message: error instanceof Error ? error.message : 'Failed to upload files',
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  }, [folder, preset, multiple, onInput, onUploadFiles]);

  const handleFileSelect = useCallback((files: File | File[] | null) => {
    if (!files) return;
    const fileArray = Array.isArray(files) ? files : [files];
    handleFiles(fileArray);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (fromUser) {
      setIsDragOver(true);
    }
  }, [fromUser]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!fromUser) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [fromUser, handleFiles]);

  const handleImportFromUrl = useCallback(async () => {
    if (!importUrl.trim()) return;

    setImporting(true);
    try {
      let importedFile: FileUpload;

      if (onImportFromUrl) {
        importedFile = await onImportFromUrl(importUrl, { folder });
      } else {
        // Mock import for demo
        const urlParts = importUrl.split('/');
        const filename = urlParts[urlParts.length - 1] || 'imported-file';
        importedFile = {
          id: `imported-${Date.now()}`,
          filename_download: filename,
          filename_disk: filename,
          type: 'application/octet-stream',
          filesize: 0,
          uploaded_on: new Date().toISOString(),
          uploaded_by: 'current-user',
          folder,
        };
      }

      onInput?.(multiple ? [importedFile] : importedFile);
      setUrlDialogOpen(false);
      setImportUrl('');

      notifications.show({
        title: 'Import complete',
        message: 'File imported successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Import error:', error);
      notifications.show({
        title: 'Import failed',
        message: error instanceof Error ? error.message : 'Failed to import from URL',
        color: 'red',
      });
    } finally {
      setImporting(false);
    }
  }, [importUrl, folder, multiple, onInput, onImportFromUrl]);

  const fetchLibraryFiles = useCallback(async () => {
    if (!onFetchLibraryFiles) {
      // Mock library files for demo
      setLibraryFiles([
        {
          id: 'lib-1',
          filename_download: 'sample-image.jpg',
          filename_disk: 'sample-image.jpg',
          type: 'image/jpeg',
          filesize: 102400,
          width: 1920,
          height: 1080,
          title: 'Sample Image',
          uploaded_on: new Date().toISOString(),
          uploaded_by: 'system',
        },
        {
          id: 'lib-2',
          filename_download: 'document.pdf',
          filename_disk: 'document.pdf',
          type: 'application/pdf',
          filesize: 51200,
          title: 'Sample Document',
          uploaded_on: new Date().toISOString(),
          uploaded_by: 'system',
        },
      ]);
      return;
    }

    setLibraryLoading(true);
    try {
      const result = await onFetchLibraryFiles({
        page: 1,
        limit: 20,
        search: librarySearch,
        folder,
      });
      // Handle both { files: [...] } and direct array responses
      const files = Array.isArray(result) ? result : (result?.files ?? []);
      setLibraryFiles(Array.isArray(files) ? files : []);
    } catch (error) {
      console.error('Failed to fetch library files:', error);
      setLibraryFiles([]);
    } finally {
      setLibraryLoading(false);
    }
  }, [folder, librarySearch, onFetchLibraryFiles]);

  const handleOpenLibrary = useCallback(() => {
    setLibraryOpen(true);
    fetchLibraryFiles();
  }, [fetchLibraryFiles]);

  const handleSelectLibraryFile = useCallback((file: FileUpload) => {
    onInput?.(multiple ? [file] : file);
    setLibraryOpen(false);
  }, [multiple, onInput]);

  const isValidUrl = React.useMemo(() => {
    try {
      new URL(importUrl);
      return true;
    } catch {
      return false;
    }
  }, [importUrl]);

  return (
    <Box data-testid="upload-component">
      <Paper
        ref={dropzoneRef}
        p="xl"
        withBorder
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          borderStyle: 'dashed',
          backgroundColor: isDragOver
            ? 'var(--mantine-primary-color-0)'
            : 'var(--mantine-color-gray-0)',
          borderColor: isDragOver
            ? 'var(--mantine-primary-color-5)'
            : 'var(--mantine-color-gray-4)',
          transition: 'all 0.2s ease',
        }}
        data-testid="upload-dropzone"
      >
        <Stack align="center" gap="md">
          {uploading ? (
            <>
              <Loader size="lg" />
              <Text size="sm" c="dimmed">Uploading...</Text>
            </>
          ) : (
            <>
              <Box
                style={{
                  color: isDragOver
                    ? 'var(--mantine-primary-color-6)'
                    : 'var(--mantine-color-gray-5)',
                }}
              >
                <IconPhoto size={52} stroke={1.5} />
              </Box>

              <Box ta="center">
                <Text size="lg" inline>
                  {isDragOver ? 'Drop files here' : 'Drag files here or click to select'}
                </Text>
                <Text size="sm" c="dimmed" inline mt={7}>
                  {accept ? `Accepts: ${accept}` : 'All file types accepted'}
                </Text>
              </Box>

              <Group gap="sm">
                {fromUser && (
                  <FileButton
                    onChange={handleFileSelect}
                    accept={acceptString}
                    multiple={multiple}
                  >
                    {(props) => (
                      <Button
                        {...props}
                        variant="default"
                        leftSection={<IconUpload size={16} />}
                        data-testid="upload-from-device-btn"
                      >
                        Upload from device
                      </Button>
                    )}
                  </FileButton>
                )}

                {fromLibrary && (
                  <Button
                    variant="default"
                    leftSection={<IconFolderOpen size={16} />}
                    onClick={handleOpenLibrary}
                    data-testid="choose-from-library-btn"
                  >
                    Choose from library
                  </Button>
                )}

                {fromUrl && (
                  <Button
                    variant="default"
                    leftSection={<IconLink size={16} />}
                    onClick={() => setUrlDialogOpen(true)}
                    data-testid="import-from-url-btn"
                  >
                    Import from URL
                  </Button>
                )}
              </Group>
            </>
          )}
        </Stack>
      </Paper>

      {/* URL Import Dialog */}
      <Modal
        opened={urlDialogOpen}
        onClose={() => setUrlDialogOpen(false)}
        title="Import from URL"
        data-testid="url-import-modal"
      >
        <Stack>
          <TextInput
            label="File URL"
            placeholder="https://example.com/file.jpg"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            disabled={importing}
            data-testid="url-input"
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setUrlDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImportFromUrl}
              loading={importing}
              disabled={!isValidUrl}
              data-testid="import-btn"
            >
              Import
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Library Browser Dialog */}
      <Modal
        opened={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title="Choose from library"
        size="lg"
        data-testid="library-modal"
      >
        <Stack>
          <TextInput
            placeholder="Search files..."
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            rightSection={
              libraryLoading ? (
                <Loader size="xs" />
              ) : librarySearch ? (
                <ActionIcon variant="subtle" onClick={() => setLibrarySearch('')}>
                  <IconX size={14} />
                </ActionIcon>
              ) : null
            }
            data-testid="library-search"
          />

          <Box style={{ minHeight: 200 }}>
            {libraryLoading ? (
              <Stack align="center" justify="center" style={{ height: 200 }}>
                <Loader />
                <Text size="sm" c="dimmed">Loading files...</Text>
              </Stack>
            ) : libraryFiles.length === 0 ? (
              <Stack align="center" justify="center" style={{ height: 200 }}>
                <IconFolderOpen size={48} color="var(--mantine-color-gray-5)" />
                <Text c="dimmed">No files found</Text>
              </Stack>
            ) : (
              <div className="library-grid">
                {libraryFiles.map((file) => (
                  <Paper
                    key={file.id}
                    withBorder
                    className="library-card"
                    onClick={() => handleSelectLibraryFile(file)}
                    data-testid={`library-file-${file.id}`}
                  >
                    <div className="library-card-thumb">
                      {file.type?.startsWith('image/') ? (
                        <img
                          src={`/api/assets/${file.id}?key=system-small-cover`}
                          alt={file.title || file.filename_download}
                          className="library-card-thumb-img"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                            (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex');
                          }}
                        />
                      ) : null}
                      <div
                        className={`library-card-fallback${file.type?.startsWith('image/') ? ' library-card-fallback--hidden' : ''}`}
                      >
                        <IconFolderOpen size={32} color="var(--mantine-color-gray-5)" />
                      </div>
                    </div>
                    <Box p="xs">
                      <Text size="xs" fw={500} lineClamp={1} title={file.title || file.filename_download}>
                        {file.title || file.filename_download}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {Math.round((file.filesize || 0) / 1024)} KB
                      </Text>
                    </Box>
                  </Paper>
                ))}
              </div>
            )}
          </Box>
        </Stack>
      </Modal>
    </Box>
  );
};

export default Upload;
