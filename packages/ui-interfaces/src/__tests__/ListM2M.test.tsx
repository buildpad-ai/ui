import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ListM2M } from '../list-m2m/ListM2M';

// ListM2M consumes @buildpad/hooks directly (useRelationM2M / useRelationPermissionsM2M /
// useRelationMultipleM2M / useFieldMetadata). Mock the whole module so tests are
// deterministic and don't hit the network.
//
// useRelationMultipleM2M is given a small *stateful* fake implementation (built with
// real React state) rather than a static jest.fn() return value, because the two
// behaviors under test here — the revert-to-empty notification and "Create New"
// junction linking — are both driven by ListM2M reacting to `changes` transitioning
// between states across renders. A static mock can't express that transition.
const mockUseRelationM2M = jest.fn();
const mockUseRelationPermissionsM2M = jest.fn();
const mockSelectItems = jest.fn();
const mockLoadItems = jest.fn();
const mockRemoveItem = jest.fn();
const mockApiRequest = jest.fn();
const mockLastParentPk = jest.fn();

jest.mock('@buildpad/hooks', () => {
    const ReactActual = require('react');
    const actual = jest.requireActual('@buildpad/hooks');

    return {
        // Use the real predicate — a hand-rolled copy here drifts from the
        // implementation under test (it missed '%2B') and pins behavior the
        // shipped component does not have.
        isValidPrimaryKey: actual.isValidPrimaryKey,
        apiRequest: (...args: unknown[]) => mockApiRequest(...args),
        useRelationM2M: (...args: unknown[]) => mockUseRelationM2M(...args),
        useRelationPermissionsM2M: (...args: unknown[]) => mockUseRelationPermissionsM2M(...args),
        useFieldMetadata: () => ({ getDisplayName: (f: string) => f, loading: false }),
        useRelationMultipleM2M: (relationInfo: unknown, _pk: unknown) => {
            mockLastParentPk(_pk);
            const [changes, setChanges] = ReactActual.useState({
                create: [] as Record<string, unknown>[],
                update: [] as Record<string, unknown>[],
                delete: [] as (string | number)[],
            });

            const [stagedRelatedData, setStagedRelatedData] = ReactActual.useState({} as Record<string | number, Record<string, unknown>>);

            // Mirrors the real hook's contract: the staged payload stays
            // reference-only ({pk} and nothing else, which is what
            // CollectionForm uses to tell "link existing" from "deep-create"),
            // and display data is kept separately.
            const selectItems = ReactActual.useCallback((ids: (string | number)[], relatedDataById?: Record<string | number, Record<string, unknown>>) => {
                mockSelectItems(ids, relatedDataById);
                if (relatedDataById) setStagedRelatedData((prev: any) => ({ ...prev, ...relatedDataById }));
                setChanges((prev: any) => ({
                    ...prev,
                    create: [
                        ...prev.create,
                        ...ids.map((id: string | number) => ({
                            $type: 'created',
                            id,
                            tag_id: { id },
                        })),
                    ],
                }));
            }, []);

            const removeItem = ReactActual.useCallback((item: any) => {
                mockRemoveItem(item);
                setChanges((prev: any) => ({
                    ...prev,
                    create: prev.create.filter((c: any) => c.id !== item.id),
                }));
            }, []);

            const resetChanges = ReactActual.useCallback(() => {
                setChanges({ create: [], update: [], delete: [] });
            }, []);

            const loadItems = mockLoadItems;
            const createItem = ReactActual.useRef(jest.fn()).current;
            const updateItem = ReactActual.useRef(jest.fn()).current;
            const reorderItems = ReactActual.useRef(jest.fn()).current;
            const moveItemUp = ReactActual.useRef(jest.fn()).current;
            const moveItemDown = ReactActual.useRef(jest.fn()).current;
            const getSelectedRelatedPKs = ReactActual.useCallback(() => new Set(), []);
            const getChanges = ReactActual.useCallback(() => changes, [changes]);

            const displayItems = changes.create.map((c: any) => ({ ...c }));

            return {
                displayItems,
                fetchedItems: [],
                totalCount: displayItems.length,
                loading: false,
                error: null,
                loadItems,
                createItem,
                selectItems,
                removeItem,
                updateItem,
                reorderItems,
                moveItemUp,
                moveItemDown,
                stagedRelatedData,
                getSelectedRelatedPKs,
                getChanges,
                hasChanges: changes.create.length > 0 || changes.update.length > 0 || changes.delete.length > 0,
                setLocalChanges: setChanges,
                resetChanges,
                changes,
            };
        },
    };
});

const mockCollectionListProps = jest.fn();

jest.mock('@buildpad/ui-collections', () => ({
    CollectionForm: ({ onSuccess }: any) => (
        <div data-testid="collection-form">
            <button onClick={() => onSuccess?.({ id: 'new-tag-id', name: 'Brand new tag' })}>
                Save Form
            </button>
        </div>
    ),
    CollectionList: (props: any) => {
        mockCollectionListProps(props);
        const { bulkActions } = props;
        return (
            <div data-testid="collection-list">
                {bulkActions && (
                    <button
                        onClick={() =>
                            bulkActions[0].action([42], [{ id: 42, name: 'Announcement' }])
                        }
                    >
                        Add Selected
                    </button>
                )}
            </div>
        );
    },
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <MantineProvider>
        <Notifications />
        {children}
    </MantineProvider>
);

const RELATION_INFO = {
    relatedCollection: { collection: 'tags', meta: {} },
    junctionCollection: { collection: 'articles_tags' },
    junctionField: { field: 'tag_id', type: 'integer' },
    reverseJunctionField: { field: 'article_id', type: 'integer' },
    relatedPrimaryKeyField: { field: 'id', type: 'integer' },
    junctionPrimaryKeyField: { field: 'id', type: 'integer' },
    sortField: undefined,
};

const defaultProps = {
    collection: 'articles',
    field: 'tags',
    primaryKey: 1,
    enableCreate: true,
    enableSelect: true,
    mockRelationInfo: RELATION_INFO,
};

beforeEach(() => {
    jest.clearAllMocks();
    mockUseRelationM2M.mockReturnValue({ relationInfo: RELATION_INFO, loading: false, error: null });
    mockUseRelationPermissionsM2M.mockReturnValue({
        createAllowed: true,
        selectAllowed: true,
        updateAllowed: true,
        deleteAllowed: true,
    });
});

describe('ListM2M revert-to-empty notification', () => {
    it('notifies the parent with an empty changeset after every staged change is undone', async () => {
        const onChange = jest.fn();
        const { container } = render(
            <TestWrapper>
                <ListM2M {...defaultProps} onChange={onChange} />
            </TestWrapper>,
        );

        const selectBtn = await screen.findByText('Add Existing');
        fireEvent.click(selectBtn);
        const addSelectedBtn = await screen.findByText('Add Selected');
        fireEvent.click(addSelectedBtn);

        // A non-empty changeset was staged and reported.
        await waitFor(() => {
            expect(onChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.arrayContaining([expect.objectContaining({ id: 42 })]),
                }),
            );
        });
        onChange.mockClear();

        // Undo it — remove the item that was just added (the row's trash icon
        // button — the component doesn't expose a data-testid/aria-label for it,
        // so target it via the tabler trash icon rendered inside).
        await waitFor(() => {
            expect(container.querySelector('svg.tabler-icon-trash')).toBeTruthy();
        });
        const trashIcon = container.querySelector('svg.tabler-icon-trash')!;
        const removeBtn = trashIcon.closest('button')!;
        fireEvent.click(removeBtn);

        // Parent must be told the changeset is empty again, not left holding
        // the previous non-empty payload.
        await waitFor(() => {
            expect(onChange).toHaveBeenCalledWith({ create: [], update: [], delete: [] });
        });
    });
});

describe('ListM2M "Create New" junction linking', () => {
    it('links the newly created related item via selectItems, not just closing the drawer', async () => {
        render(
            <TestWrapper>
                <ListM2M {...defaultProps} />
            </TestWrapper>,
        );

        const createBtn = await screen.findByText('Create New');
        fireEvent.click(createBtn);

        const saveBtn = await screen.findByText('Save Form');
        fireEvent.click(saveBtn);

        // handleEditFormSuccess must call selectItems([data.id]) to stage a
        // junction row linking the newly created item — not silently drop it.
        await waitFor(() => {
            expect(mockSelectItems).toHaveBeenCalledWith(
                ['new-tag-id'],
                { 'new-tag-id': { id: 'new-tag-id', name: 'Brand new tag' } },
            );
        });
    });

    // Only `data.id` was ever forwarded to selectItems — the rest of the
    // just-created record (e.g. `name`) was discarded, so a display template
    // had nothing to resolve against and rendered blank until the parent
    // form was saved and the list reloaded from the server.
    it('renders the display template immediately using the just-created record, without a reload', async () => {
        render(
            <TestWrapper>
                <ListM2M {...defaultProps} template="{{tag_id.name}}" />
            </TestWrapper>,
        );

        fireEvent.click(await screen.findByText('Create New'));
        fireEvent.click(await screen.findByText('Save Form'));

        expect(await screen.findByText('Brand new tag')).toBeInTheDocument();
    });
});

describe('ListM2M enableLink', () => {
    it('renders an external-link action pointing at the related record', async () => {
        const { container } = render(
            <TestWrapper>
                <ListM2M {...defaultProps} enableLink />
            </TestWrapper>,
        );

        // Stage a related item (junction row: tag_id: { id: 42 }) via the
        // existing "Add Selected" flow used elsewhere in this file.
        fireEvent.click(await screen.findByText('Add Existing'));
        fireEvent.click(await screen.findByText('Add Selected'));

        await waitFor(() => {
            expect(container.querySelector('svg.tabler-icon-external-link')).toBeTruthy();
        });
        const icon = container.querySelector('svg.tabler-icon-external-link')!;
        const link = icon.closest('a')!;
        expect(link.getAttribute('href')).toBe('/content/tags/42');
    });

    it('does not render the external-link action when enableLink is false', async () => {
        const { container } = render(
            <TestWrapper>
                <ListM2M {...defaultProps} />
            </TestWrapper>,
        );

        fireEvent.click(await screen.findByText('Add Existing'));
        fireEvent.click(await screen.findByText('Add Selected'));

        await waitFor(() => {
            expect(container.querySelector('svg.tabler-icon-trash')).toBeTruthy();
        });
        expect(container.querySelector('svg.tabler-icon-external-link')).toBeFalsy();
    });
});

describe('ListM2M fields= query PK resolution', () => {
    it('resolves the bootstrap "id" to the related PK field in the items query', async () => {
        mockUseRelationM2M.mockReturnValue({
            relationInfo: {
                ...RELATION_INFO,
                relatedPrimaryKeyField: { field: 'code', type: 'string' },
            },
            loading: false,
            error: null,
        });

        // Real mode: no mockRelationInfo/mockItems so the load effect runs.
        render(
            <MantineProvider>
                <ListM2M collection="articles" field="tags" primaryKey={1} />
            </MantineProvider>
        );

        await waitFor(() => expect(mockLoadItems).toHaveBeenCalled());
        const fields: string[] = mockLoadItems.mock.calls.at(-1)?.[0]?.fields ?? [];
        expect(fields).toContain('tag_id.code');
        expect(fields).not.toContain('tag_id.id');
    });

    // A field's row-display template (e.g. "{{tag_id.name}}", authored via
    // meta.options.template) references a junction-relative path — the
    // actual fetched fields must include it, or the template renders blank
    // (the related item's `name` was never fetched, only whatever `fields`
    // happened to list — defaulting to just the bootstrap "id").
    it('includes fields referenced by the display template in the items query, even when not in the fields prop', async () => {
        mockUseRelationM2M.mockReturnValue({
            relationInfo: RELATION_INFO,
            loading: false,
            error: null,
        });

        render(
            <MantineProvider>
                <ListM2M
                    collection="articles"
                    field="tags"
                    primaryKey={1}
                    fields={['id']}
                    template="{{tag_id.name}}"
                />
            </MantineProvider>
        );

        await waitFor(() => expect(mockLoadItems).toHaveBeenCalled());
        const fields: string[] = mockLoadItems.mock.calls.at(-1)?.[0]?.fields ?? [];
        expect(fields).toContain('tag_id.name');
    });
});

describe('ListM2M select-existing label resolution', () => {
    // Picking an item stages only a reference locally, so a display template
    // had nothing to resolve against and rendered blank until the parent form
    // was saved and the list reloaded. The select modal already loaded these
    // rows, so it hands them back with the ids — no extra request — and the
    // label resolves immediately.
    it('uses the rows supplied by the select modal to resolve the label immediately', async () => {
        mockUseRelationM2M.mockReturnValue({ relationInfo: RELATION_INFO, loading: false, error: null });

        render(
            <TestWrapper>
                <ListM2M collection="articles" field="tags" primaryKey={1} template="{{tag_id.name}}" />
            </TestWrapper>
        );

        fireEvent.click(screen.getByText('Add Existing'));
        fireEvent.click(await screen.findByText('Add Selected'));

        await waitFor(() => {
            expect(mockSelectItems).toHaveBeenCalledWith([42], { 42: { id: 42, name: 'Announcement' } });
        });
        expect(await screen.findByText('Announcement')).toBeInTheDocument();
    });

    it('does not issue its own request for the selected rows', async () => {
        mockUseRelationM2M.mockReturnValue({ relationInfo: RELATION_INFO, loading: false, error: null });

        render(
            <TestWrapper>
                <ListM2M collection="articles" field="tags" primaryKey={1} template="{{tag_id.name}}" />
            </TestWrapper>
        );

        fireEvent.click(screen.getByText('Add Existing'));
        fireEvent.click(await screen.findByText('Add Selected'));
        await waitFor(() => expect(mockSelectItems).toHaveBeenCalled());

        expect(mockApiRequest).not.toHaveBeenCalled();
    });

    // The staged payload is what CollectionForm inspects to tell "link this
    // existing row" from "deep-create a new one" — it must carry the related
    // PK and nothing else, however much display data the modal supplied.
    it('keeps the staged junction payload reference-only', async () => {
        mockUseRelationM2M.mockReturnValue({ relationInfo: RELATION_INFO, loading: false, error: null });

        const onChange = jest.fn();
        render(
            <TestWrapper>
                <ListM2M
                    collection="articles"
                    field="tags"
                    primaryKey={1}
                    template="{{tag_id.name}}"
                    onChange={onChange}
                />
            </TestWrapper>
        );

        fireEvent.click(screen.getByText('Add Existing'));
        fireEvent.click(await screen.findByText('Add Selected'));
        await waitFor(() => expect(onChange).toHaveBeenCalled());

        const staged = onChange.mock.calls.at(-1)![0].create[0];
        expect(Object.keys(staged.tag_id)).toEqual(['id']);
        expect(staged.tag_id).toEqual({ id: 42 });
    });
});

describe('ListM2M row-label rendering with a junction-relative template', () => {
    it('resolves "{{tag_id.name}}" against the nested related item, not a blank label', () => {
        // formatDisplayValue used to render the template against `relatedData`
        // (already item.tag_id — just {id, name}), so "{{tag_id.name}}" tried
        // to resolve relatedData.tag_id.name, which doesn't exist — blank label.
        render(
            <MantineProvider>
                <ListM2M
                    collection="articles"
                    field="tags"
                    primaryKey={1}
                    template="{{tag_id.name}}"
                    mockRelationInfo={RELATION_INFO as any}
                    mockItems={[
                        { id: 'junction-1', tag_id: { id: 'tag-1', name: 'Announcement' } } as any,
                    ]}
                />
            </MantineProvider>
        );

        expect(screen.getByText('Announcement')).toBeInTheDocument();
    });
});

describe('ListM2M load-items dedupe', () => {
    it('does not refire an identical query when the parent passes fresh filter/fields literals', async () => {
        const { rerender } = render(
            <MantineProvider>
                <ListM2M
                    collection="articles"
                    field="tags"
                    primaryKey={1}
                    filter={{ status: 'published' }}
                    fields={['id', 'name']}
                />
            </MantineProvider>
        );

        await waitFor(() => expect(mockLoadItems).toHaveBeenCalledTimes(1));

        // Same values, fresh object/array identities — the pre-fix effect
        // refired on dep identity and issued the identical query again.
        rerender(
            <MantineProvider>
                <ListM2M
                    collection="articles"
                    field="tags"
                    primaryKey={1}
                    filter={{ status: 'published' }}
                    fields={['id', 'name']}
                />
            </MantineProvider>
        );

        await waitFor(() => expect(mockLoadItems).toHaveBeenCalledTimes(1));
        expect(mockLoadItems).toHaveBeenCalledTimes(1);
    });

    it('still refires when the query genuinely changes', async () => {
        const { rerender } = render(
            <MantineProvider>
                <ListM2M collection="articles" field="tags" primaryKey={1} filter={{ status: 'published' }} />
            </MantineProvider>
        );
        await waitFor(() => expect(mockLoadItems).toHaveBeenCalledTimes(1));

        rerender(
            <MantineProvider>
                <ListM2M collection="articles" field="tags" primaryKey={1} filter={{ status: 'draft' }} />
            </MantineProvider>
        );
        await waitFor(() => expect(mockLoadItems).toHaveBeenCalledTimes(2));
    });

    // V3-5: the signature used to omit primaryKey/isParentSaved, so a
    // mounted ListM2M whose primaryKey switches to a different saved record
    // without a remount (e.g. navigating between records in a single-page
    // detail view) kept the same params/refreshKey and skipped the refetch
    // — the previous record's rows stayed on screen.
    it('refires when primaryKey switches to a different record with no other param change', async () => {
        const { rerender } = render(
            <MantineProvider>
                <ListM2M collection="articles" field="tags" primaryKey={1} filter={{ status: 'published' }} />
            </MantineProvider>
        );
        await waitFor(() => expect(mockLoadItems).toHaveBeenCalledTimes(1));

        rerender(
            <MantineProvider>
                <ListM2M collection="articles" field="tags" primaryKey={2} filter={{ status: 'published' }} />
            </MantineProvider>
        );
        await waitFor(() => expect(mockLoadItems).toHaveBeenCalledTimes(2));
        // The params are identical between records (the parent key only
        // reaches the request through the hook), so assert on the parent the
        // hook was driven with — otherwise this passes even if the refetch
        // queried the OLD record.
        expect(mockLastParentPk).toHaveBeenLastCalledWith(2);

        // And no third, duplicate query settles afterwards: including
        // refreshKey in the signature made a record switch that also cleared
        // `value` fire the same query twice.
        await new Promise((r) => setTimeout(r, 50));
        expect(mockLoadItems).toHaveBeenCalledTimes(2);
    });

    it('clears the previous record\'s rows when switching to an unsaved parent', async () => {
        const { rerender } = render(
            <MantineProvider>
                <ListM2M collection="articles" field="tags" primaryKey={1} />
            </MantineProvider>
        );
        await waitFor(() => expect(mockLoadItems).toHaveBeenCalledTimes(1));

        // '+' is a new record: loadItems is what empties fetchedItems for a
        // new item, so returning early left the previous record's rows on
        // screen inside the blank create form.
        rerender(
            <MantineProvider>
                <ListM2M collection="articles" field="tags" primaryKey="+" />
            </MantineProvider>
        );
        await waitFor(() => expect(mockLoadItems).toHaveBeenCalledTimes(2));
        expect(mockLastParentPk).toHaveBeenLastCalledWith('+');
    });
});

describe('ListM2M "Add Existing" picker requests an exact count', () => {
    // Regression test: the related-collection picker is always a small,
    // human-browsed list, never a large primary collection view. The
    // server's default `estimated` count mode can report a wildly inflated
    // total on a full first page when the related table has stale/absent
    // ANALYZE statistics — confirmed on a live deployment where a roles
    // table (14 real rows, never analyzed) reported 180 until pagination
    // reached a short page and forced a recount. CollectionList's
    // `exactCount` prop sidesteps that entirely by asking for a real count
    // up front, and must be set for this modal specifically.
    it('renders CollectionList with exactCount when the select modal opens', async () => {
        render(
            <TestWrapper>
                <ListM2M {...defaultProps} />
            </TestWrapper>,
        );

        const selectBtn = await screen.findByText('Add Existing');
        fireEvent.click(selectBtn);

        await screen.findByTestId('collection-list');
        expect(mockCollectionListProps).toHaveBeenCalledWith(
            expect.objectContaining({ exactCount: true }),
        );
    });
});
