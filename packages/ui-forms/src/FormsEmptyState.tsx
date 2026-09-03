/**
 * FormsEmptyState
 *
 * Prerequisite guidance shown when the definitions collection is missing (or a
 * data request against it failed because it does not exist). Rather than
 * crashing, the builder and the forms list render this hint describing the
 * one-time collection that must be created and its fields. The same content is
 * documented in the package README.
 *
 * @package @buildpad/ui-forms
 */

'use client';

import { Fragment, useState, type ReactNode } from 'react';
import { Alert, Button, Code, Group, List, Stack, Text } from '@mantine/core';
import { IconDatabaseOff, IconDatabasePlus } from '@tabler/icons-react';
import { CollectionsService, useBuildpadTranslations } from '@buildpad/services';
import type { DeepPartial, FormsTranslations } from '@buildpad/utils';
import type { CollectionSpec } from '@buildpad/types';

/**
 * `interpolate()` for copy whose `{placeholders}` render as React nodes
 * (`<strong>`, `<Code>`), so a translation keeps control of the word order
 * around the markup. Unknown placeholders stay visible, like `interpolate()`.
 *
 * Shared by the builder's rich-text copy (`FormBuilder`, `NameFieldModal`); it
 * lives here rather than in a module of its own because the registry copies the
 * package into consumer apps file by file.
 */
export function interpolateNodes(
  template: string,
  values: Record<string, ReactNode>,
): ReactNode {
  return template.split(/(\{\w+\})/).map((part, index) => {
    const match = /^\{(\w+)\}$/.exec(part);
    if (match && Object.prototype.hasOwnProperty.call(values, match[1])) {
      return <Fragment key={index}>{values[match[1]]}</Fragment>;
    }
    return part;
  });
}

export interface FormsEmptyStateProps {
  /** The configured definitions collection name (default `fb_definitions`). */
  formsCollection?: string;
  /** Optional underlying error message to surface. */
  error?: string | null;
  /**
   * Show an actionable "Create collection" button that provisions the
   * definitions collection via the DDL API. Gate this on DaaS schema rights —
   * when absent, only the manual instructions are shown.
   */
  canCreateCollection?: boolean;
  /** Called after the collection is successfully created (e.g. to reload). */
  onCreated?: () => void;
  /** Per-instance overrides of the dictionary strings (`forms` namespace). */
  translations?: DeepPartial<FormsTranslations>;
}

/**
 * Field specs for the definitions collection (beyond the baseline id + extras).
 * The labels are persisted as DaaS schema metadata of the provisioned
 * collection (not rendered here), so they stay English rather than baking the
 * clicking user's locale into a shared schema.
 */
function definitionsFields(): CollectionSpec['fields'] {
  return [
    { field: 'name', type: 'string', label: 'Name', required: true },
    {
      field: 'target_collection',
      type: 'string',
      label: 'Target collection',
      required: true,
      addIndex: true,
    },
    { field: 'key', type: 'string', label: 'Key' },
    { field: 'definition', type: 'json', label: 'Definition' },
  ];
}

/**
 * Explain the required `fb_definitions` collection and its fields, and —
 * with schema rights — offer to provision it in-app.
 */
export function FormsEmptyState({
  formsCollection = 'fb_definitions',
  error,
  canCreateCollection = false,
  onCreated,
  translations,
}: FormsEmptyStateProps) {
  const t = useBuildpadTranslations((d) => d.forms, translations);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      await new CollectionsService().createCollection({
        collection: formsCollection,
        // Persisted collection description (schema metadata), not UI copy.
        note: 'Form builder form definitions',
        fields: definitionsFields(),
      });
      onCreated?.();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : t.formsEmptyState.error.createFailed,
      );
    } finally {
      setCreating(false);
    }
  };

  const s = t.formsEmptyState;

  return (
    <Alert
      icon={<IconDatabaseOff size={18} />}
      color="yellow"
      title={s.title}
      data-testid="forms-empty-state"
    >
      <Stack gap="xs">
        <Text size="sm">
          {interpolateNodes(s.intro, { collection: <Code>{formsCollection}</Code> })}{' '}
          {canCreateCollection ? s.introCanCreate : s.introManual}
        </Text>
        <List size="sm" spacing={2}>
          <List.Item>
            {interpolateNodes(s.fields.id, { field: <Code>id</Code> })}
          </List.Item>
          <List.Item>
            {interpolateNodes(s.fields.name, { field: <Code>name</Code> })}
          </List.Item>
          <List.Item>
            {interpolateNodes(s.fields.targetCollection, {
              field: <Code>target_collection</Code>,
            })}
          </List.Item>
          <List.Item>
            {interpolateNodes(s.fields.key, { field: <Code>key</Code> })}
          </List.Item>
          <List.Item>
            {interpolateNodes(s.fields.definition, { field: <Code>definition</Code> })}
          </List.Item>
        </List>
        <Text size="xs" c="dimmed">
          {interpolateNodes(s.systemPrefixWarning, { prefix: <Code>daas_</Code> })}
          {!canCreateCollection && (
            <>
              {' '}
              {s.reloadHint}
            </>
          )}
        </Text>

        {canCreateCollection && (
          <Group mt={4}>
            <Button
              size="xs"
              leftSection={<IconDatabasePlus size={14} />}
              loading={creating}
              onClick={handleCreate}
              data-testid="forms-create-collection"
            >
              {s.createCollection}
            </Button>
          </Group>
        )}

        {(error || createError) && (
          <Text size="xs" c="red">
            {createError ?? error}
          </Text>
        )}
      </Stack>
    </Alert>
  );
}

export default FormsEmptyState;
