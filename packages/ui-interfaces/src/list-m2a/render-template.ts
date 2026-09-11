/**
 * Template rendering utility for M2A and relational display values.
 *
 * Replaces `{{field}}` and `{{nested.field.path}}` placeholders in a template
 * string with values resolved from an item data object. Mirrors the core
 * behaviour of DaaS's `render-template` Vue component but returns a plain
 * string (no component rendering).
 *
 * Features:
 * - Nested dot-path access (e.g. `{{author.name}}`)
 * - Array index access (e.g. `{{tags.0.label}}`)
 * - Missing value fallback (empty string by default)
 * - Cleans up any remaining `{{…}}` placeholders after resolution
 *
 * Also exports shared relational interface utilities used across
 * select-dropdown-m2o, list-o2m, list-m2m, list-m2a, and collection-item-dropdown.
 */

export const TEMPLATE_REGEX = /{{(.*?)}}/g; // NOSONAR: single lazy quantifier, no nesting, linear

/**
 * Safely resolve a dot-separated path against an object.
 *
 * @example
 *   getByPath({ a: { b: 'hello' } }, 'a.b') // 'hello'
 *   getByPath({ a: null }, 'a.b')            // undefined
 */
export function getByPath(obj: unknown, path: string): unknown {
    if (obj == null) return undefined;

    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
        if (current == null) return undefined;

        if (typeof current === 'object') {
            current = (current as Record<string, unknown>)[part];
        } else {
            return undefined;
        }
    }

    return current;
}

export interface RenderTemplateOptions {
    /** String to use when a placeholder cannot be resolved. Defaults to `''`. */
    fallback?: string;
    /** When `true`, unresolved `{{…}}` placeholders are kept as-is instead of
     *  being replaced with the fallback string. */
    keepUnresolved?: boolean;
}

/**
 * Render a mustache-style template string against an item data object.
 *
 * @param template - Template string, e.g. `"{{title}} by {{author.name}}"`
 * @param data     - The data object to resolve placeholders from.
 * @param options  - Optional rendering behaviour overrides.
 * @returns The rendered string with all placeholders replaced.
 *
 * @example
 *   renderTemplate('{{title}} by {{author.name}}', {
 *       title: 'Hello',
 *       author: { name: 'World' },
 *   });
 *   // → 'Hello by World'
 *
 *   renderTemplate('{{missing}}', {}, { fallback: '–' });
 *   // → '–'
 */
export function renderTemplate(
    template: string,
    data: unknown,
    options: RenderTemplateOptions = {},
): string {
    const { fallback = '', keepUnresolved = false } = options;

    if (!template) return '';
    if (data == null || typeof data !== 'object') return template;

    return template.replace(TEMPLATE_REGEX, (match, fieldKey: string) => {
        const trimmedKey = fieldKey.trim();
        const value = getByPath(data, trimmedKey);

        if (value === undefined || value === null) {
            return keepUnresolved ? match : fallback;
        }

        if (typeof value === 'object') {
            // For objects/arrays, stringify to avoid "[object Object]"
            try {
                return JSON.stringify(value);
            } catch {
                return fallback;
            }
        }

        return String(value); // NOSONAR: value is unreachable as an object here (handled above), so this is always a primitive
    });
}

// ---------------------------------------------------------------------------
// Shared relational interface utilities
// ---------------------------------------------------------------------------

/** Default fields requested from related collections when fetching items. */
export const DEFAULT_RELATIONAL_FIELDS: string[] = ["id"];

/**
 * Extract field names referenced inside `{{…}}` placeholders so we know which
 * fields to request from the API when loading items.
 *
 * For nested paths like `"author.name"` both the root (`"author"`) and the
 * full dot-path are included so the API returns enough data.
 */
export function extractFieldsFromTemplate(template: string | undefined | null): string[] {
    if (!template) return [];
    const fields: string[] = [];
    let m: RegExpExecArray | null;

    while ((m = TEMPLATE_REGEX.exec(template)) !== null) {
        const key = m[1].trim();
        if (key) {
            fields.push(key);
            const root = key.split(".")[0];
            if (root !== key && !fields.includes(root)) {
                fields.push(root);
            }
        }
    }

    return [...new Set(fields)];
}

/**
 * Minimal interface for relation info used by display-template resolution.
 * All relational hooks (`useRelationM2O`, `useRelationO2M`, etc.) provide
 * compatible shapes.
 */
export interface DisplayTemplateRelationInfo {
    displayTemplate?: string;
    relatedPrimaryKeyField?: { field: string } | string;
}

/**
 * Resolve the effective display template using the DaaS-style fallback chain:
 *   1. Explicit `template` string (from field options)
 *   2. Collection's `display_template` meta (from relation info)
 *   3. `{{ primaryKeyField }}` fallback
 */
export function resolveDisplayTemplate(
    template: string | undefined | null,
    relationInfo: DisplayTemplateRelationInfo | null | undefined,
    defaultPkField = "id",
): string {
    if (template) return template;
    if (relationInfo?.displayTemplate) return relationInfo.displayTemplate;

    const pk =
        (typeof relationInfo?.relatedPrimaryKeyField === "object"
            ? relationInfo.relatedPrimaryKeyField?.field
            : relationInfo?.relatedPrimaryKeyField) ?? defaultPkField;

    return `{{ ${pk} }}`;
}

/**
 * Resolve the API request fields list by merging:
 *  - Primary key field (always included)
 *  - Fields extracted from the display template
 *  - Explicit user-provided fields
 */
export function resolveRelationFields(
    displayTemplate: string,
    explicitFields: string[],
    pkField = "id",
): string[] {
    const fromTemplate = extractFieldsFromTemplate(displayTemplate);
    // Callers pass DEFAULT_RELATIONAL_FIELDS (["id"]) as a bootstrap default
    // when they have no real field list yet — that "id" is only ever a
    // stand-in for "the primary key", not a genuine column reference. Once
    // the caller has resolved a different real pkField (e.g. a related
    // collection whose PK is "slug"), the bootstrapped "id" is a column
    // that doesn't exist on that collection and 500s the fields= query.
    // Drop it unless the resolved pkField actually is "id".
    const fromProp = explicitFields.filter(
        (f) => f !== pkField && !(f === "id" && pkField !== "id"),
    );
    const merged = new Set([pkField, ...fromTemplate, ...fromProp]);
    return Array.from(merged);
}

/** A template path is only usable as an API field if it's a plain dotted path. */
function isPlainFieldPath(key: string): boolean {
    return /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(key);
}

/**
 * Split a junction display template's field references into the two scopes an
 * M2M query needs.
 *
 * M2M templates come from three rungs with MIXED conventions: an explicit
 * `template` prop may be written junction-relative (`{{tag_id.name}}`) or
 * related-relative (`{{name}}` — what the prop docs imply), while the related
 * collection's `display_template` and the `{{ pk }}` bootstrap are always
 * related-relative. Sending a related-relative path into the junction query
 * asks the junction table for a column it doesn't have, which errors the whole
 * request rather than merely rendering a blank label.
 *
 * Returns:
 *  - `junction`: paths ready for the junction collection's `fields=`, i.e.
 *    related-relative paths prefixed with the junction field.
 *  - `related`: the same references relative to the related collection, for
 *    querying it directly.
 *
 * The bare junction-field root that `extractFieldsFromTemplate` emits
 * alongside a dotted path (`tag_id.name` -> also `tag_id`) is dropped: asking
 * for a relational field bare collapses it to the scalar FK, which breaks the
 * nested-object shape the renderer expects. Keys that aren't plain dotted
 * paths (e.g. a `{{ name | upper }}` filter expression) are skipped rather
 * than sent as column names.
 */
export function splitJunctionTemplateFields(
    displayTemplate: string,
    junctionField: string,
): { junction: string[]; related: string[] } {
    const junction = new Set<string>();
    const related = new Set<string>();

    for (const key of extractFieldsFromTemplate(displayTemplate)) {
        if (!isPlainFieldPath(key)) continue;
        // The bare junction root carries no information of its own.
        if (key === junctionField) continue;

        if (key.startsWith(`${junctionField}.`)) {
            const rest = key.slice(junctionField.length + 1);
            junction.add(key);
            related.add(rest);
        } else {
            junction.add(`${junctionField}.${key}`);
            related.add(key);
        }
    }

    return { junction: [...junction], related: [...related] };
}
