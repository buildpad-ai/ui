import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MAX_IMAGE_BYTES, checkImage, nameFor, pictureFiles } from '../src/core/images';
import { setGlobalDaaSConfig } from '@buildpad/services';
import { assetUrl, itemsAdapter, uploadToFiles } from '../src/CommentsAdapter';

const png = (name = 'a.png', size = 10) => new File([new Uint8Array(size)], name, { type: 'image/png' });

describe('checkImage', () => {
  it('accepts PNG, JPEG, GIF and WebP', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
      expect(checkImage({ type, size: 1 })).toBeNull();
    }
  });
  it('refuses SVG (it can carry script) and anything that is not a picture', () => {
    expect(checkImage({ type: 'image/svg+xml', size: 1 })).toBe('not-image');
    expect(checkImage({ type: 'application/pdf', size: 1 })).toBe('not-image');
    expect(checkImage({ type: '', size: 1 })).toBe('not-image');
  });
  it('refuses a picture over the size limit', () => {
    expect(checkImage({ type: 'image/png', size: MAX_IMAGE_BYTES })).toBeNull();
    expect(checkImage({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toBe('too-big');
  });
});

describe('pictureFiles', () => {
  it('takes picture files from a file list', () => {
    const text = new File(['x'], 'a.txt', { type: 'text/plain' });
    expect(pictureFiles([png('a.png'), text] as unknown as FileList)).toHaveLength(1);
  });
  it('takes picture files from clipboard items and leaves text alone', () => {
    const file = png('shot.png');
    const items = [
      { kind: 'string', type: 'text/plain', getAsFile: () => null },
      { kind: 'file', type: 'image/png', getAsFile: () => file },
      { kind: 'file', type: 'application/pdf', getAsFile: () => new File(['x'], 'a.pdf', { type: 'application/pdf' }) },
      { kind: 'file', type: 'image/png', getAsFile: () => null },
    ] as unknown as DataTransferItemList;
    expect(pictureFiles(items)).toEqual([file]);
  });
  it('copes with nothing', () => {
    expect(pictureFiles(null)).toEqual([]);
    expect(pictureFiles(undefined)).toEqual([]);
  });
});

describe('nameFor', () => {
  it('names an unnamed clipboard screenshot', () => {
    const named = nameFor(png('image.png'), 1700000000000);
    expect(named.name).toBe('pasted-1700000000000.png');
    expect(named.type).toBe('image/png');
  });
  it('gives a jpeg the jpg extension', () => {
    expect(nameFor(new File(['x'], '', { type: 'image/jpeg' }), 5).name).toBe('pasted-5.jpg');
  });
  it('keeps a real name', () => {
    const file = png('invoice.png');
    expect(nameFor(file)).toBe(file);
  });
});

describe('assetUrl', () => {
  it('points at /api/assets, resized for a thumbnail', () => {
    expect(assetUrl('abc')).toBe('/api/assets/abc');
    expect(assetUrl('abc', 'thumb')).toBe('/api/assets/abc?width=320&height=320&fit=inside');
    expect(assetUrl('a/b')).toBe('/api/assets/a%2Fb');
  });
});

describe('uploadToFiles', () => {
  // buildApiUrl needs a configured backend, as apiRequest does.
  beforeAll(() => setGlobalDaaSConfig({ url: 'https://daas.example.test' }));
  afterAll(() => setGlobalDaaSConfig(null));
  const reply = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

  it('posts the file as multipart to /api/files and returns its id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ data: { id: 'file-9' } }));
    vi.stubGlobal('fetch', fetchMock);
    const id = await uploadToFiles(png('shot.png'), 'folder-1');
    expect(id).toBe('file-9');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/files');
    expect(init.method).toBe('POST');
    const form = init.body as FormData;
    expect((form.get('file') as File).name).toBe('shot.png');
    expect(form.get('folder')).toBe('folder-1');
    // The browser sets the multipart boundary itself.
    expect(Object.keys(init.headers as Record<string, string>).map((h) => h.toLowerCase())).not.toContain('content-type');
    vi.unstubAllGlobals();
  });

  it('sends no folder unless asked', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ data: { id: 'f' } }));
    vi.stubGlobal('fetch', fetchMock);
    await uploadToFiles(png());
    expect((fetchMock.mock.calls[0][1].body as FormData).has('folder')).toBe(false);
    vi.unstubAllGlobals();
  });

  it('throws the backend’s own sentence when it refuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ errors: [{ message: 'File too large' }] }, false)));
    await expect(uploadToFiles(png())).rejects.toThrow('File too large');
    vi.unstubAllGlobals();
  });

  it('throws when the answer has no id, or is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ data: {} })));
    await expect(uploadToFiles(png())).rejects.toThrow('Upload failed');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => Promise.reject(new Error('x')) } as unknown as Response));
    await expect(uploadToFiles(png())).rejects.toThrow('Upload failed');
    vi.unstubAllGlobals();
  });
});

describe('itemsAdapter.images', () => {
  const base = { collection: 'c', hostField: 'h', hostId: '1', meId: 'me', request: vi.fn() as never };
  it('is off by default', () => {
    const adapter = itemsAdapter(base);
    expect(adapter.uploadImage).toBeUndefined();
    expect(adapter.photoUrl).toBeUndefined();
  });
  it('true uploads to /api/files and serves /api/assets', () => {
    const adapter = itemsAdapter({ ...base, images: true });
    expect(adapter.uploadImage).toBeTypeOf('function');
    expect(adapter.photoUrl!('x', 'thumb')).toContain('/api/assets/x?width=');
  });
  it('can use its own upload', async () => {
    const upload = vi.fn().mockResolvedValue('mine');
    const adapter = itemsAdapter({ ...base, images: { upload } });
    expect(await adapter.uploadImage!(png())).toBe('mine');
  });
  it('sends the picture ids with the comment', async () => {
    const request = vi.fn().mockResolvedValue({ data: { id: 'n' } });
    await itemsAdapter({ ...base, request: request as never, images: true }).add({ body: '', photos: ['f1', 'f2'] });
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ body: '', photos: ['f1', 'f2'] });
  });
});
