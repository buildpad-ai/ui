import React, { useState } from 'react';
import {
  Alert,
  Anchor,
  Code,
  Divider,
  Group,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import type { Field, Permission } from '@buildpad/types';

export interface PermissionPresetsTabProps {
  /** Draft permission being edited (must carry `collection` and `action`). */
  permission: Partial<Permission>;
  policyName?: string;
  /** Fields of the permission's collection, used to warn on relational-array presets. */
  fields?: Field[];
  onChange: (permission: Partial<Permission>) => void;
  'data-testid'?: string;
}

/**
 * "Field Presets" tab — default field values applied automatically when
 * creating/updating items. Raw JSON editor with a relational-array warning.
 */
export function PermissionPresetsTab({
  permission,
  policyName,
  fields = [],
  onChange,
  'data-testid': testId,
}: PermissionPresetsTabProps) {
  const [presetsJson, setPresetsJson] = useState<string>(
    JSON.stringify(permission.presets || {}, null, 2),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  const actionText = permission.action === 'create' ? 'creating' : 'updating';

  // UUID fields (likely relational) assigned array values need detailed syntax
  const warnings = (() => {
    try {
      const presets = JSON.parse(presetsJson);
      const newWarnings: string[] = [];
      Object.keys(presets).forEach((fieldName) => {
        const field = fields.find((f) => f.field === fieldName);
        if (field?.type === 'uuid' && Array.isArray(presets[fieldName])) {
          newWarnings.push(fieldName);
        }
      });
      return newWarnings;
    } catch {
      return [];
    }
  })();

  const handleJsonChange = (value: string) => {
    setPresetsJson(value);
    try {
      const parsed = JSON.parse(value);
      setJsonError(null);
      onChange({
        ...permission,
        presets: Object.keys(parsed).length > 0 ? parsed : null,
      });
    } catch (error) {
      // Invalid JSON — keep the draft untouched until it parses again
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON');
    }
  };

  const handleClearPresets = () => {
    setPresetsJson('{}');
    setJsonError(null);
    onChange({
      ...permission,
      presets: null,
    });
  };

  return (
    <Stack gap="md" data-testid={testId}>
      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        Define default values for fields when {actionText} items in{' '}
        <strong>{permission.collection}</strong> by {policyName || 'this policy'}.
      </Alert>

      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" fw={500}>Field Presets</Text>
        <Anchor
          component="button"
          type="button"
          size="sm"
          c="red"
          fw={500}
          onClick={handleClearPresets}
          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          data-testid={testId ? `${testId}-clear` : undefined}
        >
          Clear
        </Anchor>
      </Group>

      {warnings.length > 0 && (
        <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
          <Stack gap="xs">
            <Text size="sm" fw={500}>Warning: Relational Field Preset Syntax</Text>
            <Text size="xs" c="dimmed">
              The following relational fields use array syntax which may not work correctly in
              the app interface:
            </Text>
            <Code block fz="xs">
              {warnings.join(', ')}
            </Code>
            <Text size="xs" c="dimmed">
              Consider using the detailed syntax for relational fields (see examples below).
            </Text>
          </Stack>
        </Alert>
      )}

      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          Enter default field values that will be automatically applied when {actionText} items.
          These values can be static or dynamic.
        </Text>
        <Textarea
          value={presetsJson}
          onChange={(e) => handleJsonChange(e.target.value)}
          autosize
          minRows={12}
          maxRows={20}
          error={jsonError}
          styles={{
            input: {
              fontFamily: 'monospace',
              fontSize: 'var(--mantine-font-size-xs)',
            },
          }}
          placeholder={`{
  "status": "draft",
  "user_created": "$CURRENT_USER",
  "date_created": "$NOW",
  "published": false
}`}
          data-testid={testId ? `${testId}-json` : undefined}
        />
      </Stack>

      <Divider />

      <Stack gap="xs">
        <Text size="xs" fw={500}>Example Preset Patterns:</Text>
        <Code block fz="xs">
{`// Static values
{
  "status": "draft",
  "published": false,
  "priority": 1
}

// Current user
{
  "user_created": "$CURRENT_USER",
  "author_id": "$CURRENT_USER"
}

// Timestamps
{
  "date_created": "$NOW",
  "last_modified": "$NOW"
}

// Simple relational field (array syntax)
{
  "category_ids": ["uuid-1", "uuid-2"]
}

// Relational field (detailed syntax - RECOMMENDED)
{
  "categories": {
    "create": [
      { "collection_id": "uuid-1" }
    ]
  }
}

// One-to-Many relationship
{
  "related_items": {
    "create": [
      { "item_id": "uuid-1", "sort": 1 },
      { "item_id": "uuid-2", "sort": 2 }
    ],
    "update": [],
    "delete": []
  }
}

// Computed values
{
  "slug": "$SLUG(title)",
  "full_name": "$CONCAT(first_name, ' ', last_name)"
}`}
        </Code>
      </Stack>

      <Alert color="cyan" variant="light">
        <Stack gap="xs">
          <Text size="sm" fw={500}>Dynamic Variables</Text>
          <Text size="xs" c="dimmed">
            You can use the following dynamic variables in your presets:
          </Text>
          <Code block fz="xs">
{`$CURRENT_USER         - ID of the current user
$CURRENT_ROLE         - ID of the current user's role
$NOW                  - Current timestamp
$NOW(+1 day)          - Relative time calculations
$SLUG(field)          - Generate URL slug from field
$UUID                 - Generate new UUID`}
          </Code>
        </Stack>
      </Alert>

      <Alert color="yellow" variant="light">
        <Stack gap="xs">
          <Text size="sm" fw={500}>Important Notes</Text>
          <Text size="xs" c="dimmed">
            • Presets are applied before validation rules
            <br />
            • Users cannot override preset values in the app
            <br />
            • For relational fields used in app interfaces, use detailed syntax instead of arrays
            <br />
            • Presets can be combined with validation to ensure data consistency
          </Text>
        </Stack>
      </Alert>
    </Stack>
  );
}

export default PermissionPresetsTab;
