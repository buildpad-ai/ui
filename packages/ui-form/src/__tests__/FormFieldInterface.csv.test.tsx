/**
 * FormFieldInterface — csv-string/array normalization for multi-select
 * interfaces.
 *
 * Multi-select interfaces are registered for both `json` (array) and `csv`
 * (comma-string) storage, but the leaves are array-only. The pipeline must
 * coerce a csv string to an array on the way in and back to a comma-string
 * on the way out — including for fields whose backend reports the physical
 * column type (e.g. `text`) instead of `csv`, detected by observing a
 * string value.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

// Probe leaf: records the value prop it receives and emits a fixed array on
// click, exactly like the real multi-select leaves (which always emit arrays).
const received: { value: unknown; readOnly?: boolean }[] = [];
// Defined inside the factory: it is *called* at factory time (unlike `received`,
// which is only touched when a probe renders), so a module-scope binding would
// still be in its temporal dead zone here.
jest.mock('../components/interface-components', () => {
    const Probe = ({ value, onChange, readOnly }: any) => {
        received.push({ value, readOnly });
        return (
            <button data-testid="probe-emit" onClick={() => onChange?.(['a', 'b'])}>
                emit
            </button>
        );
    };
    return {
        getInterfaceComponent: () => Probe,
        loadInstalledInterfaceComponent: () => Promise.resolve(null),
    };
});

// Which interface id getFieldInterface resolves to, so the same assertions can
// be run against each multi-select leaf.
const resolved = { type: 'select-multiple-checkbox' };
jest.mock('@buildpad/utils', () => ({
    // Spread the real module: only the interface resolution is stubbed here,
    // and blanking the rest hides every other util the component calls.
    ...jest.requireActual('@buildpad/utils'),
    getFieldInterface: () => ({ type: resolved.type, props: {} }),
}));

import { FormFieldInterface } from '../components/FormFieldInterface';

const wrap = (ui: React.ReactNode) => <MantineProvider>{ui}</MantineProvider>;

const baseField = {
    collection: 'articles',
    field: 'tags',
    name: 'Tags',
    meta: {},
    schema: {},
} as any;

beforeEach(() => {
    received.length = 0;
    resolved.type = 'select-multiple-checkbox';
    jest.clearAllMocks();
});

describe('FormFieldInterface csv normalization', () => {
    it('delivers a csv string to the leaf as a trimmed array', () => {
        render(
            wrap(
                <FormFieldInterface
                    field={{ ...baseField, type: 'csv' }}
                    value="alpha, beta ,gamma"
                />,
            ),
        );

        expect(received.at(-1)?.value).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('joins the leaf-emitted array back to a comma-string for csv fields', () => {
        const onChange = jest.fn();
        render(
            wrap(
                <FormFieldInterface
                    field={{ ...baseField, type: 'csv' }}
                    value="alpha"
                    onChange={onChange}
                />,
            ),
        );

        fireEvent.click(screen.getByTestId('probe-emit'));
        expect(onChange).toHaveBeenCalledWith('a,b');
    });

    it('round-trips string storage even when the field type is reported as text', () => {
        const onChange = jest.fn();
        render(
            wrap(
                <FormFieldInterface
                    field={{ ...baseField, type: 'text' }}
                    value="x,y"
                    onChange={onChange}
                />,
            ),
        );

        expect(received.at(-1)?.value).toEqual(['x', 'y']);
        fireEvent.click(screen.getByTestId('probe-emit'));
        expect(onChange).toHaveBeenCalledWith('a,b');
    });

    it('passes real arrays through untouched for json fields, in and out', () => {
        const onChange = jest.fn();
        render(
            wrap(
                <FormFieldInterface
                    field={{ ...baseField, type: 'json' }}
                    value={['x']}
                    onChange={onChange}
                />,
            ),
        );

        expect(received.at(-1)?.value).toEqual(['x']);
        fireEvent.click(screen.getByTestId('probe-emit'));
        expect(onChange).toHaveBeenCalledWith(['a', 'b']);
    });
});

/**
 * The normalization above is keyed off the manifest's `csvMultiValue` flag, and every
 * assertion in the block above resolves to `select-multiple-checkbox`. Nothing
 * pinned the other two members, so dropping the flag from one silently
 * reintroduced substring reads, a `.filter is not a function` crash and array
 * writes into a comma-string column, with a fully green suite.
 */
describe.each([
    'select-multiple-checkbox-tree',
    'select-multiple-dropdown',
])('FormFieldInterface csv normalization — %s', (interfaceType) => {
    it('carries the csvMultiValue flag: csv in, comma-string out', () => {
        resolved.type = interfaceType;
        const onChange = jest.fn();
        render(
            wrap(
                <FormFieldInterface
                    field={{ ...baseField, type: 'csv' }}
                    value="alpha, beta"
                    onChange={onChange}
                />,
            ),
        );

        expect(received.at(-1)?.value).toEqual(['alpha', 'beta']);
        fireEvent.click(screen.getByTestId('probe-emit'));
        expect(onChange).toHaveBeenCalledWith('a,b');
    });
});

describe('FormFieldInterface readOnly forwarding', () => {
    it('forwards readonly state under the camelCase prop the leaves consume', () => {
        render(
            wrap(
                <FormFieldInterface
                    field={{ ...baseField, type: 'json' }}
                    value={['x']}
                    readonly
                />,
            ),
        );

        expect((received.at(-1) as { value: unknown; readOnly?: boolean }).readOnly).toBe(true);
    });
});
