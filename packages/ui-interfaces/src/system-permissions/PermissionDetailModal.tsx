import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Modal,
  Stack,
  Tabs,
  Text,
} from '@mantine/core';
import type { Field, Permission, PermissionAction } from '@buildpad/types';
import type { RelationInfo } from './PermissionFilterTypes';
import { fetchCollectionFields, fetchCollectionRelations } from './permissionMetadata';
import { PermissionFieldsTab } from './PermissionFieldsTab';
import { PermissionFilterTab } from './PermissionFilterTab';
import { PermissionValidationTab } from './PermissionValidationTab';
import { PermissionPresetsTab } from './PermissionPresetsTab';

export interface PermissionDetailModalProps {
  opened: boolean;
  onClose: () => void;
  /** Existing permission row (display markers tolerated) or `null` when creating. */
  permission: Partial<Permission> | null;
  collection: string;
  action: PermissionAction;
  policyName?: string;
  /** Matched app-access minimal permission for this collection/action, if any. */
  appMinimal?: Partial<Permission>;
  /** Inject fields for tests/stories instead of fetching `/api/fields/{collection}`. */
  fields?: Field[];
  /** Inject relations for tests/stories instead of fetching `/api/relations`. */
  relations?: RelationInfo[];
  /** Receives only the editable keys: `{ fields, permissions, validation, presets }`. */
  onSave: (edited: Partial<Permission>) => void;
  /** Rendered as a Delete action when provided (existing permissions only). */
  onDelete?: () => void;
  'data-testid'?: string;
}

const EMPTY_DRAFT: Pick<Permission, 'fields' | 'permissions' | 'validation' | 'presets'> = {
  fields: null,
  permissions: null,
  validation: null,
  presets: null,
};

function hasObjectValue(value: unknown): boolean {
  return !!value && typeof value === 'object' && Object.keys(value).length > 0;
}

/**
 * Tabbed editor for a single permission's custom rules. Edits a local
 * draft only — persistence stays with the caller's alterations model.
 */
export function PermissionDetailModal({
  opened,
  onClose,
  permission,
  collection,
  action,
  policyName,
  appMinimal,
  fields: injectedFields,
  relations: injectedRelations,
  onSave,
  onDelete,
  'data-testid': testId,
}: PermissionDetailModalProps) {
  const [draft, setDraft] = useState<Partial<Permission>>({ collection, action, ...EMPTY_DRAFT });
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fields, setFields] = useState<Field[]>(injectedFields ?? []);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [relations, setRelations] = useState<RelationInfo[]>(injectedRelations ?? []);

  const isNew = !permission;

  // Seed the draft each time the modal opens
  useEffect(() => {
    if (!opened) return;
    setDraft({
      collection,
      action,
      ...EMPTY_DRAFT,
      ...(permission
        ? {
            fields: permission.fields ?? null,
            permissions: permission.permissions ?? null,
            validation: permission.validation ?? null,
            presets: permission.presets ?? null,
          }
        : null),
    });
    setDeleteConfirmOpen(false);
    setActiveTab(null);
  }, [opened, permission, collection, action]);

  // Field metadata: injected, or fetched once per collection while open
  useEffect(() => {
    if (!opened) return;
    if (injectedFields) {
      setFields(injectedFields);
      return;
    }
    let cancelled = false;
    setFieldsLoading(true);
    fetchCollectionFields(collection)
      .then((result) => {
        if (!cancelled) setFields(result);
      })
      .catch(() => {
        if (!cancelled) setFields([]);
      })
      .finally(() => {
        if (!cancelled) setFieldsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [opened, collection, injectedFields]);

  // Relation metadata (for the filter builder): injected, or fetched while open
  useEffect(() => {
    if (!opened) return;
    if (injectedRelations) {
      setRelations(injectedRelations);
      return;
    }
    if (action === 'create') return; // no Item Permissions tab
    let cancelled = false;
    fetchCollectionRelations(collection)
      .then((result) => {
        if (!cancelled) setRelations(result);
      })
      .catch(() => {
        if (!cancelled) setRelations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [opened, collection, action, injectedRelations]);

  // Tabs are action-dependent (Directus semantics)
  const tabs = useMemo(() => {
    const tabList: Array<{ value: string; label: string; hasValue: boolean }> = [];

    if (['read', 'update', 'delete', 'share'].includes(action)) {
      tabList.push({
        value: 'permissions',
        label: 'Item Permissions',
        hasValue: hasObjectValue(draft.permissions),
      });
    }
    if (['create', 'read', 'update'].includes(action)) {
      tabList.push({
        value: 'fields',
        label: 'Field Permissions',
        hasValue: draft.fields !== null && draft.fields !== undefined,
      });
    }
    if (['create', 'update'].includes(action)) {
      tabList.push({
        value: 'validation',
        label: 'Field Validation',
        hasValue: hasObjectValue(draft.validation),
      });
      tabList.push({
        value: 'presets',
        label: 'Field Presets',
        hasValue: hasObjectValue(draft.presets),
      });
    }

    return tabList;
  }, [action, draft]);

  const currentTab = activeTab ?? tabs[0]?.value ?? null;

  const handleSave = () => {
    onSave({
      fields: draft.fields && draft.fields.length > 0 ? draft.fields : null,
      permissions: draft.permissions ?? null,
      validation: draft.validation ?? null,
      presets: draft.presets ?? null,
    });
    onClose();
  };

  const executeDelete = () => {
    setDeleteConfirmOpen(false);
    onDelete?.();
    onClose();
  };

  const modalTitle = `${policyName || 'Policy'} → ${collection} → ${action.toUpperCase()}`;

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={modalTitle}
        size="xl"
        transitionProps={{ duration: 0 }}
        styles={{ body: { minHeight: 400 } }}
        data-testid={testId}
      >
        <Stack gap="md">
          <Tabs value={currentTab} onChange={setActiveTab}>
            <Tabs.List>
              {tabs.map((tab) => (
                <Tabs.Tab
                  key={tab.value}
                  value={tab.value}
                  rightSection={
                    tab.hasValue ? <Badge size="xs" variant="dot" color="blue" /> : null
                  }
                  data-testid={testId ? `${testId}-tab-${tab.value}` : undefined}
                >
                  {tab.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            {tabs.some((t) => t.value === 'permissions') && (
              <Tabs.Panel value="permissions" pt="md">
                <PermissionFilterTab
                  permission={draft}
                  policyName={policyName}
                  fields={fields}
                  relations={relations}
                  loading={fieldsLoading}
                  appMinimal={appMinimal?.permissions}
                  onChange={setDraft}
                  data-testid={testId ? `${testId}-filter` : undefined}
                />
              </Tabs.Panel>
            )}

            {tabs.some((t) => t.value === 'fields') && (
              <Tabs.Panel value="fields" pt="md">
                <PermissionFieldsTab
                  permission={draft}
                  policyName={policyName}
                  fields={fields}
                  loading={fieldsLoading}
                  appMinimal={appMinimal?.fields}
                  onChange={setDraft}
                  data-testid={testId ? `${testId}-fields` : undefined}
                />
              </Tabs.Panel>
            )}

            {tabs.some((t) => t.value === 'validation') && (
              <Tabs.Panel value="validation" pt="md">
                <PermissionValidationTab
                  permission={draft}
                  policyName={policyName}
                  appMinimal={appMinimal?.validation}
                  onChange={setDraft}
                  data-testid={testId ? `${testId}-validation` : undefined}
                />
              </Tabs.Panel>
            )}

            {tabs.some((t) => t.value === 'presets') && (
              <Tabs.Panel value="presets" pt="md">
                <PermissionPresetsTab
                  permission={draft}
                  policyName={policyName}
                  fields={fields}
                  onChange={setDraft}
                  data-testid={testId ? `${testId}-presets` : undefined}
                />
              </Tabs.Panel>
            )}
          </Tabs>

          <Group justify="space-between" mt="md">
            <Group>
              {!isNew && onDelete && (
                <Button
                  color="red"
                  variant="light"
                  onClick={() => setDeleteConfirmOpen(true)}
                  data-testid={testId ? `${testId}-delete` : undefined}
                >
                  Delete
                </Button>
              )}
            </Group>
            <Group>
              <Button
                variant="default"
                onClick={onClose}
                data-testid={testId ? `${testId}-cancel` : undefined}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} data-testid={testId ? `${testId}-save` : undefined}>
                {isNew ? 'Create' : 'Save'}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      {/* Delete confirmation dialog */}
      <Modal
        opened={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Remove permission"
        centered
        size="sm"
        transitionProps={{ duration: 0 }}
        data-testid={testId ? `${testId}-delete-dialog` : undefined}
      >
        <Text size="sm" mb="md">
          Are you sure you want to remove this permission? This action cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={executeDelete}
            data-testid={testId ? `${testId}-delete-confirm` : undefined}
          >
            Remove
          </Button>
        </Group>
      </Modal>
    </>
  );
}

export default PermissionDetailModal;
