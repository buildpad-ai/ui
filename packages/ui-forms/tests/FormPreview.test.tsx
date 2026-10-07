/**
 * FormPreview — relational UI on the offline path.
 *
 * The offline (unbound) preview renders a standalone VForm, which supplies only
 * itself to relational fields. FormPreview wraps it in
 * CollectionsRelationalProvider so O2M / M2M / M2A fields in a draft keep their
 * create / select / edit dialogs. The bound path renders CollectionForm, which
 * supplies the same components itself.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Field, FormDefinition } from '@buildpad/types';
import type { RelationalUIComponents } from '@buildpad/services/relational-ui-context';

const { seen } = vi.hoisted(() => ({
  seen: { current: null as RelationalUIComponents | null },
}));

// VForm double that records the relational components in scope where the
// form's fields (and so any ListO2M / M2M / M2A) would render.
vi.mock('@buildpad/ui-form', async () => {
  const { useRelationalUI } = await import('@buildpad/services/relational-ui-context');
  return {
    VForm: function VForm() {
      seen.current = useRelationalUI();
      return <div data-testid="vform-probe" />;
    },
  };
});

// FormPreview takes CollectionForm and CollectionsRelationalProvider from the
// ui-collections barrel; serve them from the live source (CollectionForm's
// module re-exports the provider) instead of a possibly stale dist.
vi.mock('@buildpad/ui-collections', async () => await import('../../ui-collections/src/CollectionForm'));

import { FormPreview } from '../src/FormPreview';

const FIELDS: Field[] = [
  {
    collection: 'drafts',
    field: 'title',
    type: 'string',
    meta: { id: 1, collection: 'drafts', field: 'title', interface: 'input', hidden: false, readonly: false, required: false, width: 'full' },
  } as Field,
];

const OFFLINE: FormDefinition = {
  name: 'Draft',
  target_collection: '',
  sections: [{ id: 'main', title: 'Main', fields: [{ field: 'title' }] }],
} as FormDefinition;

beforeEach(() => {
  seen.current = null;
});

describe('FormPreview (offline)', () => {
  it('supplies CollectionForm, CollectionList and a form renderer to the standalone VForm', async () => {
    render(
      <MantineProvider>
        <FormPreview definition={OFFLINE} schemaFields={FIELDS} />
      </MantineProvider>,
    );
    await screen.findByTestId('vform-probe');

    expect(seen.current?.CollectionForm).toBeTruthy();
    expect(seen.current?.CollectionList).toBeTruthy();
    expect(seen.current?.FormRenderer).toBeTruthy();
  });
});
