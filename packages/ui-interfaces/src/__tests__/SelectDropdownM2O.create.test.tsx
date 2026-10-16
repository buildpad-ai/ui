/**
 * SelectDropdownM2O — "Create New", Enter in the search, and the modal
 * layout's Select dialog.
 *
 * - "Create New" opened a stub ("Create functionality will be available when
 *   CollectionForm component is implemented."); it now renders the create
 *   form of the relational UI context and selects the item it creates.
 * - Enter in the dropdown's search box (no option highlighted) submitted the
 *   form around the field; the dropdown is rendered in place, not portalled.
 * - The modal layout's Select dialog listed "No items found" until a search
 *   was typed; it loads the related items when it opens.
 */
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { RelationalUIProvider, type RelationalCollectionFormProps } from "@buildpad/services/relational-ui-context";

jest.mock("@buildpad/hooks", () => ({
    useRelationM2O: jest.fn(),
    useRelationM2OItem: jest.fn(),
}));
jest.mock("@buildpad/services", () => ({
    ...jest.requireActual("@buildpad/services"),
    apiRequest: jest.fn(),
}));

import { useRelationM2O, useRelationM2OItem } from "@buildpad/hooks";
import { apiRequest } from "@buildpad/services";
import { SelectDropdownM2O } from "../select-dropdown-m2o/SelectDropdownM2O";

const RELATION_INFO = {
    relatedCollection: { collection: "authors", meta: {} },
    foreignKeyField: { field: "author", type: "integer" },
    relatedPrimaryKeyField: { field: "id", type: "integer" },
    displayTemplate: "{{name}}",
};

const BASE_PROPS = { collection: "posts", field: "author", allowNone: true };

/** Stands in for CollectionForm: "creates" an author when its button is clicked. */
function FakeCollectionForm({ collection, mode, onSuccess }: RelationalCollectionFormProps) {
    return (
        <div data-testid="fake-collection-form" data-collection={collection} data-mode={mode}>
            <button type="button" onClick={() => onSuccess?.({ name: "New", id: 300 })}>
                fake create
            </button>
        </div>
    );
}

function wrap(ui: React.ReactNode, withForm = true) {
    return (
        <MantineProvider>
            {withForm ? (
                <RelationalUIProvider components={{ CollectionForm: FakeCollectionForm }}>{ui}</RelationalUIProvider>
            ) : (
                ui
            )}
        </MantineProvider>
    );
}

beforeEach(() => {
    jest.clearAllMocks();
    (useRelationM2O as jest.Mock).mockReturnValue({ relationInfo: RELATION_INFO, loading: false, error: null });
    (useRelationM2OItem as jest.Mock).mockReturnValue({
        item: null,
        loading: false,
        error: null,
        loadItem: jest.fn(),
        clearItem: jest.fn(),
        setItem: jest.fn(),
        primaryKey: null,
    });
    (apiRequest as jest.Mock).mockResolvedValue({
        data: [
            { id: 1, name: "Ada" },
            { id: 2, name: "Grace" },
        ],
    });
});

describe("SelectDropdownM2O Create New", () => {
    it("opens a create form for the related collection and selects the new item", async () => {
        const onChange = jest.fn();
        render(wrap(<SelectDropdownM2O {...(BASE_PROPS as any)} value={null} onChange={onChange} />));

        fireEvent.click(screen.getByTestId("m2o-select-author"));
        fireEvent.click(await screen.findByRole("button", { name: "Create New" }));

        const dialog = await screen.findByRole("dialog", { name: "Create New authors" });
        const form = within(dialog).getByTestId("fake-collection-form");
        expect(form).toHaveAttribute("data-collection", "authors");
        expect(form).toHaveAttribute("data-mode", "create");
        expect(dialog).not.toHaveTextContent("Create functionality will be available");

        fireEvent.click(within(dialog).getByRole("button", { name: "fake create" }));

        expect(onChange).toHaveBeenCalledWith(300);
        await waitFor(() => {
            expect(screen.queryByRole("dialog", { name: "Create New authors" })).not.toBeInTheDocument();
        });
    });

    it("says which component is missing when no create form is provided", async () => {
        render(wrap(<SelectDropdownM2O {...(BASE_PROPS as any)} value={null} onChange={jest.fn()} />, false));

        fireEvent.click(screen.getByTestId("m2o-select-author"));
        fireEvent.click(await screen.findByRole("button", { name: "Create New" }));

        expect(await screen.findByTestId("m2o-missing-relational-ui")).toHaveAttribute("data-missing", "CollectionForm");
    });
});

describe("SelectDropdownM2O search box", () => {
    it("does not let Enter submit the form around the field", async () => {
        const onSubmit = jest.fn((e: React.FormEvent) => e.preventDefault());
        render(
            wrap(
                <form onSubmit={onSubmit}>
                    <SelectDropdownM2O {...(BASE_PROPS as any)} value={null} onChange={jest.fn()} />
                    <button type="submit">Save</button>
                </form>,
            ),
        );

        fireEvent.click(screen.getByTestId("m2o-select-author"));
        const search = await screen.findByPlaceholderText("Search...");
        fireEvent.change(search, { target: { value: "Ada" } });

        // false = the default action (the form's implicit submission) is prevented.
        expect(fireEvent.keyDown(search, { key: "Enter", code: "Enter" })).toBe(false);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("still picks a highlighted option with Enter", async () => {
        const onChange = jest.fn();
        render(wrap(<SelectDropdownM2O {...(BASE_PROPS as any)} value={null} onChange={onChange} />));

        fireEvent.click(screen.getByTestId("m2o-select-author"));
        const search = await screen.findByPlaceholderText("Search...");
        await screen.findByText("Ada");
        fireEvent.keyDown(search, { key: "ArrowDown", code: "ArrowDown" });
        fireEvent.keyDown(search, { key: "Enter", code: "Enter" });

        expect(onChange).toHaveBeenCalledWith(1);
    });
});
