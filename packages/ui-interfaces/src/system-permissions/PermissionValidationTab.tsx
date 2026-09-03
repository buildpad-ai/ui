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
import { useBuildpadTranslations } from '@buildpad/services';
import { interpolate, type DeepPartial, type InterfacesTranslations } from '@buildpad/utils';
import { interpolateNodes } from './PermissionFilterUtils';

export interface PermissionValidationTabProps {
  /** Draft permission being edited (must carry `collection` and `action`). */
  permission: Partial<Permission>;
  policyName?: string;
  /** Validation rules locked in by app-access minimal permissions. */
  appMinimal?: Filter | null;
  onChange: (permission: Partial<Permission>) => void;
  'data-testid'?: string;
  /** Per-instance overrides of the dictionary strings (`interfaces.systemPermissions`) */
  translations?: DeepPartial<InterfacesTranslations['systemPermissions']>;
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
  translations,
}: PermissionValidationTabProps) {
  const t = useBuildpadTranslations((d) => d.interfaces.systemPermissions, translations);
  const [validationJson, setValidationJson] = useState<string>(
    JSON.stringify(permission.validation || {}, null, 2),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  const actionText = permission.action === 'create' ? t.actionGerund.creating : t.actionGerund.updating;

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
      setJsonError(error instanceof Error ? error.message : t.invalidJson);
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
        {interpolateNodes(t.validationTab.intro, {
          action: actionText,
          collection: <strong>{permission.collection}</strong>,
          policyName: policyName || t.thisPolicyFallback,
        })}
      </Alert>

      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" fw={500}>{t.validationTab.heading}</Text>
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
          {t.clear}
        </Anchor>
      </Group>

      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          {interpolate(t.validationTab.jsonHint, { action: actionText })}
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
        <Text size="xs" fw={500}>{t.validationTab.examplesHeading}</Text>
        <Code block fz="xs">
{`// ${t.validationTab.examples.requiredField}
{
  "title": {
    "_nnull": true,
    "_nempty": true
  }
}

// ${t.validationTab.examples.enumValidation}
{
  "status": {
    "_in": ["draft", "published", "archived"]
  }
}

// ${t.validationTab.examples.dateRange}
{
  "publish_date": {
    "_gte": "$NOW",
    "_lte": "$NOW(+7 days)"
  }
}

// ${t.validationTab.examples.stringLength}
{
  "description": {
    "_nnull": true,
    "_regex": "^.{10,500}$"
  }
}

// ${t.validationTab.examples.numericRange}
{
  "price": {
    "_gte": 0,
    "_lte": 10000
  }
}

// ${t.validationTab.examples.multipleConditions}
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
          <Text size="sm" fw={500}>{t.dynamicVariables.title}</Text>
          <Text size="xs" c="dimmed">
            {t.dynamicVariables.validationDescription}
          </Text>
          <Code block fz="xs">
{`$CURRENT_USER    - ${t.dynamicVariableHelp.currentUser}
$CURRENT_ROLE    - ${t.dynamicVariableHelp.currentRole}
$NOW             - ${t.dynamicVariableHelp.now}
$NOW(+1 day)     - ${t.dynamicVariableHelp.nowRelative}`}
          </Code>
        </Stack>
      </Alert>

      {appMinimal && Object.keys(appMinimal).length > 0 && (
        <>
          <Divider />
          <Alert color="yellow" variant="light" icon={<IconInfoCircle size={16} />}>
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                {t.validationTab.appMinimal.title}
              </Text>
              <Text size="xs" c="dimmed">
                {t.validationTab.appMinimal.description}
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
