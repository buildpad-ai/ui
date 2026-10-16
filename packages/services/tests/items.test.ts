/**
 * ItemsService — a primary key is one URL path segment.
 *
 * A manually entered string key may hold "/" (or "?", "#", "%"). Unencoded,
 * GET /api/items/docs/A/B-1 asked for another route, and the item could not
 * be opened, saved or deleted.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('../src/api-request', () => ({ apiRequest: apiRequestMock }));

import { ItemsService } from '../src/items';

describe('ItemsService item paths', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ data: { code: 'A/B-1' } });
  });

  it('encodes the key of readOne, updateOne and deleteOne', async () => {
    const service = new ItemsService('docs');

    await service.readOne('A/B-1', ['code', 'title']);
    await service.updateOne('A/B-1', { title: 'x' });
    await service.deleteOne('A/B-1');

    expect(apiRequestMock.mock.calls.map(([path]) => path)).toEqual([
      '/api/items/docs/A%2FB-1?fields=code,title',
      '/api/items/docs/A%2FB-1',
      '/api/items/docs/A%2FB-1',
    ]);
  });

  it('leaves numeric and plain keys as they were', async () => {
    const service = new ItemsService('docs');

    await service.readOne(7);
    await service.updateOne('abc-1', {});

    expect(apiRequestMock.mock.calls.map(([path]) => path)).toEqual(['/api/items/docs/7', '/api/items/docs/abc-1']);
  });
});
