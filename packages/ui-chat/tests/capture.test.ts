import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultTranslations } from '@buildpad/utils';

const selectRegion = vi.fn();
const capturePageRegion = vi.fn();
const openAnnotator = vi.fn();
vi.mock('../src/screenshot/region-selector', () => ({ selectRegion: (...args: unknown[]) => selectRegion(...args) }));
vi.mock('../src/screenshot/capture-page', () => ({ capturePageRegion: (...args: unknown[]) => capturePageRegion(...args) }));
vi.mock('../src/screenshot/annotator', () => ({ openAnnotator: (...args: unknown[]) => openAnnotator(...args) }));

import { annotateImage, AttachmentError, imagePartFromFile, takeScreenshot } from '../src/capture';

const strings = defaultTranslations.chat;
const png = (bytes = 8) => new Blob([new Uint8Array(bytes)], { type: 'image/png' });

beforeEach(() => {
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 100, height: 80, close: vi.fn() })));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('imagePartFromFile', () => {
  it('keeps a small image as it is, as a data URL', async () => {
    const part = await imagePartFromFile(png(), 'shot.png', strings);
    expect(part).toMatchObject({ type: 'file', mediaType: 'image/png', filename: 'shot.png' });
    expect(part.url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('refuses other file types, huge files and unreadable images, in plain words', async () => {
    await expect(imagePartFromFile(new Blob(['x'], { type: 'text/plain' }), 'notes.txt', strings)).rejects.toThrow(
      "notes.txt isn't a PNG, JPEG, WebP or GIF image."
    );
    const huge = { type: 'image/png', size: 26_000_000 } as Blob;
    await expect(imagePartFromFile(huge, 'big.png', strings)).rejects.toThrow('big.png is too large to attach.');
    vi.stubGlobal('createImageBitmap', vi.fn(async () => Promise.reject(new Error('bad'))));
    await expect(imagePartFromFile(png(), 'broken.png', strings)).rejects.toBeInstanceOf(AttachmentError);
  });

  it('says so when the browser cannot re-encode a large image', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4000, height: 3000, close: vi.fn() })));
    // jsdom's canvas has no 2D context, like a browser that can't prepare the image.
    await expect(imagePartFromFile(png(), 'wide.png', strings)).rejects.toThrow("This browser couldn't prepare the image.");
  });
});

describe('imagePartFromFile re-encoding', () => {
  function stubCanvas(sizes: { png: number; jpeg: number[] }) {
    const jpegSizes = [...sizes.jpeg];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), imageSmoothingQuality: 'low' } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback, type) {
      const size = type === 'image/png' ? sizes.png : (jpegSizes.shift() ?? 10_000_000);
      callback({ size, type } as Blob);
    });
  }

  beforeEach(() => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4000, height: 3000, close: vi.fn() })));
    vi.stubGlobal(
      'FileReader',
      class {
        result: string | null = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsDataURL(blob: Blob) {
          this.result = `data:${blob.type};base64,AAAA`;
          this.onload?.();
        }
      }
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps PNG when it fits, for the sharpest screen text', async () => {
    stubCanvas({ png: 1000, jpeg: [] });
    expect(await imagePartFromFile(png(), 'wide.png', strings)).toMatchObject({ mediaType: 'image/png', filename: 'wide.png' });
  });

  it('falls back to JPEG, then to smaller sizes', async () => {
    stubCanvas({ png: 5_000_000, jpeg: [3_000_000, 2_000_000, 1_000] });
    expect(await imagePartFromFile(png(), 'photo.webp', strings)).toMatchObject({ mediaType: 'image/jpeg', filename: 'photo.jpg' });
  });

  it('gives up on an image that stays too large', async () => {
    stubCanvas({ png: 5_000_000, jpeg: [] });
    await expect(imagePartFromFile(png(), 'huge.png', strings)).rejects.toThrow('huge.png is too large to attach.');
  });
});

describe('takeScreenshot', () => {
  it('hides the chat, captures the selected region and returns the annotated image', async () => {
    const restore = vi.fn();
    const hide = vi.fn(() => restore);
    selectRegion.mockResolvedValue({ x: 0, y: 0, width: 10, height: 10 });
    capturePageRegion.mockResolvedValue(png());
    openAnnotator.mockResolvedValue(png());

    const part = await takeScreenshot(hide, strings);
    expect(hide).toHaveBeenCalled();
    expect(restore).toHaveBeenCalled();
    expect(selectRegion).toHaveBeenCalledWith(expect.any(String), strings.regionSelector);
    expect(openAnnotator).toHaveBeenCalledWith(expect.any(Blob), expect.any(String), strings.annotator);
    expect(part?.filename).toMatch(/^Screenshot \d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.\d{2}\.png$/);
  });

  it('returns null when the selection or the annotator is cancelled', async () => {
    selectRegion.mockResolvedValueOnce(null);
    expect(await takeScreenshot(() => () => {}, strings)).toBeNull();
    selectRegion.mockResolvedValueOnce({ x: 0, y: 0, width: 10, height: 10 });
    capturePageRegion.mockResolvedValueOnce(png());
    openAnnotator.mockResolvedValueOnce(null);
    expect(await takeScreenshot(() => () => {}, strings)).toBeNull();
  });

  it('reports a capture that failed, after bringing the chat back', async () => {
    const restore = vi.fn();
    selectRegion.mockResolvedValue({ x: 0, y: 0, width: 10, height: 10 });
    capturePageRegion.mockResolvedValue(null);
    await expect(takeScreenshot(() => restore, strings)).rejects.toThrow("The screenshot couldn't be taken. Try again.");
    expect(restore).toHaveBeenCalled();
  });
});

describe('annotateImage', () => {
  it('reopens an attached image in the annotator', async () => {
    openAnnotator.mockResolvedValueOnce(png());
    const part = await annotateImage({ type: 'file', mediaType: 'image/jpeg', filename: 'photo.jpg', url: 'data:image/jpeg;base64,AAAA' }, strings);
    expect(part?.filename).toBe('photo.png');
    openAnnotator.mockResolvedValueOnce(null);
    expect(await annotateImage({ type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,AAAA' }, strings)).toBeNull();
  });
});
