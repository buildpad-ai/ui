/**
 * JunctionItemForm renders its two sections with the FormRenderer (VForm) a
 * relational provider supplies — it no longer imports @buildpad/ui-form.
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

jest.mock("@buildpad/services", () => {
    const actual = jest.requireActual("@buildpad/services");
    return {
        apiRequest: jest.fn(),
        useBuildpadI18n: actual.useBuildpadI18n,
        useBuildpadTranslations: actual.useBuildpadTranslations,
    };
});

import { apiRequest } from "@buildpad/services";
import { RelationalUIProvider } from "@buildpad/services/relational-ui-context";
import { JunctionItemForm } from "../list-m2a/JunctionItemForm";
import { id as idDictionary } from "@buildpad/utils";

const { BuildpadI18nProvider } = jest.requireActual("@buildpad/services");

const RELATION_INFO = {
    junctionCollection: { collection: "pages_blocks" },
    collectionField: { field: "collection" },
    junctionField: { field: "item" },
    reverseJunctionField: { field: "page_id" },
    junctionPrimaryKeyField: { field: "id" },
    relationPrimaryKeyFields: { headings: { field: "id" } },
} as any;

const FIELDS: Record<string, unknown[]> = {
    "/api/fields/headings": [{ field: "title", type: "string", meta: {}, schema: {} }],
    "/api/fields/pages_blocks": [{ field: "note", type: "string", meta: {}, schema: {} }],
};

const rendererProps = jest.fn();
const StubRenderer = (props: any) => {
    rendererProps(props);
    return <div data-testid={`renderer-${props.collection}`} />;
};

const baseProps = {
    relationInfo: RELATION_INFO,
    item: null,
    targetCollection: "headings",
    isNew: true,
    onSave: jest.fn(),
    onCancel: jest.fn(),
};

beforeEach(() => {
    jest.clearAllMocks();
    (apiRequest as jest.Mock).mockImplementation((path: string) => Promise.resolve({ data: FIELDS[path] ?? [] }));
});

describe("JunctionItemForm — relational UI provider", () => {
    it("without a provider: shows the alert, hides the save action and still lets the user cancel", async () => {
        const onCancel = jest.fn();
        render(
            <MantineProvider>
                <JunctionItemForm {...baseProps} onCancel={onCancel} />
            </MantineProvider>,
        );

        const alert = await screen.findByTestId("junction-missing-relational-ui");
        expect(alert).toHaveAttribute("data-missing", "FormRenderer");
        expect(screen.queryByTestId("junction-form-save")).not.toBeInTheDocument();
        fireEvent.click(screen.getByText("Cancel"));
        expect(onCancel).toHaveBeenCalled();
    });

    it("renders both sections with the provider's FormRenderer", async () => {
        render(
            <MantineProvider>
                <RelationalUIProvider components={{ FormRenderer: StubRenderer }}>
                    <JunctionItemForm {...baseProps} />
                </RelationalUIProvider>
            </MantineProvider>,
        );

        expect(await screen.findByTestId("renderer-headings")).toBeInTheDocument();
        expect(await screen.findByTestId("renderer-pages_blocks")).toBeInTheDocument();
        expect(screen.getByTestId("junction-form-save")).toBeInTheDocument();
        await waitFor(() =>
            expect(rendererProps).toHaveBeenCalledWith(
                expect.objectContaining({ collection: "headings", primaryKey: "+", showNoVisibleFields: false }),
            ),
        );
    });

    it("the `components` prop wins over the provider", async () => {
        const Other = () => <div data-testid="other-renderer" />;
        render(
            <MantineProvider>
                <RelationalUIProvider components={{ FormRenderer: StubRenderer }}>
                    <JunctionItemForm {...baseProps} components={{ FormRenderer: Other }} />
                </RelationalUIProvider>
            </MantineProvider>,
        );

        expect((await screen.findAllByTestId("other-renderer")).length).toBe(2);
        expect(screen.queryByTestId("renderer-headings")).not.toBeInTheDocument();
    });

    it("the alert is translated", async () => {
        render(
            <MantineProvider>
                <BuildpadI18nProvider locale="id" translations={idDictionary}>
                    <JunctionItemForm {...baseProps} />
                </BuildpadI18nProvider>
            </MantineProvider>,
        );
        expect(await screen.findByText("Item terkait tidak dapat diubah di sini")).toBeInTheDocument();
    });
});
