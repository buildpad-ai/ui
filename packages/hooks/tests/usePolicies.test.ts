/**
 * usePolicies unit tests
 *
 * Covers query-string construction for `fetchPolicies`, the total/totalPages
 * fallback chain, and error normalization. `apiRequest` is mocked so no
 * network is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('@buildpad/services', () => ({ apiRequest: apiRequestMock }));

import { usePolicies } from '../src/usePolicies';

function lastPath(): string {
  return apiRequestMock.mock.calls.at(-1)?.[0] as string;
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('usePolicies.fetchPolicies', () => {
  it('builds default query params (page/limit/meta)', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 0 });
    const { result } = renderHook(() => usePolicies());

    await act(async () => {
      await result.current.fetchPolicies();
    });

    const query = new URLSearchParams(lastPath().split('?')[1]);
    expect(query.get('page')).toBe('1');
    expect(query.get('limit')).toBe('25');
    expect(query.get('meta')).toBe('total_count');
  });

  it('includes search/sort when provided', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 0 });
    const { result } = renderHook(() => usePolicies());

    await act(async () => {
      await result.current.fetchPolicies({ search: 'admin', sort: '-name' });
    });

    const query = new URLSearchParams(lastPath().split('?')[1]);
    expect(query.get('search')).toBe('admin');
    expect(query.get('sort')).toBe('-name');
  });

  it('resolves total from totalCount, falling back to meta.total_count then count', async () => {
    const policies = [{ id: 'p1', name: 'Admin', userCount: 2, roleCount: 1 }];

    apiRequestMock.mockResolvedValueOnce({ data: policies, totalCount: 5, totalPages: 1 });
    const { result } = renderHook(() => usePolicies());
    let out: Awaited<ReturnType<typeof result.current.fetchPolicies>> | undefined;
    await act(async () => {
      out = await result.current.fetchPolicies();
    });
    expect(out).toEqual({ policies, total: 5, totalPages: 1 });

    apiRequestMock.mockResolvedValueOnce({ data: policies, meta: { total_count: 3 } });
    await act(async () => {
      out = await result.current.fetchPolicies({ limit: 1 });
    });
    expect(out).toEqual({ policies, total: 3, totalPages: 3 });

    apiRequestMock.mockResolvedValueOnce({ data: policies, count: 2 });
    await act(async () => {
      out = await result.current.fetchPolicies();
    });
    expect(out?.total).toBe(2);
  });
});

describe('usePolicies CRUD', () => {
  it('getPolicy calls /api/policies/:id', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { id: 'p1' } });
    const { result } = renderHook(() => usePolicies());

    await act(async () => {
      await result.current.getPolicy('p1');
    });

    expect(lastPath()).toBe('/api/policies/p1');
  });

  it('getMyPolicies calls /api/policies/me', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [{ id: 'p1' }] });
    const { result } = renderHook(() => usePolicies());

    await act(async () => {
      await result.current.getMyPolicies();
    });

    expect(lastPath()).toBe('/api/policies/me');
  });

  it('createPolicy POSTs to /api/policies', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { id: 'p1', name: 'New' } });
    const { result } = renderHook(() => usePolicies());

    await act(async () => {
      await result.current.createPolicy({ name: 'New' });
    });

    expect(lastPath()).toBe('/api/policies');
    const [, opts] = apiRequestMock.mock.calls.at(-1)!;
    expect((opts as { method?: string }).method).toBe('POST');
  });

  it('updatePolicy PATCHes /api/policies/:id', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { id: 'p1' } });
    const { result } = renderHook(() => usePolicies());

    await act(async () => {
      await result.current.updatePolicy('p1', { admin_access: true });
    });

    expect(lastPath()).toBe('/api/policies/p1');
    const [, opts] = apiRequestMock.mock.calls.at(-1)!;
    expect((opts as { method?: string }).method).toBe('PATCH');
  });

  it('deletePolicy DELETEs /api/policies/:id', async () => {
    apiRequestMock.mockResolvedValueOnce({});
    const { result } = renderHook(() => usePolicies());

    await act(async () => {
      await result.current.deletePolicy('p1');
    });

    expect(lastPath()).toBe('/api/policies/p1');
    const [, opts] = apiRequestMock.mock.calls.at(-1)!;
    expect((opts as { method?: string }).method).toBe('DELETE');
  });
});

describe('usePolicies error normalization', () => {
  it('sets `error` to the parsed message and rethrows on failure', async () => {
    apiRequestMock.mockRejectedValueOnce(new Error('API error: 400 - {"error":"Policy name is required"}'));
    const { result } = renderHook(() => usePolicies());

    await act(async () => {
      await expect(result.current.createPolicy({ name: '' })).rejects.toThrow(
        'Policy name is required'
      );
    });

    expect(result.current.error).toBe('Policy name is required');
  });
});
