/**
 * FieldsService Unit Tests
 *
 * Every method answers in either DaaS response shape (`{ data: Field }` or a
 * flat `Field`), and the DDL methods have to send the right verb and body —
 * a wrong one silently alters or drops a real column. The network layer is
 * mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('../src/api-request', () => ({ apiRequest: apiRequestMock }));

import { FieldsService, createFieldsService } from '../src/fields';

/** The options object `apiRequest` was called with, for the Nth call. */
const optionsOfCall = (n = 0) => apiRequestMock.mock.calls[n]?.[1] as
  | { method?: string; headers?: Record<string, string>; body?: string }
  | undefined;

describe('FieldsService.readAll', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it('returns the fields of a { data } response', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [{ field: 'title' }] });

    await expect(new FieldsService().readAll('posts')).resolves.toEqual([{ field: 'title' }]);
    expect(apiRequestMock).toHaveBeenCalledWith('/api/fields/posts');
  });

  it('returns a flat array response as it is', async () => {
    apiRequestMock.mockResolvedValueOnce([{ field: 'title' }]);

    await expect(new FieldsService().readAll()).resolves.toEqual([{ field: 'title' }]);
    expect(apiRequestMock).toHaveBeenCalledWith('/api/fields');
  });

  // A failed load is not "a collection without fields": callers show their
  // load error only if the failure reaches them.
  it('rejects when the request fails', async () => {
    apiRequestMock.mockRejectedValueOnce(new Error('API error: 500 - {}'));

    await expect(new FieldsService().readAll('posts')).rejects.toThrow('API error: 500');
  });
});


describe('FieldsService.readOne', () => {
  beforeEach(() => apiRequestMock.mockReset());

  it('unwraps a { data } response', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { field: 'title', type: 'string' } });

    await expect(new FieldsService().readOne('posts', 'title')).resolves.toEqual({
      field: 'title',
      type: 'string',
    });
    expect(apiRequestMock).toHaveBeenCalledWith('/api/fields/posts/title');
  });

  it('accepts a flat field response', async () => {
    apiRequestMock.mockResolvedValueOnce({ field: 'title', type: 'string' });

    await expect(new FieldsService().readOne('posts', 'title')).resolves.toEqual({
      field: 'title',
      type: 'string',
    });
  });

  // A response that carries no `field` is not a field: resolving it would hand
  // the caller an object that looks loaded but has nothing in it.
  it.each([
    ['an empty object', {}],
    ['a { data: null } envelope', { data: null }],
    ['an object without `field`', { type: 'string' }],
  ])('throws a named error for %s', async (_label, response) => {
    apiRequestMock.mockResolvedValueOnce(response);

    await expect(new FieldsService().readOne('posts', 'title')).rejects.toThrow(
      'Field not found: posts.title',
    );
  });

  // Documents a rough edge rather than endorsing it: the unwrap reads
  // `response.data` before the guard runs, so a null body (a 204, say) throws
  // a TypeError instead of the named "Field not found". Callers still see a
  // rejection, so nothing is silently wrong — but the message is useless.
  // Changing it is a behaviour change and belongs in its own changeset.
  it('throws an unhelpful TypeError for a null body', async () => {
    apiRequestMock.mockResolvedValueOnce(null);

    await expect(new FieldsService().readOne('posts', 'title')).rejects.toThrow(
      "Cannot read properties of null (reading 'data')",
    );
  });

  it('lets a failed request surface', async () => {
    apiRequestMock.mockRejectedValueOnce(new Error('API error: 403 - {}'));

    await expect(new FieldsService().readOne('posts', 'title')).rejects.toThrow('API error: 403');
  });
});

describe('FieldsService.createField', () => {
  beforeEach(() => apiRequestMock.mockReset());

  it('POSTs the mapped DaaS payload and returns the created field', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { field: 'subtitle' } });

    const created = await new FieldsService().createField('posts', {
      field: 'subtitle',
      type: 'string',
      label: 'Subtitle',
    });

    expect(created).toEqual({ field: 'subtitle' });
    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/fields/posts');

    const options = optionsOfCall();
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({ 'Content-Type': 'application/json' });

    // The spec is mapped, not forwarded: DaaS wants `meta`/`schema`, and the
    // builder's `label` lands in `meta.note`.
    const body = JSON.parse(options?.body ?? '{}');
    expect(body).toMatchObject({
      collection: 'posts',
      field: 'subtitle',
      type: 'string',
      meta: { note: 'Subtitle', field: 'subtitle', collection: 'posts' },
    });
  });

  it('accepts a flat field response', async () => {
    apiRequestMock.mockResolvedValueOnce({ field: 'subtitle' });

    await expect(
      new FieldsService().createField('posts', { field: 'subtitle' }),
    ).resolves.toEqual({ field: 'subtitle' });
  });

  it('lets a rejected DDL call surface', async () => {
    apiRequestMock.mockRejectedValueOnce(new Error('API error: 403 - no schema rights'));

    await expect(
      new FieldsService().createField('posts', { field: 'subtitle' }),
    ).rejects.toThrow('no schema rights');
  });
});

describe('FieldsService.updateField', () => {
  beforeEach(() => apiRequestMock.mockReset());

  it('PATCHes only the patch it was given', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { field: 'title' } });

    const patch = { meta: { note: 'Headline' } } as never;
    await expect(new FieldsService().updateField('posts', 'title', patch)).resolves.toEqual({
      field: 'title',
    });

    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/fields/posts/title');
    const options = optionsOfCall();
    expect(options?.method).toBe('PATCH');
    expect(options?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options?.body ?? '{}')).toEqual({ meta: { note: 'Headline' } });
  });

  it('accepts a flat field response', async () => {
    apiRequestMock.mockResolvedValueOnce({ field: 'title' });

    await expect(
      new FieldsService().updateField('posts', 'title', {}),
    ).resolves.toEqual({ field: 'title' });
  });
});

describe('FieldsService.deleteField', () => {
  beforeEach(() => apiRequestMock.mockReset());

  it('sends DELETE to the field path and resolves with nothing', async () => {
    apiRequestMock.mockResolvedValueOnce(undefined);

    await expect(new FieldsService().deleteField('posts', 'title')).resolves.toBeUndefined();
    expect(apiRequestMock).toHaveBeenCalledWith('/api/fields/posts/title', { method: 'DELETE' });
  });

  // Dropping a column is destructive; a refused delete must not look like success.
  it('lets a refused delete surface', async () => {
    apiRequestMock.mockRejectedValueOnce(new Error('API error: 403 - {}'));

    await expect(new FieldsService().deleteField('posts', 'title')).rejects.toThrow('API error: 403');
  });
});

describe('createFieldsService', () => {
  it('returns a usable FieldsService', () => {
    expect(createFieldsService()).toBeInstanceOf(FieldsService);
  });
});
