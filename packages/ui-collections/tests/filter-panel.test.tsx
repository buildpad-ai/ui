/**
 * FilterPanel Component Tests
 *
 * The rules the panel shows and the DaaS filter it emits, driven through the
 * same controls a user uses (the @mantine/core test double renders Select as
 * a native <select> and Menu.Item as a button).
 */

import { render, screen, fireEvent, within } from "@testing-library/react";
import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import type { Field } from "@buildpad/types";
import { FilterPanel } from "../src/FilterPanel";

const FIELDS = [
  { field: "title", type: "string", meta: { interface: "input" } },
  { field: "quantity", type: "integer", meta: { interface: "input" } },
] as unknown as Field[];

/** A host that feeds the emitted filter back, as CollectionList does. */
function ControlledPanel({ onChange }: { onChange?: (filter: Record<string, unknown> | null) => void }) {
  const [value, setValue] = useState<Record<string, unknown> | null>(null);
  return (
    <>
      <button type="button" data-testid="outer-clear" onClick={() => setValue(null)} />
      <FilterPanel
        fields={FIELDS}
        value={value}
        onChange={(filter) => {
          setValue(filter);
          onChange?.(filter);
        }}
        mode="inline"
      />
    </>
  );
}

function addRule(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

function rules() {
  return screen.queryAllByTestId("filter-rule");
}

describe("FilterPanel", () => {
  describe("a value changed outside the panel", () => {
    it("rebuilds the rules when the host clears the filter", () => {
      const onChange = vi.fn();
      render(<ControlledPanel onChange={onChange} />);

      addRule("Title");
      expect(rules()).toHaveLength(1);
      expect(onChange).toHaveBeenLastCalledWith({ _and: [{ title: { _eq: null } }] });

      fireEvent.click(screen.getByTestId("outer-clear"));

      expect(rules()).toHaveLength(0);
      expect(screen.getByText('No filter rules. Click "Add filter" to get started.')).toBeInTheDocument();

      // The next edit starts from the cleared state, not the old rules.
      addRule("Quantity");
      expect(onChange).toHaveBeenLastCalledWith({ _and: [{ quantity: { _eq: null } }] });
    });

    it("keeps its rules when the host passes back what the panel emitted", () => {
      render(<ControlledPanel />);

      addRule("Title");
      const rule = rules()[0];
      fireEvent.change(within(rule).getByPlaceholderText("Value..."), { target: { value: "abc" } });

      expect(rules()).toHaveLength(1);
      expect(within(rules()[0]).getByPlaceholderText("Value...")).toHaveValue("abc");
    });

    it("keeps its rules in a host that never passes a value", () => {
      const onChange = vi.fn();
      render(<FilterPanel fields={FIELDS} onChange={onChange} mode="inline" />);

      addRule("Title");
      addRule("Quantity");

      expect(rules()).toHaveLength(2);
      expect(onChange).toHaveBeenLastCalledWith({
        _and: [{ title: { _eq: null } }, { quantity: { _eq: null } }],
      });
    });
  });

  describe("switching operators", () => {
    it("starts the value empty when switching from Is null to a value operator", () => {
      const onChange = vi.fn();
      render(<ControlledPanel onChange={onChange} />);

      addRule("Quantity");
      const operator = () => within(rules()[0]).getAllByRole("combobox")[1];
      fireEvent.change(operator(), { target: { value: "_null" } });
      expect(onChange).toHaveBeenLastCalledWith({ _and: [{ quantity: { _null: true } }] });

      fireEvent.change(operator(), { target: { value: "_gt" } });

      expect(onChange).toHaveBeenLastCalledWith({ _and: [{ quantity: { _gt: null } }] });
      expect(within(rules()[0]).getByPlaceholderText("Value...")).toHaveValue(null);
    });

    it("keeps the value when switching between two value operators", () => {
      const onChange = vi.fn();
      render(<ControlledPanel onChange={onChange} />);

      addRule("Title");
      fireEvent.change(within(rules()[0]).getByPlaceholderText("Value..."), { target: { value: "abc" } });
      fireEvent.change(within(rules()[0]).getAllByRole("combobox")[1], { target: { value: "_contains" } });

      expect(onChange).toHaveBeenLastCalledWith({ _and: [{ title: { _contains: "abc" } }] });
    });
  });

  describe("number values", () => {
    it("sends an emptied number value as null, never as an empty string", () => {
      const onChange = vi.fn();
      render(<ControlledPanel onChange={onChange} />);

      addRule("Quantity");
      const input = () => within(rules()[0]).getByPlaceholderText("Value...");
      fireEvent.change(input(), { target: { value: "5" } });
      expect(onChange).toHaveBeenLastCalledWith({ _and: [{ quantity: { _eq: 5 } }] });

      fireEvent.change(input(), { target: { value: "" } });

      expect(onChange).toHaveBeenLastCalledWith({ _and: [{ quantity: { _eq: null } }] });
      expect(input()).toHaveValue(null);
    });
  });
});
