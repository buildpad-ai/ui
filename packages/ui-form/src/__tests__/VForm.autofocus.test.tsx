/**
 * Which field VForm elects for initial focus.
 *
 * The election used to be an index into `visibleFields` filtered by
 * `!meta.readonly` — a far weaker rule than the one enforced downstream by
 * `isFieldReadOnly`, and blind to permission-readonly rows, presentation rows
 * and group headers. It elected rows that then refused the flag, so on the
 * commonest schema shape (auto-increment `id` first) nothing was focused at
 * all, and a form whose fields lived inside a section could never focus.
 */
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

jest.mock('../components/interface-components', () =>
    require('./helpers/leafProbe').makeInterfacesMock());
jest.mock('@buildpad/utils', () => ({
    ...jest.requireActual('@buildpad/utils'),
    getFieldInterface: () => ({ type: 'input', props: {} }),
}));

import { received, resetProbe } from './helpers/leafProbe';
import { VForm } from '../VForm';

const field = (over: Record<string, unknown>): any => ({
    collection: 'articles',
    type: 'string',
    meta: { sort: 1 },
    schema: {},
    name: over.field,
    ...over,
});

const renderForm = (fields: any[]) =>
    render(
        <MantineProvider>
            <VForm fields={fields} autofocus enforcePermissions={false} />
        </MantineProvider>,
    );

/** Field keys the probe saw, in render order, that were told to autofocus. */
const focused = () =>
    received.map((r, i) => (r.autofocus ? i : -1)).filter((i) => i >= 0);

beforeEach(resetProbe);

describe('VForm — electing the field to autofocus', () => {
    it('skips an auto-increment primary key and focuses the first real field', () => {
        renderForm([
            field({ field: 'id', type: 'integer', schema: { has_auto_increment: true, is_primary_key: true } }),
            field({ field: 'title' }),
        ]);
        expect(focused()).toEqual([1]);
    });

    it('skips a field the schema declares readonly', () => {
        renderForm([
            field({ field: 'slug', meta: { sort: 1, readonly: true } }),
            field({ field: 'title' }),
        ]);
        expect(focused()).toEqual([1]);
    });

    it('elects exactly one field', () => {
        renderForm([
            field({ field: 'title' }),
            field({ field: 'body' }),
            field({ field: 'summary' }),
        ]);
        expect(focused()).toHaveLength(1);
        expect(focused()).toEqual([0]);
    });

    // Group rows are containers and can never take focus themselves; the
    // election has to descend into them or a sectioned form focuses nothing.
    it('descends into a section to focus its first child', () => {
        renderForm([
            field({ field: 'details', type: 'alias', meta: { sort: 1, special: ['group'] } }),
            field({ field: 'title', meta: { sort: 2, group: 'details' } }),
        ]);
        expect(focused()).toEqual([0]);
    });

    it('focuses nothing when the form has no editable field', () => {
        renderForm([
            field({ field: 'id', type: 'integer', schema: { has_auto_increment: true, is_primary_key: true } }),
            field({ field: 'slug', meta: { sort: 2, readonly: true } }),
        ]);
        expect(focused()).toEqual([]);
    });

    it('focuses nothing when autofocus is not requested', () => {
        render(
            <MantineProvider>
                <VForm fields={[field({ field: 'title' })]} enforcePermissions={false} />
            </MantineProvider>,
        );
        expect(focused()).toEqual([]);
    });
});
