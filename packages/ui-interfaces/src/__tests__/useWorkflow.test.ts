import { renderHook, waitFor, act } from '@testing-library/react';
import { setGlobalDaaSConfig } from '@buildpad/services';
import { useWorkflow } from '../workflow-button';
import { createDefaultApiClient } from '../workflow-button/use-workflow';
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

  // `item_id` alone matched the instance of another collection's item with
  // the same key (integer keys repeat across collections).
  describe('Instance lookup filter', () => {
    /** The `filter` of the first instance lookup the hook made. */
    const instanceFilter = (): Record<string, unknown> => {
      const call = mockFetch.mock.calls.find((c) => String(c[0]).includes('/api/items/daas_wf_instance'));
      const query = new URLSearchParams(String(call![0]).split('?')[1]);
      return JSON.parse(query.get('filter') as string);
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });

    it('filters by collection as well as item id', async () => {
      const { result } = renderHook(() => useWorkflow({ itemId: 5, collection: 'pages' }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
        expect(result.current.loading).toBe(false);
      });

      expect(instanceFilter()).toEqual({ item_id: 5, collection: 'pages' });
    });

    it('keeps the version key next to the collection', async () => {
      const { result } = renderHook(() =>
        useWorkflow({ itemId: 5, collection: 'pages', versionKey: 'draft-v1' })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
        expect(result.current.loading).toBe(false);
      });

      expect(instanceFilter()).toEqual({ item_id: 5, collection: 'pages', version_key: 'draft-v1' });
    });

    it('leaves a translation lookup filtered by id only', async () => {
      const { result } = renderHook(() =>
        useWorkflow({ itemId: 5, collection: 'pages', translationId: 'translation-9' })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
        expect(result.current.loading).toBe(false);
      });

      expect(instanceFilter()).toEqual({ item_id: 'translation-9' });
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

    it('reports a refused transition in errorMessage and still rejects', async () => {
      const { result } = renderHook(() =>
        useWorkflow({ itemId: 'article-123', collection: 'articles' })
      );

      await waitFor(() => {
        expect(result.current.workflowInstanceId).toBe(1);
      });

      const accept = mockFetch.getMockImplementation()!;
      mockFetch.mockImplementation((url: string, options?: RequestInit) =>
        url.includes('/api/workflow/transition')
          ? Promise.resolve({ ok: false, status: 403 })
          : accept(url, options)
      );

      await act(async () => {
        await expect(result.current.executeTransition('Submit')).rejects.toThrow(
          'HTTP error! status: 403'
        );
      });

      expect(result.current.errorMessage).toBe('HTTP error! status: 403');
      // The instance is untouched: the item is still in the state it was in.
      expect(result.current.workflowInstance?.current_state).toBe('Draft');
      expect(result.current.transitionCount).toBe(0);

      // The next attempt starts clean.
      mockFetch.mockImplementation(accept);
      await act(async () => {
        await result.current.executeTransition('Submit');
      });

      expect(result.current.errorMessage).toBe('');
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

  // Who is offered a gated command. The server decides again on the
  // transition; these are about the menu not offering what it would refuse,
  // and not hiding what it would allow.
  describe('Gated commands', () => {
    const gatedInstance: WorkflowInstance = {
      ...mockWorkflowInstance,
      current_state: 'Review',
      workflow: {
        id: 1,
        name: 'Purchase approval',
        workflow_json: JSON.stringify({
          initial_state: 'Draft',
          states: [
            {
              name: 'Review',
              isEndState: false,
              commands: [
                { name: 'Comment', next_state: 'Review', policies: [] },
                { name: 'Approve', next_state: 'Approved', policies: [], module_access_keys: ['workflow:approve'] },
                { name: 'Escalate', next_state: 'Finance', policies: ['policy-manager'] },
                { name: 'Override', next_state: 'Approved', policies: ['policy-director'], module_access_keys: ['purchase:override'] },
              ],
            },
          ],
        }),
      },
    };

    /** Answers the routes the hook reads; `access` is what the user holds. */
    function serve(access: { isAdmin?: boolean; moduleAccess?: Record<string, boolean>; policies?: string[]; policiesRoute?: boolean; permissionsRoute?: boolean }) {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/items/daas_wf_instance')) {
          return Promise.resolve({ ok: true, json: async () => ({ data: [gatedInstance] }) });
        }
        if (url.includes('/api/permissions/me')) {
          return access.permissionsRoute === false
            ? Promise.resolve({ ok: false, status: 500 })
            : Promise.resolve({ ok: true, json: async () => ({ data: {}, isAdmin: access.isAdmin ?? false, moduleAccess: access.moduleAccess ?? {} }) });
        }
        if (url.includes('/api/policies/me')) {
          return access.policiesRoute === false
            ? Promise.resolve({ ok: false, status: 404 })
            : Promise.resolve({ ok: true, json: async () => ({ data: (access.policies ?? []).map((id) => ({ id, name: id })) }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      });
    }

    async function commandsFor(access: Parameters<typeof serve>[0]) {
      serve(access);
      const { result } = renderHook(() => useWorkflow({ itemId: 'article-123', collection: 'articles' }));
      await waitFor(() => expect(result.current.loading).toBe(false));
      await waitFor(() => expect(result.current.commands.length).toBeGreaterThan(0));
      return result.current.commands.map((command) => command.command);
    }

    it('offers a user with no grants only the open command', async () => {
      expect(await commandsFor({})).toEqual(['Comment']);
    });

    it('offers a command gated by a module access key to a holder of that key', async () => {
      expect(await commandsFor({ moduleAccess: { 'workflow:approve': true } })).toEqual(['Comment', 'Approve']);
    });

    it('does not take a key that is present but false as a grant', async () => {
      expect(await commandsFor({ moduleAccess: { 'workflow:approve': false } })).toEqual(['Comment']);
    });

    it('offers a policy-gated command to a holder of the policy, read from /api/policies/me', async () => {
      expect(await commandsFor({ policies: ['policy-manager'] })).toEqual(['Comment', 'Escalate']);
      expect(mockFetch.mock.calls.some((call) => String(call[0]).includes('/api/policies/me'))).toBe(true);
    });

    it('treats the two lists of one command as alternatives', async () => {
      expect(await commandsFor({ moduleAccess: { 'purchase:override': true } })).toEqual(['Comment', 'Override']);
      expect(await commandsFor({ policies: ['policy-director'] })).toEqual(['Comment', 'Override']);
    });

    it('offers an administrator every command, whatever their own grants', async () => {
      expect(await commandsFor({ isAdmin: true })).toEqual(['Comment', 'Approve', 'Escalate', 'Override']);
      // An administrator's policies are never asked for.
      expect(mockFetch.mock.calls.some((call) => String(call[0]).includes('/api/policies/me'))).toBe(false);
    });

    it('offers no gated command when the access lookup fails', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(await commandsFor({ permissionsRoute: false, moduleAccess: { 'workflow:approve': true } })).toEqual(['Comment']);
    });

    it('falls back to the earlier policy lookup on a backend without /api/policies/me', async () => {
      serve({ policiesRoute: false });
      const base = mockFetch.getMockImplementation()!;
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/auth/user')) return Promise.resolve({ ok: true, json: async () => ({ user: { policies: ['access-1'] } }) });
        if (url.includes('/api/access')) return Promise.resolve({ ok: true, json: async () => ({ data: [{ policy: 'policy-manager' }] }) });
        return base(url);
      });

      const { result } = renderHook(() => useWorkflow({ itemId: 'article-123', collection: 'articles' }));
      await waitFor(() => expect(result.current.commands.length).toBe(2));

      expect(result.current.commands.map((command) => command.command)).toEqual(['Comment', 'Escalate']);
    });

    it('asks for no access at all when the state has only open commands', async () => {
      mockFetch.mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          json: async () => ({ data: url.includes('/api/items/daas_wf_instance') ? [{ ...mockWorkflowInstance, current_state: 'Review' }] : [] }),
        }),
      );

      const { result } = renderHook(() => useWorkflow({ itemId: 'article-123', collection: 'articles' }));
      await waitFor(() => expect(result.current.commands.length).toBe(1));

      const asked = mockFetch.mock.calls.map((call) => String(call[0]));
      expect(asked.some((url) => url.includes('/api/permissions/me') || url.includes('/api/policies/me'))).toBe(false);
    });
  });

  // The default client sends requests where the other data hooks send them.
  describe('Default API client', () => {
    const ok = (data: unknown) => Promise.resolve({ ok: true, json: async () => data });

    afterEach(() => {
      setGlobalDaaSConfig(null);
    });

    it('stays same-origin when no DaaS URL is configured', async () => {
      mockFetch.mockImplementation(() => ok({ data: [] }));

      await createDefaultApiClient().get('/api/items/daas_wf_instance');

      expect(mockFetch.mock.calls[0][0]).toBe('/api/items/daas_wf_instance');
    });

    it('calls the configured DaaS origin with the session token and the scope header', async () => {
      mockFetch.mockImplementation(() => ok({ message: 'ok' }));
      const client = createDefaultApiClient(undefined, () => ({
        url: 'https://daas.example.com/',
        getToken: async () => 'jwt-1',
        getHeaders: async () => ({ 'X-Resource-Uri': '/tenant:1' }),
      }));

      await client.post('/api/workflow/transition', { workflowInstanceId: 'i-1', commandName: 'Submit' });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://daas.example.com/api/workflow/transition');
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('include');
      expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt-1', 'X-Resource-Uri': '/tenant:1' });
    });

    it('uses the globally configured DaaS when the hook has no provider', async () => {
      setGlobalDaaSConfig({ url: 'https://daas.example.com', token: 'static-token' });
      mockFetch.mockImplementation(() => ok({ data: [] }));

      await createDefaultApiClient().get('/api/items/daas_wf_instance', { params: { fields: 'id' } });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://daas.example.com/api/items/daas_wf_instance?fields=id');
      expect(init.headers).toMatchObject({ Authorization: 'Bearer static-token' });
    });

    it("reports the server's reason for a refusal instead of the bare status", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, status: 403, json: async () => ({ message: 'You are not authorized to perform this transition' }) }),
      );

      await expect(createDefaultApiClient().post('/api/workflow/transition', {})).rejects.toThrow(
        'You are not authorized to perform this transition',
      );
    });

    it('reads the reason from either error envelope', async () => {
      mockFetch.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 400, json: async () => ({ error: 'Command "X" not found in state "Draft"' }) }));
      await expect(createDefaultApiClient().post('/api/workflow/transition', {})).rejects.toThrow('Command "X" not found in state "Draft"');

      mockFetch.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 403, json: async () => ({ errors: [{ message: 'Forbidden' }] }) }));
      await expect(createDefaultApiClient().get('/api/items/daas_wf_instance')).rejects.toThrow('Forbidden');
    });

    it('falls back to the status when the body says nothing', async () => {
      mockFetch.mockImplementation(() => Promise.resolve({ ok: false, status: 502, json: async () => { throw new Error('not json'); } }));

      await expect(createDefaultApiClient().get('/api/items/daas_wf_instance')).rejects.toThrow('HTTP error! status: 502');
    });
  });
});
