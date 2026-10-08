/**
 * FormFieldInterface — how it loads the interface component.
 *
 * - A component in the eager table renders at once.
 * - A lazy component shows a skeleton of the manifest's height in the field's
 *   own Suspense boundary, then renders.
 * - A name the tables do not have is looked up in the components barrel:
 *   skeleton, then the component, or the not-found alert when nothing
 *   installed exports it. A failed load lands in the field's error boundary.
 * - A client-only component is not loaded on the server or during hydration.
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react';
// The node build: the browser build needs MessageChannel, which jsdom lacks.
import { renderToString } from 'react-dom/server.node';
import { hydrateRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };
function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

type Leaf = React.ComponentType<Record<string, unknown>>;

// What the mocked ./interface-components serves. `mock`-prefixed so the
// jest.mock factory may close over it.
const mockTables: {
    components: Record<string, Leaf>;
    installed: Record<string, Promise<Leaf | null>>;
    lazyLoads: number;
} = { components: {}, installed: {}, lazyLoads: 0 };

jest.mock('../components/interface-components', () => ({
    getInterfaceComponent: (name: string) => mockTables.components[name],
    loadInstalledInterfaceComponent: (name: string) => mockTables.installed[name] ?? Promise.resolve(null),
}));

// The interface id a field stores is what getFieldInterface resolves to.
jest.mock('@buildpad/utils', () => ({
    ...jest.requireActual('@buildpad/utils'),
    getFieldInterface: (field: { meta?: { interface?: string } }) => ({ type: field.meta?.interface, props: {} }),
}));

import { FormFieldInterface } from '../components/FormFieldInterface';

const leaf = (label: string): Leaf => (props) => <input data-testid="leaf" aria-label={label} data-field={String(props.field)} />;

/** A React.lazy component whose module arrives when the returned deferred resolves. */
function lazyLeaf(label: string) {
    const loaded = deferred<{ default: Leaf }>();
    const component = React.lazy(() => {
        mockTables.lazyLoads += 1;
        return loaded.promise;
    }) as unknown as Leaf;
    return { component, arrive: () => act(async () => loaded.resolve({ default: leaf(label) })) };
}

const field = (interfaceId: string): any => ({
    collection: 'articles',
    field: 'body',
    name: 'Body',
    type: 'text',
    meta: { interface: interfaceId },
    schema: {},
});

const ui = (interfaceId: string) => (
    <MantineProvider>
        <FormFieldInterface field={field(interfaceId)} value={null} />
    </MantineProvider>
);

beforeEach(() => {
    mockTables.components = {};
    mockTables.installed = {};
    mockTables.lazyLoads = 0;
});

describe('FormFieldInterface component loading', () => {
    it('renders an eager component at once, under the manifest export name of the type', () => {
        // `input-multiline` → Textarea; `number` is a deprecated type literal of `input`.
        mockTables.components = { Textarea: leaf('textarea'), Input: leaf('input') };

        const { unmount } = render(ui('input-multiline'));
        expect(screen.getByTestId('leaf')).toHaveAttribute('aria-label', 'textarea');
        expect(screen.queryByTestId('field-body-loading')).not.toBeInTheDocument();
        unmount();

        render(ui('number'));
        expect(screen.getByTestId('leaf')).toHaveAttribute('aria-label', 'input');
    });

    it('shows a skeleton of the manifest fallback height while a lazy component loads', async () => {
        const html = lazyLeaf('rich text');
        mockTables.components = { RichTextHTML: html.component };

        render(ui('input-rich-text-html'));

        // input-rich-text-html: fallbackHeight 240
        expect(screen.getByTestId('field-body-loading')).toHaveStyle({ height: 'calc(15rem * var(--mantine-scale))' });
        expect(screen.queryByTestId('leaf')).not.toBeInTheDocument();

        await html.arrive();

        expect(screen.getByTestId('leaf')).toHaveAttribute('aria-label', 'rich text');
        expect(screen.queryByTestId('field-body-loading')).not.toBeInTheDocument();
    });

    it('looks a name the tables do not have up in the components barrel', async () => {
        const installed = deferred<Leaf | null>();
        // system-permissions → SystemPermissions, which vform does not install.
        mockTables.installed = { SystemPermissions: installed.promise };

        render(ui('system-permissions'));
        expect(screen.getByTestId('field-body-loading')).toBeInTheDocument();

        await act(async () => installed.resolve(leaf('permissions')));

        expect(screen.getByTestId('leaf')).toHaveAttribute('aria-label', 'permissions');
        expect(screen.getByTestId('leaf')).toHaveAttribute('data-field', 'body');
    });

    it('resolves an unknown interface id to the PascalCase export name', async () => {
        mockTables.installed = { MyWidget: Promise.resolve(leaf('my widget')) };

        render(ui('my-widget'));

        expect(await screen.findByTestId('leaf')).toHaveAttribute('aria-label', 'my widget');
    });

    it('shows the not-found alert when nothing installed exports the component', async () => {
        render(ui('my-widget'));

        expect(await screen.findByText('my-widget')).toBeInTheDocument();
        expect(screen.getByText(/Interface component not found/)).toBeInTheDocument();
        expect(screen.getByText('Field: body (Type: text)')).toBeInTheDocument();
        expect(screen.queryByTestId('field-body-loading')).not.toBeInTheDocument();
    });

    it('hands a failed barrel load to the field error boundary', async () => {
        const error = jest.spyOn(console, 'error').mockImplementation(() => {});
        const installed = deferred<Leaf | null>();
        mockTables.installed = { MyWidget: installed.promise };
        installed.promise.catch(() => {});

        render(ui('my-widget'));
        await act(async () => installed.reject(new Error('Loading chunk 7 failed')));

        expect(screen.getByText(/Unexpected error in interface/)).toBeInTheDocument();
        expect(screen.getByText('Loading chunk 7 failed')).toBeInTheDocument();
        error.mockRestore();
    });

    it('does not load a client-only component on the server or while hydrating', async () => {
        const editor = lazyLeaf('block editor');
        mockTables.components = { InputBlockEditor: editor.component };

        // Server: the skeleton, and the module is never asked for.
        const html = renderToString(ui('input-block-editor'));
        expect(html).toContain('field-body-loading');
        expect(html).not.toContain('data-testid="leaf"');
        expect(mockTables.lazyLoads).toBe(0);

        // Client: hydrates to the same skeleton, then loads the editor.
        const container = document.createElement('div');
        document.body.appendChild(container);
        container.innerHTML = html;
        const recoverable: unknown[] = [];
        let root!: ReturnType<typeof hydrateRoot>;
        await act(async () => {
            root = hydrateRoot(container, ui('input-block-editor'), {
                onRecoverableError: (e) => recoverable.push(e),
            });
        });
        expect(recoverable).toEqual([]);
        expect(mockTables.lazyLoads).toBe(1);

        await editor.arrive();
        expect(container.querySelector('[data-testid="leaf"]')).toHaveAttribute('aria-label', 'block editor');

        act(() => root.unmount());
        container.remove();
    });

    it('renders a lazy (not client-only) component on the client without waiting for hydration', () => {
        const html = lazyLeaf('rich text');
        mockTables.components = { RichTextHTML: html.component, InputBlockEditor: lazyLeaf('editor').component };

        // A client-rendered tree is past hydration: both start loading at once.
        render(
            <MantineProvider>
                <FormFieldInterface field={field('input-rich-text-html')} value={null} />
                <FormFieldInterface field={{ ...field('input-block-editor'), field: 'blocks' }} value={null} />
            </MantineProvider>,
        );
        expect(mockTables.lazyLoads).toBe(2);
    });
});
