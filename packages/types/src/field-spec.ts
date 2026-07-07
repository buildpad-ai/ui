/**
 * Field/Collection provisioning specs
 *
 * Builder-friendly descriptions of a field or collection to provision via the
 * DaaS DDL API (`POST /api/fields/{collection}`, `POST /api/collections`). A
 * `FieldSpec` is mapped to the DaaS `Field` create payload by
 * `fieldSpecToDaaSField` in `@buildpad/utils`; the schema services
 * (`FieldsService`/`CollectionsService`) consume these specs directly.
 *
 * These are intentionally lean — the builder collects a label/type/interface
 * and storage choice, not the full DaaS `Field` shape.
 *
 * @package @buildpad/types
 */

/**
 * A field to provision as a real DaaS column.
 *
 * Maps to the body of `POST /api/fields/{collection}` (`type` →
 * `schema.data_type`; `interface`/`label`/`options` → `meta`; `addIndex` →
 * the DDL-only `add_index` flag).
 */
export interface FieldSpec {
  /** Column/field key (snake_case, matches `Field.field`) */
  field: string;
  /**
   * DaaS field type (`'string' | 'text' | 'integer' | 'bigInteger' | 'float' |
   * 'decimal' | 'boolean' | 'uuid' | 'json' | 'date' | 'time' | 'dateTime' |
   * 'timestamp'`). Defaults to `'string'`.
   */
  type?: string;
  /** VForm interface id (e.g. `'input'`, `'select-dropdown'`); inferred from `type` when omitted */
  interface?: string;
  /** Human-readable label → `meta.note` */
  label?: string;
  /** Interface options (e.g. choices) → `meta.options` */
  options?: Record<string, unknown>;
  /** Mark the column `NOT NULL` + `meta.required` */
  required?: boolean;
  /** Hide the field in forms */
  hidden?: boolean;
  /** Mark the field readonly in forms */
  readonly?: boolean;
  /** Field width in forms */
  width?: 'half' | 'full';
  /** Max length for string columns → `schema.max_length` */
  maxLength?: number;
  /** Default column value → `schema.default_value` */
  defaultValue?: unknown;
  /**
   * Create a B-tree index on the column immediately (`add_index: true`). Pass
   * for columns that will be filtered or sorted.
   */
  addIndex?: boolean;
}

/**
 * How a builder-created collection stores its answers:
 * - `'hybrid'` — real columns for provisioned fields + a single opt-in `extras`
 *   jsonb tail. The strategy for collections a screen binds to.
 * - `'full'` — standard audit **system fields** + every field as a real column;
 *   **no** `extras` tail, so the whole record is natively searchable.
 *
 * A collection is `'full'` iff its schema has no `extras` column — the builder
 * derives the strategy from the live schema rather than persisting it.
 */
export type CollectionStorageStrategy = 'hybrid' | 'full';

/**
 * A collection to provision via `POST /api/collections`.
 *
 * When `fields` is omitted, the schema service provisions a baseline collection.
 * The baseline depends on `strategy`: `'hybrid'` (default) → a primary `id` and a
 * single `extras` jsonb column; `'full'` → a primary `id` and the standard audit
 * system fields with **no** `extras`. This is the minimum a form-builder target
 * collection needs.
 */
export interface CollectionSpec {
  /** Collection (table) name — must not be a `daas_`-prefixed system name */
  collection: string;
  /** Collection note/description → `meta.note` */
  note?: string;
  /** Collection icon → `meta.icon` */
  icon?: string;
  /**
   * Storage strategy selecting the baseline columns (default `'hybrid'`).
   * See {@link CollectionStorageStrategy}.
   */
  strategy?: CollectionStorageStrategy;
  /** Fields to create with the collection (in addition to the baseline) */
  fields?: FieldSpec[];
}
