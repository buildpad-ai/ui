/**
 * useRoles unit tests
 *
 * Covers query-string construction for `fetchRoles`/`getRole`, the
 * role↔policy attach/detach sub-resource calls, and error normalization.
 * `apiRequest` is mocked so no network is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('@buildpad/services', () => ({ apiRequest: apiRequestMock }));

import { useRoles } from '../src/useRoles';

function lastPath(): string {
  return apiRequestMock.mock.calls.at(-1)?.[0] as string;
}

function lastBody(): Record<string, unknown> | undefined {
  const [, opts] = apiRequestMock.mock.calls.at(-1) ?? [];
  const body = (opts as { body?: string } | undefined)?.body;
  return body ? JSON.parse(body) : undefined;
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('useRoles.fetchRoles', () => {
  it('builds default query params (page/limit)', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 0, totalPages: 1 });
    const { result } = renderHook(() => useRoles());

    await act(async () => {
      await result.current.fetchRoles();
    });

    expect(lastPath()).toBe('/api/roles?page=1&limit=25');
  });

  it('includes search/sort/includeUsers when provided', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 0, totalPages: 1 });
    const { result } = renderHook(() => useRoles());

    await act(async () => {
      await result.current.fetchRoles({ search: 'admin', sort: 'name', includeUsers: true });
    });

    const query = new URLSearchParams(lastPath().split('?')[1]);
    expect(query.get('search')).toBe('admin');
    expect(query.get('sort')).toBe('name');
    expect(query.get('includeUsers')).toBe('true');
  });

  it('resolves { roles, total, totalPages } from the response envelope', async () => {
    const roles = [{ id: 'r1', name: 'Admin' }];
    apiRequestMock.mockResolvedValueOnce({ data: roles, totalCount: 1, totalPages: 1 });
    const { result } = renderHook(() => useRoles());

    let out: Awaited<ReturnType<typeof result.current.fetchRoles>> | undefined;
    await act(async () => {
      out = await result.current.fetchRoles();
    });

    expect(out).toEqual({ roles, total: 1, totalPages: 1 });
  });
});

describe('useRoles.getRole', () => {
  it('omits includePolicies by default', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { id: 'r1' } });
    const { result } = renderHook(() => useRoles());

    await act(async () => {
      await result.current.getRole('r1');
    });

    expect(lastPath()).toBe('/api/roles/r1');
  });

  it('adds includePolicies=true when requested', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { id: 'r1' } });
    const { result } = renderHook(() => useRoles());

    await act(async () => {
      await result.current.getRole('r1', { includePolicies: true });
    });

    expect(lastPath()).toBe('/api/roles/r1?includePolicies=true');
  });
});

describe('useRoles.getMyRoles', () => {
  it('wraps the single /api/roles/me role in an array', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { id: 'r1', name: 'Admin' } });
    const { result } = renderHook(() => useRoles());

    let roles: unknown;
    await act(async () => {
      roles = await result.current.getMyRoles();
    });

    expect(lastPath()).toBe('/api/roles/me');
    expect(roles).toEqual([{ id: 'r1', name: 'Admin' }]);
  });

  it('returns an empty array when there is no data', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: null });
    const { result } = renderHook(() => useRoles());

    let roles: unknown;
    await act(async () => {
      roles = await result.current.getMyRoles();
    });

    expect(roles).toEqual([]);
  });
});

describe('useRoles policy sub-resource', () => {
  it('fetchRolePolicies calls the nested policies route', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [{ id: 'p1' }] });
    const { result } = renderHook(() => useRoles());

    await act(async () => {
      await result.current.fetchRolePolicies('r1');
    });

    expect(lastPath()).toBe('/api/roles/r1/policies');
  });

  it('attachRolePolicy POSTs a policyIds array', async () => {
    apiRequestMock.mockResolvedValueOnce({});
    const { result } = renderHook(() => useRoles());

    await act(async () => {
      await result.current.attachRolePolicy('r1', ['p1', 'p2']);
    });

    expect(lastPath()).toBe('/api/roles/r1/policies');
    expect(lastBody()).toEqual({ policyIds: ['p1', 'p2'] });
  });

  it('detachRolePolicy DELETEs the nested policy route', async () => {
    apiRequestMock.mockResolvedValueOnce({});
    const { result } = renderHook(() => useRoles());

    await act(async () => {
      await result.current.detachRolePolicy('r1', 'p1');
    });

    expect(lastPath()).toBe('/api/roles/r1/policies/p1');
  });
});

describe('useRoles error normalization', () => {
  it('sets `error` to the parsed message and rethrows on failure', async () => {
    apiRequestMock.mockRejectedValueOnce(new Error('API error: 404 - {"error":"Role not found"}'));
    const { result } = renderHook(() => useRoles());

    await act(async () => {
      await expect(result.current.getRole('missing')).rejects.toThrow('Role not found');
    });

    expect(result.current.error).toBe('Role not found');
  });
});
