/**
 * PermissionsService (client-side /permissions/me cache) unit tests.
 *
 * Pins the documented failure semantics: module-level access keys FAIL CLOSED
 * (unloaded / failed fetch → false), collection read fields return [] when
 * absent, and the cache is keyed on the active scope (daas_resource_uri cookie)
 * so one tenant's permissions are never served for another.
 * The network layer (apiRequest) is the mocked boundary.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('../src/api-request', () => ({ apiRequest: apiRequestMock }));

import { PermissionsService, createPermissionsService } from '../src/permissions';

const ACCESS = {
  articles: {
    read: { fields: ['id', 'title'], permissions: null, validation: null, presets: null },
    update: { fields: null },
  },
  notes: { create: { fields: ['*'] } },
};

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  PermissionsService.clearCache();
  apiRequestMock.mockReset();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('module access — fails closed', () => {
  it('before anything is loaded: not admin, no module access', () => {
    expect(PermissionsService.isAdmin).toBe(false);
    expect(PermissionsService.moduleAccess).toBeNull();
    expect(PermissionsService.hasModuleAccess('reports')).toBe(false);
  });

  it('grants only keys that are exactly true', async () => {
    apiRequestMock.mockResolvedValue({
      data: ACCESS,
      moduleAccess: { reports: true, billing: false, odd: 'true' },
    });
    await PermissionsService.ensureLoaded();
    expect(apiRequestMock).toHaveBeenCalledWith('/api/permissions/me');
    expect(PermissionsService.hasModuleAccess('reports')).toBe(true);
    expect(PermissionsService.hasModuleAccess('billing')).toBe(false);
    expect(PermissionsService.hasModuleAccess('odd')).toBe(false);
    expect(PermissionsService.hasModuleAccess('missing')).toBe(false);
  });

  it('a response without moduleAccess (older DaaS) grants no keys', async () => {
    apiRequestMock.mockResolvedValue({ data: ACCESS });
    await PermissionsService.ensureLoaded();
    expect(PermissionsService.moduleAccess).toEqual({});
    expect(PermissionsService.hasModuleAccess('reports')).toBe(false);
  });

  it('isAdmin only for isAdmin === true; admins hold every key', async () => {
    apiRequestMock.mockResolvedValue({ data: {}, isAdmin: 'true' });
    await PermissionsService.getMyCollectionAccess(true);
    expect(PermissionsService.isAdmin).toBe(false);

    apiRequestMock.mockResolvedValue({ data: {}, isAdmin: true });
    await PermissionsService.getMyCollectionAccess(true);
    expect(PermissionsService.isAdmin).toBe(true);
    expect(PermissionsService.hasModuleAccess('anything')).toBe(true);
  });

  it('a failed fetch clears previously granted module keys', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: ACCESS, moduleAccess: { reports: true } });
    await PermissionsService.ensureLoaded();
    expect(PermissionsService.hasModuleAccess('reports')).toBe(true);

    apiRequestMock.mockRejectedValueOnce(new Error('401'));
    expect(await PermissionsService.getMyCollectionAccess(true)).toEqual({});
    expect(PermissionsService.moduleAccess).toBeNull();
    expect(PermissionsService.hasModuleAccess('reports')).toBe(false);
  });

  it('clearCache resets admin and module access', async () => {
    apiRequestMock.mockResolvedValue({ data: ACCESS, isAdmin: true, moduleAccess: { reports: true } });
    await PermissionsService.ensureLoaded();
    PermissionsService.clearCache();
    expect(PermissionsService.isAdmin).toBe(false);
    expect(PermissionsService.hasModuleAccess('reports')).toBe(false);
  });
});

describe('getReadableFields', () => {
  it.each([
    ['explicit field list', 'articles', ['id', 'title']],
    ['unknown collection → none', 'secrets', []],
    ['collection without a read entry → none', 'notes', []],
  ])('%s', async (_label, collection, expected) => {
    apiRequestMock.mockResolvedValue({ data: ACCESS });
    expect(await PermissionsService.getReadableFields(collection)).toEqual(expected);
  });

  it('a read entry with null fields means all fields', async () => {
    apiRequestMock.mockResolvedValue({ data: { a: { read: { fields: null } } } });
    expect(await PermissionsService.getReadableFields('a')).toEqual(['*']);
  });

  it('a failed fetch → no readable fields', async () => {
    apiRequestMock.mockRejectedValue(new Error('500'));
    expect(await PermissionsService.getReadableFields('articles')).toEqual([]);
  });

  it('a response without data → no readable fields', async () => {
    apiRequestMock.mockResolvedValue({});
    expect(await PermissionsService.getReadableFields('articles')).toEqual([]);
  });
});

describe('/permissions/me cache', () => {
  it('shares one request between concurrent callers and caches for 30 s', async () => {
    vi.useFakeTimers();
    apiRequestMock.mockResolvedValue({ data: ACCESS });
    const [a, b] = await Promise.all([
      PermissionsService.getMyCollectionAccess(),
      PermissionsService.getMyCollectionAccess(),
    ]);
    expect(a).toBe(b);
    await PermissionsService.getMyCollectionAccess();
    expect(apiRequestMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_001);
    await PermissionsService.getMyCollectionAccess();
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it('forceRefresh bypasses the cache', async () => {
    apiRequestMock.mockResolvedValue({ data: ACCESS });
    await PermissionsService.getMyCollectionAccess();
    await PermissionsService.getMyCollectionAccess(true);
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it('a scope change (daas_resource_uri cookie) invalidates the cache', async () => {
    vi.stubGlobal('document', { cookie: 'x=1; daas_resource_uri=tenant%2Fa' });
    apiRequestMock.mockResolvedValueOnce({ data: { a: { read: { fields: ['*'] } } }, moduleAccess: { reports: true } });
    expect(await PermissionsService.getReadableFields('a')).toEqual(['*']);

    vi.stubGlobal('document', { cookie: 'daas_resource_uri=tenant%2Fb' });
    apiRequestMock.mockResolvedValueOnce({ data: {}, moduleAccess: {} });
    expect(await PermissionsService.getReadableFields('a')).toEqual([]);
    expect(PermissionsService.hasModuleAccess('reports')).toBe(false);
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it('an empty scope cookie is the same as no scope', async () => {
    apiRequestMock.mockResolvedValue({ data: ACCESS });
    await PermissionsService.getMyCollectionAccess();
    vi.stubGlobal('document', { cookie: 'daas_resource_uri=  ' });
    await PermissionsService.getMyCollectionAccess();
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
  });
});

describe('legacy field-permission helpers', () => {
  it('getFieldPermissions calls the per-collection route', async () => {
    apiRequestMock.mockResolvedValue({ data: { collection: 'a', action: 'read', fields: ['id'] } });
    expect(await PermissionsService.getFieldPermissions('a', 'read')).toEqual({
      collection: 'a',
      action: 'read',
      fields: ['id'],
    });
    expect(apiRequestMock).toHaveBeenCalledWith('/api/permissions/a?action=read');
  });

  it('getAllFieldPermissions: an action whose fetch fails gets no fields', async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.endsWith('delete')) throw new Error('403');
      return { data: { collection: 'a', action: 'x', fields: ['*'] } };
    });
    const all = await PermissionsService.getAllFieldPermissions('a');
    expect(Object.keys(all).sort()).toEqual(['create', 'delete', 'read', 'update']);
    expect(all.delete).toEqual({ collection: 'a', action: 'delete', fields: [] });
    expect(all.read.fields).toEqual(['*']);
  });

  it('isFieldAccessible / filterAccessibleFields', () => {
    const some = { collection: 'a', action: 'read', fields: ['id', 'title'] };
    const all = { collection: 'a', action: 'read', fields: ['*'] };
    const none = { collection: 'a', action: 'read', fields: [] };
    expect(PermissionsService.isFieldAccessible('title', some)).toBe(true);
    expect(PermissionsService.isFieldAccessible('secret', some)).toBe(false);
    expect(PermissionsService.isFieldAccessible('secret', all)).toBe(true);
    expect(PermissionsService.isFieldAccessible('id', none)).toBe(false);
    expect(PermissionsService.filterAccessibleFields(['id', 'secret', 'title'], some)).toEqual(['id', 'title']);
    expect(PermissionsService.filterAccessibleFields(['id', 'secret'], all)).toEqual(['id', 'secret']);
    expect(PermissionsService.filterAccessibleFields(['id'], none)).toEqual([]);
  });

  it('createPermissionsService returns the service', () => {
    expect(createPermissionsService()).toBe(PermissionsService);
  });
});
