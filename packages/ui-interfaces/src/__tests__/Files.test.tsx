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
    getItems: jest.fn(async () => []),
    createItem: jest.fn(async () => ({})),
    deleteItem: jest.fn(async () => undefined),
  },
}));

jest.mock('../upload', () => ({
  __esModule: true,
  // Files imports FileThumbnail and LibraryPickerModal from this barrel;
  // leaving them out of the mock renders them as undefined elements.
  FileThumbnail: ({ file }: any) => (
    <div data-testid={`thumb-${file?.id ?? 'unknown'}`} />
  ),
  // Picking from the library: a button that selects file "lib-1".
  LibraryPickerModal: ({ opened, onSelect }: any) =>
    opened ? (
      <div data-testid="library-picker">
        <button
          type="button"
          onClick={() =>
            onSelect({
              id: 'lib-1',
              filename_disk: 'lib-1',
              filename_download: 'lib-1',
              type: 'text/plain',
              filesize: 1,
              uploaded_on: '2024-01-01',
              uploaded_by: 'u1',
            })
          }
        >
          pick lib-1
        </button>
      </div>
    ) : null,
}));

import { daasAPI } from '@buildpad/hooks';
import { ItemSaveHostProvider } from '@buildpad/services/relational-ui-context';

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

  // Inside the CollectionForm that saves the item, the form writes the
  // junction rows on Save: picking a file must not write one at once (Cancel
  // could not undo it), and on a new item there is nothing to link to yet.
  describe('junction writes', () => {
    beforeEach(() => {
      (daasAPI.createItem as jest.Mock).mockClear();
    });

    const pickFromLibrary = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Add Existing' }));
      await userEvent.click(await screen.findByRole('button', { name: 'pick lib-1' }));
    };

    test('stages a pick when the form that saves the item hosts the field', async () => {
      const onChange = jest.fn();
      await act(async () => {
        renderWithMantine(
          <ItemSaveHostProvider host={{ collection: 'docs', primaryKey: 5 }}>
            <Files value={[]} onChange={onChange} collection="docs" field="attachments" primaryKey={5} />
          </ItemSaveHostProvider>,
        );
      });

      await pickFromLibrary();

      expect(onChange).toHaveBeenLastCalledWith(['lib-1']);
      expect(daasAPI.createItem).not.toHaveBeenCalled();
    });

    test('writes the link at once without a host (standalone field)', async () => {
      await act(async () => {
        renderWithMantine(<Files value={[]} onChange={jest.fn()} collection="docs" field="attachments" primaryKey={5} />);
      });

      await pickFromLibrary();

      expect(daasAPI.createItem).toHaveBeenCalledWith('docs_daas_files', { docs_id: 5, daas_files_id: 'lib-1' });
    });

    test('writes the link at once for a field of another item than the host saves', async () => {
      await act(async () => {
        renderWithMantine(
          <ItemSaveHostProvider host={{ collection: 'pages', primaryKey: 5 }}>
            <Files value={[]} onChange={jest.fn()} collection="docs" field="attachments" primaryKey={5} />
          </ItemSaveHostProvider>,
        );
      });

      await pickFromLibrary();

      expect(daasAPI.createItem).toHaveBeenCalledTimes(1);
    });
  });
});
