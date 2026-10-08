/**
 * loadWorkflowCollectionNames: the names of the Collection picker, and a
 * failed load that is never "no collections". `apiRequest` is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DaaSRequestError } from '../../hooks/src/daasRequest';
import { loadWorkflowCollectionNames } from '../src/workflowAssignmentOptions';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock('@buildpad/services', () => ({ apiRequest: apiRequestMock }));
vi.mock('@buildpad/hooks', async () => {
  const request = await import('../../hooks/src/daasRequest');
  return { toDaaSRequestError: request.toDaaSRequestError };
});

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('loadWorkflowCollectionNames', () => {
  it('answers the collection names, sorted and without repeats', async () => {
    apiRequestMock.mockResolvedValue({
      data: [{ collection: 'tickets' }, { collection: 'articles' }, { collection: 'tickets' }, { collection: 'pages' }],
    });
    await expect(loadWorkflowCollectionNames()).resolves.toEqual(['articles', 'pages', 'tickets']);
    expect(apiRequestMock).toHaveBeenCalledWith('/api/collections');
  });

  it('reads a bare array, and names given as text', async () => {
    apiRequestMock.mockResolvedValue([{ collection: 'b' }, 'a', { collection: '' }, null, { name: 'x' }]);
    await expect(loadWorkflowCollectionNames()).resolves.toEqual(['a', 'b']);
  });

  it('reads `data: null` as no collections', async () => {
    apiRequestMock.mockResolvedValue({ data: null });
    await expect(loadWorkflowCollectionNames()).resolves.toEqual([]);
  });

  it('rejects an answer that is not a list, instead of answering no collections', async () => {
    apiRequestMock.mockResolvedValue({ error: 'nope' });
    await expect(loadWorkflowCollectionNames()).rejects.toMatchObject({
      kind: 'failure',
      message: 'The server answered the collections request without a list of collections',
    });
    apiRequestMock.mockResolvedValue(undefined);
    await expect(loadWorkflowCollectionNames()).rejects.toBeInstanceOf(DaaSRequestError);
  });

  it('rejects a refusal as a typed error with the server\'s sentence', async () => {
    apiRequestMock.mockRejectedValue(
      new Error('API error: 403 - {"errors":[{"message":"Admin access required","extensions":{"code":"FORBIDDEN"}}]}'),
    );
    await expect(loadWorkflowCollectionNames()).rejects.toMatchObject({
      kind: 'forbidden',
      status: 403,
      message: 'Admin access required',
    });
  });
});
