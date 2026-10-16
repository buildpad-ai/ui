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
 * A primary key as one URL path segment. A key may hold "/", "?", "#" or "%"
 * (a manually entered string key such as "A/B-1"); unencoded, "A/B" was read
 * as two segments and the request went to another route.
 */
function keySegment(id: PrimaryKey): string {
  return encodeURIComponent(String(id));
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
   */
  async readOne(id: PrimaryKey, fields?: string[]): Promise<AnyItem> {
    const params = fields ? `?fields=${fields.join(",")}` : "";
    const response = await apiRequest<{ data: AnyItem } | AnyItem>(
      `/api/items/${this.collection}/${keySegment(id)}${params}`
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
   */
  async createOne(data: Partial<AnyItem>): Promise<AnyItem> {
    const response = await apiRequest<{ data: AnyItem } | AnyItem>(
      `/api/items/${this.collection}`,
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
   */
  async updateOne(
    id: PrimaryKey,
    data: Partial<AnyItem>
  ): Promise<AnyItem> {
    const response = await apiRequest<{ data: AnyItem } | AnyItem>(
      `/api/items/${this.collection}/${keySegment(id)}`,
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
    await apiRequest(`/api/items/${this.collection}/${keySegment(id)}`, {
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
