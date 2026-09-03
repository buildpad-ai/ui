/**
 * ListO2M — changeset staging & onChange emission.
 *
 * Covers the cases where the component owns pending state that the parent form
 * can only see through `onChange`, so a missed or spurious emit silently
 * corrupts what gets saved:
 *
 * - mounting with an existing value must not emit an empty payload (wipe)
 * - "Add Existing" on an unsaved parent must render AND emit the picked item
 * - un-staging the last change must emit `[]` so the parent drops the edit
 * - staged creates must get unique `$index` values across re-memoization
 * - staged links must be reflected in the count and the unique-FK guard
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
  useRelationO2M: jest.fn(),
  useRelationO2MItems: jest.fn(),
  usePermissions: jest.fn(),
}));

// The edit/select modals render a full CollectionForm / CollectionList. Stub
// them down to a single button that fires the callback under test.
jest.mock("@buildpad/ui-collections", () => {
  const R = require("react");
  return {
    CollectionForm: ({ onSuccess, defaultValues, id, mode }: any) => {
      (globalThis as any).__lastFormDefaults = defaultValues;
      (globalThis as any).__lastFormId = id;
      (globalThis as any).__lastFormMode = mode;
      return R.createElement(
        "button",
        {
          "data-testid": "mock-form-save",
          onClick: () =>
            onSuccess({
              ...((globalThis as any).__formData ?? {}),
              name: (globalThis as any).__formName ?? "New",
              // The real CollectionForm merges a literal `id` into every
              // onSuccess payload — echoing it here is what keeps this stub
              // honest about the shape production actually emits.
              id: id ?? (globalThis as any).__newId ?? "srv-new",
            }),
        },
        "save",
      );
    },
    CollectionList: ({ bulkActions }: any) =>
      R.createElement(
        "button",
        {
          "data-testid": "mock-add-selected",
          onClick: () => bulkActions[0].action((globalThis as any).__pickIds ?? ["p9"]),
        },
        "add selected",
      ),
  };
});

import { apiRequest } from "@buildpad/services";
import { useRelationO2M, useRelationO2MItems, usePermissions } from "@buildpad/hooks";
import { ListO2M } from "../list-o2m/ListO2M";

const RELATION_INFO = {
  relatedCollection: { collection: "posts" },
  reverseJunctionField: { field: "category_id", type: "uuid" },
  relatedPrimaryKeyField: { field: "id", type: "uuid" },
  parentPrimaryKeyField: { field: "id", type: "uuid" },
  relation: {
    field: "category_id",
    collection: "posts",
    related_collection: "categories",
  },
};

// A related collection whose real PK column is "slug", not "id" — the case
// R6.1's fixes cover. Items from this collection never carry a literal
// `.id` property at all.
const SLUG_PK_RELATION_INFO = {
  relatedCollection: { collection: "posts" },
  reverseJunctionField: { field: "category_id", type: "uuid" },
  relatedPrimaryKeyField: { field: "slug", type: "text" },
  parentPrimaryKeyField: { field: "id", type: "uuid" },
  relation: {
    field: "category_id",
    collection: "posts",
    related_collection: "categories",
  },
};

const wrap = (ui: React.ReactNode) => <MantineProvider>{ui}</MantineProvider>;

const BASE_PROPS = {
  collection: "categories",
  field: "posts",
  layout: "table" as const,
  fields: ["id", "name"],
};

function setHookItems(items: Record<string, unknown>[], total = items.length) {
  (useRelationO2MItems as jest.Mock).mockReturnValue({
    items,
    totalCount: total,
    loading: false,
    loadItems: jest.fn(),
    selectItems: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    deleteItem: jest.fn().mockResolvedValue(undefined),
    moveItemUp: jest.fn(),
    moveItemDown: jest.fn(),
  });
}

/** Mirrors VForm: the emitted payload becomes the field edit and is fed back in. */
function Controlled({
  onEmit,
  ...props
}: { onEmit: (v: unknown) => void } & Record<string, unknown>) {
  const [val, setVal] = React.useState<unknown[]>([]);
  return (
    <ListO2M
      {...(BASE_PROPS as any)}
      {...(props as any)}
      value={val as any}
      onChange={(v) => {
        setVal(v as unknown[]);
        onEmit(v);
      }}
    />
  );
}

const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

beforeEach(() => {
  jest.clearAllMocks();
  // clearAllMocks resets calls but NOT implementations — reset apiRequest
  // fully so a describe-level mockImplementation can't leak into later tests.
  (apiRequest as jest.Mock).mockReset();
  (globalThis as any).__formName = "New";
  (globalThis as any).__pickIds = ["p9"];
  (globalThis as any).__formData = undefined;
  (globalThis as any).__newId = undefined;
  (globalThis as any).__lastFormId = undefined;
  (globalThis as any).__lastFormMode = undefined;
  (globalThis as any).__lastFormDefaults = undefined;
  (useRelationO2M as jest.Mock).mockReturnValue({
    relationInfo: RELATION_INFO,
    loading: false,
    error: null,
  });
  (usePermissions as jest.Mock).mockReturnValue({
    canPerform: () => true,
    loading: false,
  });
  setHookItems([]);
});

describe("ListO2M — mount", () => {
  it("does not emit when mounted with a populated value and nothing staged", async () => {
    setHookItems([{ id: "p1", name: "Existing post" }], 1);
    const onChange = jest.fn();

    render(
      wrap(
        <ListO2M
          {...BASE_PROPS}
          primaryKey="cat-1"
          value={[{ id: "p1", name: "Existing post" }]}
          onChange={onChange}
        />,
      ),
    );

    await screen.findByTestId("o2m-table");
    await flush();

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ListO2M — Add Existing on an unsaved parent", () => {
  beforeEach(() => {
    (apiRequest as jest.Mock).mockResolvedValue({
      data: [{ id: "p9", name: "Picked post" }],
    });
  });

  it("renders the picked item and emits the reference with the FK", async () => {
    const onChange = jest.fn();

    render(wrap(<ListO2M {...BASE_PROPS} primaryKey="+" value={[]} onChange={onChange} />));

    fireEvent.click(await screen.findByTestId("o2m-select-btn"));
    fireEvent.click(await screen.findByTestId("mock-add-selected"));

    await waitFor(() => expect(screen.getByTestId("o2m-remove-p9")).toBeInTheDocument());
    expect(screen.getByText("Picked post")).toBeInTheDocument();

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    // reference only — echoing the fetched display fields back makes DaaS drop
    // the entry when the template contains a nested path
    expect(onChange.mock.calls.at(-1)![0]).toEqual([{ id: "p9", category_id: "+" }]);
  });

  it("emits [] when the staged link is removed again", async () => {
    const onEmit = jest.fn();

    render(wrap(<Controlled primaryKey="+" onEmit={onEmit} />));

    fireEvent.click(await screen.findByTestId("o2m-select-btn"));
    fireEvent.click(await screen.findByTestId("mock-add-selected"));
    await waitFor(() => expect(screen.getByTestId("o2m-remove-p9")).toBeInTheDocument());
    const callsAfterStage = onEmit.mock.calls.length;

    fireEvent.click(screen.getByTestId("o2m-remove-p9"));
    await waitFor(() =>
      expect(screen.queryByTestId("o2m-remove-p9")).not.toBeInTheDocument(),
    );
    await flush();

    expect(onEmit.mock.calls.length).toBeGreaterThan(callsAfterStage);
    expect(onEmit.mock.calls.at(-1)![0]).toEqual([]);
  });

  it("includes staged links in the item count", async () => {
    render(wrap(<ListO2M {...BASE_PROPS} primaryKey="+" value={[]} />));

    fireEvent.click(await screen.findByTestId("o2m-select-btn"));
    fireEvent.click(await screen.findByTestId("mock-add-selected"));
    await waitFor(() => expect(screen.getByTestId("o2m-remove-p9")).toBeInTheDocument());

    expect(screen.getByTestId("o2m-count")).toBeInTheDocument();
  });

  it("hides Add Existing once a link is staged on a unique-FK relation", async () => {
    (useRelationO2M as jest.Mock).mockReturnValue({
      relationInfo: { ...RELATION_INFO, isForeignKeyUnique: true },
      loading: false,
      error: null,
    });

    render(wrap(<ListO2M {...BASE_PROPS} primaryKey="+" value={[]} />));

    fireEvent.click(await screen.findByTestId("o2m-select-btn"));
    fireEvent.click(await screen.findByTestId("mock-add-selected"));
    await waitFor(() => expect(screen.getByTestId("o2m-remove-p9")).toBeInTheDocument());

    expect(screen.queryByTestId("o2m-select-btn")).not.toBeInTheDocument();
  });
});

describe("ListO2M — Add Existing on an already-saved parent", () => {
  // Regression: selecting an existing item used to link it via an immediate
  // API call (bypassing onChange), so the parent form's dirty-tracking never
  // saw the change and its Save button stayed disabled even though the link
  // had already been written server-side. Add Existing must always defer to
  // onChange/the changeset, the same as it does for an unsaved parent.
  beforeEach(() => {
    (apiRequest as jest.Mock).mockResolvedValue({
      data: [{ id: "p9", name: "Picked post" }],
    });
  });

  it("stages the pick and emits via onChange instead of linking immediately", async () => {
    const onChange = jest.fn();

    render(
      wrap(
        <ListO2M {...BASE_PROPS} primaryKey="cat-1" value={[]} onChange={onChange} />,
      ),
    );

    fireEvent.click(await screen.findByTestId("o2m-select-btn"));
    fireEvent.click(await screen.findByTestId("mock-add-selected"));

    await waitFor(() => expect(screen.getByTestId("o2m-remove-p9")).toBeInTheDocument());
    expect(screen.getByText("Picked post")).toBeInTheDocument();

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)![0]).toEqual([{ id: "p9", category_id: "cat-1" }]);
  });

  it("un-stages on remove without ever having called selectItems", async () => {
    const hookReturn = {
      items: [],
      totalCount: 0,
      loading: false,
      loadItems: jest.fn(),
      selectItems: jest.fn().mockResolvedValue(undefined),
      removeItem: jest.fn().mockResolvedValue(undefined),
      deleteItem: jest.fn().mockResolvedValue(undefined),
      moveItemUp: jest.fn(),
      moveItemDown: jest.fn(),
    };
    (useRelationO2MItems as jest.Mock).mockReturnValue(hookReturn);

    render(wrap(<ListO2M {...BASE_PROPS} primaryKey="cat-1" value={[]} />));

    fireEvent.click(await screen.findByTestId("o2m-select-btn"));
    fireEvent.click(await screen.findByTestId("mock-add-selected"));
    await waitFor(() => expect(screen.getByTestId("o2m-remove-p9")).toBeInTheDocument());

    expect(hookReturn.selectItems).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("o2m-remove-p9"));
    await waitFor(() =>
      expect(screen.queryByTestId("o2m-remove-p9")).not.toBeInTheDocument(),
    );

    // Un-staging a not-yet-saved pick must not call the immediate unlink/delete
    // API either — it was never linked server-side to begin with.
    expect(hookReturn.removeItem).not.toHaveBeenCalled();
    expect(hookReturn.deleteItem).not.toHaveBeenCalled();
  });
});

describe("ListO2M — saved parent stage→unstage→save revert hole (V3)", () => {
  // Regression: staging a link on a saved parent and then un-staging it
  // again (change of mind) used to emit `[]` once an emit had already
  // happened, because the preserve-fetch was gated on
  // `changeset.link.length > 0` alone. `[]` reaches the relation writer's
  // empty-array branch, which unlinks/deletes every other child. The revert
  // must instead re-preserve the full current id set (a no-op re-link).

  /** What the preserve fetch sees as currently linked server-side. */
  let serverLinked: { id: string }[];
  /** Makes the preserve fetch reject (the pick fetch keeps working). */
  let failPreserve: boolean;

  beforeEach(() => {
    serverLinked = [{ id: "p1" }];
    failPreserve = false;
    (apiRequest as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("category_id")) {
        // preserve-fetch: everything currently linked server-side
        if (failPreserve) return Promise.reject(new Error("network down"));
        return Promise.resolve({ data: [...serverLinked] });
      }
      // the "Add Existing" pick fetch
      return Promise.resolve({ data: [{ id: "p9", name: "Picked post" }] });
    });
  });

  function renderSaved(onChange: jest.Mock) {
    setHookItems([{ id: "p1", name: "Existing post" }], 1);
    return render(
      wrap(
        <ListO2M
          {...BASE_PROPS}
          primaryKey="cat-1"
          value={[{ id: "p1", name: "Existing post" }]}
          onChange={onChange}
        />,
      ),
    );
  }

  async function stageP9(onChange: jest.Mock) {
    fireEvent.click(await screen.findByTestId("o2m-select-btn"));
    fireEvent.click(await screen.findByTestId("mock-add-selected"));
    await waitFor(() => expect(screen.getByTestId("o2m-remove-p9")).toBeInTheDocument());
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  }

  it("re-preserves the full current id set instead of emitting [] on revert", async () => {
    const onChange = jest.fn();
    renderSaved(onChange);

    await stageP9(onChange);
    // Pin the STAGE-TIME payload too: the staged reference plus the
    // preserved sibling. Asserting only the revert would let the
    // `changeset.link.length > 0` gate arm (the original N1 fix) be
    // deleted without any test failing — first-stage saves would then ship
    // a links-only payload that deselects every other child.
    expect(onChange.mock.calls.at(-1)![0]).toEqual([
      { id: "p9", category_id: "cat-1" },
      "p1",
    ]);

    fireEvent.click(screen.getByTestId("o2m-remove-p9"));
    await waitFor(() =>
      expect(screen.queryByTestId("o2m-remove-p9")).not.toBeInTheDocument(),
    );
    await flush();

    const lastPayload = onChange.mock.calls.at(-1)![0];
    expect(lastPayload).not.toEqual([]);
    expect(lastPayload).toEqual(["p1"]);
  });

  it("emits the revert synchronously from the cached id set (no fetch round-trip window)", async () => {
    const onChange = jest.fn();
    renderSaved(onChange);
    await stageP9(onChange);

    // From here on the preserve fetch hangs. The revert emit must not wait
    // on it: the parent form snapshots field values at Save-click time, so
    // an emit delayed by a round-trip lets a Save inside that window submit
    // the payload that still contains the reverted link.
    (apiRequest as jest.Mock).mockImplementation(() => new Promise(() => {}));

    fireEvent.click(screen.getByTestId("o2m-remove-p9"));
    await waitFor(() =>
      expect(screen.queryByTestId("o2m-remove-p9")).not.toBeInTheDocument(),
    );

    expect(onChange.mock.calls.at(-1)![0]).toEqual(["p1"]);
  });

  it("withholds the emit and offers a retry when the preserve fetch fails with no cache", async () => {
    failPreserve = true;
    const onChange = jest.fn();
    renderSaved(onChange);

    fireEvent.click(await screen.findByTestId("o2m-select-btn"));
    fireEvent.click(await screen.findByTestId("mock-add-selected"));
    await waitFor(() => expect(screen.getByTestId("o2m-remove-p9")).toBeInTheDocument());
    await flush();

    // No known-good id set exists, so emitting would be a links-only
    // payload — the writer answers that by deselecting every other child.
    // The emit must be withheld and the failure surfaced to the user.
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("o2m-preserve-error")).toBeInTheDocument();

    failPreserve = false;
    fireEvent.click(screen.getByTestId("o2m-preserve-retry"));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)![0]).toEqual([
      { id: "p9", category_id: "cat-1" },
      "p1",
    ]);
    await waitFor(() =>
      expect(screen.queryByTestId("o2m-preserve-error")).not.toBeInTheDocument(),
    );
  });

  it("re-emits without a child removed through the direct API path", async () => {
    const onChange = jest.fn();
    renderSaved(onChange);
    await stageP9(onChange);
    expect(onChange.mock.calls.at(-1)![0]).toEqual([
      { id: "p9", category_id: "cat-1" },
      "p1",
    ]);

    // Trash the real (already-linked) child on the saved parent: this goes
    // through the immediate removeItem API path, which never touches the
    // changeset — without invalidation the retained payload would still
    // carry "p1" and saving the parent would re-link it.
    serverLinked = [];
    fireEvent.click(screen.getByTestId("o2m-remove-p1"));
    await waitFor(() => {
      expect(onChange.mock.calls.at(-1)![0]).toEqual([
        { id: "p9", category_id: "cat-1" },
      ]);
    });
  });
});

describe("ListO2M — PK-name-agnostic select-all / edit-modal / staged emits (R6.1)", () => {
  beforeEach(() => {
    (useRelationO2M as jest.Mock).mockReturnValue({
      relationInfo: SLUG_PK_RELATION_INFO,
      loading: false,
      error: null,
    });
  });

  it("selects every row via the header checkbox, keyed by the resolved real PK", async () => {
    setHookItems([
      { slug: "post-a", name: "Post A" },
      { slug: "post-b", name: "Post B" },
    ]);

    render(wrap(<ListO2M {...BASE_PROPS} primaryKey="cat-1" value={[]} />));

    fireEvent.click(await screen.findByTestId("o2m-select-all"));

    // Individual row checkboxes are keyed by getPk(item) (here, `slug`) — if
    // select-all populated selectedIds with `.id` (undefined for this
    // collection) instead, none of these would show as checked.
    await waitFor(() => {
      expect(screen.getByTestId("o2m-check-post-a")).toBeChecked();
      expect(screen.getByTestId("o2m-check-post-b")).toBeChecked();
    });
  });

  it("opens the edit modal against the resolved real PK, not undefined", async () => {
    setHookItems([{ slug: "post-a", name: "Post A" }]);

    render(wrap(<ListO2M {...BASE_PROPS} primaryKey="cat-1" value={[]} />));

    fireEvent.click(await screen.findByTestId("o2m-edit-post-a"));

    await waitFor(() =>
      expect((globalThis as any).__lastFormId).toBe("post-a"),
    );
  });

  it("keys a staged-link payload entry by the resolved real PK field, not literal id", async () => {
    (apiRequest as jest.Mock).mockResolvedValue({
      data: [{ slug: "post-z", name: "Picked post" }],
    });
    (globalThis as any).__pickIds = ["post-z"];
    setHookItems([]);

    const onChange = jest.fn();
    render(
      wrap(
        <ListO2M {...BASE_PROPS} primaryKey="cat-1" value={[]} onChange={onChange} />,
      ),
    );

    fireEvent.click(await screen.findByTestId("o2m-select-btn"));
    fireEvent.click(await screen.findByTestId("mock-add-selected"));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const lastPayload = onChange.mock.calls.at(-1)![0] as Record<string, unknown>[];
    // The relation writer resolves records via `itemObj[manyPrimary]`, and
    // `many_primary` is `NOT NULL DEFAULT 'id'` and hardcoded to "id" at
    // every DaaS write site — so the entry must carry the resolved real PK
    // *value* under a literal `id` key. Re-keying it by the related PK
    // column name makes the lookup miss and INSERTs a duplicate.
    expect(lastPayload).toContainEqual(
      expect.objectContaining({ id: "post-z" }),
    );
    expect(
      lastPayload.some((e) => typeof e === "object" && e !== null && "slug" in e),
    ).toBe(false);
  });

  it("keys a staged-update payload entry by the resolved real PK field, not literal id", async () => {
    // changeset.update is only staged for an UNSAVED parent (a saved
    // parent's edit modal calls the API directly and bypasses the
    // changeset/emit path entirely — see handleFormSuccess's early return
    // when isParentSaved). The realistic way to reach it pre-save is
    // editing a just-staged link.
    (apiRequest as jest.Mock).mockResolvedValue({
      data: [{ slug: "post-a", name: "Post A" }],
    });
    (globalThis as any).__pickIds = ["post-a"];
    (globalThis as any).__formName = "Renamed";
    setHookItems([]);

    const onChange = jest.fn();
    render(
      wrap(<ListO2M {...BASE_PROPS} primaryKey="+" value={[]} onChange={onChange} />),
    );

    fireEvent.click(await screen.findByTestId("o2m-select-btn"));
    fireEvent.click(await screen.findByTestId("mock-add-selected"));
    await waitFor(() => expect(screen.getByTestId("o2m-edit-post-a")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("o2m-edit-post-a"));
    fireEvent.click(await screen.findByTestId("mock-form-save"));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const lastPayload = onChange.mock.calls.at(-1)![0] as Record<string, unknown>[];
    expect(
      lastPayload.some(
        (e) => e["id"] === "post-a" && e["name"] === "Renamed",
      ),
    ).toBe(true);
    // The staged edit must also be visible on the row: staged links are
    // appended after the update overlay, so they need the overlay applied
    // too or the user sees their edit silently discarded.
    expect(screen.getByText("Renamed")).toBeInTheDocument();
  });

  it("keeps a user's edit to the PK column instead of reasserting the staged PK", async () => {
    (apiRequest as jest.Mock).mockResolvedValue({
      data: [{ slug: "post-a", name: "Post A" }],
    });
    (globalThis as any).__pickIds = ["post-a"];
    (globalThis as any).__formName = "Post A";
    (globalThis as any).__formData = { slug: "post-a-v2" };
    setHookItems([]);

    const onChange = jest.fn();
    render(
      wrap(<ListO2M {...BASE_PROPS} primaryKey="+" value={[]} onChange={onChange} />),
    );

    fireEvent.click(await screen.findByTestId("o2m-select-btn"));
    fireEvent.click(await screen.findByTestId("mock-add-selected"));
    await waitFor(() => expect(screen.getByTestId("o2m-edit-post-a")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("o2m-edit-post-a"));
    fireEvent.click(await screen.findByTestId("mock-form-save"));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const lastPayload = onChange.mock.calls.at(-1)![0] as Record<string, unknown>[];
    // Re-keying the entry by the PK column would overwrite the rename with
    // the pre-edit value and silently discard the user's change.
    expect(
      lastPayload.some((e) => e["slug"] === "post-a-v2"),
    ).toBe(true);
  });

  it("drops a staged update when the same row is un-staged", async () => {
    (apiRequest as jest.Mock).mockResolvedValue({
      data: [{ slug: "post-a", name: "Post A" }],
    });
    (globalThis as any).__pickIds = ["post-a"];
    (globalThis as any).__formName = "Renamed";
    setHookItems([]);

    const onChange = jest.fn();
    render(
      wrap(<ListO2M {...BASE_PROPS} primaryKey="+" value={[]} onChange={onChange} />),
    );

    fireEvent.click(await screen.findByTestId("o2m-select-btn"));
    fireEvent.click(await screen.findByTestId("mock-add-selected"));
    await waitFor(() => expect(screen.getByTestId("o2m-edit-post-a")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("o2m-edit-post-a"));
    fireEvent.click(await screen.findByTestId("mock-form-save"));
    await waitFor(() => expect(onChange).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId("o2m-remove-post-a"));

    await waitFor(() => {
      const payload = onChange.mock.calls.at(-1)![0] as Record<string, unknown>[];
      // The removed record must not still be handed to the parent form —
      // the writer would update and re-link it on save.
      expect(payload.some((e) => e && (e as any)["id"] === "post-a")).toBe(false);
    });
  });
});

describe("ListO2M — staged creates on an unsaved parent", () => {
  /** create → open edit (re-memoizes handleFormSuccess) → create */
  async function stageTwoCreatesAroundAnEdit() {
    (globalThis as any).__formName = "First";
    (globalThis as any).__newId = "srv-1";
    fireEvent.click(await screen.findByTestId("o2m-create-btn"));
    fireEvent.click(await screen.findByTestId("mock-form-save"));
    await waitFor(() => expect(screen.getByTestId("o2m-remove-$temp_0")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("o2m-edit-$temp_0"));
    await flush();

    (globalThis as any).__formName = "Second";
    (globalThis as any).__newId = "srv-2";
    fireEvent.click(screen.getByTestId("o2m-create-btn"));
    fireEvent.click(screen.getByTestId("mock-form-save"));
    await waitFor(() => expect(screen.getByTestId("o2m-remove-$temp_1")).toBeInTheDocument());
  }

  it("assigns a distinct $index across an interleaved create → edit → create", async () => {
    const onChange = jest.fn();

    render(wrap(<ListO2M {...BASE_PROPS} primaryKey="+" value={[]} onChange={onChange} />));

    await stageTwoCreatesAroundAnEdit();

    expect(screen.getByTestId("o2m-remove-$temp_0")).toBeInTheDocument();
    expect(onChange.mock.calls.at(-1)![0]).toEqual([
      { name: "First", category_id: "+", id: "srv-1" },
      { name: "Second", category_id: "+", id: "srv-2" },
    ]);
  });

  it("removes only the targeted staged create", async () => {
    render(wrap(<ListO2M {...BASE_PROPS} primaryKey="+" value={[]} />));

    await stageTwoCreatesAroundAnEdit();

    fireEvent.click(screen.getByTestId("o2m-remove-$temp_0"));

    await waitFor(() =>
      expect(screen.queryByTestId("o2m-remove-$temp_0")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("emits [] after the only staged create is removed", async () => {
    const onEmit = jest.fn();

    render(wrap(<Controlled primaryKey="+" onEmit={onEmit} />));

    (globalThis as any).__formName = "Only";
    fireEvent.click(await screen.findByTestId("o2m-create-btn"));
    fireEvent.click(await screen.findByTestId("mock-form-save"));
    await waitFor(() => expect(screen.getByTestId("o2m-remove-$temp_0")).toBeInTheDocument());

    expect(onEmit.mock.calls.at(-1)![0]).toEqual([
      { name: "Only", category_id: "+", id: "srv-new" },
    ]);
    const callsAfterStage = onEmit.mock.calls.length;

    fireEvent.click(screen.getByTestId("o2m-remove-$temp_0"));
    await waitFor(() =>
      expect(screen.queryByTestId("o2m-remove-$temp_0")).not.toBeInTheDocument(),
    );
    await flush();

    // otherwise the parent form still holds — and saves — the removed child
    expect(onEmit.mock.calls.length).toBeGreaterThan(callsAfterStage);
    expect(onEmit.mock.calls.at(-1)![0]).toEqual([]);
  });
});

describe("Create New reverse-FK default", () => {
  it("does not pre-fill the '+' placeholder as the child's FK for an unsaved parent", async () => {
    setHookItems([]);
    render(wrap(<Controlled onEmit={jest.fn()} enableCreate primaryKey="+" />));

    fireEvent.click(await screen.findByTestId("o2m-create-btn"));
    await screen.findByTestId("mock-form-save");

    const defaults = (globalThis as any).__lastFormDefaults ?? {};
    expect(defaults.category_id).toBeUndefined();
  });

  it("pre-fills the real parent id as the child's FK once the parent is saved", async () => {
    setHookItems([]);
    render(wrap(<Controlled onEmit={jest.fn()} enableCreate primaryKey="cat-7" />));

    fireEvent.click(await screen.findByTestId("o2m-create-btn"));
    await screen.findByTestId("mock-form-save");

    const defaults = (globalThis as any).__lastFormDefaults ?? {};
    expect(defaults.category_id).toBe("cat-7");
  });
});

describe("ListO2M — rendered columns and selection lifecycle (slug PK)", () => {
  beforeEach(() => {
    (useRelationO2M as jest.Mock).mockReturnValue({
      relationInfo: SLUG_PK_RELATION_INFO,
      loading: false,
      error: null,
    });
  });

  it("renders the resolved PK column, not the bootstrap \"id\" default", async () => {
    setHookItems([{ slug: "post-a", name: "Post A" }]);

    render(wrap(<ListO2M {...BASE_PROPS} primaryKey="cat-1" value={[]} />));
    await screen.findByTestId("o2m-table");

    // The bootstrap "id" is a stand-in for "the primary key", not a real
    // column: rendering it verbatim shows an empty column and sorts by a
    // field this collection doesn't have.
    expect(screen.queryByText("Id")).not.toBeInTheDocument();
    expect(screen.getByText("Slug")).toBeInTheDocument();
    expect(screen.getByText("post-a")).toBeInTheDocument();
  });

  it("does not report select-all when the visible rows are not the selected ones", async () => {
    setHookItems([
      { slug: "post-a", name: "Post A" },
      { slug: "post-b", name: "Post B" },
    ]);

    const { rerender } = render(
      wrap(<ListO2M {...BASE_PROPS} primaryKey="cat-1" value={[]} />),
    );
    await screen.findByTestId("o2m-table");

    fireEvent.click(screen.getByTestId("o2m-select-all"));
    expect(
      (screen.getByTestId("o2m-select-all") as HTMLInputElement).checked,
    ).toBe(true);

    // Swap in a different page of rows, as pagination does. Comparing the
    // Set's size to the row count would still read "all selected" here.
    setHookItems([
      { slug: "post-c", name: "Post C" },
      { slug: "post-d", name: "Post D" },
    ]);
    rerender(wrap(<ListO2M {...BASE_PROPS} primaryKey="cat-1" value={[]} />));
    await screen.findByTestId("o2m-row-post-c");

    expect(
      (screen.getByTestId("o2m-select-all") as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("keeps the header checkbox consistent with the rows when PKs collapse", async () => {
    // Field-level read permissions can strip the PK column from the response,
    // so every row resolves to the same (undefined) key and the Set collapses
    // to one entry. Comparing its size to the row count then reads "not all
    // selected" while every row box renders checked, and the header can never
    // reach its clear branch.
    setHookItems([{ name: "Post A" }, { name: "Post B" }]);

    render(wrap(<ListO2M {...BASE_PROPS} primaryKey="cat-1" value={[]} />));
    await screen.findByTestId("o2m-table");

    const header = () =>
      screen.getByTestId("o2m-select-all") as HTMLInputElement;

    fireEvent.click(header());
    expect(header().checked).toBe(true);

    fireEvent.click(header());
    expect(header().checked).toBe(false);
  });

  it("drops a row's selection once that row leaves the list", async () => {
    setHookItems([{ slug: "post-a", name: "Post A" }]);

    render(wrap(<ListO2M {...BASE_PROPS} primaryKey="+" value={[]} />));
    await screen.findByTestId("o2m-table");

    fireEvent.click(screen.getByTestId("o2m-check-post-a"));
    expect(screen.getByTestId("o2m-batch-remove")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("o2m-remove-post-a"));

    // Otherwise the bar keeps offering to unlink a row that is already gone.
    await waitFor(() =>
      expect(screen.queryByTestId("o2m-batch-remove")).not.toBeInTheDocument(),
    );
  });
});

describe("ListO2M — staged-create modal mode and parent-record reset", () => {
  async function stageOneCreate() {
    (globalThis as any).__formName = "Draft";
    (globalThis as any).__newId = "srv-draft";
    fireEvent.click(await screen.findByTestId("o2m-create-btn"));
    fireEvent.click(await screen.findByTestId("mock-form-save"));
    await waitFor(() =>
      expect(screen.getByTestId("o2m-edit-$temp_0")).toBeInTheDocument(),
    );
  }

  it("opens a staged create in create mode rather than an edit with no id", async () => {
    setHookItems([]);
    render(wrap(<ListO2M {...BASE_PROPS} primaryKey="+" value={[]} />));
    await stageOneCreate();

    fireEvent.click(screen.getByTestId("o2m-edit-$temp_0"));
    await flush();

    // A staged create has no server row, so `id` is undefined by design —
    // `mode` has to follow it, or CollectionForm routes Save into createOne.
    expect((globalThis as any).__lastFormId).toBeUndefined();
    expect((globalThis as any).__lastFormMode).toBe("create");
  });

  it("resets staged changes when the parent record changes", async () => {
    setHookItems([]);
    const onChange = jest.fn();
    const { rerender } = render(
      wrap(
        <ListO2M {...BASE_PROPS} primaryKey="+" value={[]} onChange={onChange} />,
      ),
    );
    await stageOneCreate();

    rerender(
      wrap(
        <ListO2M
          {...BASE_PROPS}
          primaryKey="cat-9"
          value={[]}
          onChange={onChange}
        />,
      ),
    );

    // Record A's staged create must not be emitted for record B.
    await waitFor(() =>
      expect(screen.queryByTestId("o2m-edit-$temp_0")).not.toBeInTheDocument(),
    );
  });
});

describe("ListO2M — reorder arrows vs staged rows", () => {
  const SORTABLE_RELATION_INFO = { ...RELATION_INFO, sortField: "sort" };

  beforeEach(() => {
    (useRelationO2M as jest.Mock).mockReturnValue({
      relationInfo: SORTABLE_RELATION_INFO,
      loading: false,
      error: null,
    });
    (apiRequest as jest.Mock).mockResolvedValue({
      data: [{ id: "p9", name: "Picked post" }],
    });
  });

  it("disables reorder for a staged row, which the movers cannot index", async () => {
    setHookItems([{ id: "p1", name: "Existing post" }]);

    render(wrap(<ListO2M {...BASE_PROPS} primaryKey="cat-1" value={[]} />));
    await screen.findByTestId("o2m-table");

    fireEvent.click(screen.getByTestId("o2m-select-btn"));
    fireEvent.click(await screen.findByTestId("mock-add-selected"));
    await waitFor(() =>
      expect(screen.getByTestId("o2m-row-p9")).toBeInTheDocument(),
    );

    // p9 is staged only — it isn't in the array the movers index, so passing
    // its display index would swap in `undefined` and throw mid-reorder.
    expect(screen.getByTestId("o2m-move-up-p9")).toBeDisabled();
    expect(screen.getByTestId("o2m-move-down-p9")).toBeDisabled();

    // p1 is the only real row, so it can move neither way.
    expect(screen.getByTestId("o2m-move-up-p1")).toBeDisabled();
    expect(screen.getByTestId("o2m-move-down-p1")).toBeDisabled();
  });
});
