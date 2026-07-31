/**
 * ItemsService - CRUD operations for collection items
 *
 * Provides create, read, update, and delete operations following
 * the DaaS REST API conventions. Uses apiRequest for both proxy
 * and direct DaaS modes.
 *
 * @package @buildpad/services
 */

import type { AnyItem, PrimaryKey } from "@buildpad/types";
import { apiRequest } from "./api-request";

/** Query parameters for listing items */
export interface ItemsQuery {
  fields?: string[];
  filter?: Record<string, unknown>;
  search?: string;
  sort?: string | string[];
  limit?: number;
  offset?: number;
  page?: number;
  meta?: string;
}

/** Response with metadata from DaaS */
export interface ItemsResponse<T = AnyItem> {
  data: T[];
  meta?: {
    total_count?: number;
    filter_count?: number;
  };
}

/**
 * Items Service — CRUD for collection items
 */
export class ItemsService {
  private collection: string;

  constructor(collection: string) {
    this.collection = collection;
  }

  /** Build query string from ItemsQuery params */
  private buildQueryString(query?: ItemsQuery): string {
    if (!query) return "";

    const params = new URLSearchParams();

    if (query.fields && query.fields.length > 0) {
      params.set("fields", query.fields.join(","));
    }
    if (query.filter && Object.keys(query.filter).length > 0) {
      params.set("filter", JSON.stringify(query.filter));
    }
    if (query.search) {
      params.set("search", query.search);
    }
    if (query.sort) {
      params.set(
        "sort",
        Array.isArray(query.sort) ? query.sort.join(",") : query.sort
      );
    }
    if (query.limit !== undefined) {
      params.set("limit", String(query.limit));
    }
    if (query.offset !== undefined) {
      params.set("offset", String(query.offset));
    }
    if (query.page !== undefined) {
      params.set("page", String(query.page));
    }
    if (query.meta) {
      params.set("meta", query.meta);
    }

    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  /**
   * Read many items with optional query parameters
   */
  async readByQuery(query?: ItemsQuery): Promise<ItemsResponse> {
    const qs = this.buildQueryString(query);
    const raw = await apiRequest<ItemsResponse | AnyItem[]>(
      `/api/items/${this.collection}${qs}`
    );

    // Handle both { data: [...] } and flat array formats
    if (Array.isArray(raw)) {
      return { data: raw, meta: { total_count: raw.length } };
    }
    return raw;
  }

  /**
   * Read a single item by primary key
   *
   * `fields`, when omitted, lets the backend fall back to selecting
   * everything — which 500s if the collection has any O2M/M2M/M2A field,
   * since those have no real flat column value and can't be resolved as a
   * bare column name, only via a proper nested embed callers don't build
   * here. Callers should pass an explicit flat-fields-only list (see
   * CollectionForm's computeFetchableFields) whenever the target collection
   * might have one.
   */
  async readOne(id: PrimaryKey, fields?: string[]): Promise<AnyItem> {
    const params = fields ? `?fields=${fields.join(",")}` : "";
    const response = await apiRequest<{ data: AnyItem } | AnyItem>(
      `/api/items/${this.collection}/${id}${params}`
    );

    // Handle both { data: item } and flat item formats
    if (
      response &&
      typeof response === "object" &&
      "data" in response &&
      response.data
    ) {
      return (response as { data: AnyItem }).data;
    }
    return response as AnyItem;
  }

  /**
   * Create a new item
   *
   * `fields` restricts the returned representation of the created item —
   * omitting it makes the backend fall back to selecting everything, which
   * 500s if the collection has any O2M/M2M/M2A field (no flat column value
   * to select bare; see readOne's doc comment for the full explanation).
   * Pass the same flat-fields-only list callers already build for readOne.
   */
  async createOne(data: Partial<AnyItem>, fields?: string[]): Promise<AnyItem> {
    const params = fields ? `?fields=${fields.join(",")}` : "";
    const response = await apiRequest<{ data: AnyItem } | AnyItem>(
      `/api/items/${this.collection}${params}`,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }
    );

    if (
      response &&
      typeof response === "object" &&
      "data" in response &&
      response.data
    ) {
      return (response as { data: AnyItem }).data;
    }
    return response as AnyItem;
  }

  /**
   * Update an existing item (PATCH semantics — only changed fields)
   *
   * `fields` restricts the returned representation of the updated item —
   * same "backend defaults to selecting everything" 500 risk as createOne
   * when the collection has an O2M/M2M/M2A field. See readOne's doc comment.
   */
  async updateOne(
    id: PrimaryKey,
    data: Partial<AnyItem>,
    fields?: string[]
  ): Promise<AnyItem> {
    const params = fields ? `?fields=${fields.join(",")}` : "";
    const response = await apiRequest<{ data: AnyItem } | AnyItem>(
      `/api/items/${this.collection}/${id}${params}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }
    );

    if (
      response &&
      typeof response === "object" &&
      "data" in response &&
      response.data
    ) {
      return (response as { data: AnyItem }).data;
    }
    return response as AnyItem;
  }

  /**
   * Delete a single item by primary key
   */
  async deleteOne(id: PrimaryKey): Promise<void> {
    await apiRequest(`/api/items/${this.collection}/${id}`, {
      method: "DELETE",
    });
  }

  /**
   * Delete multiple items by primary keys
   */
  async deleteMany(ids: PrimaryKey[], primaryKeyField = "id"): Promise<void> {
    if (ids.length === 0) return;

    // DaaS requires a filter query parameter for batch delete
    const filter = JSON.stringify({ [primaryKeyField]: { _in: ids } });
    await apiRequest(`/api/items/${this.collection}?filter=${encodeURIComponent(filter)}`, {
      method: "DELETE",
    });
  }

  /**
   * Update multiple items at once
   */
  async updateMany(
    ids: PrimaryKey[],
    data: Partial<AnyItem>
  ): Promise<void> {
    if (ids.length === 0) return;

    await apiRequest(`/api/items/${this.collection}`, {
      method: "PATCH",
      body: JSON.stringify({ keys: ids, data }),
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Factory function to create itemsService for a specific collection
 */
export function createItemsService(collection: string): ItemsService {
  return new ItemsService(collection);
}
