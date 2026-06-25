/**
 * @buildpad/ui-files
 *
 * Files management UI for Buildpad projects — a full file manager
 * (upload, folders, grid/list, search, bulk delete, import-from-URL) and a
 * file detail view (metadata edit + preview). Built with Mantine v8 and the
 * @buildpad/hooks data layer.
 */

export { FileManager } from './FileManager';
export type { FileManagerProps } from './FileManager';

export { FileDetail } from './FileDetail';
export type { FileDetailProps } from './FileDetail';

export { FilesToolbar } from './FilesToolbar';
export type { FilesToolbarProps, FilesView } from './FilesToolbar';

export { FilesGrid } from './FilesGrid';
export type { FilesGridProps } from './FilesGrid';

export { FilesList } from './FilesList';
export type { FilesListProps } from './FilesList';

export { FileCard } from './FileCard';
export type { FileCardProps } from './FileCard';

export { FolderCard } from './FolderCard';
export type { FolderCardProps } from './FolderCard';

export { FolderBreadcrumb } from './FolderBreadcrumb';
export type { FolderBreadcrumbProps, FolderPathItem } from './FolderBreadcrumb';

export { NewFolderDialog } from './NewFolderDialog';
export type { NewFolderDialogProps } from './NewFolderDialog';

export { BulkActionsBar } from './BulkActionsBar';
export type { BulkActionsBarProps } from './BulkActionsBar';

export { DeleteConfirmModal } from './DeleteConfirmModal';
export type { DeleteConfirmModalProps } from './DeleteConfirmModal';

export { FilePreview } from './FilePreview';
export type { FilePreviewProps } from './FilePreview';

export { FileInfoPanel } from './FileInfoPanel';
export type { FileInfoPanelProps } from './FileInfoPanel';

export { FileMetadataForm } from './FileMetadataForm';
export type {
  FileMetadataFormProps,
  FileMetadataValues,
} from './FileMetadataForm';
