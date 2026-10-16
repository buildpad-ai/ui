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

import { ItemsService, createItemsService } from '../src/items';

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


/** The query string of the Nth apiRequest call, '' when there is none. */
const queryOfCall = (n = 0) => {
  const path = apiRequestMock.mock.calls[n]?.[0] as string;
  const i = path.indexOf('?');
  return i === -1 ? '' : path.slice(i + 1);
};

/** The options object of the Nth apiRequest call. */
const optionsOfCall = (n = 0) => apiRequestMock.mock.calls[n]?.[1] as
  | { method?: string; headers?: Record<string, string>; body?: string }
  | undefined;

describe('ItemsService.readByQuery — the query string', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ data: [] });
  });

  it('sends no query string at all when there is no query', async () => {
    await new ItemsService('posts').readByQuery();
    expect(apiRequestMock).toHaveBeenCalledWith('/api/items/posts');
  });

  it('sends no query string for an empty query object', async () => {
    await new ItemsService('posts').readByQuery({});
    expect(apiRequestMock).toHaveBeenCalledWith('/api/items/posts');
  });

  it('joins fields with commas', async () => {
    await new ItemsService('posts').readByQuery({ fields: ['id', 'title'] });
    expect(queryOfCall()).toBe('fields=id%2Ctitle');
  });

  it('omits an empty fields array rather than sending fields=', async () => {
    await new ItemsService('posts').readByQuery({ fields: [] });
    expect(apiRequestMock).toHaveBeenCalledWith('/api/items/posts');
  });

  it('sends a filter as JSON', async () => {
    await new ItemsService('posts').readByQuery({ filter: { status: { _eq: 'published' } } });
    expect(decodeURIComponent(queryOfCall())).toBe('filter={"status":{"_eq":"published"}}');
  });

  it('omits an empty filter object', async () => {
    await new ItemsService('posts').readByQuery({ filter: {} });
    expect(apiRequestMock).toHaveBeenCalledWith('/api/items/posts');
  });

  it('accepts sort as a string or an array', async () => {
    await new ItemsService('posts').readByQuery({ sort: '-date_created' });
    expect(decodeURIComponent(queryOfCall(0))).toBe('sort=-date_created');

    await new ItemsService('posts').readByQuery({ sort: ['status', '-date_created'] });
    expect(decodeURIComponent(queryOfCall(1))).toBe('sort=status,-date_created');
  });

  // 0 is a legitimate offset and an empty-but-valid limit; `!== undefined`
  // rather than truthiness is what keeps them in the query.
  it('keeps limit 0 and offset 0', async () => {
    await new ItemsService('posts').readByQuery({ limit: 0, offset: 0 });
    expect(decodeURIComponent(queryOfCall())).toBe('limit=0&offset=0');
  });

  it('sends page and meta', async () => {
    await new ItemsService('posts').readByQuery({ page: 2, meta: 'filter_count' });
    expect(decodeURIComponent(queryOfCall())).toBe('page=2&meta=filter_count');
  });

  it('omits an empty search string', async () => {
    await new ItemsService('posts').readByQuery({ search: '' });
    expect(apiRequestMock).toHaveBeenCalledWith('/api/items/posts');
  });

  it('combines every parameter in one query', async () => {
    await new ItemsService('posts').readByQuery({
      fields: ['id'],
      search: 'hello world',
      sort: 'id',
      limit: 10,
      offset: 20,
      page: 3,
      meta: '*',
    });
    // URLSearchParams is form-urlencoded, so a space is "+", not "%20".
    const q = decodeURIComponent(queryOfCall());
    for (const part of ['fields=id', 'search=hello+world', 'sort=id', 'limit=10', 'offset=20', 'page=3', 'meta=*']) {
      expect(q).toContain(part);
    }
  });
});

describe('ItemsService.readByQuery — the response shape', () => {
  beforeEach(() => apiRequestMock.mockReset());

  it('passes a { data, meta } response straight through', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [{ id: 1 }], meta: { filter_count: 1 } });

    await expect(new ItemsService('posts').readByQuery()).resolves.toEqual({
      data: [{ id: 1 }],
      meta: { filter_count: 1 },
    });
  });

  // A flat array carries no meta, so the count is synthesised — otherwise a
  // pager reading meta.total_count would show nothing.
  it('wraps a flat array and synthesises total_count', async () => {
    apiRequestMock.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

    await expect(new ItemsService('posts').readByQuery()).resolves.toEqual({
      data: [{ id: 1 }, { id: 2 }],
      meta: { total_count: 2 },
    });
  });

  it('wraps an empty array as an empty page', async () => {
    apiRequestMock.mockResolvedValueOnce([]);

    await expect(new ItemsService('posts').readByQuery()).resolves.toEqual({
      data: [],
      meta: { total_count: 0 },
    });
  });
});

describe('ItemsService.createOne', () => {
  beforeEach(() => apiRequestMock.mockReset());

  it('POSTs the item to the collection and unwraps { data }', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { id: 1, title: 'x' } });

    await expect(new ItemsService('posts').createOne({ title: 'x' })).resolves.toEqual({
      id: 1,
      title: 'x',
    });

    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/items/posts');
    const options = optionsOfCall();
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options?.body ?? '{}')).toEqual({ title: 'x' });
  });

  it('accepts a flat item response', async () => {
    apiRequestMock.mockResolvedValueOnce({ id: 1 });

    await expect(new ItemsService('posts').createOne({})).resolves.toEqual({ id: 1 });
  });

  // `'data' in response && response.data` — a falsy .data means the response
  // is the item, not an envelope.
  it('treats a falsy data property as a flat item', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: null, id: 1 });

    await expect(new ItemsService('posts').createOne({})).resolves.toEqual({ data: null, id: 1 });
  });
});

describe('ItemsService.updateOne — the body', () => {
  beforeEach(() => apiRequestMock.mockReset());

  it('PATCHes the changed fields and unwraps { data }', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { id: 1, title: 'new' } });

    await expect(new ItemsService('posts').updateOne(1, { title: 'new' })).resolves.toEqual({
      id: 1,
      title: 'new',
    });

    const options = optionsOfCall();
    expect(options?.method).toBe('PATCH');
    expect(JSON.parse(options?.body ?? '{}')).toEqual({ title: 'new' });
  });
});

describe('ItemsService.deleteMany', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue(undefined);
  });

  // An unguarded empty list would send `_in: []`, which DaaS is free to read
  // as "every row".
  it('sends no request at all for an empty id list', async () => {
    await new ItemsService('posts').deleteMany([]);
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it('sends one DELETE with an _in filter on id', async () => {
    await new ItemsService('posts').deleteMany([1, 2, 3]);

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    const [path, options] = apiRequestMock.mock.calls[0];
    expect(decodeURIComponent(path as string)).toBe('/api/items/posts?filter={"id":{"_in":[1,2,3]}}');
    expect((options as { method: string }).method).toBe('DELETE');
  });

  it('honours a non-default primary key field', async () => {
    await new ItemsService('docs').deleteMany(['A/B-1'], 'code');

    expect(decodeURIComponent(apiRequestMock.mock.calls[0][0] as string)).toBe(
      '/api/items/docs?filter={"code":{"_in":["A/B-1"]}}',
    );
  });
});

describe('ItemsService.updateMany', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue(undefined);
  });

  it('sends no request for an empty id list', async () => {
    await new ItemsService('posts').updateMany([], { status: 'archived' });
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it('PATCHes the collection with keys and data', async () => {
    await new ItemsService('posts').updateMany([1, 2], { status: 'archived' });

    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/items/posts');
    const options = optionsOfCall();
    expect(options?.method).toBe('PATCH');
    expect(options?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options?.body ?? '{}')).toEqual({
      keys: [1, 2],
      data: { status: 'archived' },
    });
  });
});

describe('createItemsService', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ data: [] });
  });

  it('returns a service bound to the collection it was given', async () => {
    const service = createItemsService('articles');
    expect(service).toBeInstanceOf(ItemsService);

    await service.readByQuery();
    expect(apiRequestMock).toHaveBeenCalledWith('/api/items/articles');
  });
});
