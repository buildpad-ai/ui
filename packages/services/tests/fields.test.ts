/**
 * FieldsService Unit Tests
 *
 * readAll returns the fields in either response shape and lets a failed
 * request surface. The network layer is mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('../src/api-request', () => ({ apiRequest: apiRequestMock }));

import { FieldsService } from '../src/fields';

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
