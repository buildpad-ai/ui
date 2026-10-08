/**
 * FormFieldInterface — `data-testid` propagation.
 *
 * Regression coverage: FormFieldInterface never included a `data-testid` in
 * the props it hands the resolved leaf component, even though several leaves
 * (InputHash, SystemToken, ...) already accept and forward it, deriving their
 * own sub-ids (`${testId}-generate`, `${testId}-container`, ...). Every
 * `getByTestId('field-<name>')` in a consuming app's E2E suite therefore
 * resolved to nothing — see buildpad-daas's tests/ui/password-interface.spec.ts
 * and tests/ui/static-token.spec.ts, both of which had to skip entirely
 * because `field-password` / `field-token-generate` / `field-token-container`
 * never existed in the DOM.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

jest.mock('../components/interface-components', () => require('./helpers/leafProbe').makeInterfacesMock());

const interfaceProps: { props: Record<string, unknown> } = { props: {} };
jest.mock('@buildpad/utils', () => ({
    ...jest.requireActual('@buildpad/utils'),
    getFieldInterface: () => ({ type: 'input', props: interfaceProps.props }),
}));

import { resetProbe, lastProps } from './helpers/leafProbe';
import { FormFieldInterface } from '../components/FormFieldInterface';

const wrap = (ui: React.ReactNode) => <MantineProvider>{ui}</MantineProvider>;

const baseField = {
    collection: 'daas_users',
    field: 'password',
    name: 'Password',
    type: 'hash',
    meta: {},
    schema: {},
} as any;

beforeEach(() => {
    resetProbe();
    interfaceProps.props = {};
    jest.clearAllMocks();
});

describe('FormFieldInterface data-testid propagation', () => {
    it("passes 'field-<fieldName>' as data-testid to the resolved leaf", () => {
        render(wrap(<FormFieldInterface field={baseField} value={null} />));

        expect(lastProps()?.dataTestId).toBe('field-password');
    });

    it('derives the testid from the field name for a different field', () => {
        render(
            wrap(
                <FormFieldInterface
                    field={{ ...baseField, field: 'token', type: 'string' }}
                    value={null}
                />,
            ),
        );

        expect(lastProps()?.dataTestId).toBe('field-token');
    });

    it('does not let admin-authored meta.options override the container testid', () => {
        interfaceProps.props = { 'data-testid': 'attacker-controlled' };

        render(wrap(<FormFieldInterface field={baseField} value={null} />));

        expect(lastProps()?.dataTestId).toBe('field-password');
    });
});
