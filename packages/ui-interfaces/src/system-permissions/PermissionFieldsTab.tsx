import React, { useEffect, useState } from 'react';
import {
  Alert,
  Checkbox,
  Code,
  Divider,
  Group,
  LoadingOverlay,
  Stack,
  Text,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import type { Field, Permission } from '@buildpad/types';

/**
 * Format field name to Title Case (e.g., "user_created" -> "User Created")
 */
function formatFieldName(fieldName: string): string {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export interface PermissionFieldsTabProps {
  /** Draft permission being edited (must carry `collection` and `action`). */
  permission: Partial<Permission>;
  policyName?: string;
  /** Fields of the permission's collection (fetched or injected by the modal). */
  fields: Field[];
  loading?: boolean;
  /** Field names locked in by app-access minimal permissions. */
  appMinimal?: string[] | null;
  onChange: (permission: Partial<Permission>) => void;
  'data-testid'?: string;
}

/**
 * "Field Permissions" tab — checkbox list of the collection's fields with
 * all/none shortcuts. `['*']` selects everything; app-minimal fields are
 * locked and excluded from the stored array.
 */
export function PermissionFieldsTab({
  permission,
  policyName,
  fields,
  loading = false,
  appMinimal,
  onChange,
  'data-testid': testId,
}: PermissionFieldsTabProps) {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  // Initialize selected fields from permission
  useEffect(() => {
    const appMinimalSet = new Set(appMinimal || []);
    const permissionFields = permission.fields || [];

    // If fields is ['*'], select all fields
    if (permissionFields.includes('*')) {
      setSelectedFields(new Set(fields.map((f) => f.field)));
    } else {
      // Combine app minimal and permission fields
      setSelectedFields(new Set([
        ...appMinimalSet,
        ...permissionFields.filter((f) => f !== '*'),
      ]));
    }
  }, [permission.fields, appMinimal, fields]);

  const appMinimalSet = new Set(appMinimal || []);
  const hasAppMinimalAll = appMinimal?.includes('*');

  const emitFields = (selected: Set<string>) => {
    // Store only non-app-minimal fields; empty selection = null (no access)
    const permissionFieldsOnly = Array.from(selected).filter((f) => !appMinimalSet.has(f));
    onChange({
      ...permission,
      fields: permissionFieldsOnly.length > 0 ? permissionFieldsOnly : null,
    });
  };

  const handleFieldToggle = (fieldName: string) => {
    // Don't allow toggling app minimal fields
    if (appMinimalSet.has(fieldName) || hasAppMinimalAll) {
      return;
    }

    const newSelected = new Set(selectedFields);
    if (newSelected.has(fieldName)) {
      newSelected.delete(fieldName);
    } else {
      newSelected.add(fieldName);
    }
    setSelectedFields(newSelected);
    emitFields(newSelected);
  };

  const handleSelectAll = () => {
    const allFields = new Set(fields.map((f) => f.field));
    setSelectedFields(allFields);
    emitFields(allFields);
  };

  const handleSelectNone = () => {
    // Keep only app minimal fields selected in UI
    setSelectedFields(appMinimalSet);
    onChange({
      ...permission,
      fields: null,
    });
  };

  const actionText = permission.action ?? 'access';

  return (
    <Stack gap="md" pos="relative" data-testid={testId}>
      <LoadingOverlay visible={loading} />

      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        Select which fields {policyName || 'this policy'} can {actionText} in{' '}
        <strong>{permission.collection}</strong>.
      </Alert>

      <Group justify="space-between">
        <Text size="sm" fw={500}>Fields</Text>
        <Group gap={4}>
          <Text size="xs" c="dimmed">Select:</Text>
          <Text
            size="xs"
            c="blue"
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            onClick={handleSelectAll}
            data-testid={testId ? `${testId}-select-all` : undefined}
          >
            all
          </Text>
          <Text size="xs" c="dimmed">/</Text>
          <Text
            size="xs"
            c="blue"
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            onClick={handleSelectNone}
            data-testid={testId ? `${testId}-select-none` : undefined}
          >
            none
          </Text>
        </Group>
      </Group>

      <Stack gap="xs">
        {fields.length === 0 && !loading && (
          <Text size="sm" c="dimmed" ta="center" py="md">
            No fields found for this collection
          </Text>
        )}

        {fields.map((field) => {
          const isAppMinimal = appMinimalSet.has(field.field) || hasAppMinimalAll;
          const isSelected = selectedFields.has(field.field);

          return (
            <Checkbox
              key={field.field}
              label={
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm">{formatFieldName(field.field)}</Text>
                  <Code c="dimmed" fz="xs">
                    {field.field}
                  </Code>
                  {field.schema?.is_primary_key && (
                    <Text size="xs" c="blue" fw={500}>
                      PK
                    </Text>
                  )}
                  {field.type === 'alias' && (
                    <Text size="xs" c="violet" fw={500}>
                      Alias
                    </Text>
                  )}
                  {isAppMinimal && (
                    <Text size="xs" c="cyan" fw={500}>
                      App Minimal
                    </Text>
                  )}
                </Group>
              }
              checked={isSelected}
              disabled={isAppMinimal}
              onChange={() => handleFieldToggle(field.field)}
              styles={{
                label: { width: '100%' },
              }}
              data-testid={testId ? `${testId}-field-${field.field}` : undefined}
            />
          );
        })}
      </Stack>

      {appMinimal && appMinimal.length > 0 && (
        <>
          <Divider />
          <Alert color="yellow" variant="light" icon={<IconInfoCircle size={16} />}>
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Minimum Permissions (App Access)
              </Text>
              <Text size="xs" c="dimmed">
                The following fields are automatically included with app access and cannot be
                removed:
              </Text>
              <Code block fz="xs">
                {JSON.stringify(appMinimal, null, 2)}
              </Code>
            </Stack>
          </Alert>
        </>
      )}
    </Stack>
  );
}

export default PermissionFieldsTab;
