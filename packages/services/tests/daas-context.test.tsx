// @vitest-environment jsdom
/**
 * daas-context — DaaSProvider's current-user load.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { DaaSProvider, useDaaSContext } from '../src/daas-context';

function Probe() {
  const { isAdmin, authLoading } = useDaaSContext();
  return createElement('span', { 'data-testid': 'probe' }, authLoading ? 'loading' : `admin:${isAdmin}`);
}

describe('DaaSProvider current user', () => {
  const fetchMock = vi.fn();
  const savedUrl = process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL;
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'u1', admin_access: true } }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL;
    else process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL = savedUrl;
  });

  test("loads the user through the same-origin proxy when url is ''", async () => {
    render(createElement(DaaSProvider, { config: { url: '' } }, createElement(Probe)));

    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('admin:true'));
    expect(fetchMock).toHaveBeenCalledWith('/api/users/me', expect.objectContaining({ credentials: 'include' }));
  });

  test('loads nothing when no url is configured at all', async () => {
    render(createElement(DaaSProvider, {}, createElement(Probe)));

    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('admin:false'));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
