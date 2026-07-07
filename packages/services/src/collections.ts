/**
 * CollectionsService - Service for managing database collections (tables/views)
 * 
 * Uses Next.js API routes to proxy requests to DaaS backend (avoids CORS)
 */

import type { Collection, CollectionSpec, Field } from '@buildpad/types';
import { fieldSpecToDaaSField } from '@buildpad/utils';
import { apiRequest } from './api-request';

/**
 * Configurable prefix marking a collection as **builder-owned** (the definitions
 * store and any target collection the builder creates), so it is recognizable
 * alongside `daas_` system collections.
 */
export const FORM_BUILDER_COLLECTION_PREFIX = 'fb_';

/**
 * Normalize a collection name for a builder-created collection: apply the
 * builder prefix if absent (idempotent — never `fb_fb_`) and reject a reserved
 * `daas_` name. Existing collections a screen merely *binds* to are never passed
 * through this — only collections the builder creates are prefixed.
 *
 * @throws if the name is empty or uses the reserved `daas_` prefix.
 */
export function normalizeCollectionName(
  name: string,
  prefix: string = FORM_BUILDER_COLLECTION_PREFIX,
): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Collection name is required');
  }
  if (trimmed.startsWith('daas_')) {
    throw new Error(
      `Collection name "${trimmed}" must not use the reserved "daas_" prefix`,
    );
  }
  return trimmed.startsWith(prefix) ? trimmed : `${prefix}${trimmed}`;
}

type BaselineField = Record<string, unknown>;

/** Primary `id` (uuid) column — present in every baseline. */
function idField(collection: string): BaselineField {
  return {
    field: 'id',
    type: 'uuid',
    meta: { interface: 'input', hidden: true, readonly: true },
    schema: {
      name: 'id',
      table: collection,
      data_type: 'uuid',
      is_primary_key: true,
      has_auto_increment: false,
    },
  };
}

/** The single opt-in `extras` jsonb tail — present only in a hybrid collection. */
function extrasField(collection: string): BaselineField {
  return {
    field: 'extras',
    type: 'json',
    meta: {
      interface: 'input-code',
      note: 'Non-searchable extra answers (form builder extras tail)',
      width: 'full',
      options: { language: 'json' },
    },
    schema: {
      name: 'extras',
      table: collection,
      data_type: 'json',
      is_nullable: true,
    },
  };
}

/**
 * Standard audit **system fields** seeded on a `full` collection (in addition to
 * `id`): `status`, `sort`, and the DaaS-managed `user_created`/`user_updated`/
 * `date_created`/`date_updated` (auto-populated via their `meta.special` flags).
 */
function systemAuditFields(collection: string): BaselineField[] {
  const at = (name: string) => ({ name, table: collection });
  return [
    {
      field: 'status',
      type: 'string',
      meta: {
        interface: 'select-dropdown',
        display: 'labels',
        width: 'half',
        options: {
          choices: [
            { text: 'Published', value: 'published' },
            { text: 'Draft', value: 'draft' },
            { text: 'Archived', value: 'archived' },
          ],
        },
      },
      schema: {
        ...at('status'),
        data_type: 'string',
        default_value: 'draft',
        is_nullable: false,
      },
    },
    {
      field: 'sort',
      type: 'integer',
      meta: { interface: 'input', hidden: true },
      schema: { ...at('sort'), data_type: 'integer', is_nullable: true },
    },
    {
      field: 'user_created',
      type: 'uuid',
      meta: {
        special: ['user-created'],
        interface: 'select-dropdown-m2o',
        options: { template: '{{first_name}} {{last_name}}' },
        display: 'user',
        readonly: true,
        hidden: true,
        width: 'half',
      },
      schema: { ...at('user_created'), data_type: 'uuid', is_nullable: true },
    },
    {
      field: 'user_updated',
      type: 'uuid',
      meta: {
        special: ['user-updated'],
        interface: 'select-dropdown-m2o',
        options: { template: '{{first_name}} {{last_name}}' },
        display: 'user',
        readonly: true,
        hidden: true,
        width: 'half',
      },
      schema: { ...at('user_updated'), data_type: 'uuid', is_nullable: true },
    },
    {
      field: 'date_created',
      type: 'timestamp',
      meta: {
        special: ['date-created'],
        interface: 'datetime',
        display: 'datetime',
        display_options: { relative: true },
        readonly: true,
        hidden: true,
        width: 'half',
      },
      schema: { ...at('date_created'), data_type: 'timestamp', is_nullable: true },
    },
    {
      field: 'date_updated',
      type: 'timestamp',
      meta: {
        special: ['date-updated'],
        interface: 'datetime',
        display: 'datetime',
        display_options: { relative: true },
        readonly: true,
        hidden: true,
        width: 'half',
      },
      schema: { ...at('date_updated'), data_type: 'timestamp', is_nullable: true },
    },
  ];
}

/**
 * Hybrid baseline: a primary `id` + a single `extras` jsonb tail. The strategy
 * used when a screen binds to an existing collection.
 */
function hybridBaseline(collection: string): BaselineField[] {
  return [idField(collection), extrasField(collection)];
}

/**
 * Full baseline: a primary `id` + the standard audit system fields, and **no**
 * `extras` column — every field is a real, searchable column.
 */
function fullBaseline(collection: string): BaselineField[] {
  return [idField(collection), ...systemAuditFields(collection)];
}

/**
 * The full-storage baseline as typed `Field[]` — the primary `id` plus the
 * standard audit **system fields** (no `extras`). Exposed so the builder can
 * seed/preview the fields a builder-created **full** collection will have,
 * before that collection exists (the auto-create flow). The same baseline is
 * provisioned by {@link CollectionsService.createCollection} with
 * `strategy: 'full'`, so the palette stays consistent with what gets created.
 */
export function fullBaselineFields(collection = ''): Field[] {
  return fullBaseline(collection) as unknown as Field[];
}

/**
 * Collections Service
 */
export class CollectionsService {
  /**
   * Read all collections
   */
  async readByQuery(): Promise<Collection[]> {
    try {
      const response = await apiRequest<{ data: Collection[] }>('/api/collections');
      return response.data || [];
    } catch (error) {
      console.error('Error fetching collections:', error);
      // Return empty array on error
      return [];
    }
  }

  /**
   * Read a single collection by name
   */
  async readOne(collection: string): Promise<Collection> {
    const response = await apiRequest<{ data: Collection }>(`/api/collections/${collection}`);
    if (!response.data) {
      throw new Error(`Collection not found: ${collection}`);
    }
    return response.data;
  }

  /**
   * Provision a new collection via the DaaS DDL API (`POST /api/collections`).
   *
   * The collection name is normalized through the builder prefix
   * ({@link normalizeCollectionName}). The baseline columns depend on
   * `spec.strategy` (default `'hybrid'`): `'hybrid'` → `id` (uuid PK) + `extras`
   * (jsonb); `'full'` → `id` + the standard audit system fields with **no**
   * `extras`. Any additional `spec.fields` (mapped via `fieldSpecToDaaSField`)
   * are appended. Requires DaaS schema rights.
   *
   * @throws if the name is reserved (`daas_`) or the DDL call fails
   * (insufficient rights, name conflict).
   */
  async createCollection(spec: CollectionSpec): Promise<Collection> {
    const collection = normalizeCollectionName(spec.collection);
    const strategy = spec.strategy ?? 'hybrid';
    const baseline =
      strategy === 'full' ? fullBaseline(collection) : hybridBaseline(collection);

    const extraFields = (spec.fields ?? []).map((f) => {
      // Reuse the field mapper, then drop the top-level `collection` echo — when
      // creating a collection the fields are nested and the collection doesn't
      // exist yet.
      const { collection: _omit, ...field } = fieldSpecToDaaSField(
        collection,
        f,
      );
      return field as Omit<Field, 'collection'>;
    });

    const body = {
      collection,
      meta: {
        ...(spec.note !== undefined ? { note: spec.note } : {}),
        ...(spec.icon !== undefined ? { icon: spec.icon } : {}),
      },
      fields: [...baseline, ...extraFields],
    };

    const response = await apiRequest<{ data: Collection } | Collection>(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    return (response as { data: Collection }).data ?? (response as Collection);
  }

  /**
   * Drop a collection via the DaaS DDL API. Requires DaaS schema rights.
   * Destructive — removes the table and all its data.
   */
  async deleteCollection(collection: string): Promise<void> {
    await apiRequest<void>(`/api/collections/${collection}`, {
      method: 'DELETE',
    });
  }
}

/**
 * Factory function to create a new CollectionsService instance
 */
export function createCollectionsService(): CollectionsService {
  return new CollectionsService();
}
