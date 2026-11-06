import { MAX_BODY, MAX_PHOTOS } from './types';

export type CommentError = 'empty' | 'too-long' | 'photos-invalid' | 'too-many-photos';

export type Checked<T> = { ok: true; value: T } | { ok: false; error: CommentError };

/** Trim the text; it must have something in it unless a picture is attached, and stay within the limit. */
export function checkBody(input: unknown, hasPhotos = false, max = MAX_BODY): Checked<string> {
  const body = typeof input === 'string' ? input.trim() : '';
  if (!body && !hasPhotos) return { ok: false, error: 'empty' };
  if (body.length > max) return { ok: false, error: 'too-long' };
  return { ok: true, value: body };
}

/** A list of file ids: strings only, no repeats, within the limit. Null or an empty list means none. */
export function checkPhotos(input: unknown, max = MAX_PHOTOS): Checked<string[]> {
  if (input == null) return { ok: true, value: [] };
  if (!Array.isArray(input) || input.some((id) => typeof id !== 'string' || id.trim() === '')) {
    return { ok: false, error: 'photos-invalid' };
  }
  const unique = [...new Set(input.map((id: string) => id.trim()))];
  if (unique.length > max) return { ok: false, error: 'too-many-photos' };
  return { ok: true, value: unique };
}
