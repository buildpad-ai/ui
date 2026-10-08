import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildApiUrl,
  getApiHeadersAsync,
  useBuildpadTranslations,
  useDaaSContextOptional,
  type DaaSConfig,
} from '@buildpad/services';
import { defaultTranslations, interpolate, isNewItem } from '@buildpad/utils';
import type {
  UseWorkflowOptions,
  UseWorkflowReturn,
  WorkflowInstance,
  WorkflowState,
  WorkflowCommand,
  CommandOption,
} from './types';

type WorkflowApiClient = NonNullable<UseWorkflowOptions['apiClient']>;

/**
 * What the current user may do with gated commands: whether they are an
 * administrator, the policies they hold and the module access keys granted to
 * them. Resolved only when the current state has a gated command.
 */
interface WorkflowAccess {
  isAdmin: boolean;
  policyIds: Set<string>;
  moduleAccess: Record<string, boolean>;
}

const NO_ACCESS: WorkflowAccess = { isAdmin: false, policyIds: new Set(), moduleAccess: {} };

/**
 * Whether the user may run a command, by the rule the server applies on
 * POST /api/workflow/transition: a command with neither list is open; otherwise
 * an administrator passes, and anyone else needs one of its policies OR one of
 * its module access keys. The server decides again on the transition itself —
 * this only keeps the menu from offering what would be refused.
 */
export function canRunWorkflowCommand(command: WorkflowCommand, access: WorkflowAccess): boolean {
  const policies = command.policies ?? [];
  const keys = command.module_access_keys ?? [];
  if (policies.length === 0 && keys.length === 0) return true;
  if (access.isAdmin) return true;
  return (
    policies.some((policyId) => access.policyIds.has(policyId)) ||
    keys.some((key) => access.moduleAccess[key] === true)
  );
}

/** The sentence a DaaS error body carries, whichever envelope the backend used. */
async function readErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as {
      message?: unknown;
      error?: unknown;
      errors?: { message?: unknown }[];
    } | null;
    const message = body?.message ?? body?.error ?? body?.errors?.[0]?.message;
    return typeof message === 'string' && message.length > 0 ? message : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Default API client on `fetch`. Not a hook, so the HTTP error message (a GET
 * failure reaches the user through `errorMessage`) is handed in; it defaults
 * to the English dictionary entry `interfaces.workflowButton.error.http`.
 *
 * Requests go where every other Buildpad data hook sends them: to the DaaS
 * origin, with the session token and the scope header, when a DaaS URL is
 * configured (a `DaaSProvider`, `setGlobalDaaSConfig`, or
 * `NEXT_PUBLIC_BUILDPAD_DAAS_URL`). The paths used to be fetched relative to
 * the page instead, which only worked inside the Studio or behind a proxy
 * route for each one — and an app scaffolded by the CLI has no proxy for
 * `/api/workflow/transition`, so every transition answered 404. Without a
 * configured URL the paths stay relative, as before.
 *
 * `getDaasConfig` is read per request rather than captured, so a provider
 * whose `config` object changes identity between renders does not give the
 * hook a new client (and with it a refetch) each time.
 */
export function createDefaultApiClient(
  httpErrorMessage: string = defaultTranslations.interfaces.workflowButton.error.http,
  getDaasConfig: () => DaaSConfig | null = () => null,
): WorkflowApiClient {
  const failure = async (response: Response) =>
    new Error((await readErrorMessage(response)) ?? interpolate(httpErrorMessage, { status: response.status }));

  const target = async (path: string): Promise<{ url: string; headers: Record<string, string> }> => {
    const config = getDaasConfig();
    let url: string;
    try {
      url = buildApiUrl(path, config);
    } catch {
      // No DaaS URL anywhere: same-origin, as the Studio serves these routes.
      return { url: path, headers: { 'Content-Type': 'application/json' } };
    }
    return { url, headers: await getApiHeadersAsync(config) };
  };

  return {
    get: async (path, config) => {
      const params = new URLSearchParams();
      if (config?.params) {
        Object.entries(config.params).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, typeof value === 'string' ? value : JSON.stringify(value));
          }
        });
      }
      const queryString = params.toString();
      const { url, headers } = await target(queryString ? `${path}?${queryString}` : path);
      const response = await fetch(url, { method: 'GET', credentials: 'include', headers });
      if (!response.ok) throw await failure(response);
      return { data: await response.json() };
    },
    post: async (path, data) => {
      const { url, headers } = await target(path);
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) throw await failure(response);
      return { data: await response.json() };
    },
  };
}

/**
 * useWorkflow Hook
 *
 * A React hook for managing workflow state transitions.
 * Fetches workflow instance, commands, and handles transitions.
 *
 * Features:
 * - Automatic workflow instance fetching
 * - Command filtering by policy and by module access key (administrators see every command)
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
    apiClient: apiClientOption,
    translations,
  } = options;

  const t = useBuildpadTranslations((d) => d.interfaces.workflowButton, translations);
  // The provider's config is read through a ref at request time: its identity
  // is not stable across renders (see createDefaultApiClient).
  const daasConfig = useDaaSContextOptional()?.config ?? null;
  const daasConfigRef = useRef(daasConfig);
  daasConfigRef.current = daasConfig;

  // The default client is memoised on the (stable) dictionary string so it
  // keeps one identity across renders, as the module-level constant did.
  const apiClient = useMemo(
    () => apiClientOption ?? createDefaultApiClient(t.error.http, () => daasConfigRef.current),
    [apiClientOption, t.error.http],
  );

  const [workflowInstance, setWorkflowInstance] = useState<WorkflowInstance | null>(null);
  const [workflowInstanceId, setWorkflowInstanceId] = useState<number | null>(null);
  const [commands, setCommands] = useState<CommandOption[]>([]);
  const [transitionCount, setTransitionCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch the policies the current user holds.
  //
  // GET /api/policies/me is the route that answers this: the policies that
  // reach the user directly, through a role, or publicly, at the active scope.
  // The earlier lookup read a `policies` list off /api/auth/user or
  // /api/users/me — neither returns one — so it always came back empty and a
  // policy-gated command was hidden from the very users it was granted to.
  // That lookup is kept as the fallback for a backend without the route.
  const fetchUserPolicies = useCallback(async (): Promise<{ policy: string }[]> => {
    try {
      try {
        const response = await apiClient.get('/api/policies/me');
        const rows = response.data?.data;
        if (Array.isArray(rows)) {
          return rows
            .map((row: unknown) => (typeof row === 'string' ? row : (row as { id?: unknown } | null)?.id))
            .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')
            .map((id) => ({ policy: String(id) }));
        }
      } catch {
        // No such route on this backend: fall through to the earlier lookup.
      }

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

  // What the current user may do with gated commands. GET /api/permissions/me
  // carries both facts the server's gate uses that are not policies: whether
  // the user is an administrator and their OR-merged module access keys. It
  // is narrowed to one collection because only those two fields are read.
  // Every failure resolves to "no access": a gated command is something the
  // user is presumed not to have.
  const fetchAccess = useCallback(
    async (needsPolicies: boolean): Promise<WorkflowAccess> => {
      let isAdmin = false;
      let moduleAccess: Record<string, boolean> = {};
      try {
        const response = await apiClient.get('/api/permissions/me', {
          params: { collection: 'daas_wf_instance' },
        });
        const body = response.data as unknown as {
          isAdmin?: unknown;
          moduleAccess?: Record<string, boolean> | null;
        } | null;
        isAdmin = body?.isAdmin === true;
        moduleAccess = body?.moduleAccess ?? {};
      } catch (error) {
        console.error('Error fetching workflow access:', error);
      }

      const policyIds =
        !isAdmin && needsPolicies
          ? new Set((await fetchUserPolicies()).map((policy) => policy.policy))
          : new Set<string>();

      return { isAdmin, moduleAccess, policyIds };
    },
    [apiClient, fetchUserPolicies],
  );

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
        // `item_id` alone is ambiguous: integer keys repeat across collections,
        // so item 5 of `pages` matched the instance of item 5 of `articles`.
        // A translation lookup is left as it was: this hook does not know
        // which collection a translation's instance is recorded under.
        if (queryItemId === itemId) {
          filter.collection = collection;
        }
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
            setErrorMessage(t.error.missingWorkflowId);
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
            setErrorMessage(t.error.missingConfig);
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
                (t: { name: string; to: string; policies?: string[]; module_access_keys?: string[] }) => ({
                  name: t.name,
                  next_state: t.to,
                  policies: t.policies || [],
                  module_access_keys: t.module_access_keys || [],
                })
              );
            }
          }

          // Keep the commands this user may run. Access is only looked up
          // when the state has a gated command, and policies only when one of
          // them names a policy.
          const gatedCommands = workflowCommands.filter(
            (command) => !canRunWorkflowCommand(command, NO_ACCESS),
          );
          const access =
            gatedCommands.length > 0
              ? await fetchAccess(gatedCommands.some((command) => (command.policies ?? []).length > 0))
              : NO_ACCESS;
          const filteredCommands = workflowCommands.filter((command) =>
            canRunWorkflowCommand(command, access),
          );

          // Populate the command options
          setCommands(
            filteredCommands.map((command) => ({
              text: interpolate(t.commandText, {
                name: command.name,
                nextState: command.next_state || t.unknown,
              }),
              value: command.name,
              command: command.name || t.unknownCommand,
              nextState: command.next_state || t.unknownState,
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
        setErrorMessage(error instanceof Error ? error.message : t.error.fetch);
        setWorkflowInstance(null);
        setWorkflowInstanceId(null);
        setCommands([]);
      } finally {
        setLoading(false);
      }
    },
    [itemId, collection, fetchAccess, initialVersionKey, initialTranslationId, apiClient, t]
  );

  // Execute a workflow transition
  const executeTransition = useCallback(
    async (commandName: string | number, workflowField: string = 'status') => {
      if (!workflowInstanceId) {
        throw new Error(t.error.noInstance);
      }

      setErrorMessage('');

      try {
        await apiClient.post('/api/workflow/transition', {
          workflowInstanceId: workflowInstanceId,
          commandName: commandName,
          workflowField: workflowField,
        });
      } catch (error) {
        // A refused or failed transition still rejects, but it also reaches
        // `errorMessage`: the button only logged the rejection, so the user
        // saw the old state come back with no explanation.
        setErrorMessage(error instanceof Error && error.message ? error.message : String(error));
        throw error;
      }

      // Refetch the workflow instance
      await fetchWorkflowInstance();

      // Increment transition count to notify parent components
      setTransitionCount((prev) => prev + 1);
    },
    [workflowInstanceId, apiClient, fetchWorkflowInstance, t]
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
