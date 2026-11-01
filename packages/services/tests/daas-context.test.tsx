// @vitest-environment jsdom
/**
 * daas-context — DaaSProvider, its hooks, and the global (non-React) helpers.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import {
  DaaSProvider,
  buildApiUrl,
  getApiHeaders,
  getApiHeadersAsync,
  getGlobalDaaSConfig,
  setGlobalDaaSConfig,
  useDaaSContext,
  useDaaSContextOptional,
  useIsDaaSReady,
  useIsDirectDaaSMode,
  type DaaSConfig,
  type DaaSProviderProps,
} from '../src/daas-context';

function Probe() {
  const { isAdmin, authLoading, authError, user } = useDaaSContext();
  let text = `admin:${isAdmin} user:${user?.id ?? 'none'}`;
  if (authError) text = `error:${authError}`;
  return createElement('span', { 'data-testid': 'probe' }, authLoading ? 'loading' : text);
}

const probe = () => screen.getByTestId('probe').textContent;

function wrapper(props: Omit<DaaSProviderProps, 'children'>) {
  return ({ children }: { children: ReactNode }) => createElement(DaaSProvider, props, children);
}

function respond(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status });
}

const savedUrl = process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL;
const fetchMock = vi.fn();

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL;
  setGlobalDaaSConfig(null);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(respond(200, { data: { id: 'u1', admin_access: true } }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setGlobalDaaSConfig(null);
  if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL;
  else process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL = savedUrl;
});

describe('DaaSProvider current user', () => {
  test("loads the user through the same-origin proxy when url is ''", async () => {
    render(createElement(DaaSProvider, { config: { url: '' } }, createElement(Probe)));

    await waitFor(() => expect(probe()).toBe('admin:true user:u1'));
    expect(fetchMock).toHaveBeenCalledWith('/api/users/me', expect.objectContaining({ credentials: 'include' }));
  });

  test('loads nothing when no url is configured at all', async () => {
    render(createElement(DaaSProvider, {}, createElement(Probe)));

    await waitFor(() => expect(probe()).toBe('admin:false user:none'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('loads nothing when autoFetchUser is off', async () => {
    render(createElement(DaaSProvider, { config: { url: 'https://daas.test' }, autoFetchUser: false }, createElement(Probe)));

    await waitFor(() => expect(probe()).toBe('admin:false user:none'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('reads the url from NEXT_PUBLIC_BUILDPAD_DAAS_URL and reports the user', async () => {
    process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL = 'https://daas.test/';
    fetchMock.mockResolvedValue(respond(200, { id: 'u2', admin_access: false }));
    const onAuthenticated = vi.fn();

    render(createElement(DaaSProvider, { onAuthenticated }, createElement(Probe)));

    await waitFor(() => expect(probe()).toBe('admin:false user:u2'));
    expect(fetchMock).toHaveBeenCalledWith('https://daas.test/api/users/me', expect.anything());
    expect(onAuthenticated).toHaveBeenCalledWith({ id: 'u2', admin_access: false });
  });

  test('treats a 401 as signed out, without an error', async () => {
    fetchMock.mockResolvedValue(respond(401));
    const onAuthError = vi.fn();

    render(createElement(DaaSProvider, { config: { url: '' }, onAuthError }, createElement(Probe)));

    await waitFor(() => expect(probe()).toBe('admin:false user:none'));
    expect(onAuthError).not.toHaveBeenCalled();
  });

  test('reports any other failure as an auth error', async () => {
    fetchMock.mockResolvedValue(respond(500));
    const onAuthError = vi.fn();

    render(createElement(DaaSProvider, { config: { url: '' }, onAuthError }, createElement(Probe)));

    await waitFor(() => expect(probe()).toBe('error:Authentication failed: 500'));
    expect(onAuthError).toHaveBeenCalledWith(expect.any(Error));
  });

  test('reports a thrown non-Error with a generic message', async () => {
    fetchMock.mockRejectedValue('offline');
    const onAuthError = vi.fn();

    render(createElement(DaaSProvider, { config: { url: '' }, onAuthError }, createElement(Probe)));

    await waitFor(() => expect(probe()).toBe('error:Authentication failed'));
    expect(onAuthError.mock.calls[0][0].message).toBe('Authentication failed');
  });
});

describe('DaaSProvider context value', () => {
  test('sends the static token and builds urls against the configured base', async () => {
    const config: DaaSConfig = { url: 'https://daas.test/', token: 'static' };
    const { result } = renderHook(() => useDaaSContext(), { wrapper: wrapper({ config, autoFetchUser: false }) });

    expect(result.current.getHeaders()).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer static' });
    expect(result.current.buildUrl('api/items/orders')).toBe('https://daas.test/api/items/orders');
    expect(result.current.isDirectMode).toBe(true);
    expect(getGlobalDaaSConfig()).toEqual(config);

    // A static token never needs a refresh.
    await act(() => result.current.refreshToken());
    expect(result.current.getHeaders().Authorization).toBe('Bearer static');
  });

  test('takes a dynamic token from getToken', async () => {
    const getToken = vi.fn().mockResolvedValue('jwt-1');
    const { result } = renderHook(() => useDaaSContext(), {
      wrapper: wrapper({ config: { url: '', getToken }, autoFetchUser: false }),
    });

    await waitFor(() => expect(result.current.getHeaders().Authorization).toBe('Bearer jwt-1'));

    getToken.mockResolvedValue(null);
    await act(() => result.current.refreshToken());
    expect(result.current.getHeaders().Authorization).toBeUndefined();
  });

  test('has nothing to refresh without a token source', async () => {
    const { result } = renderHook(() => useDaaSContext(), { wrapper: wrapper({ config: { url: '' }, autoFetchUser: false }) });

    await act(() => result.current.refreshToken());
    expect(result.current.getHeaders()).toEqual({ 'Content-Type': 'application/json' });
  });

  test('throws from buildUrl when no url is configured', () => {
    const { result } = renderHook(() => useDaaSContext(), { wrapper: wrapper({ autoFetchUser: false }) });

    expect(() => result.current.buildUrl('/api/x')).toThrow('DaaS URL is not configured');
    expect(result.current.config).toBeNull();
  });
});

describe('DaaS context hooks', () => {
  test('useDaaSContext throws outside a provider; the optional hook returns null', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useDaaSContext())).toThrow('useDaaSContext must be used inside a <DaaSProvider>');
    expect(renderHook(() => useDaaSContextOptional()).result.current).toBeNull();
    vi.mocked(console.error).mockRestore();
  });

  test('useIsDaaSReady and useIsDirectDaaSMode', () => {
    expect(renderHook(() => useIsDaaSReady()).result.current).toBe(false);
    expect(renderHook(() => useIsDirectDaaSMode()).result.current).toBe(false);

    const inside = wrapper({ config: { url: 'https://daas.test' }, autoFetchUser: false });
    expect(renderHook(() => useIsDaaSReady(), { wrapper: inside }).result.current).toBe(true);
    expect(renderHook(() => useIsDirectDaaSMode(), { wrapper: inside }).result.current).toBe(true);
  });
});

describe('global DaaS helpers', () => {
  test('buildApiUrl uses the given config, then the global config, then the env var', () => {
    expect(buildApiUrl('/api/a', { url: 'https://given.test/' })).toBe('https://given.test/api/a');

    setGlobalDaaSConfig({ url: '' });
    expect(buildApiUrl('api/b')).toBe('/api/b');

    setGlobalDaaSConfig(null);
    process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL = 'https://env.test';
    expect(buildApiUrl('/api/c')).toBe('https://env.test/api/c');

    delete process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL;
    expect(() => buildApiUrl('/api/d')).toThrow('DaaS URL is not configured');
  });

  test('getApiHeaders adds the static token only', () => {
    expect(getApiHeaders()).toEqual({ 'Content-Type': 'application/json' });
    setGlobalDaaSConfig({ url: '', token: 'g' });
    expect(getApiHeaders().Authorization).toBe('Bearer g');
    expect(getApiHeaders({ url: '', getToken: async () => 'x' }).Authorization).toBeUndefined();
  });

  test('getApiHeadersAsync resolves the token and the extra headers', async () => {
    expect(await getApiHeadersAsync()).toEqual({ 'Content-Type': 'application/json' });
    expect((await getApiHeadersAsync({ url: '', token: 's' })).Authorization).toBe('Bearer s');
    expect((await getApiHeadersAsync({ url: '', getToken: async () => 'd' })).Authorization).toBe('Bearer d');
    expect((await getApiHeadersAsync({ url: '', getToken: async () => null })).Authorization).toBeUndefined();
    expect(
      await getApiHeadersAsync({ url: '', getHeaders: async () => ({ 'X-Resource-Uri': 'tenant/a' }) }),
    ).toEqual({ 'Content-Type': 'application/json', 'X-Resource-Uri': 'tenant/a' });
  });
});
