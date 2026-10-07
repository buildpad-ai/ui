import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { Files } from '../files/Files';

// Files uploads through the useFiles() hook (a hidden native <input
// type="file"> behind an "Upload File" button) since 2e6bee7; it no longer
// renders the <Upload> interface, so the upload is driven through that input.
const mockUploadFiles = jest.fn();

jest.mock('@buildpad/hooks', () => ({
  ...jest.requireActual('@buildpad/hooks'),
  useFiles: () => ({ uploadFiles: mockUploadFiles, fetchFiles: jest.fn() }),
  useFolders: () => ({ fetchFolders: jest.fn() }),
  daasAPI: {
    getFile: jest.fn(async (id: string) => ({
      id,
      filename_disk: `${id}.bin`,
      filename_download: `${id}.bin`,
      type: 'application/octet-stream',
      filesize: 1024,
      uploaded_on: '2024-01-01',
      uploaded_by: 'user-1',
    })),
    checkPermission: jest.fn(async () => true),
  },
}));

jest.mock('../upload', () => ({
  __esModule: true,
  // Files imports FileThumbnail and LibraryPickerModal from this barrel;
  // leaving them out of the mock renders them as undefined elements.
  FileThumbnail: ({ file }: any) => (
    <div data-testid={`thumb-${file?.id ?? 'unknown'}`} />
  ),
  LibraryPickerModal: ({ opened }: any) =>
    opened ? <div data-testid="library-picker" /> : null,
}));

const renderWithMantine = (ui: React.ReactElement) => render(<MantineProvider>{ui}</MantineProvider>);

describe('Files', () => {
  test('renders placeholder when empty', async () => {
    await act(async () => {
      renderWithMantine(<Files value={[]} />);
    });
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  // Formerly "uploads and lists files, supports reorder and remove": the
  // component has no reorder controls (and the old test never exercised any),
  // so the name now says what is checked.
  test('uploads and lists files, supports remove', async () => {
    mockUploadFiles.mockResolvedValueOnce([
      { id: 'f1', filename_disk: 'f1', filename_download: 'f1', type: 'image/png', filesize: 2048, uploaded_on: '2024-01-01', uploaded_by: 'u1' },
      { id: 'f2', filename_disk: 'f2', filename_download: 'f2', type: 'image/png', filesize: 2048, uploaded_on: '2024-01-01', uploaded_by: 'u1' },
    ]);
    const onChange = jest.fn();
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = renderWithMantine(<Files value={[]} onChange={onChange} limit={10} folder="folder-1" />));
    });

    // Upload two files through the hidden file input behind "Upload File"
    expect(screen.getByRole('button', { name: 'Upload File' })).toBeInTheDocument();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const picked = [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ];
    await userEvent.upload(fileInput, picked);

    expect(mockUploadFiles).toHaveBeenCalledWith(picked, { folder: 'folder-1' });

    // Should render two rows
    expect(await screen.findAllByTestId(/^thumb-f[12]$/)).toHaveLength(2);
    expect(screen.getByText('f1')).toBeInTheDocument();
    expect(screen.getByText('f2')).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(['f1', 'f2']);

    // Click remove on last item
    const removeButtons = screen.getAllByRole('button', { name: 'Remove file' });
    expect(removeButtons).toHaveLength(2);
    await userEvent.click(removeButtons[removeButtons.length - 1]);

    // onChange should emit remaining ids
    expect(onChange).toHaveBeenLastCalledWith(['f1']);
    expect(screen.queryByText('f2')).not.toBeInTheDocument();
  });
});
