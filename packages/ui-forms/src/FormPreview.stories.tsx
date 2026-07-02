/**
 * FormPreview — rendering proof for the provisionable interface catalog.
 *
 * Renders EVERY interface in `PROVISIONABLE_INTERFACES` (the type-aware "Add
 * field" catalog) through the offline preview path (`FormPreview` with no
 * `target_collection` → `VForm` + `buildFieldsFromDefinition`, no DaaS). Every
 * interface renders through `@buildpad/ui-interfaces`; the ones needing extra
 * libraries (rich text → `@mantine/tiptap`+`@tiptap/*`, block editor →
 * `@editorjs/*`, map → `maplibre-gl`) are declared as `@buildpad/ui-forms` peer
 * deps, so if any failed to resolve it would surface its error boundary here —
 * making this story the visual proof that every offered field type renders.
 *
 * @package @buildpad/ui-forms
 */

import type { Meta, StoryObj } from '@storybook/react';
import { Paper, Text } from '@mantine/core';
import { PROVISIONABLE_INTERFACES } from '@buildpad/utils';
import type { Field, FormDefinition } from '@buildpad/types';
import { FormPreview } from './FormPreview';

/** Interfaces that need an author-supplied choices list to render meaningfully. */
const CHOICE_INTERFACES = new Set([
  'select-dropdown',
  'select-radio',
  'select-multiple-checkbox',
  'select-multiple-dropdown',
]);

const SAMPLE_CHOICES = [
  { text: 'Low', value: 'low' },
  { text: 'Medium', value: 'medium' },
  { text: 'High', value: 'high' },
];

/** A field key for an interface id (snake_case, collision-free). */
const keyFor = (interfaceId: string) => interfaceId.replace(/-/g, '_');

/** Synthesize one builder-side `Field` per provisionable interface. */
const previewFields: Field[] = PROVISIONABLE_INTERFACES.map((i) => {
  const field = keyFor(i.value);
  return {
    collection: '__preview__',
    field,
    type: i.types[0],
    meta: {
      id: -1,
      collection: '__preview__',
      field,
      interface: i.value,
      note: `${i.label} — ${i.value} (${i.types[0]})`,
      width: 'full',
      options: CHOICE_INTERFACES.has(i.value) ? { choices: SAMPLE_CHOICES } : null,
    },
  } as Field;
});

/** A definition placing every provisionable interface in one section. */
const allInterfacesDefinition: FormDefinition = {
  name: 'All provisionable interfaces',
  target_collection: '', // empty → offline preview (no DaaS)
  sections: [
    {
      id: 'all',
      title: 'All provisionable interfaces',
      fields: previewFields.map((f) => ({ field: f.field })),
    },
  ],
};

const meta: Meta<typeof FormPreview> = {
  title: 'Forms/FormPreview',
  component: FormPreview,
  tags: ['!autodocs'],
  parameters: { layout: 'padded' },
};

export default meta;

/**
 * Proof that every interface offered by the "Add field" catalog renders. Each
 * row is labelled with its interface id + backing type. No field should show an
 * error boundary.
 */
export const AllProvisionableInterfaces: StoryObj<typeof FormPreview> = {
  render: () => (
    <Paper p="md" withBorder maw={720}>
      <Text size="sm" fw={600} mb="xs">
        {PROVISIONABLE_INTERFACES.length} provisionable interfaces — all should
        render (no error boundaries):
      </Text>
      <FormPreview
        definition={allInterfacesDefinition}
        schemaFields={previewFields}
      />
    </Paper>
  ),
};
