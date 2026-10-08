/**
 * An in-memory DaaS for the fixture stories of the two containers
 * (`WorkflowsManager`, `WorkflowDetail`), which load through the data hooks
 * and so cannot be fed by props.
 *
 * `MockWorkflowApi` replaces `window.fetch` while it is mounted, for the
 * routes the containers call — `/api/workflows`, `/api/permissions`,
 * `/api/policies` — and answers them from the fixtures, in the Studio routes'
 * envelope. Every other request goes to the real `fetch`. One mock at a time:
 * the stories that use it are tagged `!autodocs`, so two never share a page.
 *
 * Internal to the stories only (underscore-prefixed, not exported from
 * `index.ts`, not bundled by tsup). Nothing here is a contract: the live
 * `*.daas.stories.tsx` are what exercise a real backend.
 */
import React, { useEffect, useState } from 'react';
import { DaaSProvider } from '@buildpad/services';
import type { WorkflowDefinitionRecord } from '@buildpad/types';
import { mockPolicyOptions, mockWorkflows } from './_fixtures';

export interface MockWorkflowApiOptions {
  /** The definitions the backend starts with. Default: the three fixture definitions. */
  workflows?: WorkflowDefinitionRecord[];
  /**
   * What the caller may do with `daas_wf_definition`. Default: 'admin'.
   * 'readOnly' grants read alone; 'none' grants nothing and refuses the list.
   */
  access?: 'admin' | 'readOnly' | 'none';
  /** Answer every list request with this status instead of a list (500: a failed load). */
  listStatus?: number;
  /** Answer every GET by id with this status instead of the definition (500, 403). */
  detailStatus?: number;
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
  const { access = 'admin', listStatus, detailStatus, delay = 150 } = options;
  let workflows = (options.workflows ?? mockWorkflows).map((workflow) => ({ ...workflow }));
  let created = 0;
  const realFetch = window.fetch.bind(window);

  const answer = (method: string, url: URL, body: unknown): Response | null => {
    const path = url.pathname;

    if (path === '/api/permissions/me') {
      const data =
        access === 'readOnly' ? { daas_wf_definition: { read: { fields: ['*'], permissions: null } } } : {};
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
