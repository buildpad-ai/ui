import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// The users suite can share the files E2E instance — USERS_DAAS_URL wins,
// FILES_DAAS_URL is the fallback so one .env.local serves both suites.
const USERS_DAAS_URL = process.env.USERS_DAAS_URL || process.env.FILES_DAAS_URL || '';
const ADMIN_TOKEN = process.env.E2E_DAAS_ADMIN_TOKEN || '';

export function daasUrl(): string {
  return USERS_DAAS_URL;
}

export interface ApiResult<T = unknown> {
  status: number;
  data: T;
}

async function adminFetch<T = unknown>(
  method: string,
  urlPath: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  if (!USERS_DAAS_URL) throw new Error('USERS_DAAS_URL (or FILES_DAAS_URL) env var is not set');
  if (!ADMIN_TOKEN) throw new Error('E2E_DAAS_ADMIN_TOKEN env var is not set');

  const url = `${USERS_DAAS_URL}${urlPath}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = {} as T;
  }

  return { status: res.status, data };
}

export const admin = {
  get: <T = unknown>(urlPath: string) => adminFetch<T>('GET', urlPath),
  post: <T = unknown>(urlPath: string, body: unknown) => adminFetch<T>('POST', urlPath, body),
  patch: <T = unknown>(urlPath: string, body: unknown) => adminFetch<T>('PATCH', urlPath, body),
  delete: <T = unknown>(urlPath: string, body?: unknown) => adminFetch<T>('DELETE', urlPath, body),
};

/**
 * Fetch all pages of a list endpoint (no filter — scan full list by name).
 * DaaS4's filter query parameter is ignored on some endpoints; we search client-side.
 */
export async function listAll<T extends Record<string, unknown>>(
  listPath: string,
  nameField: string,
  nameValue: unknown,
): Promise<T | null> {
  let page = 1;
  const limit = 100;
  while (true) {
    const res = await admin.get<{ data: T[] }>(`${listPath}?limit=${limit}&page=${page}`);
    if (res.status !== 200) return null;
    const items = res.data?.data ?? [];
    const match = items.find(item => item[nameField] === nameValue);
    if (match) return match;
    if (items.length < limit) return null; // exhausted
    page++;
  }
}

/**
 * Idempotent create-or-get: tries to find an existing item with a matching
 * nameField first (full-list client-side scan), then CREATEs, then re-scans
 * on failure (race / duplicate).
 */
export async function createOrGet<T extends { id: string }>(
  listPath: string,
  createPath: string,
  body: Record<string, unknown>,
  nameField: string,
): Promise<T | null> {
  const existing = await listAll<T & Record<string, unknown>>(listPath, nameField, body[nameField]);
  if (existing) return existing as T;

  const createRes = await admin.post<{ data: T }>(createPath, body);
  if (createRes.status < 300) {
    return createRes.data?.data ?? null;
  }

  return (await listAll<T & Record<string, unknown>>(listPath, nameField, body[nameField])) as T | null;
}

/** Find a user by email (scans the full user list client-side). */
export async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  return listAll<{ id: string; email: string }>('/api/users', 'email', email);
}
