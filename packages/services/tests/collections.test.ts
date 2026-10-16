/**
 * CollectionsService Unit Tests
 *
 * Covers the builder collection-name prefix (`normalizeCollectionName`) and the
 * storage-strategy baseline of `createCollection` (hybrid → `id` + `extras`;
 * full → `id` + audit system fields, no `extras`). The DDL POST is mocked so no
 * network is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock for the network layer so `createCollection` never hits DaaS.
const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('../src/api-request', () => ({ apiRequest: apiRequestMock }));

import {
  CollectionsService,
  FORM_BUILDER_COLLECTION_PREFIX,
  normalizeCollectionName,
} from '../src/collections';

/** Pull the POSTed body of the last `createCollection` call. */
function lastBody(): {
  collection: string;
  fields: Array<{ field: string }>;
} {
  const [, opts] = apiRequestMock.mock.calls.at(-1) ?? [];
  return JSON.parse((opts as { body: string }).body);
}

describe('normalizeCollectionName', () => {
  it('applies the builder prefix when absent', () => {
    expect(normalizeCollectionName('issues')).toBe('fb_issues');
    expect(FORM_BUILDER_COLLECTION_PREFIX).toBe('fb_');
  });

  it('is idempotent for an already-prefixed name', () => {
    expect(normalizeCollectionName('fb_issues')).toBe('fb_issues');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeCollectionName('  issues  ')).toBe('fb_issues');
  });

  it('honors a custom prefix', () => {
    expect(normalizeCollectionName('issues', 'zz_')).toBe('zz_issues');
  });

  it('rejects a reserved daas_ name', () => {
    expect(() => normalizeCollectionName('daas_users')).toThrow(/daas_/);
  });

  it('rejects an empty name', () => {
    expect(() => normalizeCollectionName('   ')).toThrow(/required/);
  });
});

describe('CollectionsService.createCollection baselines', () => {
  const service = new CollectionsService();

  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ data: { collection: 'ignored' } });
  });

  it('prefixes the collection name', async () => {
    await service.createCollection({ collection: 'issues' });
    expect(lastBody().collection).toBe('fb_issues');
  });

  it('hybrid (default) seeds id + extras', async () => {
    await service.createCollection({ collection: 'issues' });
    const keys = lastBody().fields.map((f) => f.field);
    expect(keys).toContain('id');
    expect(keys).toContain('extras');
  });

  it('full seeds the audit system fields and NO extras', async () => {
    await service.createCollection({ collection: 'issues', strategy: 'full' });
    const keys = lastBody().fields.map((f) => f.field);
    for (const k of [
      'id',
      'status',
      'sort',
      'user_created',
      'user_updated',
      'date_created',
      'date_updated',
    ]) {
      expect(keys).toContain(k);
    }
    expect(keys).not.toContain('extras');
  });

  it('appends any additional spec.fields', async () => {
    await service.createCollection({
      collection: 'issues',
      strategy: 'full',
      fields: [{ field: 'title', type: 'string' }],
    });
    expect(lastBody().fields.map((f) => f.field)).toContain('title');
  });
});

describe('CollectionsService — answers with no collection', () => {
  beforeEach(() => apiRequestMock.mockReset());

  // These used to throw `Cannot read properties of null (reading 'data')`,
  // which named neither the collection nor the operation. Worse, a body the
  // unwrap accepted would have handed back `null` typed as a `Collection`,
  // pushing the failure into whatever used the result next.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty envelope', { data: null }],
  ])('createCollection throws a named error for %s', async (_label, response) => {
    apiRequestMock.mockResolvedValueOnce(response);

    await expect(
      new CollectionsService().createCollection({ collection: 'orders' }),
    ).rejects.toThrow(/Could not create collection fb_orders: the server returned no collection/);
  });

  it('names the normalized collection, not the name that was passed', async () => {
    apiRequestMock.mockResolvedValueOnce(null);

    await expect(
      new CollectionsService().createCollection({ collection: 'orders' }),
    ).rejects.toThrow(/fb_orders/);
  });

  it('still returns the collection of a { data } response', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { collection: 'fb_orders', meta: null, schema: null } });

    await expect(
      new CollectionsService().createCollection({ collection: 'orders' }),
    ).resolves.toMatchObject({ collection: 'fb_orders' });
  });

  it('still accepts a flat collection response', async () => {
    apiRequestMock.mockResolvedValueOnce({ collection: 'fb_orders', meta: null, schema: null });

    await expect(
      new CollectionsService().createCollection({ collection: 'orders' }),
    ).resolves.toMatchObject({ collection: 'fb_orders' });
  });
});

describe('CollectionsService.readByQuery — a null body', () => {
  beforeEach(() => apiRequestMock.mockReset());

  // The method already swallows failures and resolves []. A bodiless answer
  // now takes the same path directly, instead of throwing a TypeError into
  // the catch and logging a misleading "Error fetching collections".
  it('reads a null body as an empty list', async () => {
    apiRequestMock.mockResolvedValueOnce(null);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(new CollectionsService().readByQuery()).resolves.toEqual([]);
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('returns the collections of a { data } response', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [{ collection: 'posts' }] });

    await expect(new CollectionsService().readByQuery()).resolves.toEqual([{ collection: 'posts' }]);
  });
});
