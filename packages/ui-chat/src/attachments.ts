/**
 * Images the user attaches to a question: an uploaded file, a pasted image or a
 * screenshot. They travel as AI SDK `file` parts holding a data URL; Chocolate
 * Factory copies each one into its own storage, shows it to the agent's model and
 * (when it keeps the conversation) stores it as a signed URL that expires after
 * 7 days.
 *
 * Safe to import in the browser and on the server: the server proxy route checks
 * incoming parts with `parseImagePart`.
 */

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

/** Images one question can carry. */
export const MAX_ATTACHMENTS = 4;

/** Size an image is shrunk to before sending. */
export const TARGET_IMAGE_BYTES = 1_500_000;

/** Largest data URL accepted for one image (a little over TARGET_IMAGE_BYTES once base64-encoded). */
export const MAX_IMAGE_DATA_URL_CHARS = 2_200_000;

export interface ImagePart {
  type: 'file';
  mediaType: ImageType;
  filename?: string;
  url: string;
}

export function isImageType(type: string): type is ImageType {
  return (IMAGE_TYPES as readonly string[]).includes(type);
}

const DATA_URL = /^data:(image\/[a-z]+);base64,[A-Za-z0-9+/]+={0,2}$/;

/** A file name safe to forward: no paths or control characters, at most 100 characters. */
function cleanFilename(name: unknown): string | undefined {
  if (typeof name !== 'string') return undefined;
  const base = name
    .split(/[\\/]/)
    .pop()
    ?.replace(/[^\p{L}\p{N} ._()-]/gu, '')
    .trim()
    .slice(0, 100);
  return base || undefined;
}

/**
 * A `file` part from the browser, checked before it goes to the agent: an inline
 * PNG, JPEG, WebP or GIF data URL of bounded size. Anything else returns null, so
 * the browser can't make the agent fetch a URL of its choosing.
 */
export function parseImagePart(input: unknown): ImagePart | null {
  if (!input || typeof input !== 'object') return null;
  const { type, mediaType, url, filename } = input as Record<string, unknown>;
  if (type !== 'file' || typeof mediaType !== 'string' || !isImageType(mediaType)) return null;
  if (typeof url !== 'string' || url.length > MAX_IMAGE_DATA_URL_CHARS) return null;
  const match = DATA_URL.exec(url);
  if (!match || match[1] !== mediaType) return null;
  const name = cleanFilename(filename);
  return { type: 'file', mediaType, ...(name ? { filename: name } : {}), url };
}

/**
 * Chocolate Factory stores each attachment with an extra text part naming it and
 * its signed URL ("[Attachment: shot.png]\nFile URL: https://…"). That is for the
 * agent; the chat shows the image itself.
 */
export function isAttachmentLinkText(text: string): boolean {
  return /^\[Attachment: [^\]\n]*\]\nFile URL: \S+\s*$/.test(text);
}

/**
 * Whether a user message's image can be shown: the chat's own data URL, or the
 * HTTPS link Chocolate Factory stored it under.
 */
export function isShowableImage(part: { type: string; mediaType?: unknown; url?: unknown }): part is ImagePart {
  if (part.type !== 'file' || typeof part.mediaType !== 'string' || !part.mediaType.startsWith('image/')) return false;
  return typeof part.url === 'string' && (part.url.startsWith('data:image/') || part.url.startsWith('https://'));
}
