/**
 * Field Interface Mapper
 * Maps database field types to appropriate interface components
 * Supports explicit meta.interface from daas_fields table
 *
 * Ported from main-nextjs for shared use across Buildpad projects.
 */

import type { Field } from "@buildpad/types";
import { isNewItem } from "./is-new-item";

/**
 * Normalize DaaS rich-text toolbar items to match RichTextHTML expectations.
 * DaaS stores "link" but the component checks for "customLink".
 */
function normalizeRichTextToolbar(toolbar?: string[]): string[] | undefined {
  if (!toolbar) return undefined;
  return toolbar.map((item) => (item === "link" ? "customLink" : item));
}

/**
 * Return a shallow copy of `obj` without the specified keys.
 * Used to prevent double-passing props that are explicitly mapped.
 */
function omitKeys(
  obj: Record<string, unknown> | undefined,
  keys: string[],
): Record<string, unknown> {
  if (!obj) return {};
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!keys.includes(k)) result[k] = v;
  }
  return result;
}

export type InterfaceType =
  | "input"
  | "input-code"
  | "input-hash"
  | "input-multiline"
  | "input-autocomplete-api"
  | "input-block-editor"
  | "boolean"
  | "datetime"
  | "select-dropdown"
  | "select-radio"
  | "select-icon"
  | "select-color"
  | "slider"
  | "textarea"
  | "number"
  | "uuid"
  | "input-rich-text-html"
  | "input-rich-text-md"
  | "tags"
  | "presentation-divider"
  | "presentation-notice"
  | "list-m2o"
  | "select-dropdown-m2o"
  | "list-o2m"
  | "list-m2m"
  | "list-m2a"
  | "file"
  | "file-image"
  | "files"
  | "map"
  | "toggle"
  | "select-multiple-checkbox"
  | "select-multiple-dropdown"
  | "select-multiple-checkbox-tree"
  | "collection-item-dropdown"
  | "workflow-button"
  | "group-detail"
  | "group-accordion"
  | "group-raw"
  | "system-token"
  | "system-permissions";

export interface InterfaceConfig {
  /** Interface component type */
  type: InterfaceType;
  /** Additional component props */
  props?: Record<string, unknown>;
}

/**
 * Map database field type to interface component
 * Priority: meta.interface (explicit) > type-based mapping (inferred)
 * Based on DaaS field type mapping logic
 */
export function getFieldInterface(field: Field): InterfaceConfig {
  const { type, schema, meta } = field;
  const dataType = schema?.data_type?.toLowerCase();

  // Priority 1: Check for explicit interface in meta (from daas_fields table)
  if (meta?.interface) {
    const explicitInterface = getExplicitInterface(
      meta.interface,
      meta?.options ?? undefined,
    );
    if (explicitInterface) {
      return explicitInterface;
    }
  }

  // Priority 2: Type-based mapping (fallback)
  return getTypeBasedInterface(type, schema, dataType);
}

/**
 * Get interface config from explicit meta.interface value
 * Maps DaaS interface IDs to our component types
 */
function getExplicitInterface(
  interfaceId: string,
  options?: Record<string, unknown>,
): InterfaceConfig | null {
  switch (interfaceId) {
    // Text inputs
    case "input":
      return {
        type: "input",
        props: {
          type: "string",
          ...options,
        },
      };

    // Autocomplete API (fetches suggestions from external API)
    case "input-autocomplete-api":
      return {
        type: "input-autocomplete-api",
        props: {
          url: options?.url as string,
          resultsPath: options?.resultsPath as string,
          textPath: options?.textPath as string,
          valuePath: options?.valuePath as string,
          trigger: (options?.trigger as "debounce" | "throttle") || "throttle",
          rate: (options?.rate as number) || 500,
          ...options,
        },
      };

    // Block Editor (rich block-based content editor)
    case "input-block-editor":
      return {
        type: "input-block-editor",
        props: {
          placeholder: options?.placeholder as string,
          font: (options?.font as string) || "sans-serif",
          ...options,
        },
      };

    // Multiline text / Textarea
    case "input-multiline":
    case "textarea":
      return {
        type: "input-multiline",
        props: {
          autosize: true,
          minRows: 3,
          maxRows: 10,
          ...options,
        },
      };

    // Code editor
    case "input-code":
      return {
        type: "input-code",
        props: {
          language: (options?.language as string) || "json",
          lineNumber: true,
          ...options,
        },
      };

    // Hash input (server-side hashed values like passwords)
    case "input-hash":
      return {
        type: "input-hash",
        props: {
          placeholder: options?.placeholder as string,
          masked: options?.masked !== false,
          ...options,
        },
      };

    // Rich text HTML (WYSIWYG)
    case "input-rich-text-html":
    case "wysiwyg":
      return {
        type: "input-rich-text-html",
        props: {
          toolbar: normalizeRichTextToolbar(options?.toolbar as string[] | undefined),
          // DaaS stores font as "font" but RichTextHTML expects "editorFont"
          editorFont: (options?.font as string) || undefined,
          ...omitKeys(options, ['toolbar', 'font']),
        },
      };

    // Rich text Markdown
    case "input-rich-text-md":
    case "markdown":
      return {
        type: "input-rich-text-md",
        props: {
          toolbar: options?.toolbar,
          ...options,
        },
      };

    // Tags
    case "tags":
      return {
        type: "tags",
        props: {
          presets: (options?.presets as string[]) || [],
          allowCustom: options?.allowCustom !== false,
          ...options,
        },
      };

    // Boolean
    case "boolean":
      return {
        type: "boolean",
        props: {
          ...options,
        },
      };

    // Toggle (boolean with state labels, custom colors and icons)
    case "toggle":
      return {
        type: "toggle",
        props: {
          colorOn: options?.colorOn as string,
          colorOff: options?.colorOff as string,
          labelOn: options?.labelOn as string,
          labelOff: options?.labelOff as string,
          showStateLabels: options?.showStateLabels as boolean,
          ...options,
        },
      };

    // DateTime
    case "datetime":
      return {
        type: "datetime",
        props: {
          type: (options?.type as string) || "datetime",
          ...options,
        },
      };

    // Select dropdown
    case "select-dropdown":
      return {
        type: "select-dropdown",
        props: {
          ...options,
        },
      };

    // Select radio (radio buttons for single selection)
    case "select-radio":
      return {
        type: "select-radio",
        props: {
          choices: options?.choices,
          allowOther: options?.allowOther,
          color: options?.color,
          iconOn: options?.iconOn,
          iconOff: options?.iconOff,
          ...options,
        },
      };

    // Multiple checkbox selection
    case "select-multiple-checkbox":
      return {
        type: "select-multiple-checkbox",
        props: {
          choices: options?.choices,
          allowOther: options?.allowOther as boolean,
          color: options?.color as string,
          itemsShown: options?.itemsShown as number,
          ...options,
        },
      };

    // Multiple dropdown selection
    case "select-multiple-dropdown":
      return {
        type: "select-multiple-dropdown",
        props: {
          choices: options?.choices,
          placeholder: options?.placeholder as string,
          allowOther: options?.allowOther as boolean,
          ...options,
        },
      };

    // Multiple checkbox tree selection
    case "select-multiple-checkbox-tree":
      return {
        type: "select-multiple-checkbox-tree",
        props: {
          choices: options?.choices,
          ...options,
        },
      };

    // Select icon (icon picker)
    case "select-icon":
      return {
        type: "select-icon",
        props: {
          ...options,
        },
      };

    // Select color (color picker)
    case "select-color":
      return {
        type: "select-color",
        props: {
          presetColors: options?.presetColors as string[],
          opacity: options?.opacity as boolean,
          ...options,
        },
      };

    // Slider (numeric range slider)
    case "slider":
      return {
        type: "slider",
        props: {
          minValue: options?.minValue as number,
          maxValue: options?.maxValue as number,
          stepInterval: options?.stepInterval as number,
          alwaysShowValue: options?.alwaysShowValue as boolean,
          ...options,
        },
      };

    // Presentation Divider (visual section separator, no input)
    case "presentation-divider":
      return {
        type: "presentation-divider",
        props: {
          title: options?.title as string,
          icon: options?.icon as string,
          color: options?.color as string,
          inlineTitle: options?.inlineTitle !== false,
          marginTop: options?.marginTop as boolean,
          ...options,
        },
      };

    // Presentation Notice (visual notice/alert, no input)
    case "presentation-notice":
      return {
        type: "presentation-notice",
        props: {
          text: options?.text as string,
          icon: options?.icon as string,
          color: options?.color as string,
          ...options,
        },
      };

    // Many-to-One relationship (select one related item)
    case "list-m2o":
    case "select-dropdown-m2o":
      return {
        type: "select-dropdown-m2o",
        props: {
          layout: (options?.selectMode as "dropdown" | "modal") || (options?.layout as "dropdown" | "modal") || "dropdown",
          fields: (options?.fields as string[]) || undefined,
          template: options?.template as string,
          enableCreate: options?.enableCreate !== false,
          enableSelect: options?.enableSelect !== false,
          enableLink: options?.enableLink === true,
          searchable: options?.searchable !== false,
          allowNone: options?.allowNone !== false,
          placeholder: options?.placeholder as string,
          filter: options?.filter as Record<string, unknown>,
          ...options,
        },
      };

    // One-to-Many relationship (display multiple related items)
    case "list-o2m":
      return {
        type: "list-o2m",
        props: {
          layout: (options?.layout as "list" | "table") || "list",
          tableSpacing:
            (options?.tableSpacing as "compact" | "cozy" | "comfortable") ||
            "cozy",
          fields: (options?.fields as string[]) || ["id"],
          template: options?.template as string,
          enableCreate: options?.enableCreate !== false,
          enableSelect: options?.enableSelect !== false,
          enableLink: options?.enableLink === true,
          enableSearchFilter: options?.enableSearchFilter === true,
          limit: (options?.limit as number) || 15,
          sort: options?.sort as string | undefined,
          sortDirection: (options?.sortDirection as "asc" | "desc") || undefined,
          filter: options?.filter as Record<string, unknown>,
          ...options,
        },
      };

    // Many-to-Many relationship (junction table)
    case "list-m2m":
      return {
        type: "list-m2m",
        props: {
          layout: (options?.layout as "list" | "table") || "list",
          tableSpacing:
            (options?.tableSpacing as "compact" | "cozy" | "comfortable") ||
            "cozy",
          fields: (options?.fields as string[]) || ["id"],
          template: options?.template as string,
          enableCreate: options?.enableCreate !== false,
          enableSelect: options?.enableSelect !== false,
          enableLink: options?.enableLink === true,
          enableSearchFilter: options?.enableSearchFilter === true,
          limit: (options?.limit as number) || 15,
          allowDuplicates: options?.allowDuplicates === true,
          junctionFieldLocation:
            (options?.junctionFieldLocation as "top" | "bottom") || "bottom",
          filter: options?.filter as Record<string, unknown>,
          // M2M-specific options from DaaS
          relatedCollection: options?.related_collection as string,
          junctionCollection: options?.junction_collection as string,
          junctionFieldCurrent: options?.junction_field_current as string,
          junctionFieldRelated: options?.junction_field_related as string,
          ...options,
        },
      };

    // Many-to-Any relationship (polymorphic, links to items from multiple collections)
    case "list-m2a":
      return {
        type: "list-m2a",
        props: {
          layout: (options?.layout as "list" | "table") || "list",
          tableSpacing:
            (options?.tableSpacing as "compact" | "cozy" | "comfortable") ||
            "cozy",
          fields: (options?.fields as string[]) || ["id"],
          template: options?.template as string,
          enableCreate: options?.enableCreate !== false,
          enableSelect: options?.enableSelect !== false,
          enableLink: options?.enableLink === true,
          enableSearchFilter: options?.enableSearchFilter === true,
          limit: (options?.limit as number) || 15,
          allowDuplicates: options?.allowDuplicates === true,
          filter: options?.filter as Record<string, unknown>,
          // M2A-specific options
          allowedCollections: options?.allowedCollections as string[],
          ...options,
        },
      };

    // File upload (single file, any type)
    case "file":
      return {
        type: "file",
        props: {
          folder: options?.folder as string,
          accept: options?.accept as string,
          fromUser: options?.fromUser !== false,
          fromUrl: options?.fromUrl !== false,
          fromLibrary: options?.fromLibrary !== false,
          ...options,
        },
      };

    // File image upload (single image file with preview)
    case "file-image":
      return {
        type: "file-image",
        props: {
          folder: options?.folder as string,
          crop: options?.crop !== false,
          width:
            (options?.width as "auto" | "full" | "fill" | "half") || "auto",
          fromUser: options?.fromUser !== false,
          fromUrl: options?.fromUrl !== false,
          fromLibrary: options?.fromLibrary !== false,
          ...options,
        },
      };

    // Files upload (multiple files)
    case "files":
      return {
        type: "files",
        props: {
          folder: options?.folder as string,
          accept: options?.accept as string,
          limit: options?.limit as number,
          ...options,
        },
      };

    // Collection Item Dropdown (select single item from any collection)
    case "collection-item-dropdown": {
      // Destructure 'collection' out to prevent it from overwriting the parent field's
      // collection prop when spreaded in FormFieldInterface
      const { collection: targetCollection, ...restOptions } = options ?? {};
      return {
        type: "collection-item-dropdown",
        props: {
          selectedCollection: targetCollection as string,
          template: restOptions.template as string,
          filter: restOptions.filter as Record<string, unknown>,
          enableCreate: restOptions.enableCreate !== false,
          enableLink: restOptions.enableLink === true,
          searchable: restOptions.searchable !== false,
          allowNone: restOptions.allowNone !== false,
          placeholder: restOptions.placeholder as string,
          ...restOptions,
        },
      };
    }

    // Map / Geometry interface
    case "map":
      return {
        type: "map",
        props: {
          geometryType: (options?.geometryType as string) || "Point",
          geometryFormat: (options?.geometryFormat as string) || "geojson",
          defaultView: options?.defaultView as Record<string, unknown>,
          basemap: options?.basemap as string,
          ...options,
        },
      };

    // Workflow Button (workflow state transitions)
    // Support all xtremax workflow interface IDs
    case "workflow-button":
    case "xtr-interface-workflow":
    case "xtr-interface-workflow-old":
    case "xtremax-workflow-button":
    case "xtremax-workflow-button-v2":
    case "xtremax-workflow-button-scheduled":
      return {
        type: "workflow-button",
        props: {
          placeholder: options?.placeholder as string,
          alwaysVisible: options?.alwaysVisible !== false,
          workflowField: (options?.workflowField as string) || "status",
          ...options,
        },
      };

    // Group interfaces (layout/presentation - wrap child fields)
    case "group-detail":
      return {
        type: "group-detail",
        props: {
          start: (options?.start as string) || "open",
          headerIcon: options?.headerIcon as string,
          headerColor: options?.headerColor as string,
          badge: options?.badge as string,
          ...options,
        },
      };

    case "group-accordion":
      return {
        type: "group-accordion",
        props: {
          accordionMode: options?.accordionMode !== false,
          start: (options?.start as string) || "closed",
          ...options,
        },
      };

    case "group-raw":
      return {
        type: "group-raw",
        props: {
          ...options,
        },
      };

    // System Token (secure token generation/management)
    case "system-token":
      return {
        type: "system-token",
        props: {
          ...options,
        },
      };

    // System Permissions (permission management for policies)
    case "system-permissions":
      return {
        type: "system-permissions",
        props: {
          ...options,
        },
      };

    default:
      return null;
  }
}

/**
 * Get interface config based on database type (fallback)
 */
function getTypeBasedInterface(
  type: string,
  schema: Field["schema"],
  dataType?: string,
): InterfaceConfig {
  // UUID fields
  if (type === "uuid" || dataType?.includes("uuid")) {
    return {
      type: "input",
      props: {
        type: "uuid",
        font: "monospace",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      },
    };
  }

  // Boolean fields
  if (type === "boolean" || dataType === "boolean") {
    return {
      type: "boolean",
      props: {},
    };
  }

  // JSON/JSONB fields
  if (
    type === "json" ||
    dataType === "json" ||
    dataType === "jsonb" ||
    dataType?.includes("json")
  ) {
    return {
      type: "input-code",
      props: {
        language: "json",
        type: "json",
        lineNumber: true,
      },
    };
  }

  // Timestamp/Date/Time fields
  if (
    type === "timestamp" ||
    type === "datetime" ||
    type === "date" ||
    type === "time" ||
    dataType?.includes("timestamp") ||
    dataType?.includes("date") ||
    dataType?.includes("time")
  ) {
    let dateType: "datetime" | "date" | "time" | "timestamp" = "datetime";

    if (dataType?.includes("date") && !dataType?.includes("time")) {
      dateType = "date";
    } else if (dataType?.includes("time") && !dataType?.includes("date")) {
      dateType = "time";
    } else if (dataType?.includes("timestamp")) {
      dateType = "timestamp";
    }

    return {
      type: "datetime",
      props: {
        type: dateType,
        includeSeconds: dataType?.includes("timestamp"),
      },
    };
  }

  // Numeric fields
  if (
    type === "integer" ||
    type === "bigInteger" ||
    type === "float" ||
    type === "decimal" ||
    dataType?.includes("int") ||
    dataType?.includes("numeric") ||
    dataType?.includes("decimal") ||
    dataType?.includes("float") ||
    dataType?.includes("double")
  ) {
    return {
      type: "input",
      props: {
        type:
          type === "bigInteger"
            ? "bigInteger"
            : type === "integer"
            ? "integer"
            : "float",
        step: dataType?.includes("int") ? 1 : 0.01,
      },
    };
  }

  // Text/Long text fields - use textarea
  if (type === "text" || dataType === "text") {
    return {
      type: "input-multiline",
      props: {
        autosize: true,
        minRows: 3,
        maxRows: 10,
      },
    };
  }

  // String/Character varying (default fallback)
  return {
    type: "input",
    props: {
      type: "string",
      maxLength: schema?.max_length || undefined,
    },
  };
}

/**
 * Options for determining field read-only status
 */
export interface FieldReadOnlyOptions {
  /** Form context (create or edit) */
  context: "create" | "edit";
  /** Primary key value: '+' for new record, actual value for existing record */
  primaryKey?: string | number;
}

/**
 * Determine if a field should be read-only
 * Based on DaaS v-form setPrimaryKeyReadonly logic:
 * - Auto-increment primary keys are read-only in both create and edit
 * - UUID primary keys with special behavior are read-only when editing (primaryKey !== '+')
 * - Fields with generated defaults (UUID, timestamps) are read-only
 *
 * @param field - Field metadata
 * @param contextOrOptions - Either 'create'/'edit' string or FieldReadOnlyOptions object
 */
export function isFieldReadOnly(
  field: Field,
  contextOrOptions: "create" | "edit" | FieldReadOnlyOptions,
): boolean {
  const options: FieldReadOnlyOptions =
    typeof contextOrOptions === "string"
      ? { context: contextOrOptions }
      : contextOrOptions;

  const { context, primaryKey } = options;
  const { schema, meta } = field;

  // Check meta.readonly flag first (explicit readonly from backend/permissions)
  if (meta?.readonly === true) {
    return true;
  }

  // Auto-increment fields are ALWAYS read-only (value is generated by database)
  if (schema?.has_auto_increment) {
    return true;
  }

  // Primary key behavior based on DaaS setPrimaryKeyReadonly logic:
  // Primary keys are read-only when:
  // 1. Editing existing record (primaryKey !== '+' or context === 'edit')
  // 2. AND field has auto-increment OR special includes 'uuid'
  if (schema?.is_primary_key) {
    const isNewRecord = isNewItem(primaryKey) || context === "create";
    const isAutoGenerated =
      schema?.has_auto_increment || meta?.special?.includes("uuid");

    // In edit mode, auto-generated primary keys are always read-only
    if (!isNewRecord && isAutoGenerated) {
      return true;
    }

    // In create mode, auto-increment PKs are read-only (handled above)
    // UUID PKs with generated default are also read-only
    if (isNewRecord && isUUIDAutoGenerated(field)) {
      return true;
    }
  }

  // Fields with generated defaults (UUID, timestamps) are read-only in create mode
  if (context === "create" && hasAutoGeneratedDefault(field)) {
    return true;
  }

  return false;
}

/**
 * Check if a field has an auto-generated UUID default
 * Based on DaaS behavior where UUID primary keys are typically auto-generated
 */
export function isUUIDAutoGenerated(field: Field): boolean {
  const { type, schema, meta } = field;
  const dataType = schema?.data_type?.toLowerCase() || "";
  const isUUID = type === "uuid" || dataType.includes("uuid");

  // UUID primary keys are typically auto-generated (DaaS pattern)
  // Even if default_value is not explicitly set, UUIDs as PKs are generated by the database
  if (isUUID && schema?.is_primary_key) {
    return true;
  }

  // Check if it's a UUID type with explicit generated default
  if (schema?.default_value) {
    const defaultVal = String(schema.default_value).toLowerCase();
    if (
      defaultVal.includes("gen_random_uuid") ||
      defaultVal.includes("uuid_generate") ||
      defaultVal.includes("uuid-ossp") ||
      defaultVal.includes("extensions.uuid")
    ) {
      return true;
    }
  }

  // Check special behavior flags
  if (meta?.special?.includes("uuid")) {
    return true;
  }

  return false;
}

/**
 * Check if a field has any auto-generated default value
 */
export function hasAutoGeneratedDefault(field: Field): boolean {
  const { type, schema, meta } = field;

  // UUID primary keys are auto-generated (even without explicit default_value)
  const dataType = schema?.data_type?.toLowerCase() || "";
  const isUUID = type === "uuid" || dataType.includes("uuid");
  if (isUUID && schema?.is_primary_key) {
    return true;
  }

  if (!schema?.default_value) {
    return false;
  }

  const defaultVal = String(schema.default_value).toLowerCase();

  // Check for database-generated values
  if (
    defaultVal.includes("gen_random_uuid") ||
    defaultVal.includes("uuid_generate") ||
    defaultVal.includes("now()") ||
    defaultVal.includes("current_timestamp") ||
    defaultVal.includes("nextval(") // PostgreSQL sequences
  ) {
    return true;
  }

  // Check special behavior flags for auto-generated values
  const autoGeneratedSpecials = [
    "uuid",
    "date-created",
    "date-updated",
    "user-created",
    "user-updated",
  ];
  if (meta?.special?.some((s: string) => autoGeneratedSpecials.includes(s))) {
    return true;
  }

  return false;
}

/**
 * Get the auto-generation type for display purposes
 */
export function getAutoGenerationType(
  field: Field,
): "auto-increment" | "uuid" | "timestamp" | "user" | null {
  const { schema, meta } = field;

  if (schema?.has_auto_increment) {
    return "auto-increment";
  }

  if (isUUIDAutoGenerated(field)) {
    return "uuid";
  }

  const defaultVal = String(schema?.default_value || "").toLowerCase();
  if (
    defaultVal.includes("now()") ||
    defaultVal.includes("current_timestamp") ||
    meta?.special?.includes("date-created") ||
    meta?.special?.includes("date-updated")
  ) {
    return "timestamp";
  }

  if (
    meta?.special?.includes("user-created") ||
    meta?.special?.includes("user-updated")
  ) {
    return "user";
  }

  return null;
}

/**
 * Get validation rules for a field
 */
export function getFieldValidation(field: Field): {
  required: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: string;
} {
  const { schema } = field;

  return {
    required: schema?.is_nullable === false && !schema?.default_value,
    maxLength: schema?.max_length || undefined,
    min: schema?.numeric_precision
      ? -Math.pow(10, schema.numeric_precision)
      : undefined,
    max: schema?.numeric_precision
      ? Math.pow(10, schema.numeric_precision)
      : undefined,
  };
}

/**
 * Get default value for a field
 */
export function getFieldDefault(field: Field): unknown {
  const { schema } = field;

  if (!schema?.default_value) {
    return undefined;
  }

  const defaultValue = String(schema.default_value);

  // Handle function-generated defaults (don't use them as form defaults)
  if (
    defaultValue.includes("(") ||
    defaultValue.includes("gen_random_uuid") ||
    defaultValue.includes("now()") ||
    defaultValue.includes("CURRENT_TIMESTAMP")
  ) {
    return undefined;
  }

  // Handle boolean defaults
  if (defaultValue === "true") return true;
  if (defaultValue === "false") return false;

  // Handle numeric defaults
  if (!isNaN(Number(defaultValue))) {
    return Number(defaultValue);
  }

  // Handle string defaults (remove quotes if present)
  if (defaultValue.startsWith("'") && defaultValue.endsWith("'")) {
    return defaultValue.slice(1, -1);
  }

  return defaultValue;
}

/**
 * Format field value for display
 */
export function formatFieldValue(value: unknown, field: Field): string {
  if (value === null || value === undefined) {
    return "";
  }

  const { type, schema } = field;

  // UUID - show shortened version
  if (type === "uuid" && typeof value === "string") {
    return `${value.substring(0, 8)}...`;
  }

  // Boolean - show Yes/No
  if (type === "boolean" || schema?.data_type === "boolean") {
    return value ? "Yes" : "No";
  }

  // JSON - show formatted
  if (
    type === "json" ||
    schema?.data_type === "json" ||
    schema?.data_type === "jsonb"
  ) {
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
  }

  // Timestamp/Date - show formatted
  if (
    type === "timestamp" ||
    type === "datetime" ||
    type === "date" ||
    schema?.data_type?.includes("timestamp") ||
    schema?.data_type?.includes("date")
  ) {
    if (typeof value === "string") {
      try {
        return new Date(value).toLocaleString();
      } catch {
        return value;
      }
    }
  }

  // Default - convert to string
  return String(value);
}

/**
 * Check if a field is a presentation-only field (no data storage)
 * These fields are for visual layout only (dividers, notices, etc.)
 */
export function isPresentationField(field: Field): boolean {
  const interfaceType = field.meta?.interface;

  return (
    interfaceType === "presentation-divider" ||
    interfaceType === "presentation-notice" ||
    interfaceType === "presentation-links"
  );
}

/**
 * Converts a snake_case field name to Title Case.
 * Example: "first_name" → "First Name"
 */
export function formatFieldTitle(fieldName: string): string {
  return fieldName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Resolves the display name for a field based on its translations.
 * Falls back to a title-cased version of the raw field name.
 *
 * @param field  - The field definition from DaaS
 * @param locale - Optional BCP 47 locale string (e.g. "zh-CN")
 */
export function getFieldDisplayName(field: Field, locale?: string): string {
  const translations = field.meta?.translations;

  if (translations && translations.length > 0) {
    if (locale) {
      const lang = locale.toLowerCase();
      const match =
        translations.find((t) => t.language.toLowerCase() === lang) ??
        translations.find((t) => lang.startsWith(t.language.toLowerCase()));
      if (match?.translation) return match.translation;
    } else {
      const first = translations.find((t) => t.translation);
      if (first) return first.translation;
    }
  }

  return formatFieldTitle(field.field);
}
