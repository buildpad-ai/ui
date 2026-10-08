/**
 * Secret fields (`hash` / `conceal`) — what the container hands the leaf.
 *
 * DaaS never returns a stored secret. Its read transformer sends a run of
 * asterisks when a value exists, `null` when the column is empty, and omits
 * write-only columns entirely. Three states the UI has to tell apart, and the
 * mask is only ever a display: it must never be synthesized for a record that
 * does not exist yet, never be shown for a field a text interface renders, and
 * never survive as the value a leaf could submit.
 *
 * Exercised through FormField, not FormFieldInterface alone — half the
 * decision (which fields forward the omitted signal, and that a column default
 * must not outrank it) lives there.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

jest.mock('../components/interface-components', () =>
    require('./helpers/leafProbe').makeInterfacesMock());

jest.mock('@buildpad/utils', () => ({
    // Spread the real module: only the interface resolution is stubbed here,
    // and blanking the rest hides every other util the component calls.
    ...jest.requireActual('@buildpad/utils'),
    getFieldInterface: (field: any) => ({ type: field.meta?.interface, props: {} }),
}));

import { received, resetProbe, lastProps } from './helpers/leafProbe';
import { FormField } from '../components/FormField';
import { FormFieldInterface } from '../components/FormFieldInterface';

const wrap = (ui: React.ReactNode) => <MantineProvider>{ui}</MantineProvider>;

const MASK = '**********';
const EXISTING = 'abc-123';

const field = (over: Record<string, any> = {}): any => ({
    collection: 'daas_users',
    field: 'token',
    name: 'Token',
    type: 'string',
    meta: { interface: 'system-token', special: ['conceal'] },
    schema: {},
    ...over,
});

const password = (over: Record<string, any> = {}): any =>
    field({
        field: 'password',
        name: 'Password',
        type: 'hash',
        meta: { interface: 'input-hash', special: ['hash'] },
        ...over,
    });

beforeEach(resetProbe);

describe('FormFieldInterface — conceal value synthesis', () => {
    it('passes an explicit null straight through for a conceal field (no token set)', () => {
        render(wrap(<FormFieldInterface field={field()} value={null} primaryKey={EXISTING} />));
        expect(lastProps()?.value).toBeNull();
    });

    it('passes the masked value straight through for a conceal field (token set)', () => {
        render(wrap(<FormFieldInterface field={field()} value={MASK} primaryKey={EXISTING} />));
        expect(lastProps()?.value).toBe(MASK);
    });

    it('synthesizes the masked placeholder when a conceal field is omitted entirely', () => {
        render(wrap(<FormFieldInterface field={field()} value={undefined} primaryKey={EXISTING} />));
        expect(lastProps()?.value).toBe(MASK);
    });

    // A hash column is never round-tripped on read, so the only producer of
    // null is the leaf itself when the user types and then erases. That must
    // not read as "the stored credential is gone".
    it.each([undefined, null])(
        'keeps an existing hash field masked when the value is %p',
        (value) => {
            render(wrap(<FormFieldInterface field={password()} value={value} primaryKey={EXISTING} />));
            expect(lastProps()?.value).toBe(MASK);
        },
    );

    // A record that does not exist yet cannot have a stored secret.
    it.each([
        ['conceal', field()],
        ['hash', password()],
    ])('never claims a stored secret on a new %s record', (_name, f) => {
        render(wrap(<FormFieldInterface field={f} value={undefined} primaryKey="+" />));
        expect(lastProps()?.value).toBeNull();
    });

    // A text interface would render the mask as typeable text the user could
    // submit as their password.
    it.each([
        ['conceal on input', field({ meta: { interface: 'input', special: ['conceal'] } })],
        ['conceal on textarea', field({ meta: { interface: 'input-multiline', special: ['conceal'] } })],
        ['hash on input', password({ meta: { interface: 'input', special: ['hash'] } })],
    ])('renders no mask for %s, and never hands the leaf undefined', (_name, f) => {
        render(wrap(<FormFieldInterface field={f} value={undefined} primaryKey={EXISTING} />));
        expect(lastProps()?.value).toBeNull();
    });
});

describe('FormField — the omitted signal', () => {
    it('forwards omission for a secret field so the mask can be synthesized', () => {
        render(wrap(<FormField field={field()} value={undefined} primaryKey={EXISTING} />));
        expect(lastProps()?.value).toBe(MASK);
    });

    // A DDL default on a secret column is not the secret. Taking that branch
    // first rendered the literal default as "Value securely stored" and would
    // have submitted it as the credential.
    it.each([
        ["'changeme'::character varying", password()],
        ["''::text", field()],
    ])('does not let a column default stand in for the secret (%s)', (defaultValue, f) => {
        const withDefault = { ...f, schema: { default_value: defaultValue } };
        render(wrap(<FormField field={withDefault} value={undefined} primaryKey={EXISTING} />));
        expect(lastProps()?.value).toBe(MASK);
    });

    // Non-secret fields keep the ordinary default behaviour.
    it('still applies a column default to an ordinary field', () => {
        const plain = field({
            field: 'status',
            type: 'string',
            meta: { interface: 'input' },
            schema: { default_value: "'active'::character varying" },
        });
        render(wrap(<FormField field={plain} value={undefined} primaryKey={EXISTING} />));
        expect(lastProps()?.value).toBe('active');
    });

    it('leaves a secret field on a text interface as null, never undefined', () => {
        const f = field({ meta: { interface: 'input', special: ['conceal'] } });
        render(wrap(<FormField field={f} value={undefined} primaryKey={EXISTING} />));
        expect(lastProps()?.value).toBeNull();
        expect(received.at(-1)).toHaveProperty('value', null);
    });
});
