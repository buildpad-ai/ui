/**
 * CollectionForm supplies the relational UI context (CollectionForm,
 * CollectionList, VForm) to the fields its VForm renders, and
 * CollectionsRelationalProvider supplies the same for standalone use.
 * This is what lets ListO2M/M2M/M2A open their dialogs without importing
 * @buildpad/ui-collections (the ui-form ⇄ ui-interfaces ⇄ ui-collections
 * cycle-break).
 */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RelationalUIProvider, useRelationalUI, type RelationalUIComponents } from "@buildpad/services/relational-ui-context";

const { seen, mockFieldsReadAll, mockPermissionsGetAccess } = vi.hoisted(() => ({
  seen: { current: null as RelationalUIComponents | null },
  mockFieldsReadAll: vi.fn(),
  mockPermissionsGetAccess: vi.fn(),
}));

vi.mock("@buildpad/services", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@buildpad/services")>()),
  FieldsService: vi.fn().mockImplementation(() => ({ readAll: mockFieldsReadAll })),
  ItemsService: vi.fn().mockImplementation(() => ({ readOne: vi.fn() })),
  PermissionsService: { getMyCollectionAccess: mockPermissionsGetAccess },
  apiRequest: vi.fn(),
}));

// VForm double that records the relational components in scope where the
// form's fields (and so any ListO2M/M2M/M2A) would render.
vi.mock("@buildpad/ui-form", async () => {
  const { useRelationalUI: useUI } = await import("@buildpad/services/relational-ui-context");
  return {
    VForm: function VForm() {
      seen.current = useUI();
      return <div data-testid="vform-probe" />;
    },
  };
});

vi.mock("../src/SaveOptions", () => ({ SaveOptions: () => null }));
// Resolving the lazy CollectionList loads its module; its table and filter
// panel are not under test (collection-list.test.tsx isolates them the same way).
vi.mock("@buildpad/ui-table", () => ({}));
vi.mock("../src/FilterPanel", () => ({ FilterPanel: () => null }));

import { CollectionForm, CollectionsRelationalProvider } from "../src/CollectionForm";
import { VForm } from "@buildpad/ui-form";

const REACT_LAZY = Symbol.for("react.lazy");
const isLazy = (c: unknown) => (c as { $$typeof?: symbol } | undefined)?.$$typeof === REACT_LAZY;

function Probe() {
  seen.current = useRelationalUI();
  return null;
}

beforeEach(() => {
  seen.current = null;
  mockFieldsReadAll.mockResolvedValue([{ field: "title", type: "string", meta: { interface: "input", sort: 1 } }]);
  mockPermissionsGetAccess.mockResolvedValue({});
});

describe("CollectionForm provides the relational UI", () => {
  it("supplies itself, a lazily loaded CollectionList and VForm to its fields", async () => {
    render(<CollectionForm collection="posts" />);
    await screen.findByTestId("vform-probe");

    expect(seen.current?.CollectionForm).toBe(CollectionForm);
    expect(seen.current?.FormRenderer).toBe(VForm);
    expect(isLazy(seen.current?.CollectionList)).toBe(true);
  });

  it("never overrides a component an app-level provider chose", async () => {
    const AppList = () => null;
    render(
      <RelationalUIProvider components={{ CollectionList: AppList }}>
        <CollectionForm collection="posts" />
      </RelationalUIProvider>,
    );
    await screen.findByTestId("vform-probe");

    expect(seen.current?.CollectionList).toBe(AppList);
    expect(seen.current?.CollectionForm).toBe(CollectionForm);
  });

  it("the lazy CollectionList resolves to the real component", async () => {
    render(<CollectionForm collection="posts" />);
    await screen.findByTestId("vform-probe");
    const lazy = seen.current?.CollectionList as unknown as {
      _init: (payload: unknown) => unknown;
      _payload: unknown;
    };
    // React.lazy's thenable: calling _init starts the import and throws the
    // pending promise until it settles.
    let resolved: unknown;
    await waitFor(() => {
      try {
        resolved = lazy._init(lazy._payload);
      } catch (pending) {
        throw pending instanceof Promise ? new Error("pending") : pending;
      }
      expect(resolved).toBeTruthy();
    });
    const { CollectionList } = await import("../src/CollectionList");
    expect(resolved).toBe(CollectionList);
  });
});

describe("CollectionsRelationalProvider", () => {
  it("supplies the built-in components to standalone relational interfaces", () => {
    render(
      <CollectionsRelationalProvider>
        <Probe />
      </CollectionsRelationalProvider>,
    );
    expect(seen.current?.CollectionForm).toBe(CollectionForm);
    expect(seen.current?.FormRenderer).toBe(VForm);
    expect(isLazy(seen.current?.CollectionList)).toBe(true);
  });

  it("`components` replace individual built-ins", () => {
    const MyForm = () => null;
    render(
      <CollectionsRelationalProvider components={{ CollectionForm: MyForm }}>
        <Probe />
      </CollectionsRelationalProvider>,
    );
    expect(seen.current?.CollectionForm).toBe(MyForm);
    expect(seen.current?.FormRenderer).toBe(VForm);
  });
});
