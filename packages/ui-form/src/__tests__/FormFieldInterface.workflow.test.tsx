/**
 * FormFieldInterface — the workflow button is not locked by field-level locks.
 *
 * The state field of a workflow is meant to be locked against edits: the
 * Studio's wizard creates it `readonly`, and an update permission that leaves
 * it out of its field list makes it non-editable. Neither says anything about
 * who may run a transition — the command's policies and module access keys do,
 * on the server — so neither may make the button inert. The form-level
 * `disabled` still does.
 *
 * The button is also never wired to the form's onChange: what it reports is
 * the command it ran, not a value for the field.
 *
 * `xtr-interface-workflow` is the id a DaaS field carries; it is an alias of
 * `workflow-button`, and the exemption has to hold for both.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

jest.mock('../components/interface-components', () => require('./helpers/leafProbe').makeInterfacesMock());

import { resetProbe, lastProps, lastLockState } from './helpers/leafProbe';
import { FormFieldInterface } from '../components/FormFieldInterface';

const wrap = (ui: React.ReactNode) => <MantineProvider>{ui}</MantineProvider>;

const stateField = (iface: string) =>
    ({
        collection: 'purchase_requests',
        field: 'workflow_state',
        name: 'Workflow State',
        type: 'string',
        meta: { interface: iface, readonly: true },
        schema: {},
    }) as any;

const titleField = {
    collection: 'purchase_requests',
    field: 'title',
    name: 'Title',
    type: 'string',
    meta: { interface: 'input' },
    schema: {},
} as any;

beforeEach(() => {
    resetProbe();
});

describe.each(['workflow-button', 'xtr-interface-workflow'])('FormFieldInterface with a %s field', (iface) => {
    it('leaves the button active when the field is readonly', () => {
        render(wrap(<FormFieldInterface field={stateField(iface)} value="Draft" primaryKey={7} readonly />));

        expect(lastLockState()).toEqual({ disabled: false, readOnly: false });
    });

    it('leaves the button active when the field is non-editable for this user', () => {
        render(wrap(<FormFieldInterface field={stateField(iface)} value="Draft" primaryKey={7} nonEditable />));

        expect(lastLockState()).toEqual({ disabled: false, readOnly: false });
    });

    it('still turns the button off when the form is disabled', () => {
        render(wrap(<FormFieldInterface field={stateField(iface)} value="Draft" primaryKey={7} disabled />));

        expect(lastLockState()).toEqual({ disabled: true, readOnly: false });
    });

    it('never hands the button the form onChange, so a command name cannot become a field edit', () => {
        const onChange = jest.fn();
        render(wrap(<FormFieldInterface field={stateField(iface)} value="Draft" primaryKey={7} onChange={onChange} />));

        expect(lastProps()?.hasOnChange).toBe(false);
    });
});

describe('FormFieldInterface with an ordinary field', () => {
    it('is still locked by readonly and by nonEditable', () => {
        render(wrap(<FormFieldInterface field={titleField} value="x" readonly />));
        expect(lastLockState()).toEqual({ disabled: false, readOnly: true });

        render(wrap(<FormFieldInterface field={titleField} value="x" nonEditable />));
        expect(lastLockState()).toEqual({ disabled: true, readOnly: true });
    });
});
