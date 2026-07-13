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
import { IconInfoCircle } from '@tabler/icons-react';
import type { Filter, Permission } from '@buildpad/types';

export interface PermissionValidationTabProps {
  /** Draft permission being edited (must carry `collection` and `action`). */
  permission: Partial<Permission>;
  policyName?: string;
  /** Validation rules locked in by app-access minimal permissions. */
  appMinimal?: Filter | null;
  onChange: (permission: Partial<Permission>) => void;
  'data-testid'?: string;
}

/**
 * "Field Validation" tab — Directus-filter rules checked before allowing
 * create/update operations. Raw JSON editor with worked examples.
 */
export function PermissionValidationTab({
  permission,
  policyName,
  appMinimal,
  onChange,
  'data-testid': testId,
}: PermissionValidationTabProps) {
  const [validationJson, setValidationJson] = useState<string>(
    JSON.stringify(permission.validation || {}, null, 2),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  const actionText = permission.action === 'create' ? 'creating' : 'updating';

  const handleJsonChange = (value: string) => {
    setValidationJson(value);
    try {
      const parsed = JSON.parse(value);
      setJsonError(null);
      onChange({
        ...permission,
        validation: Object.keys(parsed).length > 0 ? parsed : null,
      });
    } catch (error) {
      // Invalid JSON — keep the draft untouched until it parses again
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON');
    }
  };

  const handleClearValidation = () => {
    setValidationJson('{}');
    setJsonError(null);
    onChange({
      ...permission,
      validation: null,
    });
  };

  return (
    <Stack gap="md" data-testid={testId}>
      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        Define validation rules for fields when {actionText} items in{' '}
        <strong>{permission.collection}</strong> by {policyName || 'this policy'}.
      </Alert>

      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" fw={500}>Validation Rules</Text>
        <Anchor
          component="button"
          type="button"
          size="sm"
          c="red"
          fw={500}
          onClick={handleClearValidation}
          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          data-testid={testId ? `${testId}-clear` : undefined}
        >
          Clear
        </Anchor>
      </Group>

      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          Enter field validation rules using Directus filter syntax. These rules will be checked
          before allowing {actionText} operations.
        </Text>
        <Textarea
          value={validationJson}
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
  "title": {
    "_nnull": true,
    "_nempty": true
  },
  "status": {
    "_in": ["draft", "published", "archived"]
  },
  "publish_date": {
    "_lte": "$NOW"
  }
}`}
          data-testid={testId ? `${testId}-json` : undefined}
        />
      </Stack>

      <Divider />

      <Stack gap="xs">
        <Text size="xs" fw={500}>Example Validation Patterns:</Text>
        <Code block fz="xs">
{`// Required field (not null and not empty)
{
  "title": {
    "_nnull": true,
    "_nempty": true
  }
}

// Enum validation
{
  "status": {
    "_in": ["draft", "published", "archived"]
  }
}

// Date range validation
{
  "publish_date": {
    "_gte": "$NOW",
    "_lte": "$NOW(+7 days)"
  }
}

// String length validation
{
  "description": {
    "_nnull": true,
    "_regex": "^.{10,500}$"
  }
}

// Numeric range
{
  "price": {
    "_gte": 0,
    "_lte": 10000
  }
}

// Multiple conditions (AND)
{
  "_and": [
    { "email": { "_contains": "@" } },
    { "email": { "_nempty": true } }
  ]
}`}
        </Code>
      </Stack>

      <Alert color="cyan" variant="light">
        <Stack gap="xs">
          <Text size="sm" fw={500}>Dynamic Variables</Text>
          <Text size="xs" c="dimmed">
            You can use the following dynamic variables in your validation rules:
          </Text>
          <Code block fz="xs">
{`$CURRENT_USER    - ID of the current user
$CURRENT_ROLE    - ID of the current user's role
$NOW             - Current timestamp
$NOW(+1 day)     - Relative time calculations`}
          </Code>
        </Stack>
      </Alert>

      {appMinimal && Object.keys(appMinimal).length > 0 && (
        <>
          <Divider />
          <Alert color="yellow" variant="light" icon={<IconInfoCircle size={16} />}>
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Minimum Validation (App Access)
              </Text>
              <Text size="xs" c="dimmed">
                The following validation rules are automatically applied with app access:
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

export default PermissionValidationTab;
