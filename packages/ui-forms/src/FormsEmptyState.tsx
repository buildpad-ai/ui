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

import { useState } from 'react';
import { Alert, Button, Code, Group, List, Stack, Text } from '@mantine/core';
import { IconDatabaseOff, IconDatabasePlus } from '@tabler/icons-react';
import { CollectionsService } from '@buildpad/services';
import type { CollectionSpec } from '@buildpad/types';

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
}

/** Field specs for the definitions collection (beyond the baseline id + extras). */
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
}: FormsEmptyStateProps) {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      await new CollectionsService().createCollection({
        collection: formsCollection,
        note: 'Form builder form definitions',
        fields: definitionsFields(),
      });
      onCreated?.();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create the collection',
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Alert
      icon={<IconDatabaseOff size={18} />}
      color="yellow"
      title="Form definitions collection not found"
      data-testid="forms-empty-state"
    >
      <Stack gap="xs">
        <Text size="sm">
          The form builder stores form definitions as items in a collection named{' '}
          <Code>{formsCollection}</Code>, which doesn&apos;t exist yet.
          {canCreateCollection
            ? ' Create it in one click below, or set it up manually with these fields:'
            : ' Create it once via the Data Model editor (or the DDL API) with these fields:'}
        </Text>
        <List size="sm" spacing={2}>
          <List.Item>
            <Code>id</Code> — uuid (primary key)
          </List.Item>
          <List.Item>
            <Code>name</Code> — string (form name)
          </List.Item>
          <List.Item>
            <Code>target_collection</Code> — string (collection the form
            targets)
          </List.Item>
          <List.Item>
            <Code>key</Code> — string, nullable (optional form discriminator)
          </List.Item>
          <List.Item>
            <Code>definition</Code> — json (the form definition body)
          </List.Item>
        </List>
        <Text size="xs" c="dimmed">
          It must not be a <Code>daas_</Code>-prefixed system collection.
          {!canCreateCollection && ' Once created, reload this page.'}
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
              Create collection
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
