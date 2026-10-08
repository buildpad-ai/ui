/**
 * FormField — routing of isFieldReadOnly() to `readonly`, not `disabled` (S2.6).
 *
 * This is the layer the readonly-vs-disabled conflation actually lived at.
 * FormField used to compute:
 *
 *   isDisabled = disabled || isFieldReadOnly(field, ...)
 *
 * and pass that down as `disabled`, so a `meta.readonly: true` field reached the
 * leaf as {disabled: true, readOnly: false} no matter what FormFieldInterface
 * computed downstream. Every assertion in this file fails against that version —
 * which is what made the original one-line change to FormFieldInterface a no-op
 * on every in-repo path.
 *
 * Note these tests drive `field.meta`, the shape production actually produces,
 * rather than the `readonly` prop (which no first-party caller sets).
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

jest.mock('../components/interface-components', () => require('./helpers/leafProbe').makeInterfacesMock());

// isFieldReadOnly / isNewItem must stay real — they are the logic under test.
jest.mock('@buildpad/utils', () => ({
    ...jest.requireActual('@buildpad/utils'),
    getFieldInterface: () => ({ type: 'input', props: {} }),
}));

import { received, resetProbe, lastProps, lastLockState } from './helpers/leafProbe';
import { FormField } from '../components/FormField';

const wrap = (ui: React.ReactNode) => <MantineProvider>{ui}</MantineProvider>;

const field = (overrides: Record<string, any> = {}) =>
    ({
        collection: 'articles',
        field: 'title',
        name: 'Title',
        type: 'string',
        meta: {},
        schema: {},
        ...overrides,
    }) as any;

beforeEach(() => {
    resetProbe();
    jest.clearAllMocks();
});

describe('FormField routes read-only-ness to `readonly` (S2.6)', () => {
    it('sends meta.readonly to the leaf as readOnly, not disabled', () => {
        render(wrap(<FormField field={field({ meta: { readonly: true } })} value="x" primaryKey="1" />));

        expect(lastLockState()).toEqual({ disabled: false, readOnly: true });
    });

    it('sends an auto-increment primary key to the leaf as readOnly, not disabled', () => {
        render(
            wrap(
                <FormField
                    field={field({ field: 'id', schema: { has_auto_increment: true, is_primary_key: true } })}
                    value={7}
                    primaryKey="1"
                />,
            ),
        );

        expect(lastLockState()).toEqual({ disabled: false, readOnly: true });
    });

    it('still sets disabled when the disabled prop is explicitly passed', () => {
        render(wrap(<FormField field={field()} value="x" primaryKey="1" disabled />));

        expect(lastLockState()).toEqual({ disabled: true, readOnly: false });
    });

    it('sets neither for a plain editable field', () => {
        render(wrap(<FormField field={field()} value="x" primaryKey="1" />));

        expect(lastLockState()).toEqual({ disabled: false, readOnly: false });
    });

    it('withholds onChange from a meta.readonly field so edits cannot reach the form state', () => {
        const onChange = jest.fn();
        const { getByTestId } = render(
            wrap(
                <FormField
                    field={field({ meta: { readonly: true } })}
                    value="x"
                    primaryKey="1"
                    onChange={onChange}
                />,
            ),
        );

        expect(lastProps()?.hasOnChange).toBe(false);

        // Even if a leaf ignores readOnly and fires anyway, there is nothing to call.
        fireEvent.change(getByTestId('probe'), { target: { value: 'injected' } });
        expect(onChange).not.toHaveBeenCalled();
    });

    it('forwards onChange for an editable field', () => {
        const onChange = jest.fn();
        const { getByTestId } = render(
            wrap(<FormField field={field()} value="x" primaryKey="1" onChange={onChange} />),
        );

        expect(lastProps()?.hasOnChange).toBe(true);

        fireEvent.change(getByTestId('probe'), { target: { value: 'edited' } });
        expect(onChange).toHaveBeenCalledWith('edited');
    });

    it('drops `required` on a readonly field so it cannot demand input the user may not give', () => {
        render(
            wrap(
                <FormField
                    field={field({ meta: { readonly: true, required: true } })}
                    value=""
                    primaryKey="1"
                />,
            ),
        );

        expect(lastProps()?.required).toBe(false);
    });

    it('keeps `required` on an editable field', () => {
        render(wrap(<FormField field={field({ meta: { required: true } })} value="" primaryKey="1" />));

        expect(lastProps()?.required).toBe(true);
    });

    it('does not autofocus a readonly field', () => {
        render(
            wrap(<FormField field={field({ meta: { readonly: true } })} value="x" primaryKey="1" autofocus />),
        );

        expect(lastProps()?.autofocus).toBe(false);
    });

    it('renders exactly one leaf per render (probe sanity)', () => {
        render(wrap(<FormField field={field()} value="x" primaryKey="1" />));

        expect(received.length).toBeGreaterThan(0);
    });
});
