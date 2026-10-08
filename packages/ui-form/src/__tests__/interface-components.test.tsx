/**
 * components/interface-components, unmocked: the tables against the interface
 * manifest, and one real field of each loading kind through FormFieldInterface.
 *
 * packages/cli/tests/interface-tables.test.ts checks the same tables as an
 * installed project sees them (import paths, registry dependencies).
 */
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { INTERFACE_MANIFEST, type InterfaceManifestEntry } from '@buildpad/utils';

// The components barrel, which only the on-demand lookup imports (the tables
// import each interface's own module). Stubbed: the real one pulls in every
// interface, ESM-only editor dependencies included.
const mockSystemPermissions = () => null;
jest.mock('@buildpad/ui-interfaces', () => ({ SystemPermissions: mockSystemPermissions }));

import {
    EAGER_INTERFACE_COMPONENTS,
    LAZY_INTERFACE_COMPONENTS,
    getInterfaceComponent,
    loadInstalledInterfaceComponent,
} from '../components/interface-components';
import { FormFieldInterface } from '../components/FormFieldInterface';

const entries: readonly InterfaceManifestEntry[] = INTERFACE_MANIFEST;
const exportNames = (loading: (l: string) => boolean) =>
    [...new Set(entries.flatMap((e) => (e.renders && loading(e.loading) ? [e.exportName] : [])))].sort();

describe('interface-components tables', () => {
    it('the eager table is the manifest entries that load with the form', () => {
        expect(Object.keys(EAGER_INTERFACE_COMPONENTS).sort()).toEqual(exportNames((l) => l === 'eager'));
    });

    it('the lazy table is the on-demand manifest entries, except the one vform does not install', () => {
        expect([...Object.keys(LAZY_INTERFACE_COMPONENTS), 'SystemPermissions'].sort()).toEqual(
            exportNames((l) => l !== 'eager'),
        );
    });

    it('only finds names a table has as its own key', () => {
        expect(getInterfaceComponent('Input')).toBe(EAGER_INTERFACE_COMPONENTS.Input);
        expect(getInterfaceComponent('Map')).toBe(LAZY_INTERFACE_COMPONENTS.Map);
        expect(getInterfaceComponent('SystemPermissions')).toBeUndefined();
        expect(getInterfaceComponent('constructor')).toBeUndefined();
        expect(getInterfaceComponent('__proto__')).toBeUndefined();
    });

    it('finds a component the tables lack in the components barrel, and null for an unknown name', async () => {
        expect(await loadInstalledInterfaceComponent('SystemPermissions')).toBe(mockSystemPermissions);
        expect(await loadInstalledInterfaceComponent('NoSuchInterface')).toBeNull();
        expect(await loadInstalledInterfaceComponent('__proto__')).toBeNull();
    });
});

describe('FormFieldInterface with the real components', () => {
    const field = (name: string, iface: string, type = 'string'): any => ({
        collection: 'articles',
        field: name,
        name,
        type,
        meta: { interface: iface, options: {} },
        schema: {},
    });

    it('renders an eager interface at once and a lazy one after its module loads', async () => {
        render(
            <MantineProvider>
                <FormFieldInterface field={field('title', 'input')} value="Hello" />
                <FormFieldInterface field={field('icon', 'select-icon')} value={null} />
            </MantineProvider>,
        );

        expect(screen.getByTestId('field-title')).toHaveValue('Hello');
        expect(screen.getByTestId('field-icon-loading')).toBeInTheDocument();

        expect(await screen.findByTestId('field-icon')).toBeInTheDocument();
        expect(screen.queryByTestId('field-icon-loading')).not.toBeInTheDocument();
    });
});
