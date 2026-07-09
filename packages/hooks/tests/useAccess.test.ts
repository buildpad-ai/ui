/**
 * useAccess unit tests
 *
 * Covers the thin CRUD surface over `/api/access` (the `daas_access`
 * junction table). `apiRequest` is mocked so no network is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('@buildpad/services', () => ({ apiRequest: apiRequestMock }));

import { useAccess } from '../src/useAccess';

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

describe('useAccess.fetchAccess', () => {
  it('defaults to limit=25 with no other params', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [] });
    const { result } = renderHook(() => useAccess());

    await act(async () => {
      await result.current.fetchAccess();
    });

    expect(lastPath()).toBe('/api/access?limit=25');
  });

  it('serializes filter/sort/page when provided', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [] });
    const { result } = renderHook(() => useAccess());

    await act(async () => {
      await result.current.fetchAccess({
        page: 2,
        sort: '-created_at',
        filter: { role: { _eq: 'r1' } },
      });
    });

    const query = new URLSearchParams(lastPath().split('?')[1]);
    expect(query.get('page')).toBe('2');
    expect(query.get('sort')).toBe('-created_at');
    expect(JSON.parse(query.get('filter')!)).toEqual({ role: { _eq: 'r1' } });
  });

  it('returns the data array', async () => {
    const rows = [{ id: 'a1', policy: 'p1', role: 'r1' }];
    apiRequestMock.mockResolvedValueOnce({ data: rows });
    const { result } = renderHook(() => useAccess());

    let out: unknown;
    await act(async () => {
      out = await result.current.fetchAccess();
    });

    expect(out).toEqual(rows);
  });
});

describe('useAccess CRUD', () => {
  it('createAccess POSTs the payload to /api/access', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { id: 'a1' } });
    const { result } = renderHook(() => useAccess());

    await act(async () => {
      await result.current.createAccess({ policy: 'p1', role: 'r1' });
    });

    expect(lastPath()).toBe('/api/access');
    expect(lastBody()).toEqual({ policy: 'p1', role: 'r1' });
    const [, opts] = apiRequestMock.mock.calls.at(-1)!;
    expect((opts as { method?: string }).method).toBe('POST');
  });

  it('updateAccess PATCHes /api/access/:id', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { id: 'a1' } });
    const { result } = renderHook(() => useAccess());

    await act(async () => {
      await result.current.updateAccess('a1', { sort: 2 });
    });

    expect(lastPath()).toBe('/api/access/a1');
    const [, opts] = apiRequestMock.mock.calls.at(-1)!;
    expect((opts as { method?: string }).method).toBe('PATCH');
  });

  it('deleteAccess DELETEs /api/access/:id', async () => {
    apiRequestMock.mockResolvedValueOnce({});
    const { result } = renderHook(() => useAccess());

    await act(async () => {
      await result.current.deleteAccess('a1');
    });

    expect(lastPath()).toBe('/api/access/a1');
    const [, opts] = apiRequestMock.mock.calls.at(-1)!;
    expect((opts as { method?: string }).method).toBe('DELETE');
  });
});

describe('useAccess error normalization', () => {
  it('sets `error` to the parsed message and rethrows on failure', async () => {
    apiRequestMock.mockRejectedValueOnce(
      new Error('API error: 400 - {"error":"Cannot set both role and user."}')
    );
    const { result } = renderHook(() => useAccess());

    await act(async () => {
      await expect(
        result.current.createAccess({ policy: 'p1', role: 'r1', user: 'u1' } as never)
      ).rejects.toThrow('Cannot set both role and user.');
    });

    expect(result.current.error).toBe('Cannot set both role and user.');
  });
});
