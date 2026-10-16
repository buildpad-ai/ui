/**
 * CollectionForm Component Tests
 *
 * Tests rendering, CRUD operations, permission enforcement, and delete flow.
 * Mocks @buildpad/services, @buildpad/ui-form (VForm), and @buildpad/ui-table.
 */

import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MantineProvider } from "@mantine/core";

// -------------------------------------------------------------------
// Service mocks — use vi.hoisted so they are available in vi.mock factories
// -------------------------------------------------------------------
const {
  mockFieldsReadAll,
  mockPermissionsGetAccess,
  permissionState,
  mockItemsReadOne,
  mockItemsCreateOne,
  mockItemsUpdateOne,
  mockItemsDeleteOne,
  mockItemsDeleteMany,
  mockJunctionCreateOne,
  mockJunctionDeleteOne,
} = vi.hoisted(() => ({
  mockFieldsReadAll: vi.fn(),
  mockPermissionsGetAccess: vi.fn(),
  // PermissionsService.isAdmin: true by default (each test starts as an
  // administrator); a test that hands the form a role's access map sets it
  // to false, as the real service does for a non-administrator.
  permissionState: { isAdmin: true },
  mockItemsReadOne: vi.fn(),
  mockItemsCreateOne: vi.fn(),
  mockItemsUpdateOne: vi.fn(),
  mockItemsDeleteOne: vi.fn(),
  mockItemsDeleteMany: vi.fn(),
  // Writes to a junction collection (any collection but the form's "posts"),
  // called with (collection, data | id).
  mockJunctionCreateOne: vi.fn(),
  mockJunctionDeleteOne: vi.fn(),
}));

vi.mock("@buildpad/services", async (importOriginal) => ({
  // Keep the real i18n hooks (they fall back to the English defaults without a
  // provider); only the data services are replaced.
  ...(await importOriginal<typeof import("@buildpad/services")>()),
  FieldsService: vi.fn().mockImplementation(() => ({
    readAll: mockFieldsReadAll,
  })),
  ItemsService: vi.fn().mockImplementation((collection: string) => ({
    readOne: mockItemsReadOne,
    createOne: (data: Record<string, unknown>) =>
      collection === "posts"
        ? mockItemsCreateOne(data)
        : mockJunctionCreateOne(collection, data),
    updateOne: mockItemsUpdateOne,
    deleteOne: (id: string | number) =>
      collection === "posts"
        ? mockItemsDeleteOne(id)
        : mockJunctionDeleteOne(collection, id),
    deleteMany: mockItemsDeleteMany,
  })),
  PermissionsService: {
    getMyCollectionAccess: mockPermissionsGetAccess,
    get isAdmin() {
      return permissionState.isAdmin;
    },
  },
  apiRequest: vi.fn(),
}));

// Mock VForm to a simple controlled component so we can drive it in tests
// Models the two halves of VForm's contract that CollectionForm depends on:
// it renders `modelValue` falling back to `initialValues`, and it emits the
// COMPLETE model on every change — dropping the key entirely when the value
// returns to the field's initial/default rather than recording it as an edit.
// A double that emitted only the changed key could not tell a merging
// `handleFormUpdate` from a replacing one.
vi.mock("@buildpad/ui-form", () => ({
  VForm: vi.fn(({ fields, modelValue, initialValues, onUpdate, disabled }: {
    fields: Array<{ field: string; meta?: { required?: boolean } }>;
    modelValue: Record<string, unknown>;
    initialValues?: Record<string, unknown>;
    onUpdate: (values: Record<string, unknown>) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="vform-mock">
      {/* Sets a field to a JSON value (a relational field's staged changes). */}
      {fields.map((f) => (
        <input
          key={`json-${f.field}`}
          data-testid={`json-${f.field}`}
          onChange={(e) => onUpdate({ ...modelValue, [f.field]: JSON.parse(e.target.value) })}
        />
      ))}
      {fields.map((f) => (
        <input
          key={f.field}
          data-testid={`field-${f.field}`}
          value={String(modelValue[f.field] ?? initialValues?.[f.field] ?? "")}
          disabled={disabled}
          required={f.meta?.required === true}
          onChange={(e) => {
            const next = { ...modelValue, [f.field]: e.target.value };
            const initial = initialValues?.[f.field];
            if (initial !== undefined && e.target.value === String(initial)) {
              delete next[f.field];
            }
            onUpdate(next);
          }}
        />
      ))}
    </div>
  )),
}));

// Minimal mock for SaveOptions — forwards the callbacks so tests can drive
// the save-variant paths (save-as-copy in particular, which builds its own
// payload rather than reusing the update body).
vi.mock("../src/SaveOptions", () => ({
  SaveOptions: ({ onSaveAsCopy, onSaveAndStay, onSaveAndAddNew, onDiscardAndStay }: {
    onSaveAsCopy?: () => void;
    onSaveAndStay?: () => void;
    onSaveAndAddNew?: () => void;
    onDiscardAndStay?: () => void;
  }) => (
    <div data-testid="save-options-mock">
      <button type="button" data-testid="save-as-copy" onClick={onSaveAsCopy} />
      <button type="button" data-testid="save-and-stay" onClick={onSaveAndStay} />
      <button type="button" data-testid="save-add-new" onClick={onSaveAndAddNew} />
      <button type="button" data-testid="discard-and-stay" onClick={onDiscardAndStay} />
    </div>
  ),
}));

// Import component under test AFTER mocks
import { apiRequest, ApiRequestError } from "@buildpad/services";
import { CollectionForm } from "../src/CollectionForm";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
const SAMPLE_FIELDS = [
  { field: "title", type: "string", meta: { interface: "input", sort: 1 } },
  { field: "body", type: "text", meta: { interface: "input-multiline", sort: 2 } },
];

/** Returns SAMPLE_FIELDS for FieldsService.readAll and empty permissions (admin) */
function setupDefaultMocks() {
  mockFieldsReadAll.mockResolvedValue(SAMPLE_FIELDS);
  mockPermissionsGetAccess.mockResolvedValue({});
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

function renderForm(props: Partial<React.ComponentProps<typeof CollectionForm>> = {}) {
  return render(
    <CollectionForm collection="posts" {...props} />,
    { wrapper },
  );
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------
afterEach(() => {
  cleanup();
});

// Every test starts as an administrator (see permissionState).
beforeEach(() => {
  permissionState.isAdmin = true;
});

describe("CollectionForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // =====================================================================
  // Rendering
  // =====================================================================
  describe("rendering", () => {
    it("renders with loading overlay then VForm", async () => {
      renderForm();

      // After loading, VForm should be rendered
      await waitFor(() => {
        expect(screen.getByTestId("vform-mock")).toBeInTheDocument();
      });
    });

    it("shows error alert when fields fail to load", async () => {
      mockFieldsReadAll.mockRejectedValueOnce(new Error("Network error"));

      renderForm();

      await waitFor(() => {
        expect(screen.getByTestId("form-error")).toBeInTheDocument();
      });
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    it("renders Create button in create mode", async () => {
      renderForm({ mode: "create" });

      await waitFor(() => {
        expect(screen.getByTestId("form-submit-btn")).toHaveTextContent("Create");
      });
    });

    it("renders Save button in edit mode", async () => {
      mockItemsReadOne.mockResolvedValue({ id: 1, title: "Test", body: "Hello" });

      renderForm({ mode: "edit", id: 1 });

      await waitFor(() => {
        expect(screen.getByTestId("form-submit-btn")).toHaveTextContent("Save");
      });
    });
  });

  // =====================================================================
  // Create operation
  // =====================================================================
  describe("create", () => {
    it("calls ItemsService.createOne on form submit", async () => {
      mockItemsCreateOne.mockResolvedValueOnce({ id: 42, title: "New" });
      const onSuccess = vi.fn();

      renderForm({ mode: "create", onSuccess });

      await waitFor(() => {
        expect(screen.getByTestId("vform-mock")).toBeInTheDocument();
      });

      // Type into the title field
      const titleInput = screen.getByTestId("field-title");
      fireEvent.change(titleInput, { target: { value: "New Post" } });

      // Submit
      fireEvent.click(screen.getByTestId("form-submit-btn"));

      await waitFor(() => {
        expect(mockItemsCreateOne).toHaveBeenCalled();
      });
    });

    it("seeds create-mode form data from each field's own schema default_value", async () => {
      // Postgres reports a typed literal default with a `::type` cast suffix
      // (e.g. `'active'::character varying`) — getFieldDefault handles the
      // parsing; this covers CollectionForm actually calling it for create
      // mode, which it previously never did (only the defaultValues prop
      // and permission presets seeded initial form data).
      mockFieldsReadAll.mockResolvedValue([
        { field: "status", type: "string", schema: { default_value: "'active'::character varying" }, meta: { interface: "input", sort: 1 } },
        { field: "theme", type: "string", schema: { default_value: "auto" }, meta: { interface: "input", sort: 2 } },
        { field: "title", type: "string", schema: { default_value: null }, meta: { interface: "input", sort: 3 } },
      ]);

      renderForm({ mode: "create" });

      await waitFor(() => {
        expect(screen.getByTestId("field-status")).toHaveValue("active");
      });
      expect(screen.getByTestId("field-theme")).toHaveValue("auto");
      expect(screen.getByTestId("field-title")).toHaveValue("");
    });

    it("lets an explicit defaultValues prop override a field's schema default", async () => {
      mockFieldsReadAll.mockResolvedValue([
        { field: "status", type: "string", schema: { default_value: "'active'::character varying" }, meta: { interface: "input", sort: 1 } },
        // A second defaulted field the prop does NOT cover, so the test can
        // tell "the prop won the tie" apart from "no seeding happened".
        { field: "theme", type: "string", schema: { default_value: "auto" }, meta: { interface: "input", sort: 2 } },
      ]);

      renderForm({ mode: "create", defaultValues: { status: "draft" } });

      await waitFor(() => {
        expect(screen.getByTestId("field-status")).toHaveValue("draft");
      });
      // Assert the schema default was actually computed and then LOST the
      // tie: without this the test passes with the seeding removed entirely,
      // because "draft" arrives from the prop either way.
      expect(screen.getByTestId("field-status")).not.toHaveValue("active");
      expect(screen.getByTestId("field-theme")).toHaveValue("auto");
    });

    // Presets are how a role forces a value on create (status, owner,
    // tenant_id). A column default is the weakest signal and must lose to one.
    it("lets a permission preset override a field's schema default", async () => {
      mockFieldsReadAll.mockResolvedValue([
        { field: "status", type: "string", schema: { default_value: "'active'::character varying" }, meta: { interface: "input", sort: 1 } },
      ]);
      permissionState.isAdmin = false;
      mockPermissionsGetAccess.mockResolvedValueOnce({
        posts: {
          read: { fields: ["*"] },
          create: { fields: ["*"], presets: { status: "pending_review" } },
        },
      });

      renderForm({ mode: "create" });

      await waitFor(() => {
        expect(screen.getByTestId("field-status")).toHaveValue("pending_review");
      });
    });

    // Everything in formData is sent on create, so a field the role cannot
    // write must never be seeded — it would put that field in the payload.
    it("does not seed a field outside the role's create fields", async () => {
      mockItemsCreateOne.mockResolvedValueOnce({ id: 1 });
      mockFieldsReadAll.mockResolvedValue([
        { field: "title", type: "string", meta: { interface: "input", sort: 1 } },
        { field: "status", type: "string", schema: { default_value: "'active'::character varying" }, meta: { interface: "input", sort: 2 } },
      ]);
      permissionState.isAdmin = false;
      mockPermissionsGetAccess.mockResolvedValueOnce({
        posts: { read: { fields: ["*"] }, create: { fields: ["title"] } },
      });

      renderForm({ mode: "create" });
      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("form-submit-btn"));
      await waitFor(() => {
        expect(mockItemsCreateOne).toHaveBeenCalled();
      });
      expect(Object.keys(mockItemsCreateOne.mock.calls[0][0])).not.toContain("status");
    });

    // A form definition's per-field config is overlaid AFTER the permission
    // pass and can set `readonly: false` (build-fields-from-definition.ts:88),
    // clearing the flag that pass raised. Write permission has to be checked
    // in its own right, or a definition re-opens a field the role cannot write.
    it("does not seed an unwritable field a definition marks writable", async () => {
      mockItemsCreateOne.mockResolvedValueOnce({ id: 1 });
      mockFieldsReadAll.mockResolvedValue([
        { field: "title", type: "string", meta: { interface: "input", sort: 1 } },
        { field: "status", type: "string", schema: { default_value: "'active'::character varying" }, meta: { interface: "input", sort: 2 } },
      ]);
      permissionState.isAdmin = false;
      mockPermissionsGetAccess.mockResolvedValueOnce({
        posts: { read: { fields: ["*"] }, create: { fields: ["title"] } },
      });

      renderForm({
        mode: "create",
        definition: {
          name: "Post create",
          target_collection: "posts",
          sections: [
            {
              id: "main",
              fields: [
                { field: "title" },
                { field: "status", readonly: false },
              ],
            },
          ],
        },
      });

      await waitFor(() => {
        expect(screen.getByTestId("field-status")).toBeInTheDocument();
      });
      expect(screen.getByTestId("field-status")).toHaveValue("");

      fireEvent.click(screen.getByTestId("form-submit-btn"));
      await waitFor(() => {
        expect(mockItemsCreateOne).toHaveBeenCalled();
      });
      expect(Object.keys(mockItemsCreateOne.mock.calls[0][0])).not.toContain("status");
    });

    // A column the schema itself declares readonly is not the user's to set,
    // even when the role's write permission is unrestricted.
    it("does not seed a field the schema declares readonly", async () => {
      mockFieldsReadAll.mockResolvedValue([
        { field: "title", type: "string", meta: { interface: "input", sort: 1 } },
        { field: "code", type: "string", schema: { default_value: "'auto'::character varying" }, meta: { interface: "input", sort: 2, readonly: true } },
      ]);

      renderForm({ mode: "create" });

      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toBeInTheDocument();
      });
      expect(screen.getByTestId("field-code")).toHaveValue("");
    });

    // A field hidden by a form-definition condition is never shown, so writing
    // its column default would persist a value the user never saw.
    it("does not seed a hidden field", async () => {
      mockFieldsReadAll.mockResolvedValue([
        { field: "title", type: "string", meta: { interface: "input", sort: 1 } },
        { field: "severity", type: "string", schema: { default_value: "'medium'::character varying" }, meta: { interface: "input", sort: 2, hidden: true } },
      ]);

      renderForm({ mode: "create" });

      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toBeInTheDocument();
      });
      expect(screen.getByTestId("field-severity")).toHaveValue("");
    });

    // VForm drops a key from the model when the value returns to its default;
    // merging that back left the previous choice in place.
    it("keeps a re-selected default instead of reverting to the previous value", async () => {
      mockFieldsReadAll.mockResolvedValue([
        { field: "status", type: "string", schema: { default_value: "'active'::character varying" }, meta: { interface: "input", sort: 1 } },
      ]);

      renderForm({ mode: "create" });
      const input = await screen.findByTestId("field-status");
      expect(input).toHaveValue("active");

      fireEvent.change(input, { target: { value: "draft" } });
      await waitFor(() => expect(screen.getByTestId("field-status")).toHaveValue("draft"));

      // Back to the default: the VForm double reports the whole model, minus
      // the key, exactly as the real component does on a revert.
      fireEvent.change(screen.getByTestId("field-status"), { target: { value: "active" } });
      await waitFor(() => expect(screen.getByTestId("field-status")).toHaveValue("active"));
    });
  });

  // =====================================================================
  // Edit / Update operation
  // =====================================================================
  describe("save as copy", () => {
    // A concealed column reads back as a mask, never as the secret, and
    // formData holds that mask verbatim. Copying it would write the literal
    // asterisks into the new row — a guessable static token, or a password
    // hashed from "**********".
    it("does not copy a concealed value into the duplicated row", async () => {
      mockFieldsReadAll.mockResolvedValue([
        { field: "id", type: "integer", meta: { interface: "input", sort: 0 } },
        { field: "title", type: "string", meta: { interface: "input", sort: 1 } },
        { field: "token", type: "string", meta: { interface: "system-token", special: ["conceal"], sort: 2 } },
      ]);
      mockItemsReadOne.mockResolvedValue({ id: 7, title: "Row", token: "**************" });
      mockItemsUpdateOne.mockResolvedValue({ id: 7 });
      mockItemsCreateOne.mockResolvedValue({ id: 8 });

      renderForm({ mode: "edit", id: "7", showSaveOptions: true });
      await waitFor(() => {
        expect(screen.getByTestId("save-as-copy")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("save-as-copy"));
      await waitFor(() => {
        expect(mockItemsCreateOne).toHaveBeenCalled();
      });

      const copied = mockItemsCreateOne.mock.calls[0][0];
      expect(copied).not.toHaveProperty("token");
      // The rest of the row still copies.
      expect(copied).toHaveProperty("title", "Row");
    });
  });

  describe("a create whose junction write fails", () => {
    const M2M_FIELDS = [
      { field: "title", type: "string", meta: { interface: "input", sort: 1 } },
      { field: "tags", type: "alias", meta: { interface: "list-m2m", special: ["m2m"], sort: 2 } },
    ];

    function relationsApi() {
      vi.mocked(apiRequest).mockImplementation(async (path: string) => {
        if (path === "/api/relations") {
          return {
            data: [
              {
                collection: "posts_tags",
                field: "posts_id",
                related_collection: "posts",
                meta: { one_field: "tags", junction_field: "tags_id" },
              },
            ],
          } as never;
        }
        return { data: [{ field: "id", schema: { is_primary_key: true } }] } as never;
      });
    }

    async function fillAndCreate() {
      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId("json-tags"), {
        target: { value: JSON.stringify({ create: [{ tags_id: { id: "red" } }, { tags_id: { id: "blue" } }], update: [], delete: [] }) },
      });
      fireEvent.change(screen.getByTestId("field-title"), { target: { value: "Dup" } });
      fireEvent.click(screen.getByTestId("form-submit-btn"));
    }

    it("retries on the item it already created, without creating it twice", async () => {
      mockFieldsReadAll.mockResolvedValue(M2M_FIELDS);
      relationsApi();
      mockItemsCreateOne.mockResolvedValue({ id: 42, title: "Dup" });
      mockJunctionCreateOne.mockRejectedValueOnce(new ApiRequestError(500, '{"error":"injected"}'));
      const onSuccess = vi.fn();

      renderForm({ mode: "create", onSuccess });
      await fillAndCreate();

      await waitFor(() => {
        expect(screen.getByTestId("form-error")).toHaveTextContent("injected");
      });
      expect(mockItemsCreateOne).toHaveBeenCalledTimes(1);
      expect(onSuccess).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId("form-submit-btn"));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
      });
      expect(mockItemsCreateOne).toHaveBeenCalledTimes(1);
      // Nothing changed on the item since it was created: no PATCH either.
      expect(mockItemsUpdateOne).not.toHaveBeenCalled();
      expect(mockJunctionCreateOne.mock.calls.filter(([, data]) => data.posts_id === 42).map(([, data]) => data.tags_id)).toEqual([
        "red", // failed
        "red",
        "blue",
      ]);
    });

    it("does not write a link twice when it failed after writing some", async () => {
      mockFieldsReadAll.mockResolvedValue(M2M_FIELDS);
      relationsApi();
      mockItemsCreateOne.mockResolvedValue({ id: 42, title: "Dup" });
      mockJunctionCreateOne
        .mockResolvedValueOnce({ id: 1 })
        .mockRejectedValueOnce(new ApiRequestError(500, '{"error":"injected"}'));

      renderForm({ mode: "create" });
      await fillAndCreate();
      await waitFor(() => {
        expect(screen.getByTestId("form-error")).toHaveTextContent("injected");
      });

      // An edit made before the retry goes to the item that exists.
      fireEvent.change(screen.getByTestId("field-title"), { target: { value: "Dup 2" } });
      fireEvent.click(screen.getByTestId("form-submit-btn"));

      await waitFor(() => {
        expect(mockJunctionCreateOne).toHaveBeenCalledTimes(3);
      });
      expect(mockJunctionCreateOne.mock.calls.map(([, data]) => data.tags_id)).toEqual(["red", "blue", "blue"]);
      expect(mockItemsCreateOne).toHaveBeenCalledTimes(1);
      expect(mockItemsUpdateOne).toHaveBeenCalledWith(42, { title: "Dup 2" });
    });
  });

  describe("a user field named sort", () => {
    it("renders it like any other field", async () => {
      mockFieldsReadAll.mockResolvedValue([
        { field: "title", type: "string", meta: { interface: "input", sort: 1 } },
        { field: "sort", type: "integer", meta: { interface: "input", sort: 2 } },
      ]);
      mockItemsCreateOne.mockResolvedValueOnce({ id: 1 });

      renderForm({ mode: "create" });
      await waitFor(() => {
        expect(screen.getByTestId("field-sort")).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId("field-title"), { target: { value: "S" } });
      fireEvent.change(screen.getByTestId("field-sort"), { target: { value: "5" } });
      fireEvent.click(screen.getByTestId("form-submit-btn"));

      await waitFor(() => {
        expect(mockItemsCreateOne).toHaveBeenCalledWith({ title: "S", sort: "5" });
      });
    });
  });

  describe("locale", () => {
    it("hands its locale to VForm, which labels the fields with it", async () => {
      const { VForm } = await import("@buildpad/ui-form");

      renderForm({ mode: "create", locale: "id" });
      await waitFor(() => {
        expect(screen.getByTestId("vform-mock")).toBeInTheDocument();
      });

      expect(vi.mocked(VForm).mock.lastCall?.[0]).toMatchObject({ locale: "id" });
    });
  });

  describe("save errors", () => {
    it("shows the backend's sentence, not the raw response", async () => {
      mockItemsCreateOne.mockRejectedValueOnce(
        new ApiRequestError(500, '{"error":"null value in column \\"title\\" violates not-null constraint"}'),
      );

      renderForm({ mode: "create" });
      await waitFor(() => {
        expect(screen.getByTestId("field-body")).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId("field-body"), { target: { value: "Body" } });
      fireEvent.click(screen.getByTestId("form-submit-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("form-error")).toHaveTextContent(
          'null value in column "title" violates not-null constraint',
        );
      });
      expect(screen.getByTestId("form-error")).not.toHaveTextContent("API error:");
      expect(screen.getByTestId("form-error")).not.toHaveTextContent('{"error"');
    });

    it("shows DaaS validation errors per field", async () => {
      mockItemsCreateOne.mockRejectedValueOnce(
        new ApiRequestError(
          400,
          JSON.stringify({ errors: [{ message: "Must contain @", extensions: { code: "FAILED_VALIDATION", field: "title" } }] }),
        ),
      );

      renderForm({ mode: "create" });
      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId("field-title"), { target: { value: "bad" } });
      fireEvent.click(screen.getByTestId("form-submit-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("form-field-errors")).toHaveTextContent("title: Must contain @");
      });
      expect(screen.getByTestId("form-error")).toHaveTextContent("Validation failed. Please fix the highlighted fields.");
    });
  });

  describe("save and create new", () => {
    it("empties the create form for the next item", async () => {
      mockItemsCreateOne.mockResolvedValueOnce({ id: 11, title: "A" });
      const onSuccess = vi.fn();
      const onNavigateToCreate = vi.fn();

      renderForm({ mode: "create", showSaveOptions: true, onSuccess, onNavigateToCreate });
      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId("field-title"), { target: { value: "A" } });

      fireEvent.click(screen.getByTestId("save-add-new"));

      await waitFor(() => {
        expect(onNavigateToCreate).toHaveBeenCalled();
      });
      expect(mockItemsCreateOne).toHaveBeenCalledWith({ title: "A" });
      expect(onSuccess).toHaveBeenCalledWith({ title: "A", id: 11 });
      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toHaveValue("");
      });
      expect(screen.queryByTestId("form-success")).not.toBeInTheDocument();

      // The next Create is a new item with the new values only.
      mockItemsCreateOne.mockResolvedValueOnce({ id: 12, title: "B" });
      fireEvent.change(screen.getByTestId("field-title"), { target: { value: "B" } });
      fireEvent.click(screen.getByTestId("form-submit-btn"));
      await waitFor(() => {
        expect(mockItemsCreateOne).toHaveBeenCalledTimes(2);
      });
      expect(mockItemsCreateOne).toHaveBeenLastCalledWith({ title: "B" });
    });
  });

  describe("required fields and the save options", () => {
    const REQUIRED_FIELDS = [
      { field: "title", type: "string", meta: { interface: "input", sort: 1 } },
      { field: "code", type: "string", meta: { interface: "input", sort: 2, required: true } },
    ];

    it("does not save with Save and Stay while a required field is empty", async () => {
      mockFieldsReadAll.mockResolvedValue(REQUIRED_FIELDS);

      renderForm({ mode: "create", showSaveOptions: true });
      await waitFor(() => {
        expect(screen.getByTestId("field-code")).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId("field-title"), { target: { value: "Req" } });

      fireEvent.click(screen.getByTestId("save-and-stay"));

      expect(screen.getByTestId("form-error")).toHaveTextContent("Validation failed");
      expect(mockItemsCreateOne).not.toHaveBeenCalled();

      // Filled in, the same option saves.
      mockItemsCreateOne.mockResolvedValueOnce({ id: 1 });
      fireEvent.change(screen.getByTestId("field-code"), { target: { value: "C1" } });
      fireEvent.click(screen.getByTestId("save-and-stay"));
      await waitFor(() => {
        expect(mockItemsCreateOne).toHaveBeenCalledWith({ title: "Req", code: "C1" });
      });
    });

    it("does not save with Ctrl+S while a required field is empty", async () => {
      mockFieldsReadAll.mockResolvedValue(REQUIRED_FIELDS);
      mockItemsReadOne.mockResolvedValue({ id: 1, title: "T", code: "C" });

      renderForm({ mode: "edit", id: 1, showSaveOptions: true });
      await waitFor(() => {
        expect(screen.getByTestId("field-code")).toHaveValue("C");
      });
      fireEvent.change(screen.getByTestId("field-code"), { target: { value: "" } });

      fireEvent.keyDown(screen.getByTestId("field-code"), { key: "s", ctrlKey: true });

      expect(screen.getByTestId("form-error")).toHaveTextContent("Validation failed");
      expect(mockItemsUpdateOne).not.toHaveBeenCalled();
    });
  });

  describe("keyboard shortcuts", () => {
    async function openEdited(props: Partial<React.ComponentProps<typeof CollectionForm>> = {}) {
      mockItemsReadOne.mockResolvedValue({ id: 1, title: "Old", body: "Body" });
      mockItemsUpdateOne.mockResolvedValue({ id: 1 });
      renderForm({ mode: "edit", id: 1, showSaveOptions: true, ...props });
      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toHaveValue("Old");
      });
      fireEvent.change(screen.getByTestId("field-title"), { target: { value: "Keyed" } });
    }

    it("saves and stays on Ctrl+S or Cmd+S", async () => {
      const onSuccess = vi.fn();
      await openEdited({ onSuccess });

      const ctrl = fireEvent.keyDown(screen.getByTestId("field-title"), { key: "s", ctrlKey: true });

      expect(ctrl).toBe(false); // default prevented: no browser "Save page"
      await waitFor(() => {
        expect(mockItemsUpdateOne).toHaveBeenCalledWith(1, { title: "Keyed" });
      });
      expect(onSuccess).not.toHaveBeenCalled();

      fireEvent.change(screen.getByTestId("field-title"), { target: { value: "Keyed 2" } });
      fireEvent.keyDown(screen.getByTestId("field-title"), { key: "s", metaKey: true });
      await waitFor(() => {
        expect(mockItemsUpdateOne).toHaveBeenLastCalledWith(1, { title: "Keyed 2" });
      });
    });

    it("saves and opens a new item on Ctrl+Shift+S", async () => {
      const onNavigateToCreate = vi.fn();
      await openEdited({ onNavigateToCreate });

      fireEvent.keyDown(screen.getByTestId("field-title"), { key: "S", ctrlKey: true, shiftKey: true });

      await waitFor(() => {
        expect(onNavigateToCreate).toHaveBeenCalled();
      });
      expect(mockItemsUpdateOne).toHaveBeenCalledWith(1, { title: "Keyed" });
    });

    it("does nothing when there is nothing to save", async () => {
      mockItemsReadOne.mockResolvedValue({ id: 1, title: "Old" });
      renderForm({ mode: "edit", id: 1, showSaveOptions: true });
      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toHaveValue("Old");
      });

      fireEvent.keyDown(screen.getByTestId("field-title"), { key: "s", ctrlKey: true });

      expect(mockItemsUpdateOne).not.toHaveBeenCalled();
    });

    it("is off without the save options", async () => {
      await openEdited({ showSaveOptions: false });

      const notPrevented = fireEvent.keyDown(screen.getByTestId("field-title"), { key: "s", ctrlKey: true });

      expect(notPrevented).toBe(true);
      expect(mockItemsUpdateOne).not.toHaveBeenCalled();
    });
  });

  describe("save and stay", () => {
    it("saves an edited item without leaving it", async () => {
      mockItemsReadOne.mockResolvedValue({ id: 1, title: "Old", body: "Body" });
      mockItemsUpdateOne.mockResolvedValueOnce({ id: 1, title: "New", body: "Body" });
      const onSuccess = vi.fn();

      renderForm({ mode: "edit", id: 1, showSaveOptions: true, onSuccess });
      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toHaveValue("Old");
      });
      fireEvent.change(screen.getByTestId("field-title"), { target: { value: "New" } });

      fireEvent.click(screen.getByTestId("save-and-stay"));

      await waitFor(() => {
        expect(screen.getByTestId("form-success")).toHaveTextContent("Item updated successfully!");
      });
      expect(mockItemsUpdateOne).toHaveBeenCalledWith(1, { title: "New" });
      expect(onSuccess).not.toHaveBeenCalled();
      expect(screen.getByTestId("field-title")).toHaveValue("New");
      // Saved: nothing left to save.
      expect(screen.getByTestId("form-submit-btn")).toBeDisabled();
    });
  });

  describe("save as copy of an edited item", () => {
    it("creates the copy with the edits and leaves the original unchanged", async () => {
      mockItemsReadOne.mockResolvedValue({ id: 7, title: "Orig", body: "Body" });
      mockItemsCreateOne.mockResolvedValueOnce({ id: 8 });
      const onSuccess = vi.fn();

      renderForm({ mode: "edit", id: 7, showSaveOptions: true, onSuccess });
      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toHaveValue("Orig");
      });
      fireEvent.change(screen.getByTestId("field-title"), { target: { value: "Copy" } });

      fireEvent.click(screen.getByTestId("save-as-copy"));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith({ title: "Copy", body: "Body", id: 8 });
      });
      expect(mockItemsCreateOne).toHaveBeenCalledWith({ title: "Copy", body: "Body" });
      expect(mockItemsUpdateOne).not.toHaveBeenCalled();
    });

    it("leaves the original unchanged when the copy fails", async () => {
      mockItemsReadOne.mockResolvedValue({ id: 7, title: "Orig", body: "Body" });
      mockItemsCreateOne.mockRejectedValueOnce(new Error("copy refused"));
      const onSuccess = vi.fn();

      renderForm({ mode: "edit", id: 7, showSaveOptions: true, onSuccess });
      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toHaveValue("Orig");
      });
      fireEvent.change(screen.getByTestId("field-title"), { target: { value: "Copy" } });

      fireEvent.click(screen.getByTestId("save-as-copy"));

      await waitFor(() => {
        expect(screen.getByTestId("form-error")).toHaveTextContent("copy refused");
      });
      expect(mockItemsUpdateOne).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      // The edit is still there to save or discard.
      expect(screen.getByTestId("field-title")).toHaveValue("Copy");
    });
  });

  describe("reverting an edit", () => {
    it("disables Save again when the loaded value is typed back", async () => {
      mockItemsReadOne.mockResolvedValue({ id: 1, title: "Rev", body: "Body" });

      renderForm({ mode: "edit", id: 1 });
      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toHaveValue("Rev");
      });
      expect(screen.getByTestId("form-submit-btn")).toBeDisabled();

      fireEvent.change(screen.getByTestId("field-title"), { target: { value: "Y" } });
      expect(screen.getByTestId("form-submit-btn")).toBeEnabled();

      // The VForm double drops the key, as VForm does on a revert.
      fireEvent.change(screen.getByTestId("field-title"), { target: { value: "Rev" } });

      expect(screen.getByTestId("field-title")).toHaveValue("Rev");
      expect(screen.getByTestId("form-submit-btn")).toBeDisabled();
    });

    it("keeps a reverted field's value after saving another field", async () => {
      mockItemsReadOne.mockResolvedValue({ id: 1, title: "Rev", body: "Body" });
      mockItemsUpdateOne.mockResolvedValueOnce({ id: 1 });

      renderForm({ mode: "edit", id: 1, showSaveOptions: true });
      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toHaveValue("Rev");
      });
      fireEvent.change(screen.getByTestId("field-title"), { target: { value: "Y" } });
      fireEvent.change(screen.getByTestId("field-title"), { target: { value: "Rev" } });
      fireEvent.change(screen.getByTestId("field-body"), { target: { value: "Body 2" } });

      fireEvent.click(screen.getByTestId("save-and-stay"));

      await waitFor(() => {
        expect(screen.getByTestId("form-success")).toBeInTheDocument();
      });
      expect(mockItemsUpdateOne).toHaveBeenCalledWith(1, { body: "Body 2" });
      expect(screen.getByTestId("field-title")).toHaveValue("Rev");
      expect(screen.getByTestId("field-body")).toHaveValue("Body 2");
      expect(screen.getByTestId("form-submit-btn")).toBeDisabled();
    });
  });

  describe("edit", () => {
    it("loads existing item data in edit mode", async () => {
      mockItemsReadOne.mockResolvedValue({
        id: 1,
        title: "Existing Title",
        body: "Existing Body",
      });

      renderForm({ mode: "edit", id: 1 });

      await waitFor(() => {
        expect(mockItemsReadOne).toHaveBeenCalledWith(1, expect.any(Array));
      });

      await waitFor(() => {
        const titleInput = screen.getByTestId("field-title") as HTMLInputElement;
        expect(titleInput.value).toBe("Existing Title");
      });
    });

    it("calls ItemsService.updateOne when saving edited item", async () => {
      mockItemsReadOne.mockResolvedValue({ id: 1, title: "Old", body: "Body" });
      mockItemsUpdateOne.mockResolvedValueOnce({ id: 1, title: "Updated", body: "Body" });

      renderForm({ mode: "edit", id: 1 });

      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toBeInTheDocument();
      });

      // Change the title
      fireEvent.change(screen.getByTestId("field-title"), {
        target: { value: "Updated" },
      });

      // Submit
      fireEvent.click(screen.getByTestId("form-submit-btn"));

      await waitFor(() => {
        expect(mockItemsUpdateOne).toHaveBeenCalled();
      });
    });
  });

  // =====================================================================
  // Delete operation
  // =====================================================================
  describe("delete", () => {
    it("shows delete button in edit mode with deleteAllowed", async () => {
      mockItemsReadOne.mockResolvedValue({ id: 1, title: "Item" });

      renderForm({ mode: "edit", id: 1, showDelete: true });

      await waitFor(() => {
        expect(screen.getByTestId("form-delete-btn")).toBeInTheDocument();
      });
    });

    it("does not show delete button in create mode", async () => {
      renderForm({ mode: "create" });

      await waitFor(() => {
        expect(screen.getByTestId("vform-mock")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("form-delete-btn")).not.toBeInTheDocument();
    });

    it("opens delete confirmation modal on delete button click", async () => {
      mockItemsReadOne.mockResolvedValue({ id: 1, title: "Item" });

      renderForm({ mode: "edit", id: 1, showDelete: true });

      await waitFor(() => {
        expect(screen.getByTestId("form-delete-btn")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId("form-delete-btn"));

      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
      });
    });

    it("calls ItemsService.deleteOne and onDelete when confirmed", async () => {
      mockItemsReadOne.mockResolvedValue({ id: 1, title: "Item" });
      mockItemsDeleteOne.mockResolvedValueOnce(undefined);
      const onDelete = vi.fn();

      renderForm({ mode: "edit", id: 1, showDelete: true, onDelete });

      await waitFor(() => {
        expect(screen.getByTestId("form-delete-btn")).toBeInTheDocument();
      });

      // Open confirmation
      await userEvent.click(screen.getByTestId("form-delete-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirm-btn")).toBeInTheDocument();
      });

      // Confirm delete
      await userEvent.click(screen.getByTestId("delete-confirm-btn"));

      await waitFor(() => {
        expect(mockItemsDeleteOne).toHaveBeenCalledWith(1);
        expect(onDelete).toHaveBeenCalled();
      });
    });

    it("shows error when delete fails", async () => {
      mockItemsReadOne.mockResolvedValue({ id: 1, title: "Item" });
      mockItemsDeleteOne.mockRejectedValueOnce(new Error("Delete forbidden"));

      renderForm({ mode: "edit", id: 1, showDelete: true });

      await waitFor(() => {
        expect(screen.getByTestId("form-delete-btn")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId("form-delete-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirm-btn")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId("delete-confirm-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("form-error")).toBeInTheDocument();
      });
      expect(screen.getByText(/delete forbidden/i)).toBeInTheDocument();
    });
  });

  // =====================================================================
  // Cancel
  // =====================================================================
  describe("cancel", () => {
    it("calls onCancel when cancel button is clicked", async () => {
      const onCancel = vi.fn();

      renderForm({ mode: "create", onCancel });

      await waitFor(() => {
        expect(screen.getByTestId("form-cancel-btn")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId("form-cancel-btn"));
      expect(onCancel).toHaveBeenCalled();
    });
  });

  // =====================================================================
  // Permissions
  // =====================================================================
  describe("permissions", () => {
    it("disables delete button when permission is denied", async () => {
      // Return permissions that deny delete
      permissionState.isAdmin = false;
      mockPermissionsGetAccess.mockResolvedValueOnce({
        posts: {
          read: { fields: ["*"] },
          create: { fields: ["*"] },
          update: { fields: ["*"] },
          // no delete key = delete not allowed
        },
      });
      mockItemsReadOne.mockResolvedValue({ id: 1, title: "Item" });

      renderForm({ mode: "edit", id: 1, showDelete: true });

      await waitFor(() => {
        expect(screen.getByTestId("vform-mock")).toBeInTheDocument();
      });

      // Delete button should NOT be shown because deleteAllowed = false
      expect(screen.queryByTestId("form-delete-btn")).not.toBeInTheDocument();
    });

    // An empty access map is what /permissions/me returns for a user with no
    // grants at all (and what a failed load turns into). It grants a
    // non-administrator nothing; it used to grant everything.
    it("gives a non-administrator with an empty access map a disabled create form", async () => {
      permissionState.isAdmin = false;
      mockPermissionsGetAccess.mockResolvedValueOnce({});

      renderForm({ mode: "create" });

      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toBeInTheDocument();
      });
      expect(screen.getByTestId("field-title")).toBeDisabled();
      expect(screen.getByTestId("form-submit-btn")).toBeDisabled();
    });

    it("gives a non-administrator no write control when the permissions fail to load", async () => {
      permissionState.isAdmin = false;
      mockPermissionsGetAccess.mockRejectedValueOnce(new Error("API error: 500"));
      mockItemsReadOne.mockResolvedValue({ id: 1, title: "Item" });

      renderForm({ mode: "edit", id: 1, showDelete: true });

      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toHaveValue("Item");
      });
      expect(screen.getByTestId("field-title")).toBeDisabled();
      expect(screen.getByTestId("form-submit-btn")).toBeDisabled();
      expect(screen.queryByTestId("form-delete-btn")).not.toBeInTheDocument();
    });

    it("keeps full access for an administrator whose access map is empty", async () => {
      mockPermissionsGetAccess.mockResolvedValueOnce({});
      mockItemsReadOne.mockResolvedValue({ id: 1, title: "Item" });

      renderForm({ mode: "edit", id: 1 });

      await waitFor(() => {
        expect(screen.getByTestId("field-title")).toHaveValue("Item");
      });
      expect(screen.getByTestId("field-title")).toBeEnabled();
      expect(screen.getByTestId("form-delete-btn")).toBeInTheDocument();
    });
  });
});

describe("edit fetch relational-field exclusion", () => {
  it("omits O2M/M2M/M2A fields from readOne and keeps flat fields plus the PK", async () => {
    mockFieldsReadAll.mockResolvedValue([
      ...SAMPLE_FIELDS,
      {
        collection: "posts",
        field: "blocks",
        type: "text",
        meta: { special: ["m2a"], interface: "list-m2a" },
        schema: {},
      },
      {
        collection: "posts",
        field: "comments",
        type: "text",
        meta: { interface: "list-o2m" },
        schema: {},
      },
    ]);
    mockItemsReadOne.mockResolvedValueOnce({ id: 1, title: "Existing Title" });

    renderForm({ mode: "edit", id: 1 });

    await waitFor(() => expect(mockItemsReadOne).toHaveBeenCalled());
    const [calledId, fields] = mockItemsReadOne.mock.calls.at(-1)!;
    expect(calledId).toBe(1);
    expect(fields).toContain("id");
    expect(fields).toContain("title");
    expect(fields).not.toContain("blocks");
    expect(fields).not.toContain("comments");
  });
});

// =====================================================================
// Manual primary key handling
//
// Regression coverage for a bug where SYSTEM_FIELDS/READ_ONLY_FIELDS
// matched the PK purely by name ("id"), so a collection whose PK type is
// "manually entered string" (schema.is_primary_key: true,
// has_auto_increment: false, no uuid special) had its id field silently
// dropped from the form and stripped from the save payload — causing a
// NOT NULL constraint violation on create, and (when the PK was the only
// non-system field) a permanently empty, permanently-disabled form.
// =====================================================================
describe("manual primary key handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  const MANUAL_STRING_PK_FIELD = {
    field: "id",
    type: "string",
    schema: { is_primary_key: true, has_auto_increment: false },
    meta: { interface: "input", sort: 1, readonly: false, hidden: false },
  };

  const AUTO_INCREMENT_PK_FIELD = {
    field: "id",
    type: "integer",
    schema: { is_primary_key: true, has_auto_increment: true },
    meta: { interface: "input", sort: 1, readonly: true, hidden: true },
  };

  const UUID_PK_FIELD = {
    field: "id",
    type: "uuid",
    schema: { is_primary_key: true, has_auto_increment: false },
    meta: { interface: "input", sort: 1, special: ["uuid"], readonly: true, hidden: true },
  };

  // Mirrors `idField()` in services/src/collections.ts EXACTLY — the PK every
  // collection created through Buildpad's own flow gets. Note what it lacks:
  // no `special: ["uuid"]` and has_auto_increment:false, so a rule that keys
  // only off those two reads this as a manually-entered PK and surfaces a
  // stray `id` control on every create form in the app. Keep this fixture in
  // sync with idField() if that baseline ever changes.
  const BASELINE_COLLECTION_PK_FIELD = {
    field: "id",
    type: "uuid",
    meta: { interface: "input", hidden: true, readonly: true },
    schema: {
      name: "id",
      table: "posts",
      data_type: "uuid",
      is_primary_key: true,
      has_auto_increment: false,
    },
  };

  // A PK the database fills from its own default (gen_random_uuid(),
  // nextval(...)). These report has_auto_increment:false but are no more
  // user-supplied than a serial column.
  const DB_DEFAULT_PK_FIELD = {
    field: "id",
    type: "string",
    schema: {
      is_primary_key: true,
      has_auto_increment: false,
      default_value: "gen_random_uuid()",
    },
    meta: { interface: "input", sort: 1 },
  };

  it("renders a manually-entered string PK as an editable field on create", async () => {
    mockFieldsReadAll.mockResolvedValue([MANUAL_STRING_PK_FIELD, ...SAMPLE_FIELDS]);

    renderForm({ mode: "create" });

    await waitFor(() => {
      expect(screen.getByTestId("field-id")).toBeInTheDocument();
    });
  });

  it("includes a typed manual PK value in the create payload", async () => {
    mockFieldsReadAll.mockResolvedValue([MANUAL_STRING_PK_FIELD, ...SAMPLE_FIELDS]);
    mockItemsCreateOne.mockResolvedValueOnce({ id: "vessel-01" });

    renderForm({ mode: "create" });
    await waitFor(() => {
      expect(screen.getByTestId("field-id")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("field-id"), {
      target: { value: "vessel-01" },
    });
    fireEvent.change(screen.getByTestId("field-title"), {
      target: { value: "New Post" },
    });
    fireEvent.click(screen.getByTestId("form-submit-btn"));

    await waitFor(() => {
      expect(mockItemsCreateOne).toHaveBeenCalled();
    });
    expect(mockItemsCreateOne.mock.calls[0][0]).toMatchObject({
      id: "vessel-01",
    });
  });

  it("still hides an auto-increment PK on create (no regression)", async () => {
    mockFieldsReadAll.mockResolvedValue([AUTO_INCREMENT_PK_FIELD, ...SAMPLE_FIELDS]);

    renderForm({ mode: "create" });

    await waitFor(() => {
      expect(screen.getByTestId("field-title")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("field-id")).not.toBeInTheDocument();
  });

  it("still hides a generated UUID PK on create (no regression)", async () => {
    mockFieldsReadAll.mockResolvedValue([UUID_PK_FIELD, ...SAMPLE_FIELDS]);

    renderForm({ mode: "create" });

    await waitFor(() => {
      expect(screen.getByTestId("field-title")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("field-id")).not.toBeInTheDocument();
  });

  it("still hides the baseline collection PK (uuid, no special) on create", async () => {
    mockFieldsReadAll.mockResolvedValue([
      BASELINE_COLLECTION_PK_FIELD,
      ...SAMPLE_FIELDS,
    ]);

    renderForm({ mode: "create" });

    await waitFor(() => {
      expect(screen.getByTestId("field-title")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("field-id")).not.toBeInTheDocument();
  });

  it("keeps the baseline collection PK out of the create payload", async () => {
    mockFieldsReadAll.mockResolvedValue([
      BASELINE_COLLECTION_PK_FIELD,
      ...SAMPLE_FIELDS,
    ]);
    mockItemsCreateOne.mockResolvedValueOnce({ id: "generated-uuid" });

    renderForm({ mode: "create" });
    await waitFor(() => {
      expect(screen.getByTestId("field-title")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("field-title"), {
      target: { value: "New Post" },
    });
    fireEvent.click(screen.getByTestId("form-submit-btn"));

    await waitFor(() => {
      expect(mockItemsCreateOne).toHaveBeenCalled();
    });
    expect(mockItemsCreateOne.mock.calls[0][0]).not.toHaveProperty("id");
  });

  it("still hides a PK the database fills from its own default", async () => {
    mockFieldsReadAll.mockResolvedValue([DB_DEFAULT_PK_FIELD, ...SAMPLE_FIELDS]);

    renderForm({ mode: "create" });

    await waitFor(() => {
      expect(screen.getByTestId("field-title")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("field-id")).not.toBeInTheDocument();
  });

  it("does not drop an auto-increment PK from the create payload's exclusion list (still stripped)", async () => {
    mockFieldsReadAll.mockResolvedValue([AUTO_INCREMENT_PK_FIELD, ...SAMPLE_FIELDS]);
    mockItemsCreateOne.mockResolvedValueOnce({ id: 42 });

    renderForm({ mode: "create" });
    await waitFor(() => {
      expect(screen.getByTestId("field-title")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("field-title"), {
      target: { value: "New Post" },
    });
    fireEvent.click(screen.getByTestId("form-submit-btn"));

    await waitFor(() => {
      expect(mockItemsCreateOne).toHaveBeenCalled();
    });
    expect(mockItemsCreateOne.mock.calls[0][0]).not.toHaveProperty("id");
  });

  // Reproduces the exact reported scenario: a collection with a manual
  // string PK and otherwise only system fields (user_created, etc.) —
  // previously the PK was the sole field wrongly filtered out, leaving
  // zero editable fields and a permanently disabled submit button.
  it("shows the form (not the empty-fields message) when the manual PK is the only non-system field", async () => {
    mockFieldsReadAll.mockResolvedValue([
      MANUAL_STRING_PK_FIELD,
      { field: "user_created", type: "uuid", meta: { special: ["user-created"] } },
      { field: "user_updated", type: "uuid", meta: { special: ["user-updated"] } },
      { field: "date_created", type: "timestamp", meta: { special: ["date-created"] } },
      { field: "date_updated", type: "timestamp", meta: { special: ["date-updated"] } },
    ]);

    renderForm({ mode: "create" });

    await waitFor(() => {
      expect(screen.getByTestId("field-id")).toBeInTheDocument();
    });
    expect(screen.queryByText(/no editable fields found/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("form-submit-btn")).not.toBeDisabled();
  });

  it("keeps user_created/date_created hidden even though the manual PK is now shown", async () => {
    mockFieldsReadAll.mockResolvedValue([
      MANUAL_STRING_PK_FIELD,
      { field: "user_created", type: "uuid", meta: { special: ["user-created"] } },
      { field: "date_created", type: "timestamp", meta: { special: ["date-created"] } },
    ]);

    renderForm({ mode: "create" });

    await waitFor(() => {
      expect(screen.getByTestId("field-id")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("field-user_created")).not.toBeInTheDocument();
    expect(screen.queryByTestId("field-date_created")).not.toBeInTheDocument();
  });

  it("includes an edited manual PK value in the update payload", async () => {
    mockFieldsReadAll.mockResolvedValue([MANUAL_STRING_PK_FIELD, ...SAMPLE_FIELDS]);
    mockItemsReadOne.mockResolvedValue({ id: "old-id", title: "Existing", body: "Body" });
    mockItemsUpdateOne.mockResolvedValueOnce({ id: "new-id" });

    renderForm({ mode: "edit", id: "old-id" });

    await waitFor(() => {
      expect(screen.getByTestId("field-id")).toHaveValue("old-id");
    });

    fireEvent.change(screen.getByTestId("field-id"), {
      target: { value: "new-id" },
    });
    fireEvent.click(screen.getByTestId("form-submit-btn"));

    await waitFor(() => {
      expect(mockItemsUpdateOne).toHaveBeenCalled();
    });
    expect(mockItemsUpdateOne.mock.calls[0][1]).toMatchObject({ id: "new-id" });
  });
});

describe("submit containment through portals", () => {
  it("does not bubble the form's submit into an ancestor page form across a portal", async () => {
    const { createPortal } = await import("react-dom");
    mockItemsCreateOne.mockResolvedValueOnce({ id: 9, title: "t" });
    const outerSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());

    // Mirrors the real bug shape: the page form is an ancestor in the REACT
    // tree while the CollectionForm lives elsewhere in the DOM via a portal
    // (Mantine Modal). React bubbles synthetic submit along the React tree.
    function Page() {
      return (
        <form onSubmit={outerSubmit} data-testid="outer-page-form">
          {createPortal(
            <CollectionForm collection="posts" mode="create" />,
            document.body,
          )}
        </form>
      );
    }

    render(<Page />, { wrapper });

    await waitFor(() => screen.getByTestId("form-submit-btn"));
    fireEvent.click(screen.getByTestId("form-submit-btn"));

    await waitFor(() => expect(mockItemsCreateOne).toHaveBeenCalled());
    expect(outerSubmit).not.toHaveBeenCalled();
  });
});

// A load is superseded when the effect that started it runs again before it
// has finished: on every mount under React strict mode, and whenever the host
// changes `collection` / `id` / `mode`, or the content of `defaultValues` /
// `excludeFields` / `includeFields` / `definition`, mid-flight. Each of those
// loads used to finish on its own and apply its result, so the last one to
// ANSWER won.
describe("superseded loads", () => {
  /** A promise the test settles by hand. */
  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  /**
   * Strict mode has to be the outermost element: React runs the effects of a
   * newly mounted tree twice only when the tree's top element is inside it,
   * so a `<StrictMode>` under the `wrapper` option would do nothing.
   */
  function renderStrict(ui: React.ReactElement) {
    return render(
      <React.StrictMode>
        <MantineProvider>{ui}</MantineProvider>
      </React.StrictMode>,
    );
  }

  /** Lets the awaits of a load whose request was just answered run. */
  async function settle() {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  }

  const title = () => (screen.getByTestId("field-title") as HTMLInputElement).value;
  const typeTitle = (value: string) =>
    fireEvent.change(screen.getByTestId("field-title"), { target: { value } });

  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    mockItemsReadOne.mockReset();
    vi.mocked(apiRequest).mockReset();
  });

  describe("under React strict mode", () => {
    /** One hand-settled fields request per load: [superseded, standing]. */
    function twoFieldLoads() {
      const loads = [deferred<typeof SAMPLE_FIELDS>(), deferred<typeof SAMPLE_FIELDS>()];
      let call = 0;
      mockFieldsReadAll.mockImplementation(() => loads[call++].promise);
      return { superseded: loads[0], standing: loads[1] };
    }

    it("keeps what was typed when the load the remount superseded answers late", async () => {
      const { superseded, standing } = twoFieldLoads();
      mockItemsCreateOne.mockResolvedValueOnce({ id: 7, title: "Typed" });

      renderStrict(<CollectionForm collection="posts" mode="create" />);
      // Strict mode ran the load effect twice, so two loads are in flight.
      await waitFor(() => expect(mockFieldsReadAll).toHaveBeenCalledTimes(2));

      standing.resolve(SAMPLE_FIELDS);
      await waitFor(() => expect(screen.getByTestId("field-title")).toBeInTheDocument());
      typeTitle("Typed");

      superseded.resolve(SAMPLE_FIELDS);
      await settle();

      expect(title()).toBe("Typed");
      fireEvent.click(screen.getByTestId("form-submit-btn"));
      await waitFor(() => expect(mockItemsCreateOne).toHaveBeenCalledTimes(1));
      expect(mockItemsCreateOne.mock.calls[0][0]).toMatchObject({ title: "Typed" });
    });

    it("draws nothing from the superseded load and leaves the loading overlay up", async () => {
      const { superseded, standing } = twoFieldLoads();

      renderStrict(<CollectionForm collection="posts" mode="create" />);
      await waitFor(() => expect(mockFieldsReadAll).toHaveBeenCalledTimes(2));

      superseded.resolve(SAMPLE_FIELDS);
      await settle();
      expect(screen.queryByTestId("field-title")).not.toBeInTheDocument();
      // The overlay belongs to the load still in flight: the superseded one
      // must not take it down and show a form with no fields.
      expect(screen.getByTestId("loading-overlay")).toBeInTheDocument();
      expect(screen.queryByTestId("collection-form")).not.toBeInTheDocument();

      standing.resolve(SAMPLE_FIELDS);
      await waitFor(() => expect(screen.getByTestId("field-title")).toBeInTheDocument());
      expect(screen.queryByTestId("loading-overlay")).not.toBeInTheDocument();
    });

    it("reports no error when the superseded load fails after the form was drawn", async () => {
      const { superseded, standing } = twoFieldLoads();
      const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

      renderStrict(<CollectionForm collection="posts" mode="create" />);
      await waitFor(() => expect(mockFieldsReadAll).toHaveBeenCalledTimes(2));

      standing.resolve(SAMPLE_FIELDS);
      await waitFor(() => expect(screen.getByTestId("field-title")).toBeInTheDocument());
      typeTitle("Typed");

      superseded.reject(new Error("late failure"));
      await settle();

      expect(screen.queryByTestId("form-error")).not.toBeInTheDocument();
      expect(errorLog).not.toHaveBeenCalledWith("Error loading form data:", expect.anything());
      expect(title()).toBe("Typed");
      errorLog.mockRestore();
    });
  });

  describe("when the id changes", () => {
    it("shows the item of the current id when the item opened before it answers last", async () => {
      const first = deferred<Record<string, unknown>>();
      const second = deferred<Record<string, unknown>>();
      mockItemsReadOne.mockImplementation((id: number) => (id === 1 ? first.promise : second.promise));

      const { rerender } = render(<CollectionForm collection="posts" mode="edit" id={1} />, { wrapper });
      await waitFor(() => expect(mockItemsReadOne).toHaveBeenCalledWith(1, expect.any(Array)));

      rerender(<CollectionForm collection="posts" mode="edit" id={2} />);
      await waitFor(() => expect(mockItemsReadOne).toHaveBeenCalledWith(2, expect.any(Array)));

      second.resolve({ id: 2, title: "Second", body: "" });
      await waitFor(() => expect(title()).toBe("Second"));
      first.resolve({ id: 1, title: "First", body: "" });
      await settle();

      expect(title()).toBe("Second");
    });

    it("loads an item again when the id returns to it while another item was loading", async () => {
      const second = deferred<Record<string, unknown>>();
      mockItemsReadOne.mockImplementation((id: number) =>
        id === 1 ? Promise.resolve({ id: 1, title: "First", body: "" }) : second.promise,
      );

      const { rerender } = render(<CollectionForm collection="posts" mode="edit" id={1} />, { wrapper });
      await waitFor(() => expect(title()).toBe("First"));

      // Item 2 is opened and, before it has loaded, item 1 again.
      rerender(<CollectionForm collection="posts" mode="edit" id={2} />);
      await waitFor(() => expect(mockItemsReadOne).toHaveBeenCalledWith(2, expect.any(Array)));
      rerender(<CollectionForm collection="posts" mode="edit" id={1} />);

      second.resolve({ id: 2, title: "Second", body: "" });
      await settle();

      // Item 1 is drawn: the cancelled load of item 2 neither applied its item
      // nor left the loading overlay up.
      await waitFor(() => expect(title()).toBe("First"));
      expect(mockItemsReadOne.mock.calls.filter(([id]) => id === 1)).toHaveLength(2);
      expect(screen.queryByTestId("loading-overlay")).not.toBeInTheDocument();
    });
  });

  // Hosts pass these props as inline literals: a new object on every render.
  describe("when the host re-renders with new objects", () => {
    it("does not start the load again while the content is the same", async () => {
      const fieldLoad = deferred<typeof SAMPLE_FIELDS>();
      mockFieldsReadAll.mockImplementation(() => fieldLoad.promise);
      const form = () => (
        <CollectionForm
          collection="posts"
          mode="create"
          defaultValues={{ body: "Preset", meta: { tags: ["a", "b"] } }}
          excludeFields={["secret"]}
          includeFields={["title", "body"]}
          definition={{ sections: [{ fields: [{ field: "title" }, { field: "body" }] }] } as never}
        />
      );

      const { rerender } = render(form(), { wrapper });
      await waitFor(() => expect(mockFieldsReadAll).toHaveBeenCalledTimes(1));

      // Twice while the load is in flight.
      rerender(form());
      rerender(form());
      await settle();
      expect(mockFieldsReadAll).toHaveBeenCalledTimes(1);

      fieldLoad.resolve(SAMPLE_FIELDS);
      await waitFor(() => expect(screen.getByTestId("field-title")).toBeInTheDocument());
      typeTitle("Typed");

      // And once after it: nothing is loaded and nothing typed is lost.
      rerender(form());
      await settle();
      expect(mockFieldsReadAll).toHaveBeenCalledTimes(1);
      expect(title()).toBe("Typed");
    });

    it("starts the load again when a default value changes, and drops the first load's answer", async () => {
      const loads = [deferred<typeof SAMPLE_FIELDS>(), deferred<typeof SAMPLE_FIELDS>()];
      let call = 0;
      mockFieldsReadAll.mockImplementation(() => loads[call++].promise);

      const { rerender } = render(
        <CollectionForm collection="posts" mode="create" defaultValues={{ title: "A" }} />,
        { wrapper },
      );
      await waitFor(() => expect(mockFieldsReadAll).toHaveBeenCalledTimes(1));
      rerender(<CollectionForm collection="posts" mode="create" defaultValues={{ title: "B" }} />);
      await waitFor(() => expect(mockFieldsReadAll).toHaveBeenCalledTimes(2));

      loads[1].resolve(SAMPLE_FIELDS);
      await waitFor(() => expect(title()).toBe("B"));
      typeTitle("Typed");

      loads[0].resolve(SAMPLE_FIELDS);
      await settle();
      expect(title()).toBe("Typed");
    });
  });

  // In create mode no item is read, so for a collection with an M2M field the
  // relations request is the last step a load waits on.
  describe("when the superseded load was waiting for the relations", () => {
    const FIELDS_WITH_M2M = [
      ...SAMPLE_FIELDS,
      { field: "tags", type: "alias", meta: { interface: "list-m2m", special: ["m2m"], sort: 3 } },
    ];
    type Relations = { data: unknown[] };

    /** Draws the form from a second load while the first still waits on `/api/relations`. */
    async function supersedeAtRelations() {
      mockFieldsReadAll.mockResolvedValue(FIELDS_WITH_M2M);
      const relations = [deferred<Relations>(), deferred<Relations>()];
      let call = 0;
      vi.mocked(apiRequest).mockImplementation(() => relations[call++].promise as never);

      const { rerender } = render(
        <CollectionForm collection="posts" mode="create" defaultValues={{ title: "A" }} />,
        { wrapper },
      );
      await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
      rerender(<CollectionForm collection="posts" mode="create" defaultValues={{ title: "B" }} />);
      await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));

      relations[1].resolve({ data: [] });
      await waitFor(() => expect(title()).toBe("B"));
      typeTitle("Typed");
      return relations[0];
    }

    it("keeps what was typed when its relations request is answered", async () => {
      const superseded = await supersedeAtRelations();
      superseded.resolve({ data: [] });
      await settle();
      expect(title()).toBe("Typed");
    });

    it("keeps what was typed when its relations request fails", async () => {
      const superseded = await supersedeAtRelations();
      superseded.reject(new Error("relations down"));
      await settle();
      expect(title()).toBe("Typed");
      expect(screen.queryByTestId("form-error")).not.toBeInTheDocument();
    });
  });
});
