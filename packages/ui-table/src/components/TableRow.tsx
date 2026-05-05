/**
 * TableRow Component
 * Renders a single row in the table
 */

import React, { forwardRef } from 'react';
import { Checkbox, Radio, Text } from '@mantine/core';
import { IconGripVertical } from '@tabler/icons-react';
import type { Header, Item, ShowSelect } from '../types';
import './TableRow.css';

export interface TableRowProps extends Omit<React.HTMLAttributes<HTMLTableRowElement>, 'onSelect'> {
  /** Column headers */
  headers: Header[];
  /** Row data */
  item: Item;
  /** Selection mode */
  showSelect?: ShowSelect;
  /** Show manual sort handle */
  showManualSort?: boolean;
  /** Whether this row is selected */
  isSelected?: boolean;
  /** Whether to show subdued styling */
  subdued?: boolean;
  /** Whether manual sort is currently active */
  sortedManually?: boolean;
  /** Whether row has click handler */
  hasClickListener?: boolean;
  /** Row height in pixels */
  height?: number;
  /** Custom cell renderer */
  renderCell?: (item: Item, header: Header) => React.ReactNode;
  /** Custom append slot */
  renderAppend?: (item: Item) => React.ReactNode;
  /** Row click handler */
  onClick?: (event: React.MouseEvent) => void;
  /** Selection change handler */
  onSelect?: (selected: boolean) => void;
  /** Drag handle props (for dnd-kit) */
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  /** Whether row is being dragged */
  isDragging?: boolean;
}

/**
 * Get nested value from item using dot notation
 */
function getNestedValue(item: Item, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, item);
}

/**
 * Format value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return JSON.stringify(value);
  }
  return String(value);
}

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(({
  headers,
  item,
  showSelect = 'none',
  showManualSort = false,
  isSelected = false,
  subdued = false,
  sortedManually = false,
  hasClickListener = false,
  height = 48,
  renderCell,
  renderAppend,
  onClick,
  onSelect,
  dragHandleProps,
  isDragging = false,
  style,
  className,
  ...restProps
}, ref) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.metaKey) return;
    if ((e.target as HTMLElement)?.tagName === 'TR' && ['Enter', ' '].includes(e.key)) {
      onClick?.(e as unknown as React.MouseEvent);
    }
  };

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Rows that contain their own focusable controls (selection checkbox / radio,
  // drag handle for manual sort) must NOT also act as a keyboard-interactive
  // button — that produces the axe "nested-interactive" violation. Mouse users
  // still get row click; keyboard users navigate to the inner control.
  const hasFocusableChild = showSelect !== 'none' || showManualSort;
  const rowIsKeyboardInteractive = hasClickListener && !hasFocusableChild;

  return (
    <tr
      ref={ref}
      className={`table-row ${subdued ? 'subdued' : ''} ${hasClickListener ? 'clickable' : ''} ${isDragging ? 'dragging' : ''} ${className || ''}`}
      style={{ height: `${height + 2}px`, ...style }}
      tabIndex={rowIsKeyboardInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={rowIsKeyboardInteractive ? handleKeyDown : undefined}
      aria-selected={showSelect !== 'none' ? (isSelected ? 'true' : 'false') : undefined}
      {...restProps}
    >
      {/* Manual Sort Handle */}
      {showManualSort && (
        <td className="cell manual" onClick={handleSelectClick}>
          <div
            className={`drag-handle ${sortedManually ? 'sorted-manually' : ''}`}
            role="button"
            aria-label="Reorder row"
            {...dragHandleProps}
          >
            <IconGripVertical size={18} />
          </div>
        </td>
      )}

      {/* Selection Checkbox/Radio */}
      {showSelect !== 'none' && (
        <td className="cell select" onClick={handleSelectClick}>
          {showSelect === 'one' ? (
            <Radio
              checked={isSelected}
              onChange={(e) => onSelect?.(e.currentTarget.checked)}
              aria-label="Select row"
            />
          ) : (
            <Checkbox
              checked={isSelected}
              onChange={(e) => onSelect?.(e.currentTarget.checked)}
              aria-label="Select row"
            />
          )}
        </td>
      )}

      {/* Data Cells */}
      {headers.map((header) => {
        const value = getNestedValue(item, header.value);
        const content = renderCell ? renderCell(item, header) : null;

        return (
          <td
            key={header.value}
            className={`cell align-${header.align}`}
          >
            {content !== null ? (
              content
            ) : value !== null && value !== undefined ? (
              <Text size="sm" truncate="end">
                {formatValue(value)}
              </Text>
            ) : (
              <Text size="sm" c="gray.6">—</Text>
            )}
          </td>
        );
      })}

      {/* Spacer */}
      <td className="cell spacer" aria-hidden="true" />

      {/* Append Slot */}
      {renderAppend && (
        <td className="cell append" onClick={handleSelectClick}>
          {renderAppend(item)}
        </td>
      )}
    </tr>
  );
});

TableRow.displayName = 'TableRow';
