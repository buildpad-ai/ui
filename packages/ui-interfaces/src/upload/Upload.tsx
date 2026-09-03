'use client';

import React, { useCallback, useRef, useState } from 'react';
import './Upload.css';
import {
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Stack,
  Text,
  Paper,
  Modal,
  Pagination,
  SegmentedControl,
  Select,
  SimpleGrid,
  Table,
  ThemeIcon,
  TextInput,
  Loader,
  ActionIcon,
  FileButton,
  VisuallyHidden,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconUpload,
  IconPhoto,
  IconX,
  IconFolderOpen,
  IconLink,
  IconFile,
  IconFileText,
  IconFileMusic,
  IconFileZip,
  IconMovie,
  IconCode,
  IconLayoutGrid,
  IconList,
  IconSearch,
  IconFolder,
  IconChevronRight,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { getAssetUrl, getFileCategory } from '@buildpad/types';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import { interpolate, type DeepPartial, type InterfacesTranslations } from '@buildpad/utils';

/**
 * Locale-aware file size — the same thresholds, rounding and unit symbols as
 * `formatFileSize` in `@buildpad/types`, with the number itself formatted for
 * the active locale (decimal separator).
 */
const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
function formatSize(
  bytes: number,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
): string {
  if (bytes === 0) return `0 ${FILE_SIZE_UNITS[0]}`;
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${formatNumber(value, { maximumFractionDigits: 2, useGrouping: false })} ${FILE_SIZE_UNITS[i]}`;
}

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

/**
 * Placeholder library contents used only when no `onFetchLibraryFiles` is wired
 * (Storybook/demo). Kept module-level so it has a stable identity across renders.
 */
const MOCK_LIBRARY_FILES: FileUpload[] = [
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
];

/**
 * Per-category icons, mirroring `FileCard` in `@buildpad/ui-files` so a file
 * looks the same whether you see it in the file manager or in this picker.
 * A generic folder icon is deliberately NOT used here — these are files, and a
 * folder glyph reads as "directory", which is misleading.
 */
const CATEGORY_ICON_COMPONENT: Record<string, React.ComponentType<{ size?: number }>> = {
  image: IconPhoto,
  document: IconFileText,
  audio: IconFileMusic,
  video: IconMovie,
  archive: IconFileZip,
  code: IconCode,
  other: IconFile,
};

/**
 * Thumbnail for one file: a real (server-resized) image preview when the file is
 * an image and its binary is retrievable, otherwise a per-category icon.
 *
 * Two deliberate choices:
 * - Transform params (`width`/`height`/`fit`) rather than a `key=<preset>`. DaaS
 *   silently ignores unknown preset keys and streams the full-size original, so
 *   `key` neither resizes nor saves bandwidth.
 * - A category icon, never a folder glyph. A file record can exist with its
 *   binary missing from storage (the assets endpoint 404s), and the `onError`
 *   path must still communicate *what kind of file* this is.
 *
 * Exported so `Files` (and other interfaces that copy alongside `upload`) render
 * files identically to the library picker.
 */
export const FileThumbnail: React.FC<{
  file: FileUpload;
  /** Rendered box edge length in px. Also drives the requested image size. */
  size?: number;
  /** Icon size for the non-image fallback. Defaults to ~55% of `size`. */
  iconSize?: number;
}> = ({ file, size = 96, iconSize }) => {
  const [failed, setFailed] = useState(false);
  const category = getFileCategory(file.type ?? null);

  if (category === 'image' && !failed) {
    // Request 2x for hi-DPI, clamped so tiny avatars don't ask for huge renders.
    const requested = Math.min(Math.max(size * 2, 120), 480);
    return (
      <img
        src={getAssetUrl(file.id, { width: requested, height: requested, fit: 'cover' })}
        alt={file.title || file.filename_download}
        className="library-card-thumb-img"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  const Icon = CATEGORY_ICON_COMPONENT[category] ?? CATEGORY_ICON_COMPONENT.other;
  return (
    <ThemeIcon size={size} variant="light" radius="md" color="gray">
      <Icon size={iconSize ?? Math.round(size * 0.55)} />
    </ThemeIcon>
  );
};

/** A folder in the file library. Mirrors the DaaS `/folders` shape. */
export interface LibraryFolder {
  id: string;
  name: string;
  parent?: string | null;
}

export interface LibraryPickerModalProps {
  opened: boolean;
  onClose: () => void;
  /** Called with the chosen file. The caller decides whether to close. */
  onSelect: (file: FileUpload) => void;
  /** Restrict browsing to this folder (also the starting point). */
  folder?: string;
  /** Files per page. Default 24. */
  pageSize?: number;
  /** Initial layout. Default 'grid'. */
  defaultView?: 'grid' | 'list';
  /** Modal title. */
  title?: string;
  /** Fetch a page of files. Omit for a local mock set (Storybook/demo). */
  onFetchFiles?: (params: {
    page: number;
    limit: number;
    search: string;
    folder?: string;
  }) => Promise<{ files: FileUpload[]; total: number }>;
  /**
   * Fetch folders for browsing. Omit to hide all folder UI — the picker then
   * shows a flat list, which is the previous behaviour.
   */
  onFetchFolders?: (params: {
    parent: string | null;
    search?: string;
  }) => Promise<LibraryFolder[]>;
  /** Per-instance overrides of the dictionary strings (`interfaces.upload`) */
  translations?: DeepPartial<InterfacesTranslations['upload']>;
}

/**
 * The "Choose from library" browser: server-side search, pagination, grid/list
 * layouts, real thumbnails, and optional folder navigation.
 *
 * Exported so every interface that offers library selection (`Upload`, `Files`,
 * …) shares one implementation instead of re-deriving it.
 *
 * ### A note on pagination
 * This DaaS build cannot report a *filtered* total: `meta.total_count` is always
 * the unfiltered collection count, `meta.filter_count` only ever equals the
 * number of rows in the current page, and `aggregate[count]` is ignored. So a
 * numeric pager is only honest when nothing is filtering the list. When a search
 * term or folder is active we fall back to Prev/Next and infer "there is more"
 * from a full page. If a page comes back empty we step back automatically, so a
 * full final page can never strand the user on a phantom page.
 */
export const LibraryPickerModal: React.FC<LibraryPickerModalProps> = ({
  opened,
  onClose,
  onSelect,
  folder,
  pageSize: pageSizeDefault = 24,
  defaultView = 'grid',
  title,
  onFetchFiles,
  onFetchFolders,
  translations,
}) => {
  // Dictionary strings; the `title` prop wins over both the `translations`
  // prop and the provider dictionary.
  const t = useBuildpadTranslations((d) => d.interfaces.upload, translations, { library: { title } });
  const { formatNumber } = useBuildpadI18n();
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeDefault);
  const [view, setView] = useState<'grid' | 'list'>(defaultView);

  // Folder browsing state. `path` powers the breadcrumb.
  const [currentFolder, setCurrentFolder] = useState<string | null>(folder ?? null);
  const [path, setPath] = useState<Array<{ id: string; name: string }>>([]);

  // The debounced mirror drives the fetch, so typing issues one request after the
  // user pauses rather than one per keystroke (same approach as FileManager).
  const [debouncedSearch] = useDebouncedValue(search, 300);

  const foldersEnabled = Boolean(onFetchFolders);
  const searching = Boolean(debouncedSearch.trim());
  // With either of these active the reported total is not trustworthy.
  const filtered = searching || currentFolder !== null;

  // Keep fetchers in refs so the effects don't re-run merely because a consumer
  // passed a new function identity on re-render.
  const filesFetcherRef = useRef(onFetchFiles);
  const foldersFetcherRef = useRef(onFetchFolders);
  React.useEffect(() => {
    filesFetcherRef.current = onFetchFiles;
    foldersFetcherRef.current = onFetchFolders;
  }, [onFetchFiles, onFetchFolders]);

  // Reset transient state each time the modal opens.
  React.useEffect(() => {
    if (!opened) return;
    setSearch('');
    setPage(1);
    setCurrentFolder(folder ?? null);
    setPath([]);
  }, [opened, folder]);

  // A new search term, page size, or folder invalidates the page number.
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize, currentFolder]);

  // Fetch files. `search` is a real dependency here — that is what makes the
  // search box work; the server filters via the DaaS `search` query param.
  React.useEffect(() => {
    if (!opened) return;

    const fetcher = filesFetcherRef.current;

    // Demo mode: page/filter the mock set locally so the picker behaves the same
    // way it does against a real backend.
    if (!fetcher) {
      const term = debouncedSearch.trim().toLowerCase();
      const matches = term
        ? MOCK_LIBRARY_FILES.filter((file) =>
            `${file.title ?? ''} ${file.filename_download}`.toLowerCase().includes(term)
          )
        : MOCK_LIBRARY_FILES;
      const start = (page - 1) * pageSize;
      setFiles(matches.slice(start, start + pageSize));
      setTotal(matches.length);
      setError(null);
      return;
    }

    // Guard against out-of-order responses: only the latest request may commit.
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher({
      page,
      limit: pageSize,
      search: debouncedSearch,
      folder: currentFolder ?? undefined,
    })
      .then((result) => {
        if (cancelled) return;
        // Handle both { files, total } and bare-array responses.
        const raw = Array.isArray(result) ? result : (result?.files ?? []);
        const safe = Array.isArray(raw) ? raw : [];
        // An empty page beyond the first means we overshot — step back rather
        // than showing a phantom "no files" page.
        if (safe.length === 0 && page > 1) {
          setPage((p) => Math.max(1, p - 1));
          return;
        }
        setFiles(safe);
        setTotal(Array.isArray(result) ? result.length : (result?.total ?? safe.length));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to fetch library files:', err);
        setFiles([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : t.library.loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [opened, debouncedSearch, page, pageSize, currentFolder, t]);

  // Fetch folders for the current level (or matching the search).
  React.useEffect(() => {
    if (!opened) return;
    const fetcher = foldersFetcherRef.current;
    if (!fetcher) {
      setFolders([]);
      return;
    }

    let cancelled = false;
    fetcher(
      searching
        ? { parent: null, search: debouncedSearch }
        : { parent: currentFolder }
    )
      .then((result) => {
        if (cancelled) return;
        setFolders(Array.isArray(result) ? result : []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to fetch library folders:', err);
        setFolders([]);
      });

    return () => {
      cancelled = true;
    };
  }, [opened, currentFolder, debouncedSearch, searching]);

  const openFolder = useCallback((target: LibraryFolder) => {
    setPath((prev) => [...prev, { id: target.id, name: target.name }]);
    setCurrentFolder(target.id);
    setSearch('');
  }, []);

  const navigateTo = useCallback(
    (folderId: string | null) => {
      if (folderId === null) {
        setPath([]);
        setCurrentFolder(folder ?? null);
      } else {
        setPath((prev) => {
          const idx = prev.findIndex((p) => p.id === folderId);
          return idx >= 0 ? prev.slice(0, idx + 1) : prev;
        });
        setCurrentFolder(folderId);
      }
      setSearch('');
    },
    [folder]
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  // Full page ⇒ assume another page exists (see the pagination note above).
  const hasMore = files.length === pageSize;
  const isEmpty = files.length === 0 && folders.length === 0;

  return (
    <Modal opened={opened} onClose={onClose} title={t.library.title} size="xl" data-testid="library-modal">
      <Stack gap="sm">
        {/* Toolbar: search + layout toggle */}
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <TextInput
            style={{ flex: 1 }}
            placeholder={t.library.searchPlaceholder}
            aria-label={t.library.searchAriaLabel}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftSection={<IconSearch size={14} />}
            rightSection={
              loading ? (
                <Loader size="xs" />
              ) : search ? (
                <ActionIcon
                  variant="subtle"
                  onClick={() => setSearch('')}
                  aria-label={t.library.clearSearch}
                >
                  <IconX size={14} />
                </ActionIcon>
              ) : null
            }
            data-testid="library-search"
          />
          <SegmentedControl
            value={view}
            onChange={(value) => setView(value as 'grid' | 'list')}
            aria-label={t.library.layoutAriaLabel}
            data-testid="library-view-toggle"
            data={[
              {
                value: 'grid',
                // Icon-only control: the visually-hidden text is what gives the
                // radio an accessible name for screen readers.
                label: (
                  <Center title={t.library.gridView}>
                    <IconLayoutGrid size={16} />
                    <VisuallyHidden>{t.library.gridView}</VisuallyHidden>
                  </Center>
                ),
              },
              {
                value: 'list',
                label: (
                  <Center title={t.library.listView}>
                    <IconList size={16} />
                    <VisuallyHidden>{t.library.listView}</VisuallyHidden>
                  </Center>
                ),
              },
            ]}
          />
        </Group>

        {/* Folder breadcrumb */}
        {foldersEnabled && !searching && (
          <Group gap={4} wrap="wrap" data-testid="library-breadcrumb">
            <Anchor
              component="button"
              type="button"
              size="xs"
              underline="never"
              onClick={() => navigateTo(null)}
              c={path.length === 0 ? 'dimmed' : undefined}
            >
              {t.library.breadcrumbRoot}
            </Anchor>
            {path.map((segment, index) => (
              <Group gap={4} key={segment.id} wrap="nowrap">
                <IconChevronRight size={12} color="var(--mantine-color-dimmed)" />
                <Anchor
                  component="button"
                  type="button"
                  size="xs"
                  underline="never"
                  onClick={() => navigateTo(segment.id)}
                  c={index === path.length - 1 ? 'dimmed' : undefined}
                >
                  {segment.name}
                </Anchor>
              </Group>
            ))}
          </Group>
        )}

        <Box style={{ minHeight: 260 }}>
          {loading ? (
            <Stack align="center" justify="center" style={{ height: 260 }}>
              <Loader />
              <Text size="sm" c="dimmed">{t.library.loading}</Text>
            </Stack>
          ) : error ? (
            <Stack align="center" justify="center" style={{ height: 260 }} gap="xs">
              <IconFile size={44} color="var(--mantine-color-gray-5)" />
              <Text c="red" size="sm" data-testid="library-error">{error}</Text>
            </Stack>
          ) : isEmpty ? (
            <Stack align="center" justify="center" style={{ height: 260 }} gap="xs">
              <IconFolderOpen size={44} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed" data-testid="library-empty">
                {debouncedSearch ? interpolate(t.library.noMatch, { search: debouncedSearch }) : t.library.empty}
              </Text>
            </Stack>
          ) : view === 'grid' ? (
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="sm">
              {folders.map((entry) => (
                <Paper
                  key={`folder-${entry.id}`}
                  withBorder
                  radius="md"
                  className="library-card"
                  role="button"
                  tabIndex={0}
                  aria-label={interpolate(t.library.openFolder, { name: entry.name })}
                  onClick={() => openFolder(entry)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openFolder(entry);
                    }
                  }}
                  data-testid={`library-folder-${entry.id}`}
                >
                  <div className="library-card-thumb">
                    <ThemeIcon size={52} variant="light" radius="md" color="gray">
                      <IconFolder size={28} />
                    </ThemeIcon>
                  </div>
                  <Box p="xs">
                    <Text size="xs" fw={500} lineClamp={1} title={entry.name}>
                      {entry.name}
                    </Text>
                    <Text size="xs" c="dimmed">{t.library.folder}</Text>
                  </Box>
                </Paper>
              ))}

              {files.map((file) => {
                const name = file.title || file.filename_download;
                const category = getFileCategory(file.type ?? null);
                return (
                  <Paper
                    key={file.id}
                    withBorder
                    radius="md"
                    className="library-card"
                    role="button"
                    tabIndex={0}
                    aria-label={interpolate(t.library.selectFile, { name })}
                    onClick={() => onSelect(file)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(file);
                      }
                    }}
                    data-testid={`library-file-${file.id}`}
                  >
                    <div className="library-card-thumb">
                      <FileThumbnail file={file} size={52} />
                    </div>
                    <Box p="xs">
                      <Text size="xs" fw={500} lineClamp={1} title={name}>
                        {name}
                      </Text>
                      <Group justify="space-between" gap={4} wrap="nowrap" mt={2}>
                        <Badge
                          size="xs"
                          variant="light"
                          color="gray"
                          style={{ textTransform: 'capitalize' }}
                        >
                          {t.categories[category]}
                        </Badge>
                        <Text size="xs" c="dimmed">{formatSize(file.filesize || 0, formatNumber)}</Text>
                      </Group>
                    </Box>
                  </Paper>
                );
              })}
            </SimpleGrid>
          ) : (
            <Table highlightOnHover verticalSpacing="xs" data-testid="library-table">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={44} />
                  <Table.Th>{t.library.columns.name}</Table.Th>
                  <Table.Th w={120}>{t.library.columns.type}</Table.Th>
                  <Table.Th w={100}>{t.library.columns.size}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {folders.map((entry) => (
                  <Table.Tr
                    key={`folder-${entry.id}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => openFolder(entry)}
                    data-testid={`library-folder-${entry.id}`}
                  >
                    <Table.Td>
                      <div className="library-row-thumb">
                        <ThemeIcon size={32} variant="light" radius="md" color="gray">
                          <IconFolder size={18} />
                        </ThemeIcon>
                      </div>
                    </Table.Td>
                    <Table.Td><Text size="sm">{entry.name}</Text></Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="light" color="gray">{t.library.folder}</Badge>
                    </Table.Td>
                    <Table.Td />
                  </Table.Tr>
                ))}
                {files.map((file) => {
                  const name = file.title || file.filename_download;
                  const category = getFileCategory(file.type ?? null);
                  return (
                    <Table.Tr
                      key={file.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onSelect(file)}
                      data-testid={`library-file-${file.id}`}
                    >
                      <Table.Td>
                        <div className="library-row-thumb">
                          <FileThumbnail file={file} size={32} />
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={1} title={name}>{name}</Text>
                        {file.title && (
                          <Text size="xs" c="dimmed" lineClamp={1}>{file.filename_download}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="xs"
                          variant="light"
                          color="gray"
                          style={{ textTransform: 'capitalize' }}
                        >
                          {t.categories[category]}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">{formatSize(file.filesize || 0, formatNumber)}</Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Box>

        {/* Footer: result count, page size, pagination */}
        {(files.length > 0 || page > 1) && (
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Group gap="sm" wrap="nowrap">
              <Text size="xs" c="dimmed" data-testid="library-count">
                {filtered
                  ? interpolate(t.library.showingRange, {
                      start: rangeStart,
                      end: rangeStart + Math.max(files.length - 1, 0),
                    })
                  : interpolate(t.library.showingRangeOfTotal, { start: rangeStart, end: rangeEnd, total })}
              </Text>
              <Select
                size="xs"
                w={110}
                aria-label={t.library.filesPerPage}
                value={String(pageSize)}
                onChange={(value) => value && setPageSize(Number(value))}
                data={['12', '24', '48', '96'].map((n) => ({
                  value: n,
                  label: interpolate(t.library.perPageOption, { count: n }),
                }))}
                data-testid="library-page-size"
              />
            </Group>

            {filtered ? (
              // Filtered: no trustworthy total, so offer relative navigation only.
              <Group gap="xs" data-testid="library-pagination-relative">
                <Button
                  size="xs"
                  variant="default"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t.library.previous}
                </Button>
                <Text size="xs" c="dimmed">{interpolate(t.library.pageNumber, { page })}</Text>
                <Button
                  size="xs"
                  variant="default"
                  disabled={!hasMore}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t.library.next}
                </Button>
              </Group>
            ) : (
              totalPages > 1 && (
                <Pagination
                  size="sm"
                  value={page}
                  onChange={setPage}
                  total={totalPages}
                  siblings={1}
                  data-testid="library-pagination"
                />
              )
            )}
          </Group>
        )}
      </Stack>
    </Modal>
  );
};

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
  /** Files per page in the library picker. Default 24. */
  libraryPageSize?: number;
  /** Initial layout of the library picker. Default 'grid'. */
  libraryDefaultView?: 'grid' | 'list';
  /** Function to fetch files from library */
  onFetchLibraryFiles?: (params: {
    page: number;
    limit: number;
    search: string;
    folder?: string;
  }) => Promise<{ files: FileUpload[]; total: number }>;
  /**
   * Fetch folders for the library picker. Provide it to enable folder browsing
   * (breadcrumb + folder tiles); omit it for a flat library.
   */
  onFetchLibraryFolders?: (params: {
    parent: string | null;
    search?: string;
  }) => Promise<LibraryFolder[]>;
  /** Function to upload files */
  onUploadFiles?: (files: File[], options: { folder?: string; preset?: string }) => Promise<FileUpload[]>;
  /** Function to import from URL */
  onImportFromUrl?: (url: string, options: { folder?: string }) => Promise<FileUpload>;
  /** Per-instance overrides of the dictionary strings (`interfaces.upload`) */
  translations?: DeepPartial<InterfacesTranslations['upload']>;
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
  libraryPageSize: libraryPageSizeDefault = 24,
  libraryDefaultView = 'grid',
  onFetchLibraryFiles,
  onFetchLibraryFolders,
  onUploadFiles,
  onImportFromUrl,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.interfaces.upload, translations);
  const { formatCount } = useBuildpadI18n();
  const [uploading, setUploading] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(autoOpenLibrary);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dropzoneRef = useRef<HTMLDivElement>(null);

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
        title: t.notifications.uploadComplete.title,
        message: formatCount(uploadedFiles.length, t.notifications.uploadComplete.message),
        color: 'green',
      });
    } catch (error) {
      console.error('Upload error:', error);
      notifications.show({
        title: t.notifications.uploadFailed.title,
        message: error instanceof Error ? error.message : t.notifications.uploadFailed.message,
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  }, [folder, preset, multiple, onInput, onUploadFiles, t, formatCount]);

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
        title: t.notifications.importComplete.title,
        message: t.notifications.importComplete.message,
        color: 'green',
      });
    } catch (error) {
      console.error('Import error:', error);
      notifications.show({
        title: t.notifications.importFailed.title,
        message: error instanceof Error ? error.message : t.notifications.importFailed.message,
        color: 'red',
      });
    } finally {
      setImporting(false);
    }
  }, [importUrl, folder, multiple, onInput, onImportFromUrl, t]);

  // Opening only flips state — LibraryPickerModal owns its own fetching, so the
  // modal can't issue two competing requests for the same open.
  const handleOpenLibrary = useCallback(() => setLibraryOpen(true), []);
  const handleCloseLibrary = useCallback(() => setLibraryOpen(false), []);

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
              <Text size="sm" c="dimmed">{t.dropzone.uploading}</Text>
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
                  {isDragOver ? t.dropzone.dropHere : t.dropzone.dragHint}
                </Text>
                <Text size="sm" c="dimmed" inline mt={7}>
                  {accept ? interpolate(t.dropzone.accepts, { accept: acceptString }) : t.dropzone.acceptsAll}
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
                        {t.actions.fromDevice}
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
                    {t.actions.fromLibrary}
                  </Button>
                )}

                {fromUrl && (
                  <Button
                    variant="default"
                    leftSection={<IconLink size={16} />}
                    onClick={() => setUrlDialogOpen(true)}
                    data-testid="import-from-url-btn"
                  >
                    {t.actions.fromUrl}
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
        title={t.urlDialog.title}
        data-testid="url-import-modal"
      >
        <Stack>
          <TextInput
            label={t.urlDialog.urlLabel}
            placeholder={t.urlDialog.urlPlaceholder}
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            disabled={importing}
            data-testid="url-input"
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setUrlDialogOpen(false)}>
              {t.urlDialog.cancel}
            </Button>
            <Button
              onClick={handleImportFromUrl}
              loading={importing}
              disabled={!isValidUrl}
              data-testid="import-btn"
            >
              {t.urlDialog.import}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Library Browser Dialog — shared implementation, see LibraryPickerModal */}
      <LibraryPickerModal
        opened={libraryOpen}
        onClose={handleCloseLibrary}
        onSelect={handleSelectLibraryFile}
        folder={folder}
        pageSize={libraryPageSizeDefault}
        defaultView={libraryDefaultView}
        onFetchFiles={onFetchLibraryFiles}
        onFetchFolders={onFetchLibraryFolders}
        translations={translations}
      />
    </Box>
  );
};

export default Upload;
