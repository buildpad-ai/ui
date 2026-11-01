/**
 * getFormFields — the labels VForm renders for each field.
 */
import type { Field } from '@buildpad/types';
import { getFormFields } from '../utils/get-form-fields';

function field(name: string, meta: Partial<NonNullable<Field['meta']>> = {}): Field {
  return {
    collection: 'suppliers',
    field: name,
    type: meta.interface === 'presentation-divider' ? 'alias' : 'string',
    meta: { id: 1, collection: 'suppliers', field: name, readonly: false, hidden: false, ...meta },
  };
}

describe('getFormFields', () => {
  it('labels a field with meta.name before its column name', () => {
    const [labelled, plain] = getFormFields([
      field('company_name', { name: 'Company', sort: 1 }),
      field('website', { sort: 2 }),
    ]);

    expect(labelled.name).toBe('Company');
    expect(plain.name).toBe('Website');
  });

  it('hides the field label of a divider, which is its own heading', () => {
    const [divider, input] = getFormFields([
      field('details_heading', { interface: 'presentation-divider', options: { title: 'Details' }, sort: 1 }),
      field('website', { interface: 'input', sort: 2 }),
    ]);

    expect(divider.hideLabel).toBe(true);
    expect(input.hideLabel).toBeUndefined();
  });
});
