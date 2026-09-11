/**
 * useFieldMetadata unit tests
 *
 * Covers formatFieldKey's fallback display-name formatting (snake_case ->
 * Title Case, dot-path fields resolved to their last segment) and that a
 * field's name is always the formatted key (DaaS has no separate
 * display-name field). `apiRequest` is mocked so no network is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('@buildpad/services', () => ({ apiRequest: apiRequestMock }));

import { useFieldMetadata } from '../src/useFieldMetadata';

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('useFieldMetadata — display name formatting', () => {
  it('formats a snake_case key into Title Case', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: [{ field: 'date_created', type: 'timestamp', meta: null }],
    });

    const { result } = renderHook(() => useFieldMetadata({ collection: 'articles' }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.getField('date_created')?.name).toBe('Date Created');
  });

  it('resolves a dot-path field to its last segment, formatted', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: [{ field: 'user_id.first_name', type: 'string', meta: null }],
    });

    const { result } = renderHook(() =>
      useFieldMetadata({ collection: 'articles', fields: ['user_id.first_name'] }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.getDisplayName('user_id.first_name')).toBe('First Name');
  });

  it('uses the formatted key as the name even when meta.note is set (note is a description, not a name)', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: [{
        field: 'internal_id',
        type: 'string',
        meta: { note: 'Internal tracking identifier, not shown to end users' },
      }],
    });

    const { result } = renderHook(() => useFieldMetadata({ collection: 'articles' }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.getField('internal_id')?.name).toBe('Internal Id');
  });
});
