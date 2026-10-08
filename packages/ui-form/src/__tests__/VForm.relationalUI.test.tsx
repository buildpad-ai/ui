/**
 * VForm supplies itself as the relational `FormRenderer` slot to the fields it
 * renders (ListM2A's JunctionItemForm renders nested forms with it), merged
 * with any provider above — and never overrides a renderer an app chose.
 */
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import {
    RelationalUIProvider,
    type RelationalUIComponents,
} from '@buildpad/services/relational-ui-context';

const mockSeen: { current: RelationalUIComponents | null } = { current: null };

jest.mock('../components/interface-components', () => {
    const { useRelationalUI } = jest.requireActual('@buildpad/services/relational-ui-context');
    // The leaf a field renders: record the relational components in scope.
    const Leaf = () => {
        mockSeen.current = useRelationalUI();
        return null;
    };
    return { getInterfaceComponent: () => Leaf, loadInstalledInterfaceComponent: () => Promise.resolve(null) };
});
jest.mock('@buildpad/utils', () => ({
    ...jest.requireActual('@buildpad/utils'),
    getFieldInterface: () => ({ type: 'input', props: {} }),
}));

import { VForm } from '../VForm';

const FIELDS: any[] = [
    { field: 'title', collection: 'articles', type: 'string', meta: { sort: 1 }, schema: {} },
];

beforeEach(() => {
    mockSeen.current = null;
});

describe('VForm — relational UI context', () => {
    it('supplies VForm as the FormRenderer to its fields', () => {
        render(
            <MantineProvider>
                <VForm fields={FIELDS} />
            </MantineProvider>,
        );
        expect(mockSeen.current?.FormRenderer).toBe(VForm);
        expect(mockSeen.current?.CollectionForm).toBeUndefined();
    });

    it('merges with a provider above and keeps its choices', () => {
        const AppForm = () => null;
        const AppRenderer = () => null;
        render(
            <MantineProvider>
                <RelationalUIProvider components={{ CollectionForm: AppForm, FormRenderer: AppRenderer }}>
                    <VForm fields={FIELDS} />
                </RelationalUIProvider>
            </MantineProvider>,
        );
        expect(mockSeen.current?.CollectionForm).toBe(AppForm);
        expect(mockSeen.current?.FormRenderer).toBe(AppRenderer);
    });
});
