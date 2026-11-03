/**
 * Browser-only helpers that turn uploads, pasted images and screenshots into the
 * image parts the chat sends (see attachments.ts). Screenshots and markup reuse
 * the get-feedback widget's region selector, snapdom capture and annotator
 * (./screenshot), so both products behave the same.
 *
 * Strings come in as an argument (the `chat` namespace) rather than from a hook,
 * since these run outside React.
 */
import { interpolate, type ChatTranslations } from '@buildpad/utils';
import { isImageType, TARGET_IMAGE_BYTES, type ImagePart } from './attachments';
import { openAnnotator } from './screenshot/annotator';
import { capturePageRegion } from './screenshot/capture-page';
import { selectRegion } from './screenshot/region-selector';

/** The strings these helpers show or name files with. */
export type CaptureStrings = Pick<ChatTranslations, 'attachment' | 'annotator' | 'regionSelector'>;

/** Longest side an image is scaled down to. Screen text stays readable at this size. */
const MAX_EDGE = 2000;

/** Files larger than this aren't even decoded. */
const MAX_SOURCE_BYTES = 25_000_000;

/** A problem worth showing to the user as it is. */
export class AttachmentError extends Error {}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function drawScaled(source: CanvasImageSource, width: number, height: number, scale: number, strings: CaptureStrings): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new AttachmentError(strings.attachment.prepareFailed);
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function withExtension(filename: string, extension: string): string {
  return `${filename.replace(/\.[a-z0-9]+$/i, '')}.${extension}`;
}

/**
 * Encodes a picture within TARGET_IMAGE_BYTES: PNG while it fits (sharpest for
 * screen text), then JPEG at falling quality, then smaller.
 */
async function encode(source: CanvasImageSource, width: number, height: number, filename: string, strings: CaptureStrings): Promise<ImagePart> {
  let scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const canvas = drawScaled(source, width, height, scale, strings);
    const png = attempt === 0 ? await canvasBlob(canvas, 'image/png') : null;
    if (png && png.size <= TARGET_IMAGE_BYTES) {
      return { type: 'file', mediaType: 'image/png', filename: withExtension(filename, 'png'), url: await readAsDataUrl(png) };
    }
    for (const quality of [0.85, 0.7]) {
      const jpeg = await canvasBlob(canvas, 'image/jpeg', quality);
      if (jpeg && jpeg.size <= TARGET_IMAGE_BYTES) {
        return { type: 'file', mediaType: 'image/jpeg', filename: withExtension(filename, 'jpg'), url: await readAsDataUrl(jpeg) };
      }
    }
    scale *= 0.7;
  }
  throw new AttachmentError(interpolate(strings.attachment.tooLarge, { name: filename }));
}

/** An uploaded or pasted image, scaled down and re-encoded only when it needs to be. */
export async function imagePartFromFile(file: Blob, filename: string, strings: CaptureStrings): Promise<ImagePart> {
  if (!isImageType(file.type)) throw new AttachmentError(interpolate(strings.attachment.notImage, { name: filename }));
  if (file.size > MAX_SOURCE_BYTES) throw new AttachmentError(interpolate(strings.attachment.tooLarge, { name: filename }));

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AttachmentError(interpolate(strings.attachment.unreadable, { name: filename }));
  }
  try {
    if (file.size <= TARGET_IMAGE_BYTES && Math.max(bitmap.width, bitmap.height) <= MAX_EDGE) {
      return { type: 'file', mediaType: file.type, filename, url: await readAsDataUrl(file) };
    }
    return await encode(bitmap, bitmap.width, bitmap.height, filename, strings);
  } finally {
    bitmap.close();
  }
}

/** "2026-11-02 14.05.09" in the user's own time, like a macOS screenshot. */
export function localStamp(at: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}.${pad(at.getMinutes())}.${pad(at.getSeconds())}`;
}

const nextFrame = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

/** The app's primary colour, for the selection frame and the annotator's Done button. */
function primaryColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--mantine-primary-color-filled').trim() || '#228be6';
}

/**
 * Takes keyboard focus off the page (usually the question box, which the chat
 * focuses when it opens) before an overlay goes up. The annotator focuses its text
 * box a frame after the click, and anything typed in between would land in the
 * question box; its Enter would also reach the annotator as Done.
 */
function releaseFocus(): void {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

export function dataUrlToBlob(url: string): Blob {
  const [header, data] = url.split(',', 2);
  const type = /^data:([^;]+)/.exec(header)?.[1] ?? 'image/png';
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type });
}

/**
 * The get-feedback widget's screenshot flow: the chat steps aside, the user drags
 * over the part of the page to show (Esc cancels), and marks it up in the
 * annotator. `hideChat` hides the chat and returns how to bring it back.
 *
 * Returns null when the user cancels the selection or the annotator.
 */
export async function takeScreenshot(hideChat: () => () => void, strings: CaptureStrings): Promise<ImagePart | null> {
  releaseFocus();
  const restore = hideChat();
  let shot: Blob | null;
  try {
    // Let the page repaint without the chat before the selection overlay goes up.
    await nextFrame();
    await nextFrame();
    const bounds = await selectRegion(primaryColor(), strings.regionSelector);
    if (!bounds) return null;
    shot = await capturePageRegion(bounds);
  } finally {
    restore();
  }
  if (!shot) throw new AttachmentError(strings.attachment.screenshotFailed);

  // Focus can have moved while the region was selected.
  releaseFocus();
  const annotated = await openAnnotator(shot, primaryColor(), strings.annotator);
  const name = interpolate(strings.attachment.screenshotName, { stamp: localStamp(new Date()) });
  return annotated ? imagePartFromFile(annotated, `${name}.png`, strings) : null;
}

/** Opens an attached image in the annotator. Returns the marked-up image, or null when cancelled. */
export async function annotateImage(part: ImagePart, strings: CaptureStrings): Promise<ImagePart | null> {
  releaseFocus();
  const annotated = await openAnnotator(dataUrlToBlob(part.url), primaryColor(), strings.annotator);
  return annotated ? imagePartFromFile(annotated, withExtension(part.filename ?? strings.attachment.pastedImage, 'png'), strings) : null;
}
