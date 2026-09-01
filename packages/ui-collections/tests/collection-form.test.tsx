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
  mockItemsReadOne,
  mockItemsCreateOne,
  mockItemsUpdateOne,
  mockItemsDeleteOne,
  mockItemsDeleteMany,
} = vi.hoisted(() => ({
  mockFieldsReadAll: vi.fn(),
  mockPermissionsGetAccess: vi.fn(),
  mockItemsReadOne: vi.fn(),
  mockItemsCreateOne: vi.fn(),
  mockItemsUpdateOne: vi.fn(),
  mockItemsDeleteOne: vi.fn(),
  mockItemsDeleteMany: vi.fn(),
}));

vi.mock("@buildpad/services", () => ({
  FieldsService: vi.fn().mockImplementation(() => ({
    readAll: mockFieldsReadAll,
  })),
  ItemsService: vi.fn().mockImplementation(() => ({
    readOne: mockItemsReadOne,
    createOne: mockItemsCreateOne,
    updateOne: mockItemsUpdateOne,
    deleteOne: mockItemsDeleteOne,
    deleteMany: mockItemsDeleteMany,
  })),
  PermissionsService: {
    getMyCollectionAccess: mockPermissionsGetAccess,
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
    fields: Array<{ field: string }>;
    modelValue: Record<string, unknown>;
    initialValues?: Record<string, unknown>;
    onUpdate: (values: Record<string, unknown>) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="vform-mock">
      {fields.map((f) => (
        <input
          key={f.field}
          data-testid={`field-${f.field}`}
          value={String(modelValue[f.field] ?? initialValues?.[f.field] ?? "")}
          disabled={disabled}
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
