import { checkBody, checkPhotos } from '../src/core/validation';
import { MAX_BODY, MAX_PHOTOS } from '../src/core/types';

describe('checkBody', () => {
  it('trims', () => expect(checkBody('  hi ')).toEqual({ ok: true, value: 'hi' }));
  it('refuses blank text without a picture', () => {
    expect(checkBody('   ')).toEqual({ ok: false, error: 'empty' });
    expect(checkBody(undefined)).toEqual({ ok: false, error: 'empty' });
  });
  it('allows blank text with a picture', () => expect(checkBody('', true)).toEqual({ ok: true, value: '' }));
  it('refuses text over the limit', () => {
    expect(checkBody('a'.repeat(MAX_BODY + 1))).toEqual({ ok: false, error: 'too-long' });
    expect(checkBody('a'.repeat(MAX_BODY)).ok).toBe(true);
  });
});

describe('checkPhotos', () => {
  it('treats null as none', () => expect(checkPhotos(null)).toEqual({ ok: true, value: [] }));
  it('de-duplicates', () => expect(checkPhotos(['a', 'a', ' b '])).toEqual({ ok: true, value: ['a', 'b'] }));
  it('refuses a non-list and non-strings', () => {
    expect(checkPhotos('a')).toEqual({ ok: false, error: 'photos-invalid' });
    expect(checkPhotos([1])).toEqual({ ok: false, error: 'photos-invalid' });
    expect(checkPhotos([''])).toEqual({ ok: false, error: 'photos-invalid' });
  });
  it('refuses too many', () => {
    const many = Array.from({ length: MAX_PHOTOS + 1 }, (_, i) => `f${i}`);
    expect(checkPhotos(many)).toEqual({ ok: false, error: 'too-many-photos' });
  });
});
