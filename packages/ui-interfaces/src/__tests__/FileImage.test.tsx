import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileImage } from '../file-image/FileImage';
import { MantineProvider } from '@mantine/core';
function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

// Mocks
jest.mock('@buildpad/hooks', () => {
  // FileImage talks to the DaaS Files API through `daasAPI` (get for previews
  // and downloads, updateFile for metadata — see 0dce257). In the real module
  // `api` is just an alias of `daasAPI`, so mirror that here.
  const daasAPI = {
    get: jest.fn(),
    getFile: jest.fn(),
    updateFile: jest.fn(),
    uploadFiles: jest.fn(),
    checkPermission: jest.fn(),
  };
  return {
    ...jest.requireActual('@buildpad/hooks'),
    api: daasAPI,
    daasAPI,
  };
});

jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }));

// Mock Upload component to expose props and allow triggering onInput easily
jest.mock('../upload', () => {
  return {
    __esModule: true,
    Upload: ({ onInput, fromUser, fromUrl, fromLibrary, accept }: any) => (
      <button
        type="button"
        data-testid="upload"
        data-fromuser={String(!!fromUser)}
        data-fromurl={String(!!fromUrl)}
        data-fromlibrary={String(!!fromLibrary)}
        data-accept={accept}
        onClick={() => onInput && onInput({ id: 'new-file-id', type: 'image/png', filename_download: 'x.png', filename_disk: 'x.png', filesize: 100, uploaded_on: '2024-01-01', uploaded_by: 'user-1' })}
      >
        MockUpload
      </button>
    ),
  };
});

// Handy accessors
const { daasAPI } = jest.requireMock('@buildpad/hooks');

// Helpers
const makeImageFile = (overrides: Partial<any> = {}) => ({
  id: 'img-1',
  type: 'image/png',
  title: 'My Image',
  filename_download: 'image.png',
  filename_disk: 'image.png',
  width: 200,
  height: 100,
  filesize: 2048,
  uploaded_on: '2024-01-01T00:00:00Z',
  uploaded_by: 'user-1',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();

  // Default: allow both create + update
  (daasAPI.checkPermission as jest.Mock)
    .mockResolvedValueOnce(true) // create
    .mockResolvedValueOnce(true); // update

  // Default file fetch
  (daasAPI.getFile as jest.Mock).mockResolvedValue(makeImageFile());

  // Update file metadata
  (daasAPI.updateFile as jest.Mock).mockResolvedValue(makeImageFile({ title: 'New Title', description: 'New Desc' }));

  // Upload files
  (daasAPI.uploadFiles as jest.Mock).mockResolvedValue([makeImageFile({ id: 'uploaded-1' })]);

  // daasAPI.get for previews and downloads
  (daasAPI.get as jest.Mock).mockImplementation((_url: string, opts: any = {}) => {
    if (opts.responseType === 'arraybuffer') {
      const buf = new Uint8Array([1, 2, 3]).buffer;
      return Promise.resolve({ data: buf, headers: { 'content-type': 'image/png' } });
    }
    if (opts.responseType === 'blob') {
      const bytes = new Uint8Array([1, 2, 3]);
      return Promise.resolve({ data: bytes, headers: { 'content-type': 'image/png' } });
    }
    return Promise.resolve({ data: {}, headers: {} });
  });

  // URL blob helpers
  // @ts-ignore
  global.URL.createObjectURL = jest.fn(() => 'blob:mock');
  // @ts-ignore
  global.URL.revokeObjectURL = jest.fn();
});

describe('FileImage', () => {
  test('renders uploader when no image selected and can trigger onInput', async () => {
    const onChange = jest.fn();
  renderWithMantine(<FileImage onChange={onChange} placeholder="Pick one" />);

    // Placeholder visible
    expect(screen.getByText('Pick one')).toBeInTheDocument();

    // Upload mock present with accept constraint
    const uploader = screen.getByTestId('upload');
    expect(uploader).toHaveAttribute('data-accept', 'image/*');
    expect(uploader).toHaveAttribute('data-fromuser', 'true');

    // Click upload to simulate selecting a file
    await userEvent.click(uploader);
    expect(onChange).toHaveBeenCalledWith('new-file-id');
  });

  test('loads image by id and shows metadata', async () => {
    (daasAPI.getFile as jest.Mock).mockResolvedValueOnce(
      makeImageFile({ id: 'abc123', title: 'Loaded Image', filesize: 4096, width: 640, height: 480 })
    );

  renderWithMantine(<FileImage value="abc123" />);

    await waitFor(() => expect(screen.getByText('Loaded Image')).toBeInTheDocument());
    // size line should appear (e.g., 4 KB), we just ensure it renders something with KB
    expect(screen.getByText(/KB/)).toBeInTheDocument();
  });

  test('disables edit buttons when update permission is false', async () => {
    // First two calls were consumed in beforeEach default. Override explicitly for this test
    (daasAPI.checkPermission as jest.Mock).mockReset();
    (daasAPI.checkPermission as jest.Mock)
      .mockResolvedValueOnce(true) // create
      .mockResolvedValueOnce(false); // update

  (daasAPI.getFile as jest.Mock).mockResolvedValueOnce(makeImageFile());
  renderWithMantine(<FileImage value="img-1" />);

    // Wait until image title shows
    await screen.findByText('My Image');

  // Find action buttons inside the widget
  const infoBox = screen.getByText('My Image').parentElement!; // info overlay box
  const container = infoBox.parentElement!; // image container
  const actions = Array.from(container.querySelectorAll('div')).find((d) => d.getAttribute('style')?.includes('position: absolute') && d.querySelector('button')) || container;
  const allButtons = actions.querySelectorAll('button');
    // Expected order: Zoom(0), Download(1), Edit details(2), Edit image(3), Deselect(4)
    expect(allButtons[2]).toBeDisabled();
    expect(allButtons[3]).toBeDisabled();
  });

  test('edit image stays disabled for non-image file even with update permission', async () => {
    (daasAPI.checkPermission as jest.Mock).mockReset();
    (daasAPI.checkPermission as jest.Mock)
      .mockResolvedValueOnce(true) // create
      .mockResolvedValueOnce(true); // update

  (daasAPI.getFile as jest.Mock).mockResolvedValueOnce(makeImageFile({ type: 'application/pdf', title: 'A PDF' }));
  renderWithMantine(<FileImage value="img-1" />);

    await screen.findByText('A PDF');

  const infoBox = screen.getByText('A PDF').parentElement!;
  const container = infoBox.parentElement!;
  const actions = Array.from(container.querySelectorAll('div')).find((d) => d.getAttribute('style')?.includes('position: absolute') && d.querySelector('button')) || container;
  const allButtons = actions.querySelectorAll('button');
    // Edit details enabled, Edit image disabled (non-image)
    expect(allButtons[2]).not.toBeDisabled();
    expect(allButtons[3]).toBeDisabled();
  });

  test('can open Edit Details modal and save changes', async () => {
  (daasAPI.getFile as jest.Mock).mockResolvedValueOnce(makeImageFile());
  renderWithMantine(<FileImage value="img-1" />);

    await screen.findByText('My Image');

    // Click Edit details (index 2)
  const infoBox = screen.getByText('My Image').parentElement!;
  const container = infoBox.parentElement!;
  const actions = Array.from(container.querySelectorAll('div')).find((d) => d.getAttribute('style')?.includes('position: absolute') && d.querySelector('button')) || container;
  const allButtons = actions.querySelectorAll('button');
    await userEvent.click(allButtons[2]);

    // Modal inputs present
    const titleInput = await screen.findByLabelText('Title');
    const descInput = await screen.findByLabelText('Description');

    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Brand New');
    await userEvent.clear(descInput);
    await userEvent.type(descInput, 'Fancy description');

    // Save
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(daasAPI.updateFile).toHaveBeenCalledWith('img-1', {
      title: 'Brand New',
      description: 'Fancy description',
    });
  });

  test('download calls API with download param', async () => {
  (daasAPI.getFile as jest.Mock).mockResolvedValueOnce(makeImageFile());
  renderWithMantine(<FileImage value="img-1" />);

    await screen.findByText('My Image');

    // Click Download (index 1)
    const container = screen.getByText('My Image').closest('.mantine-Text-root')!.closest('div')!.parentElement!;
    const allButtons = container.querySelectorAll('button');
    await userEvent.click(allButtons[1]);

    expect(daasAPI.get).toHaveBeenCalledWith('/assets/img-1', expect.objectContaining({
      responseType: 'blob',
      params: { download: 'true' },
    }));
  });
});
