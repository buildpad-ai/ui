import { useCallback, useEffect, useMemo, useState } from 'react';
import { isNewItem } from '@buildpad/utils';
import type {
  UseWorkflowOptions,
  UseWorkflowReturn,
  WorkflowInstance,
  WorkflowState,
  WorkflowCommand,
  CommandOption,
} from './types';

// Default API client using fetch
const defaultApiClient = {
  get: async (url: string, config?: { params?: Record<string, unknown> }) => {
    const params = new URLSearchParams();
    if (config?.params) {
      Object.entries(config.params).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
      });
    }
    const queryString = params.toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    const response = await fetch(fullUrl, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return { data: await response.json() };
  },
  post: async (url: string, data?: unknown) => {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return { data: await response.json() };
  },
};

/**
 * useWorkflow Hook
 *
 * A React hook for managing workflow state transitions.
 * Fetches workflow instance, commands, and handles transitions.
 *
 * Features:
 * - Automatic workflow instance fetching
 * - Policy-based command filtering
 * - Transition execution with automatic state refresh
 * - Support for versioned content and translations
 *
 * @param options - Hook configuration options
 * @returns Workflow state and actions
 *
 * @example
 * ```tsx
 * const {
 *   workflowInstance,
 *   commands,
 *   loading,
 *   executeTransition,
 * } = useWorkflow({
 *   itemId: 'article-123',
 *   collection: 'articles',
 * });
 *
 * // Execute a transition
 * await executeTransition('Submit');
 * ```
 */
export function useWorkflow(options: UseWorkflowOptions): UseWorkflowReturn {
  const {
    itemId,
    collection,
    versionKey: initialVersionKey,
    translationId: initialTranslationId,
    apiClient = defaultApiClient,
  } = options;

  const [workflowInstance, setWorkflowInstance] = useState<WorkflowInstance | null>(null);
  const [workflowInstanceId, setWorkflowInstanceId] = useState<number | null>(null);
  const [commands, setCommands] = useState<CommandOption[]>([]);
  const [transitionCount, setTransitionCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch user policies - supports both /api/users/me and /api/auth/user endpoints
  const fetchUserPolicies = useCallback(async (): Promise<{ policy: string }[]> => {
    try {
      // Try /api/auth/user first (main-nextjs format)
      let policyIds: string[] = [];
      
      try {
        const response = await apiClient.get('/api/auth/user');
        // Handle { user: { ... } } format from main-nextjs
        const userData = (response.data as { user?: { policies?: string[] } })?.user;
        policyIds = userData?.policies || [];
      } catch {
        // Fall back to /api/users/me (DaaS format)
        try {
          const response = await apiClient.get('/api/users/me');
          const data = response.data.data as { policies?: string[] };
          policyIds = data.policies || [];
        } catch {
          // Neither endpoint available, return empty
          return [];
        }
      }

      if (policyIds.length === 0) {
        return [];
      }

      // Try to fetch from /api/access if available
      try {
        const policiesResponse = await apiClient.get('/api/access', {
          params: {
            filter: {
              id: { _in: policyIds },
            },
          },
        });
        return policiesResponse.data.data as { policy: string }[];
      } catch {
        // /api/access not available, return policy IDs as-is
        return policyIds.map(id => ({ policy: id }));
      }
    } catch (error) {
      console.error('Error fetching user policies:', error);
      return [];
    }
  }, [apiClient]);

  // Fetch workflow instance
  const fetchWorkflowInstance = useCallback(
    async (versionKey?: string, translationId?: string) => {
      // Skip for new items ('+' is DaaS convention for new records)
      if (isNewItem(itemId) || !collection) {
        setWorkflowInstance(null);
        setWorkflowInstanceId(null);
        setCommands([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage('');

      try {
        // Determine which ID to use for the query
        const queryItemId = translationId || initialTranslationId || itemId;

        // Use passed versionKey, or fall back to initial version
        const requestedVersion = versionKey ?? initialVersionKey;

        // Build filter object
        const filter: Record<string, unknown> = {
          item_id: queryItemId,
        };
        if (requestedVersion) {
          filter.version_key = requestedVersion;
        }

        const response = await apiClient.get('/api/items/daas_wf_instance', {
          params: {
            filter: JSON.stringify(filter),
            fields:
              'id,collection,current_state,date_created,date_updated,item_id,terminated,version_key,workflow',
          },
        });

        const instances = response.data.data as WorkflowInstance[];
        const instance = instances?.[0];

        if (instance) {
          // Fetch workflow definition separately since nested relations may not work
          const workflowId =
            typeof instance.workflow === 'string' || typeof instance.workflow === 'number'
              ? instance.workflow
              : instance.workflow?.id;

          if (!workflowId) {
            setErrorMessage('Workflow ID is missing');
            setWorkflowInstance(null);
            setWorkflowInstanceId(null);
            setCommands([]);
            setLoading(false);
            return;
          }

          // Check if workflow is already an object with workflow_json (nested relation worked)
          let workflowDef = instance.workflow;
          
          if (typeof workflowDef === 'string' || typeof workflowDef === 'number' || !workflowDef.workflow_json) {
            // Fetch the workflow definition separately
            const workflowResponse = await apiClient.get(`/api/items/daas_wf_definition/${workflowId}`);
            workflowDef = workflowResponse.data.data as WorkflowInstance['workflow'];
          }

          if (!workflowDef?.workflow_json) {
            setErrorMessage('Workflow configuration is missing');
            setWorkflowInstance(null);
            setWorkflowInstanceId(null);
            setCommands([]);
            setLoading(false);
            return;
          }

          // Attach workflow definition to instance
          instance.workflow = workflowDef;

          const workflowJson =
            typeof workflowDef.workflow_json === 'string'
              ? JSON.parse(workflowDef.workflow_json)
              : workflowDef.workflow_json;

          // Fetch user policies
          const policies = await fetchUserPolicies();
          const policyIds = policies.map((policy) => policy.policy);

          // Store workflow instance
          setWorkflowInstanceId(instance.id);
          setWorkflowInstance(instance);

          // Get commands/transitions for the current state
          // Support both formats:
          // 1. Array format: states[].commands (Buildpad/DaaS default)
          // 2. Object format: states[stateName].transitions (DaaS format)
          let workflowCommands: WorkflowCommand[] = [];

          if (Array.isArray(workflowJson.states)) {
            // Array format with commands
            workflowCommands =
              workflowJson.states.find(
                (state: WorkflowState) => state.name === instance.current_state
              )?.commands || [];
          } else if (typeof workflowJson.states === 'object') {
            // Object format with transitions (DaaS format)
            const currentStateConfig = workflowJson.states[instance.current_state];
            if (currentStateConfig?.transitions) {
              workflowCommands = currentStateConfig.transitions.map(
                (t: { name: string; to: string; policies?: string[] }) => ({
                  name: t.name,
                  next_state: t.to,
                  policies: t.policies || [],
                })
              );
            }
          }

          // Filter commands based on user policies
          const filteredCommands = workflowCommands.filter((command) => {
            if (!command.policies || command.policies.length === 0) return true;
            return command.policies?.some((policyId) => policyIds.includes(policyId));
          });

          // Populate the command options
          setCommands(
            filteredCommands.map((command) => ({
              text: `${command.name} -> ${command.next_state || 'Unknown'}`,
              value: command.name,
              command: command.name || 'Unknown Command',
              nextState: command.next_state || 'Unknown State',
            }))
          );
        } else {
          setErrorMessage('');
          setWorkflowInstance(null);
          setWorkflowInstanceId(null);
          setCommands([]);
        }
      } catch (error) {
        console.error('Failed to fetch workflow instance:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Fetch error');
        setWorkflowInstance(null);
        setWorkflowInstanceId(null);
        setCommands([]);
      } finally {
        setLoading(false);
      }
    },
    [itemId, collection, fetchUserPolicies, initialVersionKey, initialTranslationId, apiClient]
  );

  // Execute a workflow transition
  const executeTransition = useCallback(
    async (commandName: string | number, workflowField: string = 'status') => {
      if (!workflowInstanceId) {
        throw new Error('No workflow instance available');
      }

      await apiClient.post('/api/workflow/transition', {
        workflowInstanceId: workflowInstanceId,
        commandName: commandName,
        workflowField: workflowField,
      });

      // Refetch the workflow instance
      await fetchWorkflowInstance();

      // Increment transition count to notify parent components
      setTransitionCount((prev) => prev + 1);
    },
    [workflowInstanceId, apiClient, fetchWorkflowInstance]
  );

  const clearError = useCallback(() => {
    setErrorMessage('');
  }, []);

  const notifyTransitionComplete = useCallback(() => {
    setTransitionCount((prev) => prev + 1);
  }, []);

  // Auto-fetch workflow instance when dependencies change
  useEffect(() => {
    // Skip for new items
    if (!isNewItem(itemId) && collection) {
      fetchWorkflowInstance();
    }
  }, [itemId, collection, initialVersionKey, fetchWorkflowInstance]);

  return useMemo(
    () => ({
      workflowInstance,
      workflowInstanceId,
      commands,
      errorMessage,
      loading,
      transitionCount,
      fetchWorkflowInstance,
      fetchUserPolicies,
      clearError,
      notifyTransitionComplete,
      executeTransition,
    }),
    [
      workflowInstance,
      workflowInstanceId,
      commands,
      errorMessage,
      loading,
      transitionCount,
      fetchWorkflowInstance,
      fetchUserPolicies,
      clearError,
      notifyTransitionComplete,
      executeTransition,
    ]
  );
}
