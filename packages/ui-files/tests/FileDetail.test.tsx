/**
 * FileDetail unit tests: the preview/details view and its RBAC gates.
 * `@buildpad/hooks` is mocked so no backend is required.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileDetail } from '../src/FileDetail';
import { mockFiles, mockFolders } from '../src/_fixtures';

const mocks = vi.hoisted(() => ({
  getFile: vi.fn(),
  updateFile: vi.fn(),
  replaceFile: vi.fn(),
  deleteFile: vi.fn(),
  getDownloadUrl: vi.fn(),
  fetchFolders: vi.fn(),
  usePermissions: vi.fn(),
}));

vi.mock('@buildpad/hooks', async () => {
  // The i18n hooks are used as they are.
  const i18n = await import('../../hooks/src/useBuildpadI18n');
  return {
    useBuildpadTranslations: i18n.useBuildpadTranslations,
    useBuildpadI18n: i18n.useBuildpadI18n,
    useFiles: () => ({
      getFile: mocks.getFile,
      updateFile: mocks.updateFile,
      replaceFile: mocks.replaceFile,
      deleteFile: mocks.deleteFile,
      getDownloadUrl: mocks.getDownloadUrl,
    }),
    useFolders: () => ({ fetchFolders: mocks.fetchFolders }),
    usePermissions: mocks.usePermissions,
  };
});

/** annual-report.pdf: not an image, so no focal point. */
const stored = mockFiles[1];

function ui(props: Partial<React.ComponentProps<typeof FileDetail>> = {}) {
  return (
    <MantineProvider>
      <FileDetail id={stored.id} {...props} />
    </MantineProvider>
  );
}

/** What the permissions hook answers: an administrator, or the listed actions on every collection. */
function grant(actions: string[], isAdmin = false, loading = false) {
  mocks.usePermissions.mockReturnValue({
    canPerform: (_collection: string, action: string) => isAdmin || actions.includes(action),
    isAdmin,
    loading,
  });
}

const loaded = () => screen.findByTestId('file-detail');
const titleInput = () => screen.getByLabelText('Title') as HTMLInputElement;
const saveButton = () => screen.getByTestId('file-metadata-save');

let show: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mocks.getFile.mockReset().mockResolvedValue(stored);
  mocks.updateFile.mockReset().mockResolvedValue({ ...stored, title: 'Annual report' });
  mocks.replaceFile.mockReset().mockResolvedValue(stored);
  mocks.deleteFile.mockReset().mockResolvedValue(undefined);
  mocks.getDownloadUrl.mockReset().mockResolvedValue('https://example.test/download');
  mocks.fetchFolders.mockReset().mockResolvedValue(mockFolders);
  grant([], true);
  show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
});

afterEach(() => {
  show.mockRestore();
});

describe('FileDetail', () => {
  it('shows the file with Delete, Replace and an editable metadata form for an administrator', async () => {
    render(ui());
    await loaded();
    expect(screen.getByRole('heading', { name: 'annual-report.pdf' })).toBeInTheDocument();
    expect(screen.getByTestId('file-detail-delete')).toBeInTheDocument();
    expect(screen.getByTestId('file-detail-replace')).toBeInTheDocument();
    expect(screen.getByTestId('file-detail-download')).toBeInTheDocument();
    expect(titleInput()).not.toBeDisabled();
    expect(saveButton()).not.toBeDisabled();
  });

  it('saves the metadata form', async () => {
    render(ui());
    await loaded();
    fireEvent.change(titleInput(), { target: { value: 'Annual report' } });
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(mocks.updateFile).toHaveBeenCalledWith(stored.id, expect.objectContaining({ title: 'Annual report' })),
    );
    expect(await screen.findByRole('heading', { name: 'Annual report' })).toBeInTheDocument();
  });

  it('shows a user with read access the file, a disabled form, and neither Delete nor Replace', async () => {
    grant(['read']);
    render(ui());
    await loaded();
    expect(screen.queryByTestId('file-detail-delete')).not.toBeInTheDocument();
    expect(screen.queryByTestId('file-detail-replace')).not.toBeInTheDocument();
    expect(screen.getByTestId('file-detail-download')).toBeInTheDocument();
    expect(titleInput()).toBeDisabled();
    expect(saveButton()).toBeDisabled();
  });

  describe('while the permissions are not known', () => {
    it('offers nothing that writes: no Delete, no Replace, a form that takes no edit', async () => {
      // What a user who will turn out to be an administrator gets meanwhile
      grant([], true, true);
      const view = render(ui());
      await loaded();

      expect(screen.queryByTestId('file-detail-delete')).not.toBeInTheDocument();
      expect(screen.queryByTestId('file-detail-replace')).not.toBeInTheDocument();
      expect(titleInput()).toBeDisabled();
      expect(saveButton()).toBeDisabled();
      // Reading does not wait: the file, its info and its downloads are there
      expect(screen.getByRole('heading', { name: 'annual-report.pdf' })).toBeInTheDocument();
      expect(screen.getByTestId('file-detail-download')).toBeInTheDocument();
      expect(screen.getByText('Open in new tab')).toBeInTheDocument();

      grant([], true);
      view.rerender(ui());
      expect(await screen.findByTestId('file-detail-delete')).toBeInTheDocument();
      expect(screen.getByTestId('file-detail-replace')).toBeInTheDocument();
      expect(titleInput()).not.toBeDisabled();
      expect(saveButton()).not.toBeDisabled();
      // The file was loaded once: the permissions arriving do not fetch it again
      expect(mocks.getFile).toHaveBeenCalledTimes(1);
    });

    it('a reader is never offered Delete, Replace or an editable form', async () => {
      grant([], false, true);
      const view = render(ui());
      await loaded();
      expect(screen.queryByTestId('file-detail-delete')).not.toBeInTheDocument();
      expect(screen.queryByTestId('file-detail-replace')).not.toBeInTheDocument();
      expect(titleInput()).toBeDisabled();

      grant(['read']);
      view.rerender(ui());
      expect(screen.queryByTestId('file-detail-delete')).not.toBeInTheDocument();
      expect(screen.queryByTestId('file-detail-replace')).not.toBeInTheDocument();
      expect(titleInput()).toBeDisabled();
      expect(saveButton()).toBeDisabled();
    });

    it('a later refresh of the permissions does not close the form under the user', async () => {
      const view = render(ui());
      await loaded();
      fireEvent.change(titleInput(), { target: { value: 'still typing' } });

      // The hook loads again (a renewed token, another scope) and answers from what it knew meanwhile
      grant([], true, true);
      view.rerender(ui());
      expect(titleInput()).not.toBeDisabled();
      expect(titleInput().value).toBe('still typing');
      expect(saveButton()).not.toBeDisabled();
      expect(screen.getByTestId('file-detail-delete')).toBeInTheDocument();
      expect(screen.getByTestId('file-detail-replace')).toBeInTheDocument();
    });
  });
});
