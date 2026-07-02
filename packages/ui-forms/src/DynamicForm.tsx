/**
 * DynamicForm
 *
 * Runtime renderer for the Dynamic Form Builder. Loads a saved
 * `FormDefinition` by id (via `useFormDefinitions`) and renders the existing
 * `CollectionForm` with the definition overlaid onto the target collection's
 * live schema — reusing all existing rendering, validation, M2M handling,
 * permission enforcement, and condition evaluation unchanged.
 *
 * Used by both the fill page and `FormPreview`. For a scope-enabled target
 * collection the active scope URI (read from the `daas_resource_uri` cookie)
 * is passed as a create-time default value so the new item lands in the
 * correct tenant scope — unless DaaS permission presets already inject it
 * (presets remain authoritative; the default only fills an otherwise-empty
 * scope field on create).
 *
 * @package @buildpad/ui-forms
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Center, Loader, Paper } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { CollectionForm } from '@buildpad/ui-collections';
import { useFormDefinitions } from '@buildpad/hooks';
import type { FormDefinition } from '@buildpad/types';

export interface DynamicFormProps {
  /** Item id of the saved definition in the definitions collection. */
  definitionId: string | number;
  /** Definitions collection name (default `fb_definitions`). */
  formsCollection?: string;
  /** Target-collection item id — switches the form to edit mode when provided. */
  itemId?: string | number;
  /** Called after a successful create/update. */
  onSuccess?: (data?: Record<string, unknown>) => void;
  /** Called when the form is cancelled. */
  onCancel?: () => void;
  /**
   * Field on the target collection that holds the scope URI when it is
   * scope-enabled. The active scope is injected here as a create-time default.
   * Default `'resource_uri'`.
   */
  scopeField?: string;
  /**
   * Inject the active scope URI as a create-time default on the target
   * collection (no-op when no active scope is set). Default `true`.
   */
  injectActiveScope?: boolean;
}

/** Read the active scope URI from the `daas_resource_uri` cookie (browser only). */
function readActiveScopeUri(): string | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie
    .split('; ')
    .find((row) => row.startsWith('daas_resource_uri='))
    ?.split('=')[1];
  return raw ? decodeURIComponent(raw) : null;
}

/**
 * Render a saved form definition as a live create/edit form.
 */
export function DynamicForm({
  definitionId,
  formsCollection,
  itemId,
  onSuccess,
  onCancel,
  scopeField = 'resource_uri',
  injectActiveScope = true,
}: DynamicFormProps) {
  const { get } = useFormDefinitions(formsCollection);
  const [definition, setDefinition] = useState<FormDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    get(definitionId)
      .then((def) => {
        if (!cancelled) setDefinition(def);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load form definition',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `get` is stable per formsCollection; re-run only when the id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definitionId, formsCollection]);

  // Create-time scope default (no-op in edit mode or when no active scope).
  const defaultValues = useMemo<Record<string, unknown> | undefined>(() => {
    if (itemId != null || !injectActiveScope) return undefined;
    const scope = readActiveScopeUri();
    return scope ? { [scopeField]: scope } : undefined;
  }, [itemId, injectActiveScope, scopeField]);

  if (loading) {
    return (
      <Paper p="md" mih={200} pos="relative">
        <Center mih={160}>
          <Loader />
        </Center>
      </Paper>
    );
  }

  if (error || !definition) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        color="red"
        title="Could not load form"
      >
        {error ?? 'Form definition not found.'}
      </Alert>
    );
  }

  return (
    <CollectionForm
      collection={definition.target_collection}
      definition={definition}
      id={itemId}
      mode={itemId != null ? 'edit' : 'create'}
      defaultValues={defaultValues}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  );
}

export default DynamicForm;
