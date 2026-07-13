/**
 * useUsers unit tests
 *
 * Covers query-string construction for `fetchUsers`, `admin_access` stripping
 * on `createUser`/`updateUser`/`updateMe`, and error normalization via
 * `parseDaaSError`. `apiRequest` is mocked so no network is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('@buildpad/services', () => ({ apiRequest: apiRequestMock }));

import { useUsers } from '../src/useUsers';

/** Pull the path+query used in the last `apiRequest` call. */
function lastPath(): string {
  return apiRequestMock.mock.calls.at(-1)?.[0] as string;
}

/** Pull the parsed JSON body of the last `apiRequest` call, if any. */
function lastBody(): Record<string, unknown> | undefined {
  const [, opts] = apiRequestMock.mock.calls.at(-1) ?? [];
  const body = (opts as { body?: string } | undefined)?.body;
  return body ? JSON.parse(body) : undefined;
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('useUsers.fetchUsers', () => {
  it('builds default query params (page/limit)', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 0, totalPages: 1 });
    const { result } = renderHook(() => useUsers());

    await act(async () => {
      await result.current.fetchUsers();
    });

    expect(lastPath()).toBe('/api/users?page=1&limit=25');
  });

  it('includes search/sort/fields/role/status/filter when provided', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 0, totalPages: 1 });
    const { result } = renderHook(() => useUsers());

    await act(async () => {
      await result.current.fetchUsers({
        page: 2,
        limit: 10,
        search: 'jane',
        sort: '-created_at',
        fields: 'id,email',
        role: 'role-1',
        status: 'active',
        filter: { status: { _eq: 'active' } },
      });
    });

    const path = lastPath();
    const query = new URLSearchParams(path.split('?')[1]);
    expect(query.get('page')).toBe('2');
    expect(query.get('limit')).toBe('10');
    expect(query.get('search')).toBe('jane');
    expect(query.get('sort')).toBe('-created_at');
    expect(query.get('fields')).toBe('id,email');
    expect(query.get('role')).toBe('role-1');
    expect(query.get('status')).toBe('active');
    expect(JSON.parse(query.get('filter')!)).toEqual({ status: { _eq: 'active' } });
  });

  it('resolves { users, total, totalPages } from the response envelope', async () => {
    const users = [{ id: 'u1', email: 'a@b.com', status: 'active' }];
    apiRequestMock.mockResolvedValueOnce({ data: users, totalCount: 1, totalPages: 1 });
    const { result } = renderHook(() => useUsers());

    let out: Awaited<ReturnType<typeof result.current.fetchUsers>> | undefined;
    await act(async () => {
      out = await result.current.fetchUsers();
    });

    expect(out).toEqual({ users, total: 1, totalPages: 1 });
  });
});

describe('useUsers admin_access stripping', () => {
  it('createUser strips admin_access before POSTing', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { id: 'u1', email: 'a@b.com' } });
    const { result } = renderHook(() => useUsers());

    await act(async () => {
      await result.current.createUser({
        email: 'a@b.com',
        admin_access: true,
      } as never);
    });

    expect(lastPath()).toBe('/api/users');
    const body = lastBody();
    expect(body).not.toHaveProperty('admin_access');
    expect(body).toEqual({ email: 'a@b.com' });
  });

  it('updateUser strips admin_access before PATCHing', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { id: 'u1' } });
    const { result } = renderHook(() => useUsers());

    await act(async () => {
      await result.current.updateUser('u1', {
        first_name: 'Jane',
        admin_access: true,
      } as never);
    });

    expect(lastPath()).toBe('/api/users/u1');
    const body = lastBody();
    expect(body).toEqual({ first_name: 'Jane' });
  });

  it('updateMe strips admin_access before PATCHing', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { id: 'u1' } });
    const { result } = renderHook(() => useUsers());

    await act(async () => {
      await result.current.updateMe({
        theme: 'dark',
        admin_access: true,
      } as never);
    });

    expect(lastPath()).toBe('/api/users/me');
    expect(lastBody()).toEqual({ theme: 'dark' });
  });
});

describe('useUsers policy sub-resource + bulk update', () => {
  it('fetchUserPolicies calls the nested policies route', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [{ id: 'p1', name: 'Admin' }] });
    const { result } = renderHook(() => useUsers());

    let policies: unknown;
    await act(async () => {
      policies = await result.current.fetchUserPolicies('u1');
    });

    expect(lastPath()).toBe('/api/users/u1/policies');
    expect(policies).toEqual([{ id: 'p1', name: 'Admin' }]);
  });

  it('attachUserPolicy POSTs a policyIds array', async () => {
    apiRequestMock.mockResolvedValueOnce({});
    const { result } = renderHook(() => useUsers());

    await act(async () => {
      await result.current.attachUserPolicy('u1', 'p1');
    });

    expect(lastPath()).toBe('/api/users/u1/policies');
    expect(lastBody()).toEqual({ policyIds: ['p1'] });
  });

  it('detachUserPolicy DELETEs the nested policy route', async () => {
    apiRequestMock.mockResolvedValueOnce({});
    const { result } = renderHook(() => useUsers());

    await act(async () => {
      await result.current.detachUserPolicy('u1', 'p1');
    });

    expect(lastPath()).toBe('/api/users/u1/policies/p1');
    const [, opts] = apiRequestMock.mock.calls.at(-1)!;
    expect((opts as { method?: string }).method).toBe('DELETE');
  });

  it('bulkUpdateUsers PATCHes /api/users/bulk-update with userIds + change', async () => {
    apiRequestMock.mockResolvedValueOnce({});
    const { result } = renderHook(() => useUsers());

    await act(async () => {
      await result.current.bulkUpdateUsers(['u1', 'u2'], { addRoles: ['r1'], removeRoles: ['r2'] });
    });

    expect(lastPath()).toBe('/api/users/bulk-update');
    expect(lastBody()).toEqual({ userIds: ['u1', 'u2'], addRoles: ['r1'], removeRoles: ['r2'] });
  });
});

describe('useUsers error normalization', () => {
  it('sets `error` to the parsed message and rethrows on failure', async () => {
    apiRequestMock.mockRejectedValueOnce(
      new Error('API error: 404 - {"errors":[{"message":"User not found"}]}')
    );
    const { result } = renderHook(() => useUsers());

    await act(async () => {
      await expect(result.current.getUser('missing')).rejects.toThrow('User not found');
    });

    await waitFor(() => expect(result.current.error).toBe('User not found'));
  });

  it('exposes loading=true while a request is in flight', async () => {
    let resolve!: (value: unknown) => void;
    apiRequestMock.mockImplementationOnce(
      () => new Promise((r) => { resolve = r; })
    );
    const { result } = renderHook(() => useUsers());

    let pending: Promise<unknown>;
    act(() => {
      pending = result.current.fetchUsers();
    });

    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => {
      resolve({ data: [], count: 0, totalPages: 1 });
      await pending;
    });

    expect(result.current.loading).toBe(false);
  });
});
