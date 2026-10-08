/**
 * FormFieldInterface — readonly-vs-disabled styling (S2.6).
 *
 * `readonly` and `disabled` are visually and semantically distinct: readonly
 * means the value is visible but not editable; disabled means the control is
 * greyed out and inert. A merely-readonly field must not also receive
 * disabled=true. `nonEditable` is stronger (no interaction at all) and keeps
 * disabled on top of readOnly.
 *
 * Because `disabled` is no longer the write block for a readonly field, this
 * file also pins the container-level guards that replace it: onChange
 * suppression, `required`/`autofocus`, and the meta.options override order.
 *
 * Scope note: these tests drive the `readonly` PROP. For the production path —
 * `field.meta.readonly` flowing through FormField — see
 * FormField.readonlyRouting.test.tsx. For the leaves actually honouring
 * `readOnly`, see ui-interfaces/src/__tests__/readonly-contract.test.tsx.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

jest.mock('../components/interface-components', () => require('./helpers/leafProbe').makeInterfacesMock());

const interfaceProps: { props: Record<string, unknown> } = { props: {} };
jest.mock('@buildpad/utils', () => ({
    // Spread the real module: only the interface resolution is stubbed here,
    // and blanking the rest hides every other util the component calls.
    ...jest.requireActual('@buildpad/utils'),
    getFieldInterface: () => ({ type: 'input', props: interfaceProps.props }),
}));

import { resetProbe, lastProps, lastLockState } from './helpers/leafProbe';
import { FormFieldInterface } from '../components/FormFieldInterface';

const wrap = (ui: React.ReactNode) => <MantineProvider>{ui}</MantineProvider>;

const baseField = {
    collection: 'articles',
    field: 'title',
    name: 'Title',
    type: 'string',
    meta: {},
    schema: {},
} as any;

beforeEach(() => {
    resetProbe();
    interfaceProps.props = {};
    jest.clearAllMocks();
});

describe('FormFieldInterface readonly-vs-disabled (S2.6)', () => {
    it('does not set disabled when only readonly is true', () => {
        render(wrap(<FormFieldInterface field={baseField} value="x" readonly />));

        expect(lastLockState()).toEqual({ disabled: false, readOnly: true });
    });

    it('still sets disabled when the disabled prop is explicitly passed', () => {
        render(wrap(<FormFieldInterface field={baseField} value="x" disabled />));

        expect(lastLockState()).toEqual({ disabled: true, readOnly: false });
    });

    it('sets both disabled and readOnly when nonEditable', () => {
        render(wrap(<FormFieldInterface field={baseField} value="x" nonEditable />));

        expect(lastLockState()).toEqual({ disabled: true, readOnly: true });
    });

    it('sets neither when the field is fully editable', () => {
        render(wrap(<FormFieldInterface field={baseField} value="x" />));

        expect(lastLockState()).toEqual({ disabled: false, readOnly: false });
    });
});

describe('FormFieldInterface locked-field guards', () => {
    it('withholds onChange for a merely-readonly field', () => {
        const onChange = jest.fn();
        const { getByTestId } = render(
            wrap(<FormFieldInterface field={baseField} value="x" readonly onChange={onChange} />),
        );

        expect(lastProps()?.hasOnChange).toBe(false);

        fireEvent.change(getByTestId('probe'), { target: { value: 'injected' } });
        expect(onChange).not.toHaveBeenCalled();
    });

    it('forwards onChange for an editable field', () => {
        const onChange = jest.fn();
        render(wrap(<FormFieldInterface field={baseField} value="x" onChange={onChange} />));

        expect(lastProps()?.hasOnChange).toBe(true);
    });

    it('drops required and autofocus on a readonly field', () => {
        render(wrap(<FormFieldInterface field={baseField} value="x" readonly required autofocus />));

        expect(lastProps()?.required).toBe(false);
        expect(lastProps()?.autofocus).toBe(false);
    });

    it('keeps required and autofocus on an editable field', () => {
        render(wrap(<FormFieldInterface field={baseField} value="x" required autofocus />));

        expect(lastProps()?.required).toBe(true);
        expect(lastProps()?.autofocus).toBe(true);
    });

    it('does not let meta.options unlock a readonly field', () => {
        // meta.options flows into interfaceConfig.props unfiltered, so the lock
        // props must be re-asserted after that spread.
        interfaceProps.props = { readOnly: false, disabled: false, onChange: jest.fn() };

        const onChange = jest.fn();
        render(wrap(<FormFieldInterface field={baseField} value="x" readonly onChange={onChange} />));

        expect(lastProps()?.readOnly).toBe(true);
        expect(lastProps()?.hasOnChange).toBe(false);
    });

    it('does not let meta.options unlock a nonEditable field', () => {
        interfaceProps.props = { readOnly: false, disabled: false };

        render(wrap(<FormFieldInterface field={baseField} value="x" nonEditable />));

        expect(lastLockState()).toEqual({ disabled: true, readOnly: true });
    });

    // The focus and required suppressions are the container's decision too,
    // and both sat ABOVE the meta.options spread — so an admin-authored
    // `autofocus: true` on a locked field defeated "never steal initial focus
    // into a field that cannot be edited", and a readonly input is focusable.
    it.each([
        ['autofocus', 'autofocus'],
        ['required', 'required'],
    ])('does not let meta.options re-enable %s on a readonly field', (_name, key) => {
        interfaceProps.props = { [key]: true };
        render(
            wrap(
                <FormFieldInterface
                    field={{ ...baseField, meta: { ...baseField.meta, interface: 'input' } } as any}
                    value=""
                    readonly
                />,
            ),
        );
        expect(lastProps()?.[key as 'autofocus' | 'required']).toBe(false);
        interfaceProps.props = {};
    });

    // Admin-authored options JSON reaches the leaf unfiltered, so anything the
    // container owns must be declared after that spread. The accessible name
    // is the container's: FormField withholds `label` and relies on it.
    it('does not let meta.options override the accessible name', () => {
        interfaceProps.props = { 'aria-label': 'FROM-OPTIONS' };
        render(
            wrap(
                <FormFieldInterface
                    field={{ ...baseField, meta: { ...baseField.meta, interface: 'input' } } as any}
                    value=""
                />,
            ),
        );
        expect(lastProps()?.ariaLabel).toBe('Title');
        interfaceProps.props = {};
    });
});
