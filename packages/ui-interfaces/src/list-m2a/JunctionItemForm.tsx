"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Stack,
    Divider,
    Text,
    LoadingOverlay,
    Alert,
    Group,
    Button,
    Badge,
    Box,
} from "@mantine/core";
import { IconAlertCircle, IconDeviceFloppy, IconX } from "@tabler/icons-react";
import { apiRequest } from "@buildpad/services";
import { VForm } from "@buildpad/ui-form";
import type { Field } from "@buildpad/types";
import type { M2ARelationInfo, M2AItem } from "@buildpad/hooks";

/**
 * JunctionItemForm props
 */
export interface JunctionItemFormProps {
    /** Relation metadata for the M2A relationship */
    relationInfo: M2ARelationInfo;
    /** The junction item being edited (null for create-new) */
    item: M2AItem | null;
    /** The target related collection (e.g. "text_blocks") */
    targetCollection: string;
    /** Whether this is a new item */
    isNew: boolean;
    /** Primary key of the parent item (for context) */
    parentPrimaryKey?: string | number;
    /** Called when user confirms edits; receives the junction-shaped edits */
    onSave: (edits: Record<string, unknown>) => void;
    /** Called when user cancels */
    onCancel: () => void;
    /** Disabled state */
    disabled?: boolean;
}

/**
 * JunctionItemForm
 *
 * Renders a two-section form following the DaaS OverlayItemContent pattern:
 *
 * 1. **Related item fields** — the target collection's editable fields,
 *    rendered under the junction's `junctionField` key so edits produce
 *    `{ [junctionField]: { title: "...", ... } }`.
 *
 * 2. **Junction metadata fields** — the junction collection's own fields
 *    (e.g. sort, custom columns), excluding the back-reference to the parent
 *    (circularField), the collection discriminator, and the junction FK itself.
 *
 * The combined edits object is structured exactly like a DaaS relational
 * payload so the parent form can PATCH/POST it directly.
 */
export const JunctionItemForm: React.FC<JunctionItemFormProps> = ({
    relationInfo,
    item,
    targetCollection,
    isNew,
    parentPrimaryKey: _parentPrimaryKey,
    onSave,
    onCancel,
    disabled = false,
}) => {
    // ── field definitions ──────────────────────────────────────────
    const [relatedFields, setRelatedFields] = useState<Field[]>([]);
    const [junctionFields, setJunctionFields] = useState<Field[]>([]);
    const [fieldsLoading, setFieldsLoading] = useState(true);
    const [fieldsError, setFieldsError] = useState<string | null>(null);

    // ── form values ────────────────────────────────────────────────
    const [relatedEdits, setRelatedEdits] = useState<Record<string, unknown>>({});
    const [junctionEdits, setJunctionEdits] = useState<Record<string, unknown>>({});

    // ── initial values (fetched from server for edit mode) ─────────
    const [relatedInitialValues, setRelatedInitialValues] = useState<Record<string, unknown>>({});
    const [junctionInitialValues, setJunctionInitialValues] = useState<Record<string, unknown>>({});

    // Field names to exclude from junction metadata form
    const junctionExcludeFields = useMemo(() => {
        const excludes: string[] = [];
        // Primary key
        if (relationInfo.junctionPrimaryKeyField?.field) {
            excludes.push(relationInfo.junctionPrimaryKeyField.field);
        }
        // Back-reference to parent (circular field)
        if (relationInfo.reverseJunctionField?.field) {
            excludes.push(relationInfo.reverseJunctionField.field);
        }
        // Collection discriminator field
        if (relationInfo.collectionField?.field) {
            excludes.push(relationInfo.collectionField.field);
        }
        // Junction FK to related item (rendered in the related form section instead)
        if (relationInfo.junctionField?.field) {
            excludes.push(relationInfo.junctionField.field);
        }
        // Also exclude standard system fields
        excludes.push('id', 'user_created', 'user_updated', 'date_created', 'date_updated');
        return [...new Set(excludes)];
    }, [relationInfo]);

    // System fields to exclude from the related item form
    const relatedExcludeFields = useMemo(() => {
        return ['id', 'user_created', 'user_updated', 'date_created', 'date_updated'];
    }, []);

    // ── load field definitions and initial values ──────────────────
    useEffect(() => {
        const loadFields = async () => {
            try {
                setFieldsLoading(true);
                setFieldsError(null);

                // Fetch fields for both collections in parallel
                const [relatedFieldsRes, junctionFieldsRes] = await Promise.all([
                    apiRequest<{ data: Field[] }>(`/api/fields/${targetCollection}`),
                    apiRequest<{ data: Field[] }>(
                        `/api/fields/${relationInfo.junctionCollection.collection}`
                    ),
                ]);

                const rawRelatedFields = relatedFieldsRes.data || [];
                const rawJunctionFields = junctionFieldsRes.data || [];

                // Filter related fields: exclude system, hidden, PK
                const filteredRelated = rawRelatedFields.filter((f) => {
                    if (relatedExcludeFields.includes(f.field)) return false;
                    if (f.schema?.is_primary_key) return false;
                    if (f.meta?.hidden) return false;
                    // Exclude alias-type fields (O2M/M2M) unless they are groups or presentations
                    if (f.type === 'alias') {
                        const iface = f.meta?.interface || '';
                        const special = f.meta?.special || [];
                        if (special.includes('group') || iface.startsWith('presentation-')) return true;
                        return false;
                    }
                    return true;
                });

                // Filter junction fields: exclude reserved fields, system, hidden
                const filteredJunction = rawJunctionFields.filter((f) => {
                    if (junctionExcludeFields.includes(f.field)) return false;
                    if (f.schema?.is_primary_key) return false;
                    if (f.meta?.hidden) return false;
                    if (f.type === 'alias') {
                        const iface = f.meta?.interface || '';
                        const special = f.meta?.special || [];
                        if (special.includes('group') || iface.startsWith('presentation-')) return true;
                        return false;
                    }
                    return true;
                });

                setRelatedFields(filteredRelated);
                setJunctionFields(filteredJunction);

                // For edit mode: extract initial values from the item
                if (!isNew && item) {
                    const junctionFieldName = relationInfo.junctionField.field;
                    const relatedData = item[junctionFieldName];
                    if (relatedData && typeof relatedData === 'object') {
                        setRelatedInitialValues(relatedData as Record<string, unknown>);
                    }

                    // Junction-level values (everything except the related item nest)
                    const junctionValues: Record<string, unknown> = {};
                    for (const [key, value] of Object.entries(item)) {
                        if (key.startsWith('$')) continue; // skip internal markers
                        if (junctionExcludeFields.includes(key)) continue;
                        if (key === junctionFieldName) continue;
                        junctionValues[key] = value;
                    }
                    setJunctionInitialValues(junctionValues);
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to load fields';
                setFieldsError(msg);
            } finally {
                setFieldsLoading(false);
            }
        };

        loadFields();
    }, [targetCollection, relationInfo, item, isNew, junctionExcludeFields, relatedExcludeFields]);

    // ── derive the related item PK for the related form ────────────
    const relatedPrimaryKey = useMemo(() => {
        if (isNew) return '+';
        if (!item) return '+';
        const junctionFieldName = relationInfo.junctionField.field;
        const relatedData = item[junctionFieldName];
        if (relatedData && typeof relatedData === 'object') {
            const pkField = relationInfo.relationPrimaryKeyFields?.[targetCollection]?.field || 'id';
            return (relatedData as Record<string, unknown>)[pkField] as string | number || '+';
        }
        return '+';
    }, [isNew, item, relationInfo, targetCollection]);

    // ── junction item PK ───────────────────────────────────────────
    const junctionPrimaryKey = useMemo(() => {
        if (isNew) return '+';
        return item?.id || '+';
    }, [isNew, item]);

    // ── build combined edits for save ──────────────────────────────
    const handleSave = useCallback(() => {
        const junctionFieldName = relationInfo.junctionField.field;
        const collectionFieldName = relationInfo.collectionField.field;
        const pkField = relationInfo.junctionPrimaryKeyField?.field || 'id';
        const relatedPkField = relationInfo.relationPrimaryKeyFields?.[targetCollection]?.field || 'id';

        // Build the combined payload
        const edits: Record<string, unknown> = {
            // Junction-level metadata edits
            ...junctionEdits,
            // Collection discriminator
            [collectionFieldName]: targetCollection,
        };

        // Nested related item edits under the junction field
        const relatedPayload: Record<string, unknown> = { ...relatedEdits };

        // For edit mode, include the related item PK so DaaS knows which item to update
        if (!isNew && relatedPrimaryKey !== '+') {
            relatedPayload[relatedPkField] = relatedPrimaryKey;
        }

        edits[junctionFieldName] = relatedPayload;

        // For edit mode, include the junction PK
        if (!isNew && junctionPrimaryKey !== '+') {
            edits[pkField] = junctionPrimaryKey;
        }

        onSave(edits);
    }, [
        relationInfo, targetCollection, isNew, relatedPrimaryKey, junctionPrimaryKey,
        relatedEdits, junctionEdits, onSave,
    ]);

    // ── render ─────────────────────────────────────────────────────

    if (fieldsError) {
        return (
            <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error loading fields">
                {fieldsError}
            </Alert>
        );
    }

    return (
        <Stack gap="md" pos="relative" data-testid="junction-item-form">
            <LoadingOverlay visible={fieldsLoading} />

            {/* Section 1: Related Item Fields */}
            <Box>
                <Group gap="xs" mb="sm">
                    <Badge color="accent" variant="light" size="lg">
                        {targetCollection}
                    </Badge>
                    <Text size="sm" c="dimmed">
                        {isNew ? 'New item' : `Editing item ${relatedPrimaryKey}`}
                    </Text>
                </Group>

                {relatedFields.length > 0 ? (
                    <VForm
                        collection={targetCollection}
                        fields={relatedFields}
                        modelValue={relatedEdits}
                        initialValues={relatedInitialValues}
                        onUpdate={setRelatedEdits}
                        primaryKey={relatedPrimaryKey}
                        disabled={disabled}
                        loading={fieldsLoading}
                        showNoVisibleFields={false}
                    />
                ) : (
                    !fieldsLoading && (
                        <Text size="sm" c="dimmed" ta="center" py="md">
                            No editable fields found for {targetCollection}
                        </Text>
                    )
                )}
            </Box>

            {/* Section 2: Junction Metadata Fields (if any exist beyond the system fields) */}
            {junctionFields.length > 0 && (
                <>
                    <Divider
                        label={
                            <Text size="xs" c="dimmed" fw={500}>
                                Junction settings
                            </Text>
                        }
                        labelPosition="center"
                    />
                    <VForm
                        collection={relationInfo.junctionCollection.collection}
                        fields={junctionFields}
                        modelValue={junctionEdits}
                        initialValues={junctionInitialValues}
                        onUpdate={setJunctionEdits}
                        primaryKey={junctionPrimaryKey}
                        disabled={disabled}
                        loading={fieldsLoading}
                        excludeFields={junctionExcludeFields}
                        showNoVisibleFields={false}
                    />
                </>
            )}

            {/* Action Buttons */}
            <Group justify="flex-end" mt="md">
                <Button variant="subtle" onClick={onCancel} leftSection={<IconX size={14} />}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    leftSection={<IconDeviceFloppy size={14} />}
                    disabled={disabled}
                    data-testid="junction-form-save"
                >
                    {isNew ? 'Add Item' : 'Update Item'}
                </Button>
            </Group>
        </Stack>
    );
};

export default JunctionItemForm;
