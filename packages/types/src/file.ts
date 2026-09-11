/**
 * File Types
 * 
 * TypeScript type definitions for the Files module,
 * following the DaaS v11.12.0 specification.
 */

/**
 * File entity representing a file stored in the system.
 * Matches the daas_files table schema.
 */
export interface DaaSFile {
  /** Unique identifier for the file */
  id: string;
  
  /** Storage location identifier */
  storage: string;
  
  /** Filename as stored on disk */
  filename_disk: string | null;
  
  /** Original filename for downloads */
  filename_download: string;
  
  /** Display title for the file */
  title: string | null;
  
  /** MIME type of the file */
  type: string | null;
  
  /** Folder containing this file */
  folder: string | null;
  
  /** User who uploaded the file */
  uploaded_by: string | null;
  
  /** Timestamp when file was uploaded */
  uploaded_on: string | null;
  
  /** Timestamp when file was created (record) */
  created_on?: string;
  
  /** User who last modified the file */
  modified_by?: string | null;
  
  /** Timestamp when file was last modified */
  modified_on?: string;
  
  /** Character encoding for text files */
  charset?: string | null;
  
  /** File size in bytes */
  filesize: number;
  
  /** Image width in pixels */
  width?: number | null;
  
  /** Image height in pixels */
  height?: number | null;
  
  /** Duration in seconds (for video/audio) */
  duration?: number | null;
  
  /** Embed code/URL for external media */
  embed?: string | null;
  
  /** Description of the file */
  description?: string | null;
  
  /** Location metadata */
  location?: string | null;
  
  /** Tags array */
  tags?: string[];
  
  /** Additional metadata (EXIF, etc.) */
  metadata?: Record<string, unknown>;
  
  /** Focal point X coordinate for cropping */
  focal_point_x?: number | null;
  
  /** Focal point Y coordinate for cropping */
  focal_point_y?: number | null;
}

/**
 * File upload result matching Upload component's FileUpload interface
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

/**
 * Folder entity representing a folder for organizing files.
 */
export interface Folder {
  /** Unique identifier for the folder */
  id: string;
  
  /** Folder name */
  name: string;
  
  /** Parent folder ID (null for root) */
  parent: string | null;
  
  /** Timestamp when folder was created */
  created_at: string;
  
  /** Timestamp when folder was last updated */
  updated_at: string;
}

/**
 * Payload for creating a new file
 */
export interface FileCreatePayload {
  storage?: string;
  filename_download: string;
  title?: string;
  type?: string;
  folder?: string | null;
  description?: string;
  location?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  focal_point_x?: number;
  focal_point_y?: number;
}

/**
 * Payload for updating a file
 */
export interface FileUpdatePayload {
  filename_download?: string;
  title?: string;
  folder?: string | null;
  description?: string;
  location?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  focal_point_x?: number;
  focal_point_y?: number;
}

/**
 * Payload for importing a file from URL
 */
export interface FileImportPayload {
  /** URL to import file from */
  url: string;
  
  /** Optional file data to override */
  data?: Partial<FileCreatePayload>;
}

/**
 * File upload options
 */
export interface FileUploadOptions {
  /** Storage location */
  storage?: string;
  
  /** Optional folder to place file in */
  folder?: string;
  
  /** Custom title */
  title?: string;
  
  /** Description */
  description?: string;
  
  /** Progress callback */
  onProgress?: (progress: number) => void;
}

/**
 * Response for file list operations
 */
export interface FileListResponse {
  data: DaaSFile[];
  meta?: {
    filter_count?: number;
    total_count?: number;
  };
}

/**
 * Response for single file operations
 */
export interface FileResponse {
  data: DaaSFile;
}

/**
 * Query parameters for file list
 */
export interface FileQuery {
  /** Fields to include in response */
  fields?: string[];
  
  /** Filter conditions */
  filter?: Record<string, unknown>;
  
  /** Search query */
  search?: string;
  
  /** Sort fields */
  sort?: string[];
  
  /** Maximum items to return */
  limit?: number;
  
  /** Number of items to skip */
  offset?: number;
  
  /** Page number */
  page?: number;
  
  /** Metadata to include */
  meta?: string;
}

/**
 * Folder create payload
 */
export interface FolderCreatePayload {
  name: string;
  parent?: string | null;
}

/**
 * Folder update payload
 */
export interface FolderUpdatePayload {
  name?: string;
  parent?: string | null;
}

/**
 * Response for folder operations
 */
export interface FolderResponse {
  data: Folder;
}

/**
 * Response for folder list operations
 */
export interface FolderListResponse {
  data: Folder[];
  meta?: {
    filter_count?: number;
    total_count?: number;
  };
}

/**
 * MIME type categories
 */
export type FileCategory = 
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'archive'
  | 'code'
  | 'other';

/**
 * Get file category from MIME type
 */
export function getFileCategory(mimeType: string | null): FileCategory {
  if (!mimeType) return 'other';
  
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  
  // Document types
  if (
    mimeType === 'application/pdf' ||
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    mimeType.includes('sheet') ||
    mimeType.includes('presentation') ||
    mimeType.startsWith('text/')
  ) {
    return 'document';
  }
  
  // Archive types
  if (
    mimeType === 'application/zip' ||
    mimeType === 'application/x-rar-compressed' ||
    mimeType === 'application/x-7z-compressed' ||
    mimeType === 'application/gzip' ||
    mimeType === 'application/x-tar'
  ) {
    return 'archive';
  }
  
  // Code types
  if (
    mimeType === 'application/json' ||
    mimeType === 'application/javascript' ||
    mimeType === 'application/xml' ||
    mimeType === 'text/html' ||
    mimeType === 'text/css'
  ) {
    return 'code';
  }
  
  return 'other';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Get asset URL for a file
 */
export function getAssetUrl(fileId: string, options?: {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'inside' | 'outside';
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  download?: boolean;
}): string {
  const params = new URLSearchParams();
  
  if (options?.width) params.set('width', options.width.toString());
  if (options?.height) params.set('height', options.height.toString());
  if (options?.fit) params.set('fit', options.fit);
  if (options?.quality) params.set('quality', options.quality.toString());
  if (options?.format) params.set('format', options.format);
  if (options?.download) params.set('download', '');
  
  const queryString = params.toString();
  return `/api/assets/${fileId}${queryString ? `?${queryString}` : ''}`;
}

/**
 * Check if file is an image
 */
export function isImageFile(file: DaaSFile): boolean {
  return getFileCategory(file.type) === 'image';
}

/**
 * Check if file is a video
 */
export function isVideoFile(file: DaaSFile): boolean {
  return getFileCategory(file.type) === 'video';
}

/**
 * Check if file is an audio
 */
export function isAudioFile(file: DaaSFile): boolean {
  return getFileCategory(file.type) === 'audio';
}
