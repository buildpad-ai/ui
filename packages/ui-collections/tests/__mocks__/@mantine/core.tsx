/**
 * Mock for @mantine/core — provides simple div-based components
 * to avoid React duplication issues in pnpm monorepo testing.
 */
import React from "react";

// Simple wrapper that passes through children and common props
const makeComponent = (displayName: string) => {
  const Comp = React.forwardRef<HTMLDivElement, Record<string, unknown>>(
    ({ children, ...props }, ref) => {
      // Forward data-testid and common test attributes
      const testProps: Record<string, unknown> = {};
      for (const key of Object.keys(props)) {
        if (key.startsWith("data-") || key === "role" || key === "id" || key === "className") {
          testProps[key] = props[key];
        }
      }
      return (
        <div ref={ref} data-component={displayName} {...testProps}>
          {children}
        </div>
      );
    }
  );
  Comp.displayName = displayName;
  return Comp;
};

// Interactive components
const Button = React.forwardRef<HTMLButtonElement, Record<string, unknown>>(
  ({ children, onClick, disabled, loading, type, ...props }, ref) => {
    const testProps: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      if (key.startsWith("data-") || key === "role" || key === "id" || key === "className") {
        testProps[key] = props[key];
      }
    }
    return (
      <button
        ref={ref}
        onClick={onClick as React.MouseEventHandler}
        disabled={!!disabled || !!loading}
        type={(type as "button" | "submit" | "reset") ?? "button"}
        {...testProps}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

const ActionIcon = React.forwardRef<HTMLButtonElement, Record<string, unknown>>(
  ({ children, onClick, disabled, ...props }, ref) => {
    const testProps: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      if (key.startsWith("data-") || key === "role" || key === "id" || key === "className") {
        testProps[key] = props[key];
      }
    }
    return (
      <button ref={ref} onClick={onClick as React.MouseEventHandler} disabled={!!disabled} {...testProps}>
        {children}
      </button>
    );
  }
);
ActionIcon.displayName = "ActionIcon";

const TextInput = React.forwardRef<HTMLInputElement, Record<string, unknown>>(
  ({ value, onChange, placeholder, ...props }, ref) => {
    const testProps: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      if (key.startsWith("data-") || key === "role" || key === "id" || key === "className") {
        testProps[key] = props[key];
      }
    }
    return (
      <input
        ref={ref}
        value={value as string}
        onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
        placeholder={placeholder as string}
        {...testProps}
      />
    );
  }
);
TextInput.displayName = "TextInput";

const Select = React.forwardRef<HTMLSelectElement, Record<string, unknown>>(
  ({ value, onChange, data, placeholder, ...props }, ref) => {
    const testProps: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      if (key.startsWith("data-") || key === "role" || key === "id" || key === "className") {
        testProps[key] = props[key];
      }
    }
    return (
      <select
        ref={ref}
        value={value as string}
        onChange={(e) => (onChange as (v: string) => void)?.(e.target.value)}
        {...testProps}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {(data as Array<{ label: string; value: string }> | undefined)?.map((d) => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </select>
    );
  }
);
Select.displayName = "Select";

// Modal with opened/onClose support
const Modal = ({ opened, onClose, children, title, ...props }: Record<string, unknown>) => {
  if (!opened) return null;
  const testProps: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-") || key === "role" || key === "id" || key === "className") {
      testProps[key] = props[key];
    }
  }
  return (
    <div data-component="Modal" role="dialog" {...testProps}>
      {title && <div data-component="Modal.Title">{title as React.ReactNode}</div>}
      {children as React.ReactNode}
    </div>
  );
};

// LoadingOverlay
const LoadingOverlay = ({ visible, ...props }: Record<string, unknown>) => {
  if (!visible) return null;
  return <div data-component="LoadingOverlay" data-testid="loading-overlay" />;
};

// Collapse
const Collapse = ({ in: isIn, children }: Record<string, unknown>) => {
  if (!isIn) return null;
  return <div data-component="Collapse">{children as React.ReactNode}</div>;
};

// Tooltip
const Tooltip = ({ children, label }: Record<string, unknown>) => (
  <div data-component="Tooltip" title={label as string}>
    {children as React.ReactNode}
  </div>
);

// Menu
const MenuComp = ({ children }: Record<string, unknown>) => (
  <div data-component="Menu">{children as React.ReactNode}</div>
);
MenuComp.Target = ({ children }: Record<string, unknown>) => <div>{children as React.ReactNode}</div>;
MenuComp.Dropdown = ({ children }: Record<string, unknown>) => <div>{children as React.ReactNode}</div>;
MenuComp.Item = ({ children, onClick, ...props }: Record<string, unknown>) => {
  const testProps: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-")) testProps[key] = props[key];
  }
  return (
    <button onClick={onClick as React.MouseEventHandler} {...testProps}>
      {children as React.ReactNode}
    </button>
  );
};

// MantineProvider
const MantineProvider = ({ children }: Record<string, unknown>) => (
  <>{children as React.ReactNode}</>
);

const Alert = makeComponent("Alert");
const Badge = makeComponent("Badge");
const GroupComp = makeComponent("Group");

// Interactive pagination — renders one button per page so tests can navigate
// through the same control users click, mirroring the Mantine <Pagination>
// props the components rely on (value/onChange/total).
const PaginationComp = React.forwardRef<HTMLDivElement, Record<string, unknown>>(
  ({ value, onChange, total, ...props }, ref) => {
    const testProps: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      if (key.startsWith("data-") || key === "role" || key === "id" || key === "className") {
        testProps[key] = props[key];
      }
    }
    // Cap the rendered buttons so a huge page count cannot bloat the test DOM.
    const pageCount = Math.min(Number(total) || 0, 50);
    return (
      <div
        ref={ref}
        data-component="Pagination"
        data-current={String(value ?? "")}
        data-total={String(total ?? "")}
        {...testProps}
      >
        {Array.from({ length: pageCount }, (_, i) => (
          <button
            key={i + 1}
            type="button"
            data-testid={`pagination-page-${i + 1}`}
            data-active={value === i + 1 ? "true" : undefined}
            onClick={() => (onChange as ((page: number) => void) | undefined)?.(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    );
  }
);
PaginationComp.displayName = "Pagination";
const Paper = makeComponent("Paper");
const StackComp = makeComponent("Stack");
const TextComp = makeComponent("Text");

export {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Collapse,
  GroupComp as Group,
  LoadingOverlay,
  MantineProvider,
  MenuComp as Menu,
  Modal,
  PaginationComp as Pagination,
  Paper,
  Select,
  StackComp as Stack,
  TextComp as Text,
  TextInput,
  Tooltip,
};
