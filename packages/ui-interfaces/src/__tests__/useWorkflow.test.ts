import { renderHook, waitFor, act } from '@testing-library/react';
import { useWorkflow } from '../workflow-button';
import type { WorkflowInstance } from '../workflow-button';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock workflow instance response
const mockWorkflowInstance: WorkflowInstance = {
  id: 1,
  item_id: 'article-123',
  current_state: 'Draft',
  version_key: null,
  terminated: false,
  workflow: {
    id: 1,
    name: 'Article Workflow',
    workflow_json: JSON.stringify({
      initial_state: 'Draft',
      states: [
        {
          name: 'Draft',
          commands: [
            { name: 'Submit', next_state: 'Review', policies: [] },
            { name: 'Publish', next_state: 'Published', policies: ['admin-policy'] },
          ],
          isEndState: false,
        },
        {
          name: 'Review',
          commands: [
            { name: 'Approve', next_state: 'Published', policies: [] },
          ],
          isEndState: false,
        },
        {
          name: 'Published',
          commands: [],
          isEndState: true,
        },
      ],
    }),
  },
};

// Mock user response
const mockUserResponse = {
  data: {
    id: 'user-1',
    email: 'user@example.com',
    policies: ['user-policy'],
  },
};

// Mock access response
const mockAccessResponse = {
  data: [{ policy: 'user-policy' }],
};

describe('useWorkflow', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Initial State', () => {
    it('returns initial state with null workflow instance', () => {
      const { result } = renderHook(() =>
        useWorkflow({ itemId: null, collection: 'articles' })
      );

      expect(result.current.workflowInstance).toBeNull();
      expect(result.current.workflowInstanceId).toBeNull();
      expect(result.current.commands).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.errorMessage).toBe('');
    });

    it('does not fetch when itemId is missing', () => {
      renderHook(() => useWorkflow({ itemId: null, collection: 'articles' }));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not fetch when collection is missing', () => {
      renderHook(() => useWorkflow({ itemId: 'article-123', collection: undefined }));

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Fetching Workflow', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/items/daas_wf_instance')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [mockWorkflowInstance] }),
          });
        }
        if (url.includes('/api/users/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockUserResponse,
          });
        }
        if (url.includes('/api/access')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockAccessResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });
    });

    it('fetches workflow instance on mount', async () => {
      const { result } = renderHook(() =>
        useWorkflow({ itemId: 'article-123', collection: 'articles' })
      );

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.workflowInstance).toBeDefined();
      expect(result.current.workflowInstance?.current_state).toBe('Draft');
    });

    it('populates workflow instance ID', async () => {
      const { result } = renderHook(() =>
        useWorkflow({ itemId: 'article-123', collection: 'articles' })
      );

      await waitFor(() => {
        expect(result.current.workflowInstanceId).toBe(1);
      });
    });

    it('populates commands based on current state', async () => {
      const { result } = renderHook(() =>
        useWorkflow({ itemId: 'article-123', collection: 'articles' })
      );

      await waitFor(() => {
        expect(result.current.commands.length).toBeGreaterThan(0);
      });

      // Should have Submit command (no policies required)
      const submitCommand = result.current.commands.find((c) => c.command === 'Submit');
      expect(submitCommand).toBeDefined();
      expect(submitCommand?.nextState).toBe('Review');
    });

    it('filters commands based on user policies', async () => {
      const { result } = renderHook(() =>
        useWorkflow({ itemId: 'article-123', collection: 'articles' })
      );

      await waitFor(() => {
        expect(result.current.commands.length).toBeGreaterThan(0);
      });

      // Should have Submit (no policies) but NOT Publish (requires admin-policy)
      const submitCommand = result.current.commands.find((c) => c.command === 'Submit');
      const publishCommand = result.current.commands.find((c) => c.command === 'Publish');
      
      expect(submitCommand).toBeDefined();
      expect(publishCommand).toBeUndefined();
    });
  });

  describe('Version Key Support', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/items/daas_wf_instance')) {
          // Check if version_key is in the filter
          const hasVersionKey = url.includes('version_key');
          if (hasVersionKey) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                data: [{
                  ...mockWorkflowInstance,
                  version_key: 'draft-v1',
                }],
              }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [mockWorkflowInstance] }),
          });
        }
        if (url.includes('/api/users/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockUserResponse,
          });
        }
        if (url.includes('/api/access')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockAccessResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });
    });

    it('includes version key in query when provided', async () => {
      const { result } = renderHook(() =>
        useWorkflow({
          itemId: 'article-123',
          collection: 'articles',
          versionKey: 'draft-v1',
        })
      );

      await waitFor(() => {
        expect(result.current.workflowInstance?.version_key).toBe('draft-v1');
      });
    });
  });

  describe('Error Handling', () => {
    it('sets error message on fetch failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useWorkflow({ itemId: 'article-123', collection: 'articles' })
      );

      await waitFor(() => {
        expect(result.current.errorMessage).toBe('Network error');
      });

      expect(result.current.workflowInstance).toBeNull();
    });

    it('sets error message when workflow config is missing', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/items/daas_wf_instance')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: [{
                ...mockWorkflowInstance,
                workflow: {
                  id: 1,
                  name: 'Invalid Workflow',
                  workflow_json: null,
                },
              }],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });

      const { result } = renderHook(() =>
        useWorkflow({ itemId: 'article-123', collection: 'articles' })
      );

      await waitFor(() => {
        expect(result.current.errorMessage).toBe('Workflow configuration is missing');
      });
    });

    it('clears error message with clearError', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useWorkflow({ itemId: 'article-123', collection: 'articles' })
      );

      await waitFor(() => {
        expect(result.current.errorMessage).toBe('Network error');
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.errorMessage).toBe('');
    });
  });

  describe('Transition Execution', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/api/items/daas_wf_instance')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [mockWorkflowInstance] }),
          });
        }
        if (url.includes('/api/users/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockUserResponse,
          });
        }
        if (url.includes('/api/access')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockAccessResponse,
          });
        }
        if (url.includes('/api/workflow/transition') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });
    });

    it('executes transition with correct payload', async () => {
      const { result } = renderHook(() =>
        useWorkflow({ itemId: 'article-123', collection: 'articles' })
      );

      await waitFor(() => {
        expect(result.current.workflowInstanceId).toBe(1);
      });

      await result.current.executeTransition('Submit', 'status');

      // Check that transition was called with correct payload
      const transitionCall = mockFetch.mock.calls.find(
        (call) => String(call[0]).includes('/api/workflow/transition')
      );
      
      expect(transitionCall).toBeDefined();
      const body = JSON.parse(transitionCall![1].body);
      expect(body.workflowInstanceId).toBe(1);
      expect(body.commandName).toBe('Submit');
      expect(body.workflowField).toBe('status');
    });

    it('increments transitionCount after successful transition', async () => {
      const { result } = renderHook(() =>
        useWorkflow({ itemId: 'article-123', collection: 'articles' })
      );

      await waitFor(() => {
        expect(result.current.workflowInstanceId).toBe(1);
      });

      const initialCount = result.current.transitionCount;

      await result.current.executeTransition('Submit');

      await waitFor(() => {
        expect(result.current.transitionCount).toBe(initialCount + 1);
      });
    });

    it('throws error when no workflow instance available', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const { result } = renderHook(() =>
        useWorkflow({ itemId: 'article-123', collection: 'articles' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(result.current.executeTransition('Submit')).rejects.toThrow(
        'No workflow instance available'
      );
    });
  });

  describe('Notify Transition Complete', () => {
    it('increments transitionCount when called', () => {
      const { result } = renderHook(() =>
        useWorkflow({ itemId: null, collection: 'articles' })
      );

      const initialCount = result.current.transitionCount;

      act(() => {
        result.current.notifyTransitionComplete();
      });

      expect(result.current.transitionCount).toBe(initialCount + 1);
    });
  });
});
