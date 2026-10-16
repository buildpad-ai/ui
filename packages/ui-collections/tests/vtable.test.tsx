/**
 * VTable (@buildpad/ui-table) tests.
 *
 * @buildpad/ui-table has no unit-test harness of its own; this package's
 * vitest config resolves it to source, with the same @mantine/core test
 * double, so its behaviour that CollectionList relies on is pinned here.
 */

import { render, screen, fireEvent, within } from "@testing-library/react";
import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { VTable } from "@buildpad/ui-table";
import type { HeaderRaw, Sort } from "@buildpad/ui-table";

type Row = { id: number; title: string };

const HEADERS: HeaderRaw[] = [
  { text: "Title", value: "title", sortable: true, width: 160 } as HeaderRaw,
];

const PAGE_1: Row[] = [
  { id: 1, title: "Item 01" },
  { id: 2, title: "Item 02" },
];
const PAGE_2: Row[] = [
  { id: 3, title: "Item 03" },
  { id: 4, title: "Item 04" },
];

/** A host that keeps the selection as row objects across pages, as CollectionList does. */
function PagedTable({ onUpdate }: { onUpdate?: (selection: unknown[]) => void }) {
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<unknown[]>([]);
  return (
    <>
      <button type="button" data-testid="page-2" onClick={() => setPage(2)} />
      <div data-testid="selected">{selection.map((s) => (s as Row).id).join(",")}</div>
      <VTable
        headers={HEADERS}
        items={page === 1 ? PAGE_1 : PAGE_2}
        itemKey="id"
        showSelect="multiple"
        value={selection}
        onUpdate={(next) => {
          setSelection(next);
          onUpdate?.(next);
        }}
      />
    </>
  );
}

const selectAll = () => screen.getByRole("checkbox", { name: "Select all" });
const selected = () => screen.getByTestId("selected").textContent;

describe("VTable", () => {
  describe("Select all", () => {
    it("describes and adds to the selection on another page", () => {
      render(<PagedTable />);

      fireEvent.click(screen.getAllByRole("checkbox", { name: "Select row" })[0]);
      expect(selected()).toBe("1");

      fireEvent.click(screen.getByTestId("page-2"));

      // Nothing on page 2 is selected yet.
      expect(selectAll()).not.toBeChecked();
      expect(selectAll()).not.toHaveAttribute("data-indeterminate");

      fireEvent.click(selectAll());

      expect(selected()).toBe("1,3,4");
      expect(selectAll()).toBeChecked();
    });

    it("clears only this page's rows", () => {
      render(<PagedTable />);

      fireEvent.click(screen.getAllByRole("checkbox", { name: "Select row" })[0]);
      fireEvent.click(screen.getByTestId("page-2"));
      fireEvent.click(selectAll());
      expect(selected()).toBe("1,3,4");

      fireEvent.click(selectAll());

      expect(selected()).toBe("1");
      expect(selectAll()).not.toBeChecked();
    });

    it("shows a page with some of its rows selected as indeterminate", () => {
      render(<PagedTable />);

      fireEvent.click(screen.getAllByRole("checkbox", { name: "Select row" })[0]);

      expect(selectAll()).toHaveAttribute("data-indeterminate", "true");
      expect(selectAll()).not.toBeChecked();
    });
  });

  describe("header clicks", () => {
    function renderSortable() {
      const onSortChange = vi.fn();
      const onHeadersChange = vi.fn();
      const view = render(
        <VTable
          headers={HEADERS}
          items={PAGE_1}
          itemKey="id"
          sort={{ by: null, desc: false } as Sort}
          showResize
          allowHeaderReorder
          onSortChange={onSortChange}
          onHeadersChange={onHeadersChange}
        />,
      );
      const header = view.container.querySelector("th.sortable") as HTMLElement;
      return { onSortChange, onHeadersChange, header };
    }

    it("sorts on a click on the header", () => {
      const { onSortChange, header } = renderSortable();

      fireEvent.click(within(header).getByText("Title"));

      expect(onSortChange).toHaveBeenCalledWith({ by: "title", desc: false });
    });

    it("does not sort when a resize is released inside the header", () => {
      const { onSortChange, onHeadersChange, header } = renderSortable();
      const handle = header.querySelector(".resize-handle") as HTMLElement;

      fireEvent.pointerDown(handle, { pageX: 100 });
      fireEvent.pointerMove(window, { pageX: 160 });
      fireEvent.pointerUp(window, { pageX: 160 });
      // The click the browser sends after a press and release inside the <th>.
      fireEvent.click(header);

      expect(onHeadersChange).toHaveBeenCalled();
      expect(onSortChange).not.toHaveBeenCalled();
    });

    it("does not sort on a click on the Reorder column grip", () => {
      const { onSortChange, header } = renderSortable();

      fireEvent.click(within(header).getByRole("button", { name: "Reorder column" }));

      expect(onSortChange).not.toHaveBeenCalled();
    });
  });
});
