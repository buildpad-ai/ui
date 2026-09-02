/**
 * useUrlListParams unit tests (jsdom).
 *
 * The Storybook e2e specs exercise the router-less path, where
 * `history.replaceState` commits synchronously. The production path — a
 * registered writer such as Next's `router.replace` — commits asynchronously,
 * and that is where the interesting failure modes live. These tests model
 * that writer with a queue that is committed by hand.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  URL_STATE_EVENT,
  readUrlIntParam,
  readUrlParam,
  registerUrlStateWriter,
  useHydrated,
  useUrlListParams,
} from '../src/useUrlListParams';

let testNo = 0;
beforeEach(() => {
  // A fresh pathname per test: the module's pending-write record is scoped to
  // the pathname, so this guarantees nothing bleeds between tests.
  testNo += 1;
  window.history.replaceState(null, '', `/t${testNo}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
});
afterEach(() => {
  registerUrlStateWriter(null);
});

const query = () => window.location.search.replace(/^\?/, '');

/** An async writer in the shape of `router.replace`: nothing lands until `commit()`. */
function asyncWriter() {
  const writes: string[] = [];
  registerUrlStateWriter((url) => {
    writes.push(url);
  });
  return {
    writes,
    commit() {
      const last = writes[writes.length - 1];
      if (last) window.history.replaceState(null, '', last);
    },
  };
}

describe('state → URL', () => {
  it('writes managed keys and keeps defaults off the URL', () => {
    renderHook(() => useUrlListParams({ params: { search: 'ann', page: null, role: '' } }));
    expect(query()).toBe('search=ann');
  });

  it('merges: parameters it does not manage survive the write', () => {
    window.history.replaceState(null, '', `/t${testNo}?id=story-1&viewMode=story`);
    renderHook(() => useUrlListParams({ params: { search: 'ann' } }));
    const url = new URLSearchParams(query());
    expect(url.get('id')).toBe('story-1');
    expect(url.get('viewMode')).toBe('story');
    expect(url.get('search')).toBe('ann');
  });

  it('removes a managed key when its value returns to default', () => {
    window.history.replaceState(null, '', `/t${testNo}?id=story-1`);
    const { rerender } = renderHook(
      ({ search }: { search: string | null }) => useUrlListParams({ params: { search } }),
      { initialProps: { search: 'ann' } },
    );
    expect(query()).toContain('search=ann');
    rerender({ search: null });
    expect(query()).toBe('id=story-1');
  });

  it('does not write when the URL is already in sync', () => {
    window.history.replaceState(null, '', `/t${testNo}?search=ann`);
    const spy = vi.spyOn(window.history, 'replaceState');
    renderHook(() => useUrlListParams({ params: { search: 'ann' } }));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('enabled=false: writes nothing and hears nothing', () => {
    const onExternalChange = vi.fn();
    renderHook(() => useUrlListParams({ enabled: false, params: { search: 'ann' }, onExternalChange }));
    expect(query()).toBe('');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onExternalChange).not.toHaveBeenCalled();
  });

  it('routes through a registered writer instead of history.replaceState', () => {
    const w = asyncWriter();
    const spy = vi.spyOn(window.history, 'replaceState');
    renderHook(() => useUrlListParams({ params: { search: 'ann' } }));
    expect(w.writes).toEqual([`/t${testNo}?search=ann`]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('URL → state', () => {
  it('popstate flows back through onExternalChange', () => {
    const seen: (string | null)[] = [];
    renderHook(() => useUrlListParams({ params: { search: null }, onExternalChange: (get) => seen.push(get('search')) }));
    window.history.replaceState(null, '', `/t${testNo}?search=zed`);
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(seen).toEqual(['zed']);
  });

  it('a URL_STATE_EVENT with detail.search is the truth, even if location lags', () => {
    const seen: (string | null)[] = [];
    renderHook(() => useUrlListParams({ params: { search: null }, onExternalChange: (get) => seen.push(get('search')) }));
    // location still says nothing; the event says otherwise
    act(() => {
      window.dispatchEvent(new CustomEvent(URL_STATE_EVENT, { detail: { search: 'search=fromdetail' } }));
    });
    expect(seen).toEqual(['fromdetail']);
  });

  it('a plain-Event URL_STATE_EVENT falls back to location', () => {
    const seen: (string | null)[] = [];
    renderHook(() => useUrlListParams({ params: { search: null }, onExternalChange: (get) => seen.push(get('search')) }));
    window.history.replaceState(null, '', `/t${testNo}?search=fromlocation`);
    act(() => {
      window.dispatchEvent(new Event(URL_STATE_EVENT));
    });
    expect(seen).toEqual(['fromlocation']);
  });
});

describe('two instances on one page (the urlParamPrefix case)', () => {
  it('sync writer: writes are additive', () => {
    renderHook(() => useUrlListParams({ params: { a: 'x' } }));
    renderHook(() => useUrlListParams({ params: { b: 'y' } }));
    const url = new URLSearchParams(query());
    expect(url.get('a')).toBe('x');
    expect(url.get('b')).toBe('y');
  });

  it('async writer: still additive, and the first instance is never told to reset', () => {
    const w = asyncWriter();
    const heardA: (string | null)[] = [];
    renderHook(() => useUrlListParams({ params: { a: 'x' }, onExternalChange: (get) => heardA.push(get('a')) }));
    renderHook(() => useUrlListParams({ params: { b: 'y' } }));
    // Before the fix the second write was "/tN?b=y" — merged into a stale
    // location — and A heard `a=null` from its announcement.
    expect(w.writes[w.writes.length - 1]).toBe(`/t${testNo}?a=x&b=y`);
    expect(heardA).not.toContain(null);
    w.commit();
    const url = new URLSearchParams(query());
    expect(url.get('a')).toBe('x');
    expect(url.get('b')).toBe('y');
  });

  it('the in-flight merge base is scoped to its pathname', () => {
    const w = asyncWriter();
    renderHook(() => useUrlListParams({ params: { a: 'x' } }));
    // A navigation happens before the router commits; the pending record for
    // the old path must not leak into the new page's first write.
    window.history.replaceState(null, '', `/t${testNo}-elsewhere`);
    renderHook(() => useUrlListParams({ params: { b: 'y' } }));
    expect(w.writes[w.writes.length - 1]).toBe(`/t${testNo}-elsewhere?b=y`);
  });

  it('an external rewrite becomes the merge base for the next write', () => {
    const w = asyncWriter();
    const { rerender } = renderHook(
      ({ a }: { a: string }) => useUrlListParams({ params: { a } }),
      { initialProps: { a: 'x' } },
    );
    // A bridge applies the host's URL and announces it (without committing to
    // location yet — a router write).
    act(() => {
      window.dispatchEvent(new CustomEvent(URL_STATE_EVENT, { detail: { search: 'a=x&host=1' } }));
    });
    rerender({ a: 'x2' });
    expect(w.writes[w.writes.length - 1]).toBe(`/t${testNo}?a=x2&host=1`);
  });
});

describe('helpers', () => {
  it('useHydrated is true on a client mount', () => {
    const { result } = renderHook(() => useHydrated());
    expect(result.current).toBe(true);
  });

  it('readUrlParam / readUrlIntParam', () => {
    window.history.replaceState(null, '', `/t${testNo}?search=ann&page=3&bad=0&neg=-1&nan=abc`);
    expect(readUrlParam('search')).toBe('ann');
    expect(readUrlParam('missing')).toBeNull();
    expect(readUrlIntParam('page', 1)).toBe(3);
    expect(readUrlIntParam('bad', 1)).toBe(1);
    expect(readUrlIntParam('neg', 1)).toBe(1);
    expect(readUrlIntParam('nan', 1)).toBe(1);
    expect(readUrlIntParam('missing', 7)).toBe(7);
  });

  it('warns once in development when Next.js is present and no writer is registered', async () => {
    vi.resetModules();
    const fresh = await import('../src/useUrlListParams');
    (window as unknown as { next?: unknown }).next = { version: 'test' };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      renderHook(() => fresh.useUrlListParams({ params: { a: '1' } }));
      renderHook(() => fresh.useUrlListParams({ params: { b: '2' } }));
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('registerUrlStateWriter');
    } finally {
      warn.mockRestore();
      delete (window as unknown as { next?: unknown }).next;
    }
  });

  it('does not warn outside Next.js', async () => {
    vi.resetModules();
    const fresh = await import('../src/useUrlListParams');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      renderHook(() => fresh.useUrlListParams({ params: { a: '1' } }));
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

// Keep React in scope for the JSX-free file under the classic runtime.
void React;
