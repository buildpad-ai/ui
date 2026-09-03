'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Button,
  Center,
  FileButton,
  Grid,
  Group,
  Loader,
  Paper,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconDownload,
  IconExternalLink,
  IconReplace,
  IconTrash,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { getAssetUrl, formatFileSize, getFileCategory } from '@buildpad/types';
import {
  useBuildpadTranslations,
  useFiles,
  useFolders,
  usePermissions,
  type FileUpload,
  type Folder,
} from '@buildpad/hooks';
import { interpolate, type DeepPartial, type FilesTranslations } from '@buildpad/utils';
import { FilePreview } from './FilePreview';
import { FileMetadataForm, type FileMetadataValues, type FolderOption } from './FileMetadataForm';
import { FileInfoPanel } from './FileInfoPanel';
import { DeleteConfirmModal } from './DeleteConfirmModal';

export interface FileDetailProps {
  /** File id to display. */
  id: string;
  /** Called after the file is deleted (e.g. navigate back to the list). */
  onDeleted?: () => void;
  /** Called when the back button is pressed. */
  onBack?: () => void;
  /** DaaS collection used for RBAC checks. */
  filesCollection?: string;
  /**
   * Per-instance overrides of the `files` dictionary namespace, forwarded to
   * every sub-component (prop > `BuildpadI18nProvider` > English defaults).
   */
  translations?: DeepPartial<FilesTranslations>;
}

/**
 * File detail surface: Preview/Details tabs + a read-only info panel and
 * actions (replace, download, open, delete). Metadata edits, folder moves,
 * focal point, and destructive actions are gated by DaaS permissions.
 */
export const FileDetail: React.FC<FileDetailProps> = ({
  id,
  onDeleted,
  onBack,
  filesCollection = 'daas_files',
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.files, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const { getFile, updateFile, replaceFile, deleteFile, getDownloadUrl } = useFiles();
  const { fetchFolders } = useFolders();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [filesCollection],
  });

  // Optimistic while permissions resolve, then enforce; admins bypass.
  const updateAllowed = permsLoading || isAdmin || canPerform(filesCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(filesCollection, 'delete');

  const [file, setFile] = useState<FileUpload | null>(null);
  const [folderOptions, setFolderOptions] = useState<FolderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getFile(id)
      .then((f) => {
        if (!cancelled) setFile(f);
      })
      .catch((err) => {
        if (!cancelled) {
          notifications.show({
            color: 'red',
            title: t.fileDetail.notifications.loadFailedTitle,
            message: err instanceof Error ? err.message : t.unknownError,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, getFile, t]);

  useEffect(() => {
    let cancelled = false;
    fetchFolders({})
      .then((folders: Folder[]) => {
        if (!cancelled) {
          setFolderOptions(folders.map((f) => ({ value: f.id, label: f.name })));
        }
      })
      .catch(() => {
        /* folders are optional for the detail view */
      });
    return () => {
      cancelled = true;
    };
  }, [fetchFolders]);

  const handleSave = useCallback(
    async (values: FileMetadataValues) => {
      setSaving(true);
      try {
        const updated = await updateFile(id, {
          title: values.title,
          description: values.description,
          tags: values.tags,
          location: values.location,
          filename_download: values.filename_download,
          folder: values.folder,
          focal_point_x: values.focal_point_x,
          focal_point_y: values.focal_point_y,
        });
        setFile(updated);
        notifications.show({ color: 'green', message: t.fileDetail.notifications.saved });
      } catch (err) {
        notifications.show({
          color: 'red',
          title: t.fileDetail.notifications.saveFailedTitle,
          message: err instanceof Error ? err.message : t.unknownError,
        });
      } finally {
        setSaving(false);
      }
    },
    [id, updateFile, t]
  );

  const handleReplace = useCallback(
    async (newFile: File | null) => {
      if (!newFile) return;
      setReplacing(true);
      try {
        const updated = await replaceFile(id, newFile);
        setFile(updated);
        notifications.show({ color: 'green', message: t.fileDetail.notifications.replaced });
      } catch (err) {
        notifications.show({
          color: 'red',
          title: t.fileDetail.notifications.replaceFailedTitle,
          message: err instanceof Error ? err.message : t.unknownError,
        });
      } finally {
        setReplacing(false);
      }
    },
    [id, replaceFile, t]
  );

  const handleDownload = useCallback(async () => {
    try {
      const url = await getDownloadUrl(id);
      window.open(url, '_blank', 'noopener');
    } catch {
      window.open(getAssetUrl(id, { download: true }), '_blank', 'noopener');
    }
  }, [id, getDownloadUrl]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteFile(id);
      notifications.show({ color: 'green', message: t.fileDetail.notifications.deleted });
      setDeleteOpen(false);
      onDeleted?.();
    } catch (err) {
      notifications.show({
        color: 'red',
        title: t.fileDetail.notifications.deleteFailedTitle,
        message: err instanceof Error ? err.message : t.unknownError,
      });
    } finally {
      setDeleting(false);
    }
  }, [id, deleteFile, onDeleted, t]);

  if (loading) {
    return (
      <Center mih={320}>
        <Loader />
      </Center>
    );
  }

  if (!file) {
    return (
      <Center mih={320}>
        <Text c="dimmed">{t.fileDetail.notFound}</Text>
      </Center>
    );
  }

  const isImage = getFileCategory(file.type) === 'image';

  return (
    <Stack gap="md" data-testid="file-detail">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          {onBack && (
            <ActionIcon variant="subtle" onClick={onBack} aria-label={t.fileDetail.backAriaLabel}>
              <IconArrowLeft size={18} />
            </ActionIcon>
          )}
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Title order={4} lineClamp={1}>
              {file.title || file.filename_download}
            </Title>
            <Text size="xs" c="dimmed">
              {interpolate(t.fileDetail.subtitle, {
                type: file.type || t.fileDetail.unknownType,
                size: formatFileSize(file.filesize),
              })}
            </Text>
          </Stack>
        </Group>

        {deleteAllowed && (
          <Button
            color="red"
            variant="light"
            leftSection={<IconTrash size={16} />}
            onClick={() => setDeleteOpen(true)}
            data-testid="file-detail-delete"
          >
            {common.delete}
          </Button>
        )}
      </Group>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Tabs defaultValue="preview">
            <Tabs.List>
              <Tabs.Tab value="preview">{t.fileDetail.tabs.preview}</Tabs.Tab>
              <Tabs.Tab value="details">{t.fileDetail.tabs.details}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="preview" pt="md">
              <Paper withBorder radius="md" p="md">
                <FilePreview file={file} translations={translations} />
              </Paper>
            </Tabs.Panel>

            <Tabs.Panel value="details" pt="md">
              <FileMetadataForm
                file={file}
                saving={saving}
                disabled={!updateAllowed}
                folderOptions={folderOptions}
                showFocalPoint={isImage}
                onSave={handleSave}
                translations={translations}
              />
            </Tabs.Panel>
          </Tabs>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
            <FileInfoPanel file={file} translations={translations} />

            <Paper withBorder radius="md" p="md">
              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  {t.fileDetail.actions.heading}
                </Text>
                <Button
                  variant="default"
                  leftSection={<IconDownload size={16} />}
                  onClick={handleDownload}
                  fullWidth
                  data-testid="file-detail-download"
                >
                  {common.download}
                </Button>
                <Button
                  variant="default"
                  leftSection={<IconExternalLink size={16} />}
                  component="a"
                  href={getAssetUrl(file.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  fullWidth
                >
                  {t.fileDetail.actions.openInNewTab}
                </Button>
                {updateAllowed && (
                  <FileButton onChange={handleReplace}>
                    {(props) => (
                      <Button
                        {...props}
                        variant="light"
                        leftSection={<IconReplace size={16} />}
                        loading={replacing}
                        fullWidth
                        data-testid="file-detail-replace"
                      >
                        {t.fileDetail.actions.replaceFile}
                      </Button>
                    )}
                  </FileButton>
                )}
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>

      <DeleteConfirmModal
        opened={deleteOpen}
        count={1}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        translations={translations}
      />
    </Stack>
  );
};

export default FileDetail;
