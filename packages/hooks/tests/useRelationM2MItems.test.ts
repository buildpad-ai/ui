/**
 * useRelationM2MItems unit tests
 *
 * The junction table's real primary key is the identity for every per-row URL
 * this hook builds. For any junction whose PK column isn't literally named
 * "id", reading `.id` resolved to `undefined` and the request silently
 * targeted `/api/items/{collection}/undefined` — which a string-PK backend
 * answers 2xx, so the UI reported a success that never happened.
 *
 * `apiRequest` is mocked so no network is required. Only that one export is
 * replaced: the rest of `../src/utils` is the real module. The hook itself
 * uses `@buildpad/utils`'s `isExistingItem` (unmocked, real) for the same
 * unsaved-item check — rejecting the `'+'` / `'%2B'` / `'new'` sentinels.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('../src/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/utils')>()),
  apiRequest: apiRequestMock,
}));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

import { useRelationM2MItems } from '../src/useRelationM2MItems';
import type { M2MRelationInfo } from '../src/useRelationM2M';

// A junction table whose real PK column is "uuid", not "id" — the case that
// was silently broken. `as M2MRelationInfo` matches the sibling fixture: the
// type carries `relation`/`junction` members these tests never read.
function makeRelationInfo(sortField: string | undefined = 'sort'): M2MRelationInfo {
  return {
    junctionCollection: { collection: 'articles_tags', meta: {} as never },
    relatedCollection: { collection: 'tags', meta: {} as never },
    junctionField: { field: 'tag_id', type: 'uuid' },
    reverseJunctionField: { field: 'article_id', type: 'uuid' },
    relatedPrimaryKeyField: { field: 'id', type: 'uuid' },
    junctionPrimaryKeyField: { field: 'uuid', type: 'uuid' },
    sortField,
    relation: {
      field: 'tags',
      collection: 'articles_tags',
      related_collection: 'tags',
      meta: {} as never,
    },
    junction: {
      field: 'tag_id',
      collection: 'articles_tags',
      related_collection: 'tags',
      meta: {} as never,
    },
  } as M2MRelationInfo;
}

const relationInfo = makeRelationInfo();
const params = { limit: 10, page: 1, fields: ['id'] };

const row = (uuid: string, sort?: number) => ({
  uuid,
  tag_id: { id: `tag-${uuid}`, name: `Tag ${uuid}` },
  ...(sort === undefined ? {} : { sort }),
});

/** Render the hook and complete one successful load. */
async function loaded(rows: Record<string, unknown>[], info = relationInfo) {
  apiRequestMock.mockResolvedValueOnce({ data: rows, meta: {} });
  const { result } = renderHook(() => useRelationM2MItems(info, 'article-1'));
  await act(async () => { await result.current.loadItems(params); });
  return result;
}

/** The request URLs of every call made with the given method. */
const urlsFor = (method: string) =>
  apiRequestMock.mock.calls.filter(c => c[1]?.method === method).map(c => c[0]);

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('load-items PK aliasing', () => {
  it('aliases the real junction PK field onto .id for each loaded item', async () => {
    const result = await loaded([row('j1')]);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('j1');
  });

  // Writing `undefined` over a real id would collapse every row onto one
  // identity and point every per-row URL at `/undefined`.
  it('leaves a row untouched when the PK column is absent from the response', async () => {
    const result = await loaded([{ id: 'real-id', tag_id: { id: 'tag-1' } }]);
    expect(result.current.items[0].id).toBe('real-id');
  });

  it('degrades to "id" when the relation info carries no junction PK field', async () => {
    const partial = { ...makeRelationInfo(), junctionPrimaryKeyField: undefined } as unknown as M2MRelationInfo;
    const result = await loaded([{ id: 'real-id', tag_id: { id: 'tag-1' } }], partial);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('real-id');
  });
});

describe('load-items query construction', () => {
  // Deliberately asks for a field that is NOT the related PK: with
  // `fields: ['id']` the caller's own entry happens to produce `tag_id.id`,
  // so that fixture cannot tell whether the hook force-adds it.
  it('always fetches the junction PK, the related PK and the sort field', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], meta: {} });
    const { result } = renderHook(() => useRelationM2MItems(relationInfo, 'article-1'));
    await act(async () => { await result.current.loadItems({ ...params, fields: ['name'] }); });
    const fields = new URL('http://x' + apiRequestMock.mock.calls[0][0]).searchParams.get('fields');
    expect(fields?.split(',')).toEqual(expect.arrayContaining(['uuid', 'tag_id.id', 'sort']));
  });

  // Without the related PK the "already linked" filter silently excludes
  // nothing and the user re-links a row the junction already has.
  it('populates selectedPrimaryKeys even when the caller omits the related PK', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [row('j1')], meta: {} });
    const { result } = renderHook(() => useRelationM2MItems(relationInfo, 'article-1'));
    await act(async () => { await result.current.loadItems({ ...params, fields: ['name'] }); });
    expect(result.current.selectedPrimaryKeys).toEqual(['tag-j1']);
  });

  it('keeps a related primary key of 0', async () => {
    const result = await loaded([{ uuid: 'j1', tag_id: { id: 0 } }]);
    expect(result.current.selectedPrimaryKeys).toEqual([0]);
  });

  it('sends search when asked, without a companion flag', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], meta: {} });
    const { result } = renderHook(() => useRelationM2MItems(relationInfo, 'article-1'));
    await act(async () => { await result.current.loadItems({ ...params, search: 'foo' }); });
    const url = new URL('http://x' + apiRequestMock.mock.calls[0][0]);
    expect(url.searchParams.get('search')).toBe('foo');
  });

  it('honours sortDirection on the configured sort field', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], meta: {} });
    const { result } = renderHook(() => useRelationM2MItems(relationInfo, 'article-1'));
    await act(async () => { await result.current.loadItems({ ...params, sortDirection: 'desc' }); });
    const url = new URL('http://x' + apiRequestMock.mock.calls[0][0]);
    expect(url.searchParams.get('sort')).toBe('-sort');
  });

  // A bare sort field names a related-collection column, exactly as in `fields`.
  it('prefixes a caller-supplied sort field with the junction field', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], meta: {} });
    const { result } = renderHook(() => useRelationM2MItems(relationInfo, 'article-1'));
    await act(async () => { await result.current.loadItems({ ...params, sortField: 'name' }); });
    const url = new URL('http://x' + apiRequestMock.mock.calls[0][0]);
    expect(url.searchParams.get('sort')).toBe('tag_id.name');
  });

  // meta.total_count is the unfiltered whole-junction count on this backend.
  it('derives the count from page fullness, not meta.total_count', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [row('j1')], meta: { total_count: 10000 } });
    const { result } = renderHook(() => useRelationM2MItems(relationInfo, 'article-1'));
    await act(async () => { await result.current.loadItems(params); });
    expect(result.current.totalCount).toBe(1);
  });
});

describe('removeItem', () => {
  it('builds the request URL from the real junction PK', async () => {
    const result = await loaded([row('j1')]);
    apiRequestMock.mockResolvedValue({ data: [], meta: {} });
    await act(async () => { await result.current.removeItem(result.current.items[0]); });
    expect(urlsFor('DELETE')).toEqual(['/api/items/articles_tags/j1']);
  });

  // Rows can reach here from paths the load-time alias never touched.
  it('refuses a row with no resolvable primary key instead of requesting /undefined', async () => {
    const result = await loaded([row('j1')]);
    apiRequestMock.mockResolvedValue({ data: [], meta: {} });
    await act(async () => {
      await expect(result.current.removeItem({ tag_id: 't1' } as never)).rejects.toThrow(/primary key/);
    });
    expect(urlsFor('DELETE')).toEqual([]);
  });

  // The row shape createJunctionItem hands back: the real PK column, no `.id`.
  // Trusting `.id` alone sent this to `/undefined`.
  it('resolves the PK from the junction column when the row has no .id', async () => {
    const result = await loaded([row('j1')]);
    apiRequestMock.mockResolvedValue({ data: [], meta: {} });
    await act(async () => {
      await result.current.removeItem({ uuid: 'j9', tag_id: 't9' } as never);
    });
    expect(urlsFor('DELETE')).toEqual(['/api/items/articles_tags/j9']);
  });

  it('refreshes the list so state is not stale after a successful delete', async () => {
    const result = await loaded([row('j1')]);
    apiRequestMock.mockResolvedValue({ data: [], meta: {} });
    await act(async () => { await result.current.removeItem(result.current.items[0]); });
    expect(result.current.items).toEqual([]);
  });
});

describe('createJunctionItem and selectItems', () => {
  it('returns a created row whose .id is the real junction PK', async () => {
    const result = await loaded([]);
    apiRequestMock.mockResolvedValueOnce({ data: { uuid: 'new-1', tag_id: 't1' } });
    apiRequestMock.mockResolvedValue({ data: [], meta: {} });
    let created: unknown;
    await act(async () => { created = await result.current.createJunctionItem('t1'); });
    expect((created as { id: unknown }).id).toBe('new-1');
  });

  it('returns the server rows from selectItems, not the request bodies', async () => {
    const result = await loaded([]);
    apiRequestMock.mockResolvedValueOnce({ data: { uuid: 'new-1', tag_id: 't1' } });
    apiRequestMock.mockResolvedValueOnce({ data: { uuid: 'new-2', tag_id: 't2' } });
    apiRequestMock.mockResolvedValue({ data: [], meta: {} });
    let created: unknown;
    await act(async () => { created = await result.current.selectItems(['t1', 't2']); });
    expect((created as { id: unknown }[]).map(c => c.id)).toEqual(['new-1', 'new-2']);
  });

  // Independent writes: a rejection partway through still commits the rest,
  // so reporting a total failure made the user retry and duplicate them.
  it('keeps the rows that succeeded when part of a batch fails', async () => {
    const result = await loaded([]);
    apiRequestMock.mockResolvedValueOnce({ data: { uuid: 'new-1', tag_id: 't1' } });
    apiRequestMock.mockRejectedValueOnce(new Error('conflict'));
    apiRequestMock.mockResolvedValue({ data: [], meta: {} });
    let created: unknown;
    await act(async () => { created = await result.current.selectItems(['t1', 't2']); });
    expect((created as unknown[]).length).toBe(1);
  });

  it('assigns a sort value to a newly linked row', async () => {
    const result = await loaded([row('j1', 4)]);
    apiRequestMock.mockResolvedValueOnce({ data: { uuid: 'new-1' } });
    apiRequestMock.mockResolvedValue({ data: [], meta: {} });
    await act(async () => { await result.current.createJunctionItem('t1'); });
    const post = apiRequestMock.mock.calls.find(c => c[1]?.method === 'POST');
    expect(JSON.parse(post![1].body).sort).toBe(5);
  });
});

describe('updateSortOrder', () => {
  it('builds each PATCH URL from the real junction PK', async () => {
    const result = await loaded([row('j1', 1), row('j2', 2)]);
    apiRequestMock.mockResolvedValue({ data: [], meta: {} });
    await act(async () => { await result.current.updateSortOrder([...result.current.items].reverse()); });
    expect(urlsFor('PATCH')).toEqual([
      '/api/items/articles_tags/j2',
      '/api/items/articles_tags/j1',
    ]);
  });

  // Numbering 1..N per page collides with the previous page's values.
  it('offsets sort values by the page so pages do not collide', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [row('j1', 11), row('j2', 12)], meta: {} });
    const { result } = renderHook(() => useRelationM2MItems(relationInfo, 'article-1'));
    await act(async () => { await result.current.loadItems({ limit: 10, page: 2, fields: ['id'] }); });
    apiRequestMock.mockResolvedValue({ data: [], meta: {} });
    await act(async () => { await result.current.updateSortOrder(result.current.items); });
    const sorts = apiRequestMock.mock.calls
      .filter(c => c[1]?.method === 'PATCH')
      .map(c => JSON.parse(c[1].body).sort);
    expect(sorts).toEqual([11, 12]);
  });

  it('refuses to renumber when any row has no resolvable primary key', async () => {
    const result = await loaded([row('j1', 1)]);
    apiRequestMock.mockResolvedValue({ data: [], meta: {} });
    await act(async () => {
      await expect(
        result.current.updateSortOrder([...result.current.items, { tag_id: 't9' } as never]),
      ).rejects.toThrow(/primary key/);
    });
    expect(urlsFor('PATCH')).toEqual([]);
  });
});

describe('moveItemUp / moveItemDown bounds', () => {
  it.each([
    ['moveItemUp at the first row', 'moveItemUp' as const, 0],
    ['moveItemDown at the last row', 'moveItemDown' as const, 1],
    ['moveItemUp past the end', 'moveItemUp' as const, 5],
    ['moveItemDown past the end', 'moveItemDown' as const, 5],
    ['moveItemDown below zero', 'moveItemDown' as const, -1],
  ])('%s issues no PATCH', async (_name, method, index) => {
    const result = await loaded([row('j1', 1), row('j2', 2)]);
    apiRequestMock.mockResolvedValue({ data: [], meta: {} });
    await act(async () => { await result.current[method](index); });
    expect(urlsFor('PATCH')).toEqual([]);
  });

  it('still reorders for a valid index', async () => {
    const result = await loaded([row('j1', 1), row('j2', 2)]);
    apiRequestMock.mockResolvedValue({ data: [], meta: {} });
    await act(async () => { await result.current.moveItemDown(0); });
    expect(urlsFor('PATCH')).toEqual([
      '/api/items/articles_tags/j2',
      '/api/items/articles_tags/j1',
    ]);
  });
});
