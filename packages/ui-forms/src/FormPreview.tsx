/**
 * FormPreview
 *
 * Live preview of an in-memory (possibly unsaved) `FormDefinition` while it is
 * being authored in `FormBuilder`. Two modes:
 *
 * - **Bound** — the definition has a `target_collection`: render the true runtime
 *   via `CollectionForm` (real schema + permissions) against empty values, so
 *   layout, widths, sections, and conditional behaviour are faithful to the saved
 *   form.
 * - **Offline** — the auto-create flow, where no collection exists yet: render the
 *   builder's in-memory fields (incl. newly-added ones) directly through `VForm`
 *   using the same overlay merge (`buildFieldsFromDefinition`). No data load, no
 *   persistence, no permission checks — but conditions still evaluate live as the
 *   previewer changes values, so the preview works before the first save.
 *
 * Unlike `DynamicForm`, this takes the definition object directly rather than
 * loading it by id — the builder holds the draft in memory and the preview must
 * reflect unsaved edits.
 *
 * @package @buildpad/ui-forms
 */

'use client';

import { useMemo, useState } from 'react';
import { Alert, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { CollectionForm } from '@buildpad/ui-collections';
import { VForm } from '@buildpad/ui-form';
import { buildFieldsFromDefinition } from '@buildpad/utils';
import type { Field, FormDefinition } from '@buildpad/types';

export interface FormPreviewProps {
  /** The in-memory definition to preview (draft from the builder). */
  definition: FormDefinition;
  /**
   * The builder's current schema fields, including locally-synthesized fields
   * added before the target collection exists. Enables the **offline** preview
   * on the auto-create flow; ignored once a `target_collection` is bound.
   */
  schemaFields?: Field[];
}

/**
 * Render the draft definition as a non-persisting create-form preview.
 */
export function FormPreview({ definition, schemaFields = [] }: FormPreviewProps) {
  const hasFields = (definition.sections ?? []).some(
    (s) => (s.fields ?? []).length > 0,
  );

  // Offline preview state (used only when no target collection is bound yet).
  const [values, setValues] = useState<Record<string, unknown>>({});
  const offlineFields = useMemo(
    () => buildFieldsFromDefinition(schemaFields, definition),
    [schemaFields, definition],
  );

  if (!hasFields) {
    return (
      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        Add fields to a section to see a live preview.
      </Alert>
    );
  }

  // No target collection yet (auto-create): render the in-memory fields directly.
  if (!definition.target_collection) {
    return (
      <>
        <Text size="xs" c="dimmed" mb="xs">
          Preview — the new collection isn’t created yet, so this renders your
          in-progress fields. Conditions are live; submitting does nothing.
        </Text>
        <VForm
          fields={offlineFields}
          primaryKey="+"
          action="create"
          modelValue={values}
          onUpdate={setValues}
          enforcePermissions={false}
        />
      </>
    );
  }

  return (
    <>
      <Text size="xs" c="dimmed" mb="xs">
        Preview — submitting here does not create a record.
      </Text>
      {/* `key` forces a fresh mount when the target collection changes so the
          schema is re-loaded; the definition signature itself drives the
          in-place overlay refresh inside CollectionForm. */}
      <CollectionForm
        key={definition.target_collection}
        collection={definition.target_collection}
        definition={definition}
        mode="create"
        persist={false}
        onCancel={undefined}
      />
    </>
  );
}

export default FormPreview;
