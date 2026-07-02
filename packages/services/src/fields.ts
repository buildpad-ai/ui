/**
 * FieldsService - Service for managing database fields/columns
 * 
 * Uses Next.js API routes to proxy requests to DaaS backend (avoids CORS)
 */

import type { Field, FieldSpec } from '@buildpad/types';
import { fieldSpecToDaaSField } from '@buildpad/utils';
import { apiRequest } from './api-request';

/** Unwrap DaaS `{ data: Field }` or a flat `Field` response. */
function unwrapField(response: { data: Field } | Field): Field {
  return (response as { data: Field }).data ?? (response as Field);
}

/**
 * Fields Service
 */
export class FieldsService {
  /**
   * Read all fields across all collections or in a specific collection
   */
  async readAll(collection?: string): Promise<Field[]> {
    try {
      const path = collection
        ? `/api/fields/${collection}`
        : '/api/fields';

      // Handle both { data: Field[] } (DaaS) and Field[] (DaaS flat) formats
      const response = await apiRequest<{ data: Field[] } | Field[]>(path);
      if (Array.isArray(response)) return response;
      return response.data || [];
    } catch (error) {
      console.error('Error fetching fields:', error);
      return [];
    }
  }

  /**
   * Read a single field
   */
  async readOne(collection: string, field: string): Promise<Field> {
    const response = await apiRequest<{ data: Field } | Field>(`/api/fields/${collection}/${field}`);
    // Handle both { data: Field } (DaaS) and flat Field (DaaS) formats
    const fieldData = (response as { data: Field }).data ?? response;
    if (!fieldData || !(fieldData as Field).field) {
      throw new Error(`Field not found: ${collection}.${field}`);
    }
    return fieldData as Field;
  }

  /**
   * Provision a new **real** column on a collection via the DaaS DDL API.
   *
   * Maps the builder `FieldSpec` to the DaaS `Field` payload (`type` →
   * `schema.data_type`, `interface`/`label`/`options` → `meta`) and POSTs it.
   * Pass `spec.addIndex` to also create a B-tree index (for fields that will be
   * filtered or sorted). Provisioning is **additive** — it never alters or drops
   * existing fields. Requires DaaS schema rights.
   *
   * @throws if the DDL call fails (insufficient rights, name conflict, invalid spec).
   */
  async createField(collection: string, spec: FieldSpec): Promise<Field> {
    const body = fieldSpecToDaaSField(collection, spec);
    const response = await apiRequest<{ data: Field } | Field>(
      `/api/fields/${collection}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    return unwrapField(response);
  }

  /**
   * Update an existing field's metadata/schema via the DaaS DDL API.
   * Requires DaaS schema rights.
   */
  async updateField(
    collection: string,
    field: string,
    patch: Partial<Pick<Field, 'type' | 'meta' | 'schema'>>,
  ): Promise<Field> {
    const response = await apiRequest<{ data: Field } | Field>(
      `/api/fields/${collection}/${field}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      },
    );
    return unwrapField(response);
  }

  /**
   * Drop a field from a collection via the DaaS DDL API. Requires DaaS schema
   * rights. Destructive — removes the column and its data.
   */
  async deleteField(collection: string, field: string): Promise<void> {
    await apiRequest<void>(`/api/fields/${collection}/${field}`, {
      method: 'DELETE',
    });
  }
}

/**
 * Factory function to create a new FieldsService instance
 */
export function createFieldsService(): FieldsService {
  return new FieldsService();
}
