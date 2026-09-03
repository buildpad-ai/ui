/**
 * ListM2A — inline "Create New" staging & replace-mode payload building.
 *
 * Regression tests for the coupled bugs where an inline-created item was
 * emitted with the collection-discriminator string as its item value:
 *
 * - the Create New modal's onSave must feed createItemWithData only the nested
 *   related-item fields (itemData) plus junction-level edits (additionalData);
 *   passing JunctionItemForm's whole combined payload double-wraps it under
 *   junctionField
 * - the payload builder must resolve a staged entry's id via the collection's
 *   actual PK field (relationPrimaryKeyFields), never "first object value"
 * - an inline-created row with no PK yet must pass its whole nested object
 *   through so DaaS deep-creates the related item
 *
 * And for the mass-unlink hole: DaaS processM2AField is replace-mode (deletes
 * every junction row for the parent, re-inserts exactly the payload), but the
 * payload used to be built from page-scoped displayItems — staging any single
 * change on a >1-page relation deleted every off-page junction row on save.
 * The emit must preserve-fetch ALL junction rows (limit=-1) and abort rather
 * than emit an incomplete set.
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

jest.mock("@buildpad/services", () => {
    // The i18n hooks are real: without a provider they return the English defaults.
    const actual = jest.requireActual("@buildpad/services");
    return {
        apiRequest: jest.fn(),
        useBuildpadI18n: actual.useBuildpadI18n,
        useBuildpadTranslations: actual.useBuildpadTranslations,
    };
});

jest.mock("@buildpad/hooks", () => ({
    useRelationM2A: jest.fn(),
    useRelationM2AItems: jest.fn(),
    useRelationPermissionsM2A: jest.fn(),
}));

// The select modal renders a full CollectionList; not under test here.
jest.mock("@buildpad/ui-collections", () => ({
    CollectionList: () => null,
}));

// JunctionItemForm loads field definitions over the API and renders two VForm
// sections. Stub it to a save button that fires onSave with the same shape the
// real handleSave builds for a new item:
//   { ...junctionEdits, [collectionField]: targetCollection, [junctionField]: relatedEdits }
// (keys 'collection'/'item' match RELATION_INFO below)
jest.mock("../list-m2a/JunctionItemForm", () => {
    const R = require("react");
    return {
        JunctionItemForm: ({ targetCollection, onSave }: any) =>
            R.createElement(
                "button",
                {
                    "data-testid": "mock-junction-save",
                    onClick: () =>
                        onSave({
                            ...((globalThis as any).__junctionEdits ?? {}),
                            collection: targetCollection,
                            item: (globalThis as any).__relatedEdits ?? {},
                        }),
                },
                "save",
            ),
    };
});

import { apiRequest } from "@buildpad/services";
import {
    useRelationM2A,
    useRelationM2AItems,
    useRelationPermissionsM2A,
} from "@buildpad/hooks";
import { ListM2A } from "../list-m2a/ListM2A";

const RELATION_INFO = {
    junctionCollection: { collection: "pages_blocks" },
    allowedCollections: [
        { collection: "headings", name: "Headings", meta: {} },
        { collection: "paragraphs", name: "Paragraphs", meta: {} },
    ],
    collectionField: { field: "collection", type: "string" },
    junctionField: { field: "item", type: "string" },
    reverseJunctionField: { field: "page_id", type: "uuid" },
    junctionPrimaryKeyField: { field: "id", type: "integer" },
    relationPrimaryKeyFields: {
        headings: { field: "id", type: "uuid" },
        // deliberately not named "id" — guards the hardcoded-PK regression
        paragraphs: { field: "code", type: "string" },
    },
    sortField: "sort",
    relation: { field: "page_id", collection: "pages_blocks" },
};

const wrap = (ui: React.ReactNode) => <MantineProvider>{ui}</MantineProvider>;

const flush = () =>
    act(async () => {
        await Promise.resolve();
    });

const BASE_PROPS = {
    collection: "pages",
    field: "blocks",
    primaryKey: "page-1",
    layout: "list" as const,
};

function setItemsHook(overrides: Record<string, unknown> = {}) {
    const hook = {
        displayItems: [] as Record<string, unknown>[],
        totalCount: 0,
        loading: false,
        loadItems: jest.fn(),
        createItem: jest.fn(),
        createItemWithData: jest.fn(),
        removeItem: jest.fn(),
        updateItem: jest.fn(),
        selectItems: jest.fn(),
        moveItemUp: jest.fn(),
        moveItemDown: jest.fn(),
        getSelectedPrimaryKeysByCollection: jest.fn().mockReturnValue({}),
        getChanges: jest.fn().mockReturnValue({ create: [], update: [], delete: [] }),
        hasChanges: false,
        resetChanges: jest.fn(),
        ...overrides,
    };
    (useRelationM2AItems as jest.Mock).mockReturnValue(hook);
    return hook;
}

beforeEach(() => {
    jest.clearAllMocks();
    // Default preserve-fetch: no junction rows linked yet. Tests that model a
    // populated relation override this with their own row set.
    (apiRequest as jest.Mock).mockResolvedValue({ data: [], meta: { total_count: 0 } });
    (globalThis as any).__relatedEdits = { title: "Hello" };
    (globalThis as any).__junctionEdits = {};
    (useRelationM2A as jest.Mock).mockReturnValue({
        relationInfo: RELATION_INFO,
        loading: false,
        error: null,
    });
    (useRelationPermissionsM2A as jest.Mock).mockReturnValue({
        createAllowed: { headings: true, paragraphs: true },
        selectAllowed: true,
        updateAllowed: { headings: true, paragraphs: true },
        deleteAllowed: { headings: true, paragraphs: true },
    });
    setItemsHook();
});

describe("ListM2A inline create — staging wiring", () => {
    it("feeds createItemWithData only the nested related fields, with junction-level edits as additionalData", async () => {
        (globalThis as any).__relatedEdits = { title: "Hello", body: "World" };
        (globalThis as any).__junctionEdits = { note: "pinned" };
        const hook = setItemsHook();

        render(wrap(<ListM2A {...(BASE_PROPS as any)} />));

        fireEvent.click(screen.getByTestId("m2a-create-btn"));
        fireEvent.click(await screen.findByTestId("m2a-create-headings"));
        fireEvent.click(await screen.findByTestId("mock-junction-save"));

        expect(hook.createItemWithData).toHaveBeenCalledTimes(1);
        expect(hook.createItemWithData).toHaveBeenCalledWith(
            "headings",
            { title: "Hello", body: "World" },
            { note: "pinned" },
        );
    });

    it("never re-nests the collection discriminator inside the staged item data", async () => {
        const hook = setItemsHook();

        render(wrap(<ListM2A {...(BASE_PROPS as any)} />));

        fireEvent.click(screen.getByTestId("m2a-create-btn"));
        fireEvent.click(await screen.findByTestId("m2a-create-paragraphs"));
        fireEvent.click(await screen.findByTestId("mock-junction-save"));

        const [, itemData, additionalData] = hook.createItemWithData.mock.calls[0];
        expect(itemData).not.toHaveProperty("collection");
        expect(itemData).not.toHaveProperty("item");
        expect(additionalData ?? {}).not.toHaveProperty("collection");
    });
});

describe("ListM2A onChange payload — junction value flattening", () => {
    // The payload is built from getChanges() plus a preserve-fetch of the
    // server's junction rows — the default beforeEach fetch returns none.
    it("passes the whole nested object through for an inline-created item with no PK yet", async () => {
        const onChange = jest.fn();
        setItemsHook({
            hasChanges: true,
            getChanges: jest.fn().mockReturnValue({
                create: [{ collection: "headings", item: { title: "Hello" } }],
                update: [],
                delete: [],
            }),
        });

        render(wrap(<ListM2A {...(BASE_PROPS as any)} onChange={onChange} />));

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        expect(onChange).toHaveBeenLastCalledWith([
            { collection: "headings", item: { title: "Hello" } },
        ]);
    });

    it("flattens a staged entry via the collection's actual PK field, not the first object value", async () => {
        const onChange = jest.fn();
        setItemsHook({
            hasChanges: true,
            getChanges: jest.fn().mockReturnValue({
                create: [
                    {
                        collection: "paragraphs",
                        // non-PK key deliberately first: "first object value" would pick it
                        item: { title: "Nine", code: "para-9" },
                    },
                ],
                update: [],
                delete: [],
            }),
        });

        render(wrap(<ListM2A {...(BASE_PROPS as any)} onChange={onChange} />));

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        expect(onChange).toHaveBeenLastCalledWith([
            { collection: "paragraphs", item: "para-9" },
        ]);
    });

    it("still flattens id-keyed entries to their id", async () => {
        const onChange = jest.fn();
        setItemsHook({
            hasChanges: true,
            getChanges: jest.fn().mockReturnValue({
                create: [{ collection: "headings", item: { id: "u-1", title: "T" } }],
                update: [],
                delete: [],
            }),
        });

        render(wrap(<ListM2A {...(BASE_PROPS as any)} onChange={onChange} />));

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        expect(onChange).toHaveBeenLastCalledWith([
            { collection: "headings", item: "u-1" },
        ]);
    });
});

describe("ListM2A replace payload — must span all pages (mass-unlink regression)", () => {
    // Four junction rows exist server-side; the current page only ever shows
    // some of them. The replace-mode payload must still contain every row
    // that should survive, or DaaS deletes the off-page ones on save.
    const ALL_JUNCTION_ROWS = [
        { id: "j1", collection: "headings", item: "u1", sort: 1 },
        { id: "j2", collection: "headings", item: "u2", sort: 2 },
        { id: "j3", collection: "paragraphs", item: "para-3", sort: 3 },
        { id: "j4", collection: "headings", item: "u4", sort: 4 },
    ];

    function mockJunctionFetch(rows = ALL_JUNCTION_ROWS, total = rows.length) {
        (apiRequest as jest.Mock).mockImplementation((path: string) => {
            if (path.startsWith("/api/items/pages_blocks")) {
                return Promise.resolve({ data: rows, meta: { total_count: total } });
            }
            return Promise.resolve({ data: [] });
        });
    }

    it("re-sends every off-page junction row when a single on-page removal is staged", async () => {
        mockJunctionFetch();
        const onChange = jest.fn();
        setItemsHook({
            hasChanges: true,
            totalCount: 4,
            // current page holds j1 + j2 only; j2 is staged for removal
            displayItems: [
                { id: "j1", collection: "headings", item: { id: "u1" }, sort: 1 },
                { id: "j2", $type: "deleted", collection: "headings", item: { id: "u2" }, sort: 2 },
            ],
            getChanges: jest.fn().mockReturnValue({ create: [], update: [], delete: ["j2"] }),
        });

        render(wrap(<ListM2A {...(BASE_PROPS as any)} onChange={onChange} />));

        await waitFor(() => expect(onChange).toHaveBeenCalled());

        // The preserve-fetch must be unpaginated and exactly counted
        const junctionCall = (apiRequest as jest.Mock).mock.calls.find(([p]) =>
            (p as string).startsWith("/api/items/pages_blocks"),
        );
        expect(junctionCall).toBeDefined();
        expect(junctionCall![0]).toContain("limit=-1");
        expect(junctionCall![0]).toContain("page=0");
        expect(junctionCall![0]).toContain("count=exact");

        // Off-page rows j3/j4 survive; only the staged removal j2 is gone.
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenLastCalledWith([
            { collection: "headings", item: "u1" },
            { collection: "paragraphs", item: "para-3" },
            { collection: "headings", item: "u4" },
        ]);
    });

    it("orders the payload by staged sort updates across the full set", async () => {
        mockJunctionFetch();
        const onChange = jest.fn();
        setItemsHook({
            hasChanges: true,
            totalCount: 4,
            getChanges: jest.fn().mockReturnValue({
                create: [],
                // swap j1 and j2 — payload order is what the backend persists
                update: [
                    { id: "j1", sort: 2 },
                    { id: "j2", sort: 1 },
                ],
                delete: [],
            }),
        });

        render(wrap(<ListM2A {...(BASE_PROPS as any)} onChange={onChange} />));

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        expect(onChange).toHaveBeenLastCalledWith([
            { collection: "headings", item: "u2" },
            { collection: "headings", item: "u1" },
            { collection: "paragraphs", item: "para-3" },
            { collection: "headings", item: "u4" },
        ]);
    });

    it("appends a staged create after the preserved rows, at its staged sort", async () => {
        mockJunctionFetch();
        const onChange = jest.fn();
        setItemsHook({
            hasChanges: true,
            totalCount: 5,
            getChanges: jest.fn().mockReturnValue({
                create: [{ collection: "paragraphs", item: { code: "para-new" }, sort: 5 }],
                update: [],
                delete: [],
            }),
        });

        render(wrap(<ListM2A {...(BASE_PROPS as any)} onChange={onChange} />));

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        expect(onChange).toHaveBeenLastCalledWith([
            { collection: "headings", item: "u1" },
            { collection: "headings", item: "u2" },
            { collection: "paragraphs", item: "para-3" },
            { collection: "headings", item: "u4" },
            { collection: "paragraphs", item: "para-new" },
        ]);
    });

    it("aborts the emit when the preserve-fetch fails, instead of sending a page-only payload", async () => {
        (apiRequest as jest.Mock).mockRejectedValue(new Error("network down"));
        const consoleErr = jest.spyOn(console, "error").mockImplementation(() => {});
        const onChange = jest.fn();
        setItemsHook({
            hasChanges: true,
            getChanges: jest.fn().mockReturnValue({ create: [], update: [], delete: ["j2"] }),
        });

        render(wrap(<ListM2A {...(BASE_PROPS as any)} onChange={onChange} />));
        await flush();
        await flush();

        expect(apiRequest).toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
        consoleErr.mockRestore();
    });

    it("aborts the emit when the preserve-fetch comes back incomplete", async () => {
        // Server claims 5 linked rows but returns only 4 — emitting would
        // silently unlink the missing one.
        mockJunctionFetch(ALL_JUNCTION_ROWS, 5);
        const consoleErr = jest.spyOn(console, "error").mockImplementation(() => {});
        const onChange = jest.fn();
        setItemsHook({
            hasChanges: true,
            getChanges: jest.fn().mockReturnValue({ create: [], update: [], delete: ["j2"] }),
        });

        render(wrap(<ListM2A {...(BASE_PROPS as any)} onChange={onChange} />));
        await flush();
        await flush();

        expect(onChange).not.toHaveBeenCalled();
        expect(consoleErr).toHaveBeenCalledWith(
            expect.stringContaining("refusing to emit an incomplete replace payload"),
        );
        consoleErr.mockRestore();
    });

    it("skips the preserve-fetch for an unsaved parent and emits staged creates only", async () => {
        const onChange = jest.fn();
        setItemsHook({
            hasChanges: true,
            getChanges: jest.fn().mockReturnValue({
                create: [{ collection: "headings", item: { id: "u-9" } }],
                update: [],
                delete: [],
            }),
        });

        render(wrap(<ListM2A {...(BASE_PROPS as any)} primaryKey="+" onChange={onChange} />));

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        expect(onChange).toHaveBeenLastCalledWith([{ collection: "headings", item: "u-9" }]);
        expect(apiRequest).not.toHaveBeenCalled();
    });

    it("treats the other new-item sentinels as unsaved too", async () => {
        // `isNewItem` knows '+', '%2B' and 'new'. Testing only '+' let a
        // parent on a /new route report "saved", which preserve-fetches
        // against a literal 'new' primary key — and if the backend rejects
        // that against a uuid column, the emit aborts and the record saves
        // with none of its staged rows.
        for (const sentinel of ["%2B", "new"]) {
            (apiRequest as jest.Mock).mockClear();
            const onChange = jest.fn();
            setItemsHook({
                hasChanges: true,
                getChanges: jest.fn().mockReturnValue({
                    create: [{ collection: "headings", item: { id: "u-9" } }],
                    update: [],
                    delete: [],
                }),
            });

            const { unmount } = render(
                wrap(<ListM2A {...(BASE_PROPS as any)} primaryKey={sentinel} onChange={onChange} />),
            );

            await waitFor(() => expect(onChange).toHaveBeenCalled());
            expect(apiRequest).not.toHaveBeenCalled();
            unmount();
        }
    });

    it("scopes the preserve-fetch to this parent", async () => {
        // Without the parent filter the fetch returns every parent's junction
        // rows, and the replace-mode emit re-links them onto this one.
        mockJunctionFetch();
        const onChange = jest.fn();
        setItemsHook({
            hasChanges: true,
            totalCount: 4,
            displayItems: [{ id: "j1", collection: "headings", item: { id: "u1" }, sort: 1 }],
            getChanges: jest.fn().mockReturnValue({ create: [], update: [], delete: ["j2"] }),
        });

        render(wrap(<ListM2A {...(BASE_PROPS as any)} onChange={onChange} />));

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        const junctionCall = (apiRequest as jest.Mock).mock.calls.find(([p]) =>
            (p as string).startsWith("/api/items/pages_blocks"),
        );
        expect(decodeURIComponent(junctionCall![0] as string)).toContain(
            '{"page_id":{"_eq":"page-1"}}',
        );
    });

    it("normalizes a bare-array response instead of reading it as an empty relation", async () => {
        // This endpoint may answer with a bare array rather than a {data}
        // envelope; `resp.data || []` alone would emit [] and unlink everything.
        (apiRequest as jest.Mock).mockImplementation((path: string) => {
            if (path.startsWith("/api/items/pages_blocks")) {
                return Promise.resolve(ALL_JUNCTION_ROWS);
            }
            return Promise.resolve({ data: [] });
        });
        const onChange = jest.fn();
        setItemsHook({
            hasChanges: true,
            totalCount: 4,
            displayItems: [{ id: "j1", collection: "headings", item: { id: "u1" }, sort: 1 }],
            getChanges: jest.fn().mockReturnValue({ create: [], update: [], delete: ["j2"] }),
        });

        render(wrap(<ListM2A {...(BASE_PROPS as any)} onChange={onChange} />));

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        expect(onChange).toHaveBeenLastCalledWith([
            { collection: "headings", item: "u1" },
            { collection: "paragraphs", item: "para-3" },
            { collection: "headings", item: "u4" },
        ]);
    });

    it("still spans all pages when a search has filtered the visible set", async () => {
        // An active search can narrow the on-page set below the limit. A
        // count-based gate would skip the preserve-fetch here and emit only
        // the matching row, unlinking everything that didn't match.
        mockJunctionFetch();
        const onChange = jest.fn();
        setItemsHook({
            hasChanges: true,
            totalCount: 1,
            displayItems: [{ id: "j1", collection: "headings", item: { id: "u1" }, sort: 1 }],
            getChanges: jest.fn().mockReturnValue({ create: [], update: [], delete: ["j2"] }),
        });

        render(
            wrap(
                <ListM2A
                    {...(BASE_PROPS as any)}
                    onChange={onChange}
                    enableSearchFilter
                    layout="table"
                />,
            ),
        );

        fireEvent.change(screen.getByTestId("m2a-search"), { target: { value: "abc" } });

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        const payload = onChange.mock.calls.at(-1)![0] as unknown[];
        expect(payload).toHaveLength(3);
    });
});

describe("ListM2A drag gating — paginated sets", () => {
    const rows = (n: number) =>
        Array.from({ length: n }, (_, i) => ({
            id: `j${i}`,
            collection: "headings",
            item: `u${i}`,
            sort: i + 1,
        }));

    it("disables drag and shows the explanatory notice when totalCount exceeds one page", () => {
        // 15 visible rows (a full page) of a 30-row set: the old
        // visibleItems-based conditions left drag enabled with no notice.
        setItemsHook({ totalCount: 30, displayItems: rows(15) });

        render(wrap(<ListM2A {...(BASE_PROPS as any)} />));

        expect(screen.getByTestId("m2a-drag-disabled-notice")).toBeInTheDocument();
        expect(screen.queryAllByTestId(/^m2a-drag-handle-/)).toHaveLength(0);
    });

    it("enables drag with no notice when all items fit on one page", () => {
        setItemsHook({ totalCount: 3, displayItems: rows(3) });

        render(wrap(<ListM2A {...(BASE_PROPS as any)} />));

        expect(screen.queryByTestId("m2a-drag-disabled-notice")).toBeNull();
        expect(screen.queryAllByTestId(/^m2a-drag-handle-/)).toHaveLength(3);
    });
});
