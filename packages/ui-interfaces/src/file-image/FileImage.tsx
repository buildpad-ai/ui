import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Group,
  Text,
  Stack,
  Modal,
  Skeleton,
  Paper,
  TextInput,
  Textarea,
  Tooltip,
  Badge,
} from '@mantine/core';
import { IconZoomIn, IconDownload, IconPencil, IconPhoto, IconX, IconInfoCircle, IconAdjustments, IconPhotoOff } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { Upload, type UploadProps, type FileUpload } from '../upload';
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

export interface FileImageProps extends Omit<UploadProps, 'onInput' | 'multiple' | 'accept'> {
  value?: string | FileUpload | null;
  onChange?: (value: string | FileUpload | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  crop?: boolean; // whether preview should crop (cover) or contain
  letterbox?: boolean; // add padding around image for letterbox effect
  width?: 'auto' | 'full' | 'fill' | 'half';
  collection?: string; // for parity, not used
  field?: string; // for parity, not used
  enableCreate?: boolean; // enable upload new images
  enableSelect?: boolean; // enable selecting from library
}

/**
 * Lightweight image loader that fetches image via API and converts to base64
 * This mirrors DaaS v-image component behavior for authenticated image loading
 */
function VImageBase64({ 
  src, 
  alt, 
  className,
  'data-testid': dataTestId 
}: { 
  src: string; 
  alt?: string; 
  className?: string;
  'data-testid'?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const load = useCallback(async () => {
    if (!src) {
      return;
    }
    try {
      const response = await daasAPI.get(src, { responseType: 'arraybuffer' });
      const contentType = response.headers['content-type'] || 'image/*';
      const bytes = new Uint8Array(response.data as ArrayBuffer);
      // guard: 5MB
      if (bytes.length > 5 * 1024 * 1024) {
        setError('Image too large to preview');
        return;
      }
      let raw = '';
      bytes.forEach((b) => (raw += String.fromCharCode(b)));
      const base64 = btoa(raw);
      setDataUrl(`data:${contentType};base64,${base64}`);
    } catch (e: any) {
      setError(e?.message || 'Failed to load image');
    }
  }, [src]);

  useEffect(() => {
    setDataUrl(null);
    setError(null);
    load();
  }, [load]);

  if (error) {
    return (
      <Stack align="center" justify="center" gap={4} className="file-image-error" data-testid={`${dataTestId}-error`}>
        <IconInfoCircle size={20} />
        <Text size="xs">{error}</Text>
      </Stack>
    );
  }

  if (!dataUrl) {
    return <Skeleton height="100%" data-testid={`${dataTestId}-loading`} />;
  }

  return (
    <img 
      ref={imgRef} 
      src={dataUrl} 
      alt={alt} 
      className={className}
      data-testid={dataTestId}
    />
  );
}

/**
 * FileImage interface component matching DaaS file-image.vue
 * 
 * Features:
 * - Image preview with crop/contain options
 * - Lightbox zoom functionality
 * - Image editor (rotate, crop)
 * - Edit image details (title, description)
 * - Download functionality
 * - Permission-aware (create/update permissions)
 * - Multiple upload sources (device, URL, library)
 */
export const FileImage: React.FC<FileImageProps> = ({
  value,
  onChange,
  label,
  placeholder = 'No image selected',
  disabled = false,
  readonly = false,
  crop = true,
  letterbox = false,
  width = 'auto',
  folder,
  fromUser = true,
  fromUrl = true,
  fromLibrary = true,
  onFetchLibraryFiles,
  onUploadFiles,
  onImportFromUrl,
  preset,
  enableCreate = true,
  enableSelect = true,
}) => {
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<FileUpload | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [createAllowed, setCreateAllowed] = useState(true);
  const [updateAllowed, setUpdateAllowed] = useState(true);
  const [imageError, setImageError] = useState<string | null>(null);

  // Simple image editor state
  const [rotate, setRotate] = useState<0 | 90 | 180 | 270>(0);
  const [cropSquare, setCropSquare] = useState<boolean>(false);

  // Use the files hook for real API operations
  const { uploadFiles, fetchFiles, importFromUrl } = useFiles();

  // Normalize value to id and object
  const imageId = useMemo(() => (typeof value === 'string' ? value : value?.id || null), [value]);

  // Check if component is effectively disabled
  const internalDisabled = useMemo(() => {
    return disabled || (!enableCreate && !enableSelect && !fromUrl);
  }, [disabled, enableCreate, enableSelect, fromUrl]);

  useEffect(() => {
    let mounted = true;
    const fetchImage = async () => {
      if (!imageId) {
        setImage(null);
        return;
      }
      setLoading(true);
      setImageError(null);
      try {
        if (typeof value === 'object' && value) {
          setImage(value as FileUpload);
          setEditTitle((value as FileUpload).title || '');
          setEditDescription((value as FileUpload).description || '');
        } else {
          const file = await daasAPI.getFile(imageId);
          if (!mounted) {
            return;
          }
          setImage(toFileUpload(file));
          setEditTitle(file.title || '');
          setEditDescription(file.description || '');
        }
      } catch (e: any) {
        if (mounted) {
          setImage(null);
          setImageError('Failed to load image');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    fetchImage();
    return () => {
      mounted = false;
    };
  }, [imageId, value]);

  useEffect(() => {
    // Check permissions for create/update on files
    const check = async () => {
      try {
        const canCreate = await daasAPI.checkPermission('daas_files', 'create');
        const canUpdate = await daasAPI.checkPermission('daas_files', 'update');
        setCreateAllowed(canCreate);
        setUpdateAllowed(canUpdate);
      } catch {
        // default true
        setCreateAllowed(true);
        setUpdateAllowed(true);
      }
    };
    check();
  }, []);

  const fit = crop ? 'cover' : 'contain';
  const isImage = !!image?.type?.startsWith('image');
  const isSvg = !!image?.type?.includes('svg');

  const srcPath = useMemo(() => {
    if (!image) {
      return null;
    }
    // Use path without /api prefix since axios baseURL already includes it
    if (isSvg) {
      return `/assets/${image.id}`;
    }
    if (isImage) {
      const key = `system-large-${fit}`; // mirrors DaaS presets
      const cacheBuster = (image as any).modified_on || image.uploaded_on || '';
      return `/assets/${image.id}?key=${key}&cache-buster=${encodeURIComponent(cacheBuster)}`;
    }
    return null;
  }, [image, fit, isImage, isSvg]);

  // Format metadata string like DaaS
  const meta = useMemo(() => {
    if (!image) return null;
    const { filesize, width, height, type } = image;
    const sizeStr = filesize ? `${Math.round(filesize / 1024)} KB` : '';
    
    if (width && height) {
      return `${width}×${height}${sizeStr ? ` • ${sizeStr}` : ''}${type ? ` • ${type}` : ''}`;
    }
    
    return `${sizeStr}${type ? ` • ${type}` : ''}`;
  }, [image]);

  const handleDeselect = useCallback(() => {
    if (internalDisabled || readonly) {
      return;
    }
    setImage(null);
    setLightboxOpen(false);
    setEditOpen(false);
    setImageEditorOpen(false);
    onChange?.(null);
  }, [internalDisabled, readonly, onChange]);

  const handleUploadInput = useCallback(
    (fileOrFiles: FileUpload | FileUpload[] | null) => {
      if (!fileOrFiles) {
        return;
      }
      const f = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
      setImage(f);
      setEditTitle(f.title || '');
      setEditDescription(f.description || '');
      // For relational M2O, emit the file id
      onChange?.(f.id);
    },
    [onChange]
  );

  const handleDownload = useCallback(async () => {
    if (!image) {
      return;
    }
    try {
      const response = await daasAPI.get(`/assets/${image.id}`, {
        responseType: 'blob',
        params: { download: 'true' },
      });
      const blob = response.data instanceof Blob 
        ? response.data 
        : new Blob([response.data], { type: response.headers['content-type'] || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = image.filename_download || `${image.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notifications.show({ title: 'Download started', message: `Downloading ${image.filename_download || image.id}`, color: 'green' });
    } catch (e) {
      notifications.show({ title: 'Download failed', message: 'Unable to download file', color: 'red' });
    }
  }, [image]);

  const handleSaveDetails = useCallback(async () => {
    if (!image) {
      return;
    }
    try {
      const updated = await daasAPI.updateFile(image.id, {
        title: editTitle,
        description: editDescription,
      });
      setImage({ ...image, ...toFileUpload(updated) });
      setEditOpen(false);
      notifications.show({ title: 'Saved', message: 'Image details updated', color: 'green' });
    } catch (e) {
      notifications.show({ title: 'Error', message: 'Failed to update image details', color: 'red' });
    }
  }, [image, editTitle, editDescription]);

  const handleApplyImageEdits = useCallback(async () => {
    if (!image) {
      return;
    }
    try {
      // Load original image (direct browser request, needs full /api path)
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      const sourceUrl = `/api/assets/${image.id}`;
      const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = sourceUrl;
      });

      // Compute canvas size with rotation
      const originalW = loaded.naturalWidth;
      const originalH = loaded.naturalHeight;
      const rotated = rotate === 90 || rotate === 270;
      const canvasW = rotated ? originalH : originalW;
      const canvasH = rotated ? originalW : originalH;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas not supported');
      }

      canvas.width = canvasW;
      canvas.height = canvasH;

      // Apply rotation
      ctx.save();
      switch (rotate) {
        case 90:
          ctx.translate(canvasW, 0);
          ctx.rotate(Math.PI / 2);
          break;
        case 180:
          ctx.translate(canvasW, canvasH);
          ctx.rotate(Math.PI);
          break;
        case 270:
          ctx.translate(0, canvasH);
          ctx.rotate((3 * Math.PI) / 2);
          break;
      }

      // Draw image
      ctx.drawImage(loaded, 0, 0);
      ctx.restore();

      // Crop to center square if requested
      let outputCanvas = canvas;
      if (cropSquare) {
        const size = Math.min(canvasW, canvasH);
        const sx = Math.floor((canvasW - size) / 2);
        const sy = Math.floor((canvasH - size) / 2);
        const c2 = document.createElement('canvas');
        c2.width = size;
        c2.height = size;
        const c2ctx = c2.getContext('2d');
        if (!c2ctx) {
          throw new Error('Canvas not supported');
        }
        c2ctx.drawImage(canvas, sx, sy, size, size, 0, 0, size, size);
        outputCanvas = c2;
      }

      // Export and upload
      const blob: Blob = await new Promise((resolve) => outputCanvas.toBlob((b) => resolve(b as Blob), 'image/png'));
      const file = new File([blob], `edited_${image.filename_download || image.id}.png`, { type: 'image/png' });

      const uploader = onUploadFiles || (async (files: File[], opts: { folder?: string; preset?: string }) => {
        const result = await daasAPI.uploadFiles(files, opts);
        return result.map(toFileUpload);
      });
      const uploaded = await uploader([file], { folder, preset });
      const uploadedFile = Array.isArray(uploaded) ? uploaded[0] : uploaded;
      if (uploadedFile) {
        setImage(uploadedFile);
        setEditTitle(uploadedFile.title || '');
        setEditDescription(uploadedFile.description || '');
        onChange?.(uploadedFile.id);
        setImageEditorOpen(false);
        setRotate(0);
        setCropSquare(false);
        notifications.show({ title: 'Image updated', message: 'Applied edits and saved new image', color: 'green' });
      }
    } catch (e: any) {
      notifications.show({ title: 'Edit failed', message: e?.message || 'Unable to apply edits', color: 'red' });
    }
  }, [image, rotate, cropSquare, onUploadFiles, onChange, folder, preset]);

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

  // Get width class styles
  const widthStyles = useMemo(() => {
    switch (width) {
      case 'full':
      case 'fill':
        return { width: '100%' };
      case 'half':
        return { width: '50%' };
      default:
        return {};
    }
  }, [width]);

  return (
    <Stack gap="xs" data-testid="file-image-component">
      {label && (
        <Group gap={6} align="center">
          <Text fw={500} size="sm" data-testid="file-image-label">{label}</Text>
          {readonly && <Badge size="xs" variant="light" data-testid="file-image-readonly-badge">Read only</Badge>}
        </Group>
      )}

      {/* Main area */}
      <Box
        className={`file-image ${crop ? 'crop' : ''}`}
        style={{ position: 'relative', ...widthStyles }}
        data-testid="file-image-container"
      >
        {loading ? (
          <Skeleton height={220} radius="sm" data-testid="file-image-loading" />
        ) : internalDisabled && !image ? (
          <Paper 
            withBorder 
            p="md" 
            data-testid="file-image-disabled"
            style={{ 
              height: 220, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: 'var(--mantine-color-gray-1)'
            }}
          >
            <Group gap={8} c="dimmed">
              <IconPhotoOff size={24} />
              <Text size="sm">{disabled ? 'Disabled' : 'No image selected'}</Text>
            </Group>
          </Paper>
        ) : image ? (
          <Box style={{ position: 'relative' }} data-testid="file-image-preview-container">
            <Box
              data-testid="file-image-preview"
              style={{
                position: 'relative',
                width: '100%',
                height: 220,
                overflow: 'hidden',
                borderRadius: 'var(--mantine-radius-sm)',
                background: 'var(--mantine-color-gray-0)',
              }}
            >
              {imageError || !srcPath ? (
                <Stack 
                  align="center" 
                  justify="center" 
                  gap={6}
                  data-testid="file-image-error"
                  style={{ height: '100%', color: 'var(--mantine-color-red-6)' }}
                >
                  <IconInfoCircle size={24} />
                  <Text size="xs">{imageError || 'Unsupported media type'}</Text>
                </Stack>
              ) : isImage ? (
                <VImageBase64
                  src={srcPath}
                  alt={image.title || image.filename_download}
                  className={`file-image-img ${letterbox ? 'letterbox' : ''}`}
                  data-testid="file-image-thumbnail"
                />
              ) : (
                <Stack 
                  align="center" 
                  justify="center" 
                  gap={6}
                  data-testid="file-image-fallback"
                  style={{ height: '100%' }}
                >
                  <IconPhoto size={48} color="var(--mantine-color-gray-5)" />
                  <Text size="xs" c="dimmed">No preview available</Text>
                </Stack>
              )}

              {/* Shadow overlay at bottom */}
              <Box
                className="file-image-shadow"
                data-testid="file-image-shadow"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '100%',
                  height: 60,
                  background: 'linear-gradient(180deg, rgba(38,50,56,0) 0%, rgba(38,50,56,0.5) 100%)',
                  pointerEvents: 'none',
                }}
              />

              {/* Actions */}
              {!readonly && (
                <Group 
                  justify="center" 
                  gap="xs" 
                  data-testid="file-image-actions"
                  style={{ 
                    position: 'absolute', 
                    top: 'calc(50% - 18px)', 
                    left: 0, 
                    width: '100%',
                    opacity: 0,
                    transition: 'opacity 0.2s ease',
                  }}
                  className="file-image-actions"
                >
                  <Tooltip label="Zoom">
                    <Button 
                      variant="white" 
                      size="xs" 
                      radius="xl" 
                      onClick={() => setLightboxOpen(true)}
                      data-testid="file-image-zoom-btn"
                    >
                      <IconZoomIn size={16} />
                    </Button>
                  </Tooltip>
                  <Tooltip label="Download">
                    <Button 
                      variant="white" 
                      size="xs" 
                      radius="xl" 
                      onClick={handleDownload}
                      data-testid="file-image-download-btn"
                    >
                      <IconDownload size={16} />
                    </Button>
                  </Tooltip>
                  {!internalDisabled && (
                    <>
                      <Tooltip label="Edit details">
                        <Button 
                          variant="white" 
                          size="xs" 
                          radius="xl" 
                          onClick={() => setEditOpen(true)} 
                          disabled={!updateAllowed}
                          data-testid="file-image-edit-btn"
                        >
                          <IconPencil size={16} />
                        </Button>
                      </Tooltip>
                      <Tooltip label="Edit image">
                        <Button 
                          variant="white" 
                          size="xs" 
                          radius="xl" 
                          onClick={() => setImageEditorOpen(true)} 
                          disabled={!updateAllowed || !isImage}
                          data-testid="file-image-editor-btn"
                        >
                          <IconAdjustments size={16} />
                        </Button>
                      </Tooltip>
                      <Tooltip label="Deselect">
                        <Button 
                          variant="white" 
                          size="xs" 
                          radius="xl" 
                          color="red" 
                          onClick={handleDeselect}
                          data-testid="file-image-deselect-btn"
                        >
                          <IconX size={16} />
                        </Button>
                      </Tooltip>
                    </>
                  )}
                </Group>
              )}

              {/* Info overlay */}
              <Box 
                data-testid="file-image-info"
                style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  left: 0, 
                  width: '100%', 
                  padding: '8px 12px', 
                  color: 'white',
                  zIndex: 1,
                }}
              >
                <Text size="sm" fw={600} truncate data-testid="file-image-title">
                  {image.title || image.filename_download || image.filename_disk}
                </Text>
                <Text size="xs" style={{ opacity: 0.8 }} data-testid="file-image-meta">
                  {meta}
                </Text>
              </Box>
            </Box>
          </Box>
        ) : (
          // No image selected -> show uploader
          <Box data-testid="file-image-uploader">
            <Upload
              multiple={false}
              fromUser={fromUser && createAllowed && enableCreate && !readonly}
              fromLibrary={fromLibrary && enableSelect && !readonly}
              fromUrl={fromUrl && !readonly}
              folder={folder}
              accept="image/*"
              onInput={handleUploadInput}
              onFetchLibraryFiles={onFetchLibraryFiles || handleFetchLibraryFiles}
              onUploadFiles={onUploadFiles || handleUploadFiles}
              onImportFromUrl={onImportFromUrl || handleImportFromUrl}
              preset={preset}
            />
          </Box>
        )}
      </Box>

      {/* Placeholder text when no image */}
      {!image && !loading && !internalDisabled && placeholder && (
        <Text size="sm" c="dimmed" data-testid="file-image-placeholder">{placeholder}</Text>
      )}

      {/* Zoom Lightbox Modal */}
      <Modal 
        opened={lightboxOpen} 
        onClose={() => setLightboxOpen(false)} 
        size="xl" 
        title={image?.title || 'Image Preview'}
        data-testid="file-image-lightbox-modal"
      >
        {image && (
          <Box data-testid="file-image-lightbox-content" style={{ textAlign: 'center' }}>
            <VImageBase64 
              src={`/assets/${image.id}`} 
              alt={image.title || image.filename_download} 
              className="file-image-lightbox-img"
              data-testid="file-image-lightbox-image"
            />
            <Group justify="center" mt="md" gap="xs">
              <Button 
                variant="light" 
                leftSection={<IconDownload size={16} />}
                onClick={handleDownload}
                data-testid="file-image-lightbox-download"
              >
                Download
              </Button>
            </Group>
          </Box>
        )}
      </Modal>

      {/* Edit Details Modal */}
      <Modal 
        opened={editOpen} 
        onClose={() => setEditOpen(false)} 
        title="Edit Image Details"
        data-testid="file-image-edit-modal"
      >
        <Stack>
          {image && (
            <Paper withBorder p="sm" data-testid="file-image-edit-preview">
              <Group>
                <Box style={{ width: 60, height: 60, borderRadius: 'var(--mantine-radius-sm)', overflow: 'hidden', backgroundColor: 'var(--mantine-color-gray-1)' }}>
                  <VImageBase64 
                    src={`/assets/${image.id}?key=system-small-cover`}
                    alt={image.title || image.filename_download}
                    className="file-image-edit-thumbnail"
                    data-testid="file-image-edit-thumbnail"
                  />
                </Box>
                <Box>
                  <Text fw={500} size="sm">{image.filename_download}</Text>
                  <Text size="xs" c="dimmed">{meta}</Text>
                </Box>
              </Group>
            </Paper>
          )}
          <TextInput 
            label="Title" 
            value={editTitle} 
            onChange={(e) => setEditTitle(e.currentTarget.value)} 
            disabled={!updateAllowed}
            data-testid="file-image-edit-title"
          />
          <Textarea 
            label="Description" 
            value={editDescription} 
            onChange={(e) => setEditDescription(e.currentTarget.value)} 
            disabled={!updateAllowed} 
            minRows={3}
            data-testid="file-image-edit-description"
          />
          <Group justify="flex-end">
            <Button 
              variant="outline" 
              onClick={() => setEditOpen(false)}
              data-testid="file-image-edit-cancel"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveDetails} 
              disabled={!updateAllowed}
              data-testid="file-image-edit-save"
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Image Editor Modal */}
      <Modal 
        opened={imageEditorOpen} 
        onClose={() => setImageEditorOpen(false)} 
        title="Edit Image"
        size="lg"
        data-testid="file-image-editor-modal"
      >
        <Stack>
          {image && (
            <Box data-testid="file-image-editor-preview" style={{ display: 'flex', justifyContent: 'center', backgroundColor: 'var(--mantine-color-gray-1)', borderRadius: 'var(--mantine-radius-sm)', padding: 'var(--mantine-spacing-md)' }}>
              <VImageBase64 
                src={`/assets/${image.id}`} 
                alt={image.title || image.filename_download} 
                className="file-image-editor-img"
                data-testid="file-image-editor-image"
              />
            </Box>
          )}
          
          <Text size="sm" fw={500}>Rotation</Text>
          <Group data-testid="file-image-editor-rotation">
            <Button 
              size="xs" 
              variant={rotate === 0 ? 'filled' : 'light'} 
              onClick={() => setRotate(0)}
              data-testid="file-image-rotate-0"
            >
              0°
            </Button>
            <Button 
              size="xs" 
              variant={rotate === 90 ? 'filled' : 'light'} 
              onClick={() => setRotate(90)}
              data-testid="file-image-rotate-90"
            >
              90°
            </Button>
            <Button 
              size="xs" 
              variant={rotate === 180 ? 'filled' : 'light'} 
              onClick={() => setRotate(180)}
              data-testid="file-image-rotate-180"
            >
              180°
            </Button>
            <Button 
              size="xs" 
              variant={rotate === 270 ? 'filled' : 'light'} 
              onClick={() => setRotate(270)}
              data-testid="file-image-rotate-270"
            >
              270°
            </Button>
          </Group>
          
          <Text size="sm" fw={500}>Crop</Text>
          <Group data-testid="file-image-editor-crop">
            <Button 
              size="xs" 
              variant={cropSquare ? 'filled' : 'light'} 
              onClick={() => setCropSquare((v) => !v)}
              data-testid="file-image-crop-square"
            >
              {cropSquare ? 'Square crop ✓' : 'Square crop'}
            </Button>
          </Group>
          
          <Group justify="flex-end" mt="md">
            <Button 
              variant="outline" 
              onClick={() => setImageEditorOpen(false)}
              data-testid="file-image-editor-cancel"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleApplyImageEdits} 
              disabled={!updateAllowed}
              data-testid="file-image-editor-apply"
            >
              Apply Changes
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* CSS for hover effects */}
      <style>{`
        .file-image-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: ${crop ? 'cover' : 'contain'};
        }
        
        .file-image-img.letterbox {
          padding: 32px;
          object-fit: contain;
        }
        
        .file-image-lightbox-img {
          max-width: 100%;
          max-height: 70vh;
          object-fit: contain;
        }
        
        .file-image-editor-img {
          max-width: 100%;
          max-height: 300px;
          object-fit: contain;
        }
        
        .file-image-edit-thumbnail {
          width: 60px;
          height: 60px;
          object-fit: cover;
        }
        
        .file-image-error {
          height: 100%;
          color: var(--mantine-color-dimmed);
        }
        
        [data-testid="file-image-preview-container"]:hover .file-image-actions,
        [data-testid="file-image-preview-container"]:focus-within .file-image-actions {
          opacity: 1 !important;
        }
        
        [data-testid="file-image-preview-container"]:hover .file-image-shadow {
          height: 100% !important;
          background: linear-gradient(180deg, rgba(38,50,56,0) 0%, rgba(38,50,56,0.6) 100%) !important;
        }
      `}</style>
    </Stack>
  );
};

export default FileImage;
