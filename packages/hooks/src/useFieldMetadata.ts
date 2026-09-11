/**
 * useFieldMetadata
 *
 * Fetches field definitions from the DaaS API and provides:
 * - Human-readable display names for table column headers
 * - Field type information for value formatting
 * - Width hints based on field type
 *
 * Follows the DaaS `fieldsStore.getField()` pattern.
 *
 * @module @buildpad/hooks/useFieldMetadata
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiRequest } from './utils';
import type { Field, FieldMeta } from '@buildpad/types';

export interface FieldMetadataEntry {
    /** Technical field key (e.g. 'date_created') */
    field: string;
    /** Human-readable name (from meta, falls back to formatted key) */
    name: string;
    /** DaaS field type (e.g. 'string', 'integer', 'timestamp', 'uuid') */
    type: string;
    /** Display component (e.g. 'datetime', 'formatted-value') */
    display: string | null;
    /** Display options */
    displayOptions: Record<string, unknown> | null;
    /** Interface used for editing */
    interfaceName: string | null;
    /** Interface options */
    interfaceOptions: Record<string, unknown> | null;
    /** Full field meta (if available) */
    meta: FieldMeta | null;
    /** Suggested column width for table layout */
    width: number;
    /** Whether the field is sortable in table layout */
    sortable: boolean;
}

export interface UseFieldMetadataOptions {
    /** Collection to fetch fields for */
    collection: string | null;
    /** Specific fields to include (if empty, all fields returned) */
    fields?: string[];
    /** Skip API call (e.g. in mock mode) */
    skip?: boolean;
}

export interface UseFieldMetadataReturn {
    /** Map of field key → metadata */
    fieldMap: Map<string, FieldMetadataEntry>;
    /** Ordered list of field metadata (matching `fields` order if provided) */
    fieldList: FieldMetadataEntry[];
    /** Whether data is loading */
    loading: boolean;
    /** Error message if fetch failed */
    error: string | null;
    /** Get display name for a field key */
    getDisplayName: (fieldKey: string) => string;
    /** Get metadata for a field key */
    getField: (fieldKey: string) => FieldMetadataEntry | null;
    /** Refetch field metadata */
    refetch: () => void;
}

/** Non-sortable field types */
const NON_SORTABLE_TYPES = new Set(['json', 'alias', 'o2m', 'm2m', 'm2a']);

/** Width mapping by field type */
const TYPE_WIDTH_MAP: Record<string, number> = {
    uuid: 160,
    boolean: 80,
    integer: 100,
    bigInteger: 120,
    float: 100,
    decimal: 120,
    timestamp: 180,
    datetime: 180,
    date: 120,
    time: 100,
    string: 200,
    text: 250,
    json: 200,
};

/** Fallback: format a field key into a human-readable name */
function formatFieldKey(key: string): string {
    // Handle dot-path fields (e.g. "user_id.email" → "Email")
    const lastPart = key.includes('.') ? key.split('.').pop()! : key;
    return lastPart
        // Global regex .replace() is equivalent to .replaceAll() here — kept
        // as .replace() since consumer packages (e.g. ui-users) still target
        // ES2020, which predates String.prototype.replaceAll (ES2021).
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l: string) => l.toUpperCase());
}

/** Determine column width from field metadata */
function calculateWidth(field: Field): number {
    if (field.meta?.width === 'half' || field.meta?.width === 'half-left' || field.meta?.width === 'half-right') {
        return 160;
    }
    return TYPE_WIDTH_MAP[field.type] ?? 160;
}

export function useFieldMetadata(options: UseFieldMetadataOptions): UseFieldMetadataReturn {
    const { collection, fields: requestedFields, skip = false } = options;

    const [allFields, setAllFields] = useState<Field[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fetchTrigger, setFetchTrigger] = useState(0);

    // Fetch fields from API
    useEffect(() => {
        if (!collection || skip) {
            setAllFields([]);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        (async () => {
            try {
                const response = await apiRequest<{ data: Field[] }>(
                    `/api/fields/${collection}`,
                );
                if (!cancelled) {
                    setAllFields(response.data ?? []);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to fetch field metadata');
                    setAllFields([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => { cancelled = true; };
    }, [collection, skip, fetchTrigger]);

    // Build field map
    const fieldMap = useMemo(() => {
        const map = new Map<string, FieldMetadataEntry>();

        for (const field of allFields) {
            const entry: FieldMetadataEntry = {
                field: field.field,
                // note is a description, not a name — DaaS has no separate display-name
                // field, so the formatted field key is always the name.
                name: formatFieldKey(field.field),
                type: field.type,
                display: field.meta?.display ?? null,
                displayOptions: field.meta?.display_options ?? null,
                interfaceName: field.meta?.interface ?? null,
                interfaceOptions: field.meta?.options ?? null,
                meta: field.meta ?? null,
                width: calculateWidth(field),
                sortable: !NON_SORTABLE_TYPES.has(field.type),
            };

            // If meta has translated name, prefer that
            // DaaS stores the field's display name as the field key reformatted
            // We still improve on the raw key format
            map.set(field.field, entry);
        }

        return map;
    }, [allFields]);

    // Ordered field list (matching requested order)
    const fieldList = useMemo(() => {
        if (!requestedFields || requestedFields.length === 0) {
            return Array.from(fieldMap.values());
        }

        return requestedFields.map((key) => {
            const existing = fieldMap.get(key);
            if (existing) return existing;

            // Handle dot-path fields by looking up the final segment
            const segments = key.split('.');
            if (segments.length > 1) {
                const lastSegment = segments[segments.length - 1];
                const parent = fieldMap.get(segments[0]);
                return {
                    field: key,
                    name: formatFieldKey(lastSegment),
                    type: parent?.type ?? 'string',
                    display: null,
                    displayOptions: null,
                    interfaceName: null,
                    interfaceOptions: null,
                    meta: null,
                    width: 160,
                    sortable: true,
                };
            }

            // Fallback for unknown fields
            return {
                field: key,
                name: formatFieldKey(key),
                type: 'unknown',
                display: null,
                displayOptions: null,
                interfaceName: null,
                interfaceOptions: null,
                meta: null,
                width: 160,
                sortable: true,
            };
        });
    }, [requestedFields, fieldMap]);

    const getDisplayName = useCallback((fieldKey: string): string => {
        return fieldMap.get(fieldKey)?.name ?? formatFieldKey(fieldKey);
    }, [fieldMap]);

    const getField = useCallback((fieldKey: string): FieldMetadataEntry | null => {
        return fieldMap.get(fieldKey) ?? null;
    }, [fieldMap]);

    const refetch = useCallback(() => {
        setFetchTrigger((prev) => prev + 1);
    }, []);

    return {
        fieldMap,
        fieldList,
        loading,
        error,
        getDisplayName,
        getField,
        refetch,
    };
}
