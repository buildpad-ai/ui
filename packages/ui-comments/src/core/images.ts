/**
 * Pictures attached to a comment: which files are accepted and how they are picked up from a file
 * input, a drop or the clipboard. Pure helpers; the upload itself belongs to the adapter.
 */
export const COMMENT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
/** What the file input offers. */
export const IMAGE_ACCEPT = COMMENT_IMAGE_TYPES.join(',');
/** Pictures are refused above this size (the add-comments skill's bound). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type ImageProblem = 'not-image' | 'too-big';

/** Null when the file can be attached. SVG is not accepted: it can carry script. */
export function checkImage(file: { type: string; size: number }): ImageProblem | null {
  if (!(COMMENT_IMAGE_TYPES as readonly string[]).includes(file.type)) return 'not-image';
  if (file.size > MAX_IMAGE_BYTES) return 'too-big';
  return null;
}

type Item = File | DataTransferItem;

/**
 * The picture files in a clipboard or a drop: a file list, or the items of a `DataTransfer`.
 * Anything that is not an `image/*` file is left out, so a plain-text paste is never touched.
 */
export function pictureFiles(list: FileList | DataTransferItemList | null | undefined): File[] {
  return Array.from((list ?? []) as ArrayLike<Item>)
    .map((entry) => (entry instanceof File ? entry : entry.kind === 'file' ? entry.getAsFile() : null))
    .filter((file): file is File => !!file && file.type.startsWith('image/'));
}

/** A screenshot pasted from the clipboard usually has no useful name. */
export function nameFor(file: File, now = Date.now()): File {
  if (file.name && file.name !== 'image.png') return file;
  const extension = file.type.split('/')[1] ?? 'png';
  return new File([file], `pasted-${now}.${extension === 'jpeg' ? 'jpg' : extension}`, { type: file.type });
}
