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
