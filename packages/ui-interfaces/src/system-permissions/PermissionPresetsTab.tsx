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
import { useBuildpadTranslations } from '@buildpad/services';
import { interpolate, type DeepPartial, type InterfacesTranslations } from '@buildpad/utils';
import { interpolateNodes } from './PermissionFilterUtils';

export interface PermissionPresetsTabProps {
  /** Draft permission being edited (must carry `collection` and `action`). */
  permission: Partial<Permission>;
  policyName?: string;
  /** Fields of the permission's collection, used to warn on relational-array presets. */
  fields?: Field[];
  onChange: (permission: Partial<Permission>) => void;
  'data-testid'?: string;
  /** Per-instance overrides of the dictionary strings (`interfaces.systemPermissions`) */
  translations?: DeepPartial<InterfacesTranslations['systemPermissions']>;
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
  translations,
}: PermissionPresetsTabProps) {
  const t = useBuildpadTranslations((d) => d.interfaces.systemPermissions, translations);
  const [presetsJson, setPresetsJson] = useState<string>(
    JSON.stringify(permission.presets || {}, null, 2),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  const actionText = permission.action === 'create' ? t.actionGerund.creating : t.actionGerund.updating;

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
      setJsonError(error instanceof Error ? error.message : t.invalidJson);
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
        {interpolateNodes(t.presetsTab.intro, {
          action: actionText,
          collection: <strong>{permission.collection}</strong>,
          policyName: policyName || t.thisPolicyFallback,
        })}
      </Alert>

      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" fw={500}>{t.presetsTab.heading}</Text>
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
          {t.clear}
        </Anchor>
      </Group>

      {warnings.length > 0 && (
        <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
          <Stack gap="xs">
            <Text size="sm" fw={500}>{t.presetsTab.relationalWarning.title}</Text>
            <Text size="xs" c="dimmed">
              {t.presetsTab.relationalWarning.description}
            </Text>
            <Code block fz="xs">
              {warnings.join(', ')}
            </Code>
            <Text size="xs" c="dimmed">
              {t.presetsTab.relationalWarning.hint}
            </Text>
          </Stack>
        </Alert>
      )}

      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          {interpolate(t.presetsTab.jsonHint, { action: actionText })}
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
        <Text size="xs" fw={500}>{t.presetsTab.examplesHeading}</Text>
        <Code block fz="xs">
{`// ${t.presetsTab.examples.staticValues}
{
  "status": "draft",
  "published": false,
  "priority": 1
}

// ${t.presetsTab.examples.currentUser}
{
  "user_created": "$CURRENT_USER",
  "author_id": "$CURRENT_USER"
}

// ${t.presetsTab.examples.timestamps}
{
  "date_created": "$NOW",
  "last_modified": "$NOW"
}

// ${t.presetsTab.examples.simpleRelational}
{
  "category_ids": ["uuid-1", "uuid-2"]
}

// ${t.presetsTab.examples.detailedRelational}
{
  "categories": {
    "create": [
      { "collection_id": "uuid-1" }
    ]
  }
}

// ${t.presetsTab.examples.oneToMany}
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

// ${t.presetsTab.examples.computedValues}
{
  "slug": "$SLUG(title)",
  "full_name": "$CONCAT(first_name, ' ', last_name)"
}`}
        </Code>
      </Stack>

      <Alert color="cyan" variant="light">
        <Stack gap="xs">
          <Text size="sm" fw={500}>{t.dynamicVariables.title}</Text>
          <Text size="xs" c="dimmed">
            {t.dynamicVariables.presetsDescription}
          </Text>
          <Code block fz="xs">
{`$CURRENT_USER         - ${t.dynamicVariableHelp.currentUser}
$CURRENT_ROLE         - ${t.dynamicVariableHelp.currentRole}
$NOW                  - ${t.dynamicVariableHelp.now}
$NOW(+1 day)          - ${t.dynamicVariableHelp.nowRelative}
$SLUG(field)          - ${t.dynamicVariableHelp.slug}
$UUID                 - ${t.dynamicVariableHelp.uuid}`}
          </Code>
        </Stack>
      </Alert>

      <Alert color="yellow" variant="light">
        <Stack gap="xs">
          <Text size="sm" fw={500}>{t.presetsTab.importantNotes.title}</Text>
          <Text size="xs" c="dimmed">
            {t.presetsTab.importantNotes.appliedBeforeValidation}
            <br />
            {t.presetsTab.importantNotes.cannotOverride}
            <br />
            {t.presetsTab.importantNotes.useDetailedSyntax}
            <br />
            {t.presetsTab.importantNotes.combineWithValidation}
          </Text>
        </Stack>
      </Alert>
    </Stack>
  );
}

export default PermissionPresetsTab;
