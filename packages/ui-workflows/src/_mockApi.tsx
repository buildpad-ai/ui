/**
 * An in-memory DaaS for the fixture stories of the containers (the three
 * managers and the three detail surfaces), which load through the data hooks
 * and so cannot be fed by props.
 *
 * `MockWorkflowApi` replaces `window.fetch` while it is mounted, for the
 * routes the containers call — `/api/workflows`, `/api/workflow-assignments`,
 * `/api/workflow-instances` (and an instance's `/history`), `/api/collections`,
 * `/api/permissions`, `/api/policies` — and answers them from the fixtures, in
 * the Studio routes' envelope. Every other request goes to the real `fetch`. One mock at a time:
 * the stories that use it are tagged `!autodocs`, so two never share a page.
 *
 * Internal to the stories only (underscore-prefixed, not exported from
 * `index.ts`, not bundled by tsup). Nothing here is a contract: the live
 * `*.daas.stories.tsx` are what exercise a real backend.
 */
import React, { useEffect, useState } from 'react';
import { DaaSProvider } from '@buildpad/services';
import type {
  WorkflowAssignmentRecord,
  WorkflowDefinitionRecord,
  WorkflowHistoryRecord,
  WorkflowInstanceRecord,
} from '@buildpad/types';
import {
  mockAssignments,
  mockCollectionNames,
  mockHistory,
  mockInstances,
  mockPolicyOptions,
  mockWorkflows,
  reviewWorkflowJson,
} from './_fixtures';

export interface MockWorkflowApiOptions {
  /** The definitions the backend starts with. Default: the three fixture definitions. */
  workflows?: WorkflowDefinitionRecord[];
  /** The assignments the backend starts with. Default: the three fixture assignments. */
  assignments?: WorkflowAssignmentRecord[];
  /** The instances the backend has. Default: the three fixture instances. */
  instances?: WorkflowInstanceRecord[];
  /** The transitions every instance has. Default: the two fixture transitions. */
  history?: WorkflowHistoryRecord[];
  /**
   * What the caller may do with the workflow collections. Default: 'admin'.
   * 'readOnly' grants read alone; 'none' grants nothing and refuses the lists.
   */
  access?: 'admin' | 'readOnly' | 'none';
  /** Answer every list request with this status instead of a list (500: a failed load). */
  listStatus?: number;
  /** Answer every GET by id with this status instead of the record (500, 403). */
  detailStatus?: number;
  /** Answer an instance's history request with this status instead of its transitions (500, 403). */
  historyStatus?: number;
  /** Answer `/api/collections` with this status instead of the collections (403: administrators only). */
  collectionsStatus?: number;
  /** Milliseconds every answer takes; makes loading and pending states visible. Default: 150. */
  delay?: number;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const refusal = (status: number) =>
  json(status, {
    errors: [
      {
        message: status === 403 ? 'Permission denied' : 'The workflow service is unavailable',
        extensions: { code: status === 403 ? 'FORBIDDEN' : 'INTERNAL_SERVER_ERROR' },
      },
    ],
  });

/** Replaces `window.fetch`; returns the function that puts the real one back. */
export function installMockWorkflowApi(options: MockWorkflowApiOptions = {}): () => void {
  const { access = 'admin', listStatus, detailStatus, historyStatus, collectionsStatus, delay = 150 } = options;
  let workflows = (options.workflows ?? mockWorkflows).map((workflow) => ({ ...workflow }));
  let assignments = (options.assignments ?? mockAssignments).map((assignment) => ({ ...assignment }));
  const instances = options.instances ?? mockInstances;
  const history = options.history ?? mockHistory;
  let created = 0;

  /** One page of `rows`, in the Studio routes' list envelope. */
  const listOf = (rows: unknown[], url: URL): Response => {
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 25);
    return json(200, {
      data: rows.slice((page - 1) * limit, page * limit),
      count: rows.length,
      totalCount: rows.length,
      page,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(rows.length / limit)),
    });
  };

  /** An assignment row with its definition's id and name, as the routes answer it. */
  const withDefinition = (assignment: WorkflowAssignmentRecord): WorkflowAssignmentRecord => {
    const definition = workflows.find((w) => w.id === assignment.workflow);
    return {
      ...assignment,
      workflow_definition: definition ? { id: definition.id, name: definition.name } : null,
    };
  };
  const realFetch = window.fetch.bind(window);

  const answer = (method: string, url: URL, body: unknown): Response | null => {
    const path = url.pathname;

    if (path === '/api/permissions/me') {
      const read = { read: { fields: ['*'], permissions: null } };
      const data =
        access === 'readOnly'
          ? { daas_wf_definition: read, daas_wf_assignment: read, daas_wf_instance: read, daas_wf_history: read }
          : {};
      return json(200, { data, isAdmin: access === 'admin', moduleAccess: {} });
    }
    if (path.startsWith('/api/permissions/')) {
      return json(200, { data: access === 'readOnly' ? { read: { fields: ['*'], permissions: null } } : {} });
    }

    if (path === '/api/policies') {
      const page = Number(url.searchParams.get('page') ?? 1);
      return json(200, {
        data: page === 1 ? mockPolicyOptions : [],
        totalCount: mockPolicyOptions.length,
        totalPages: 1,
      });
    }

    if (path === '/api/workflows' && method === 'GET') {
      if (access === 'none') return refusal(403);
      if (listStatus) return refusal(listStatus);
      const search = (url.searchParams.get('search') ?? '').toLowerCase();
      const page = Number(url.searchParams.get('page') ?? 1);
      const limit = Number(url.searchParams.get('limit') ?? 25);
      const matches = workflows
        .filter((w) => `${w.name} ${w.description ?? ''}`.toLowerCase().includes(search))
        .sort((a, b) => a.name.localeCompare(b.name));
      return json(200, {
        data: matches.slice((page - 1) * limit, page * limit),
        count: matches.length,
        totalCount: matches.length,
        page,
        pageSize: limit,
        totalPages: Math.max(1, Math.ceil(matches.length / limit)),
      });
    }

    if (path === '/api/workflows' && method === 'POST') {
      if (access !== 'admin') return refusal(403);
      created += 1;
      const id = `0b0e3c1a-6c2f-4a51-9d0e-2f6a4f1f9${String(created).padStart(3, '0')}`;
      workflows = [...workflows, { ...(body as WorkflowDefinitionRecord), id }];
      return json(201, { data: id });
    }

    const byId = /^\/api\/workflows\/([^/]+)$/.exec(path);
    if (byId) {
      const id = decodeURIComponent(byId[1]);
      const stored = workflows.find((w) => w.id === id);
      if (method === 'GET') {
        if (access === 'none') return refusal(403);
        if (detailStatus) return refusal(detailStatus);
        return stored
          ? json(200, { data: stored })
          : json(404, { error: 'Workflow definition not found' });
      }
      if (access !== 'admin') return refusal(403);
      if (!stored) return json(404, { error: 'Workflow definition not found' });
      if (method === 'PATCH') {
        const updated = { ...stored, ...(body as Partial<WorkflowDefinitionRecord>) };
        workflows = workflows.map((w) => (w.id === id ? updated : w));
        return json(200, { data: updated });
      }
      if (method === 'DELETE') {
        workflows = workflows.filter((w) => w.id !== id);
        return json(200, { success: true });
      }
    }

    // -- Assignments --------------------------------------------------------

    if (path === '/api/collections' && method === 'GET') {
      if (collectionsStatus) return refusal(collectionsStatus);
      return json(200, { data: mockCollectionNames.map((collection) => ({ collection, meta: null, schema: null })) });
    }

    if (path === '/api/workflow-assignments' && method === 'GET') {
      if (access === 'none') return refusal(403);
      if (listStatus) return refusal(listStatus);
      const search = (url.searchParams.get('search') ?? '').toLowerCase();
      return listOf(
        assignments.filter((a) => a.collection.toLowerCase().includes(search)).map(withDefinition),
        url,
      );
    }

    if (path === '/api/workflow-assignments' && method === 'POST') {
      if (access !== 'admin') return refusal(403);
      created += 1;
      const assignment: WorkflowAssignmentRecord = {
        filter_rule: null,
        ...(body as WorkflowAssignmentRecord),
        id: `1c1f4d2b-7d30-4b62-8e1f-3a7b5a2a9${String(created).padStart(3, '0')}`,
        date_created: new Date().toISOString(),
      };
      assignments = [assignment, ...assignments];
      return json(200, { data: withDefinition(assignment) });
    }

    const assignmentById = /^\/api\/workflow-assignments\/([^/]+)$/.exec(path);
    if (assignmentById) {
      const id = decodeURIComponent(assignmentById[1]);
      const stored = assignments.find((a) => a.id === id);
      const missing = () =>
        json(404, { errors: [{ message: 'Workflow assignment not found', extensions: { code: 'NOT_FOUND' } }] });
      if (method === 'GET') {
        if (access === 'none') return refusal(403);
        if (detailStatus) return refusal(detailStatus);
        return stored ? json(200, { data: withDefinition(stored) }) : missing();
      }
      if (access !== 'admin') return refusal(403);
      if (!stored) return missing();
      if (method === 'PATCH') {
        const updated = { ...stored, ...(body as Partial<WorkflowAssignmentRecord>) };
        assignments = assignments.map((a) => (a.id === id ? updated : a));
        return json(200, { data: withDefinition(updated) });
      }
      if (method === 'DELETE') {
        assignments = assignments.filter((a) => a.id !== id);
        return json(200, { success: true });
      }
    }

    // -- Instances (read-only) -----------------------------------------------

    if (path === '/api/workflow-instances' && method === 'GET') {
      if (access === 'none') return refusal(403);
      if (listStatus) return refusal(listStatus);
      const search = (url.searchParams.get('search') ?? '').toLowerCase();
      return listOf(
        instances.filter((i) => `${i.collection} ${i.current_state} ${i.item_id}`.toLowerCase().includes(search)),
        url,
      );
    }

    const instanceHistory = /^\/api\/workflow-instances\/([^/]+)\/history$/.exec(path);
    if (instanceHistory && method === 'GET') {
      if (access === 'none') return refusal(403);
      if (historyStatus) return refusal(historyStatus);
      // Unpaginated, as the Studio route answers it
      return json(200, { data: history });
    }

    const instanceById = /^\/api\/workflow-instances\/([^/]+)$/.exec(path);
    if (instanceById && method === 'GET') {
      if (access === 'none') return refusal(403);
      if (detailStatus) return refusal(detailStatus);
      const stored = instances.find((i) => i.id === decodeURIComponent(instanceById[1]));
      if (!stored) {
        return json(404, { errors: [{ message: 'Workflow instance not found', extensions: { code: 'NOT_FOUND' } }] });
      }
      // A single instance carries its definition's document
      const definition = workflows.find((w) => w.id === stored.workflow?.id);
      return json(200, {
        data: {
          ...stored,
          workflow: stored.workflow && {
            ...stored.workflow,
            workflow_json: definition?.workflow_json ?? reviewWorkflowJson,
          },
        },
      });
    }

    return null;
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const url = new URL(raw, window.location.origin);
    const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
    let body: unknown;
    try {
      body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    } catch {
      body = undefined;
    }

    const response = url.pathname.startsWith('/api/') ? answer(method, url, body) : null;
    if (!response) return realFetch(input, init);
    await new Promise((resolve) => {
      setTimeout(resolve, delay);
    });
    return response;
  };

  return () => {
    window.fetch = realFetch;
  };
}

/** An empty URL makes the hooks ask for relative `/api/*` paths, which the mock answers. */
const MOCK_DAAS_CONFIG = { url: '' } as const;

/**
 * Mounts the in-memory API around a story, with the `DaaSProvider` the data
 * hooks need. The children are drawn once the mock is in place, so their
 * first request already meets it.
 */
export const MockWorkflowApi: React.FC<MockWorkflowApiOptions & { children: React.ReactNode }> = ({
  children,
  ...options
}) => {
  const [ready, setReady] = useState(false);
  // The options of a story do not change while it is mounted
  const [initialOptions] = useState(options);

  useEffect(() => {
    const restore = installMockWorkflowApi(initialOptions);
    setReady(true);
    return () => {
      restore();
      setReady(false);
    };
  }, [initialOptions]);

  if (!ready) return null;
  return (
    <DaaSProvider config={MOCK_DAAS_CONFIG} autoFetchUser={false}>
      {children}
    </DaaSProvider>
  );
};
