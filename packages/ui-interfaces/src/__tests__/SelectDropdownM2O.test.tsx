/**
 * SelectDropdownM2O — clear-reset and typed foreign-key emission.
 *
 * Regression tests for the two audit fixes:
 *
 * - clearing the value (non-null → null) must reset the loaded item via
 *   clearItem(); previously the load effect only handled the truthy branch,
 *   so the field kept showing the stale label
 * - picking an option must emit the item's real (possibly numeric) key, not
 *   Mantine's stringified option value — a stringified FK corrupts the stored
 *   type and the `active` highlight (raw === raw) never matches again
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

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
    relatedCollection: { collection: "levels", meta: {} },
    foreignKeyField: { field: "level_id", type: "integer" },
    relatedPrimaryKeyField: { field: "id", type: "integer" },
    displayTemplate: "{{name}}",
};

const wrap = (ui: React.ReactNode) => <MantineProvider>{ui}</MantineProvider>;

const BASE_PROPS = {
    collection: "courses",
    field: "level_id",
    allowNone: true,
};

function setItemHook(overrides: Record<string, unknown> = {}) {
    const hook = {
        item: null as Record<string, unknown> | null,
        loading: false,
        error: null,
        loadItem: jest.fn(),
        clearItem: jest.fn(),
        setItem: jest.fn(),
        primaryKey: null,
        ...overrides,
    };
    (useRelationM2OItem as jest.Mock).mockReturnValue(hook);
    return hook;
}

beforeEach(() => {
    jest.clearAllMocks();
    (useRelationM2O as jest.Mock).mockReturnValue({
        relationInfo: RELATION_INFO,
        loading: false,
        error: null,
    });
    (apiRequest as jest.Mock).mockResolvedValue({
        data: [
            { id: 104, name: "Advanced" },
            { id: 205, name: "Basic" },
        ],
    });
    setItemHook();
});

describe("SelectDropdownM2O clear reset", () => {
    it("clears the loaded item when the value goes non-null → null", () => {
        const hook = setItemHook({ item: { id: 104, name: "Advanced" } });

        const { rerender } = render(
            wrap(<SelectDropdownM2O {...(BASE_PROPS as any)} value={104} onChange={jest.fn()} />),
        );

        expect(hook.loadItem).toHaveBeenCalled();
        expect(hook.clearItem).not.toHaveBeenCalled();

        rerender(
            wrap(<SelectDropdownM2O {...(BASE_PROPS as any)} value={null} onChange={jest.fn()} />),
        );

        expect(hook.clearItem).toHaveBeenCalled();
    });

    it("emits null from the clear button (composes with the reset above)", () => {
        setItemHook({ item: { id: 104, name: "Advanced" } });
        const onChange = jest.fn();

        render(wrap(<SelectDropdownM2O {...(BASE_PROPS as any)} value={104} onChange={onChange} />));

        fireEvent.click(screen.getByLabelText("Clear selection"));

        expect(onChange).toHaveBeenCalledWith(null);
    });
});

describe("SelectDropdownM2O typed foreign keys", () => {
    it("emits the option's real numeric key, not Mantine's stringified value", async () => {
        const onChange = jest.fn();

        render(wrap(<SelectDropdownM2O {...(BASE_PROPS as any)} value={null} onChange={onChange} />));

        fireEvent.click(screen.getByTestId("m2o-select-level_id"));
        fireEvent.click(await screen.findByText("Advanced"));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(104);
    });

    it("still emits string keys untouched for string-keyed collections", async () => {
        (apiRequest as jest.Mock).mockResolvedValue({
            data: [{ id: "uuid-a", name: "Alpha" }],
        });
        const onChange = jest.fn();

        render(wrap(<SelectDropdownM2O {...(BASE_PROPS as any)} value={null} onChange={onChange} />));

        fireEvent.click(screen.getByTestId("m2o-select-level_id"));
        fireEvent.click(await screen.findByText("Alpha"));

        expect(onChange).toHaveBeenCalledWith("uuid-a");
    });
});
