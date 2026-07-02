/**
 * fieldSpecToDaaSField
 *
 * Maps a builder-friendly `FieldSpec` to the DaaS `Field` create payload sent to
 * `POST /api/fields/{collection}`. The inverse of `field-interface-mapper`
 * (which maps a DaaS `Field` → a React interface): here we go from the small set
 * of choices the builder collects (type, interface, label, options, storage) to
 * the `type` + `schema.data_type` + `meta.interface` shape DaaS expects.
 *
 * The DDL-only `add_index` flag is carried at the top level of the payload (it
 * is not part of the persisted `Field`), so the return type is a `Field` widened
 * with an optional `add_index`.
 *
 * @package @buildpad/utils
 */

import type { Field, FieldSpec } from "@buildpad/types";

/** The `POST /api/fields/{collection}` body: a `Field` plus the DDL-only `add_index` flag. */
export type DaaSFieldPayload = Field & { add_index?: boolean };

/**
 * Map a DaaS field `type` to a PostgreSQL `schema.data_type`. DaaS can infer the
 * column type from `type`, but we set it explicitly so the payload is
 * self-describing and round-trips through `field-interface-mapper`'s inference.
 */
const DATA_TYPE_BY_TYPE: Record<string, string> = {
  string: "varchar",
  text: "text",
  boolean: "boolean",
  integer: "integer",
  bigInteger: "bigint",
  float: "float",
  decimal: "numeric",
  uuid: "uuid",
  json: "json",
  csv: "text",
  date: "date",
  time: "time",
  dateTime: "timestamp",
  datetime: "timestamp",
  timestamp: "timestamp",
};

/** Default VForm interface id for a given DaaS field `type`. */
const INTERFACE_BY_TYPE: Record<string, string> = {
  string: "input",
  text: "input-multiline",
  boolean: "boolean",
  integer: "input",
  bigInteger: "input",
  float: "input",
  decimal: "input",
  uuid: "input",
  json: "input-code",
  csv: "tags",
  date: "datetime",
  time: "datetime",
  dateTime: "datetime",
  datetime: "datetime",
  timestamp: "datetime",
};

/** Resolve the PostgreSQL data type for a DaaS field `type` (defaults to `varchar`). */
export function dataTypeForFieldType(type: string): string {
  return DATA_TYPE_BY_TYPE[type] ?? "varchar";
}

/** Resolve the default VForm interface id for a DaaS field `type` (defaults to `input`). */
export function interfaceForFieldType(type: string): string {
  return INTERFACE_BY_TYPE[type] ?? "input";
}

/**
 * Convert a `FieldSpec` to the DaaS create payload for `POST /api/fields/{collection}`.
 *
 * @param collection Collection the field is added to (sets `collection` on the payload).
 * @param spec       Builder-friendly field spec.
 * @returns A `Field` payload (with `type`, `schema.data_type`, `meta.interface`,
 *          and overrides) plus an optional top-level `add_index`.
 */
export function fieldSpecToDaaSField(
  collection: string,
  spec: FieldSpec,
): DaaSFieldPayload {
  const type = spec.type ?? "string";
  const dataType = dataTypeForFieldType(type);
  const interfaceId = spec.interface ?? interfaceForFieldType(type);

  const payload: DaaSFieldPayload = {
    collection,
    field: spec.field,
    type,
    meta: {
      // `id`/`collection`/`field` are echoed for shape parity; DaaS assigns the
      // real `id`. Cast keeps `FieldMeta` happy without inventing an id type.
      id: 0,
      collection,
      field: spec.field,
      interface: interfaceId,
      options: spec.options ?? null,
      readonly: spec.readonly ?? false,
      hidden: spec.hidden ?? false,
      width: spec.width ?? "full",
      note: spec.label ?? null,
      required: spec.required ?? false,
    },
    schema: {
      name: spec.field,
      table: collection,
      data_type: dataType,
      is_nullable: spec.required ? false : true,
      is_unique: false,
      is_primary_key: false,
      has_auto_increment: false,
      ...(spec.maxLength !== undefined ? { max_length: spec.maxLength } : {}),
      ...(spec.defaultValue !== undefined
        ? { default_value: spec.defaultValue }
        : {}),
    },
  };

  if (spec.addIndex) {
    payload.add_index = true;
  }

  return payload;
}
