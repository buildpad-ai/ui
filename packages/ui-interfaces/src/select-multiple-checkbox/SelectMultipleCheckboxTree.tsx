/**
 * SelectMultipleCheckboxTree Interface Component
 * Tree-based multi-select checkbox with hierarchical choices
 * 
 * Based on DaaS select-multiple-checkbox-tree interface
 * Supports value combining modes: all, branch, leaf, indeterminate, exclusive
 */

'use client';

import React, { useState, useMemo, useCallback, useId } from 'react';
import {
  Stack,
  Text,
  ActionIcon,
  Group,
  Box,
  Checkbox,
  Collapse,
  ScrollArea,
  Button,
  TextInput,
} from '@mantine/core';
import { IconChevronRight, IconChevronDown, IconSearch, IconX } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';

export interface TreeChoice {
  text: string;
  value: string | number | boolean;
  children?: TreeChoice[];
  disabled?: boolean;
}

export interface SelectMultipleCheckboxTreeProps {
  value?: (string | number | boolean)[];
  onChange?: (value: (string | number | boolean)[] | null) => void;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  choices?: TreeChoice[];
  valueCombining?: 'all' | 'branch' | 'leaf' | 'indeterminate' | 'exclusive';
  width?: string;
  color?: string;
}

interface TreeNodeProps {
  choice: TreeChoice;
  selectedValues: (string | number | boolean)[];
  onToggle: (value: string | number | boolean, checked: boolean) => void;
  valueCombining: 'all' | 'branch' | 'leaf' | 'indeterminate' | 'exclusive';
  searchQuery: string;
  showSelectionOnly: boolean;
  disabled: boolean;
  level: number;
  color: string;
}

// Inline SearchInput component to avoid external dependency
function SearchInput({ 
  onSearch, 
  placeholder = 'Search...', 
  showClearButton = true,
  disabled = false,
}: {
  onSearch: (value: string) => void;
  placeholder?: string;
  showClearButton?: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const [debounced] = useDebouncedValue(value, 300);

  React.useEffect(() => {
    onSearch(debounced);
  }, [debounced, onSearch]);

  const handleClear = () => {
    setValue('');
    onSearch('');
  };

  return (
    <TextInput
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.currentTarget.value)}
      leftSection={<IconSearch size={16} />}
      rightSection={
        showClearButton && value && (
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <IconX size={12} />
          </ActionIcon>
        )
      }
      disabled={disabled}
      style={{ flex: 1 }}
    />
  );
}

export function SelectMultipleCheckboxTree({
  value = [],
  onChange,
  label,
  disabled = false,
  required = false,
  error,
  choices = [],
  valueCombining = 'all',
  width,
  color = 'blue',
}: SelectMultipleCheckboxTreeProps) {
  const [search, setSearch] = useState('');
  const [showSelectionOnly, setShowSelectionOnly] = useState(false);
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const labelId = useId();

  // Get children values for a specific parent
  const getChildrenValues = useCallback((choice: TreeChoice): (string | number | boolean)[] => {
    if (!choice.children) {
      return [];
    }
    const collectChildValues = (nodes: TreeChoice[]): (string | number | boolean)[] => {
      const values: (string | number | boolean)[] = [];
      for (const node of nodes) {
        values.push(node.value);
        if (node.children) {
          values.push(...collectChildValues(node.children));
        }
      }
      return values;
    };
    return collectChildValues(choice.children);
  }, []);

  // Get leaf values from a choice
  const getLeafValues = useCallback((choice: TreeChoice): (string | number | boolean)[] => {
    if (!choice.children || choice.children.length === 0) {
      return [choice.value];
    }
    
    const leafValues: (string | number | boolean)[] = [];
    for (const child of choice.children) {
      leafValues.push(...getLeafValues(child));
    }
    return leafValues;
  }, []);

  // Check if node matches search
  const matchesSearch = useCallback((choice: TreeChoice, query: string): boolean => {
    if (!query) {
      return true;
    }
    const lowerQuery = query.toLowerCase();
    
    // Check current node
    if (choice.text.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    
    // Check children recursively
    if (choice.children) {
      return choice.children.some(child => matchesSearch(child, query));
    }
    
    return false;
  }, []);

  // Check if node has any selected descendants
  const hasSelectedDescendants = useCallback((choice: TreeChoice): boolean => {
    if (!choice.children) {
      return false;
    }
    
    for (const child of choice.children) {
      if (value.includes(child.value) || hasSelectedDescendants(child)) {
        return true;
      }
    }
    return false;
  }, [value]);

  // Filter choices based on search and show selection only
  const filteredChoices = useMemo(() => {
    const filterTree = (nodes: TreeChoice[]): TreeChoice[] => {
      return nodes.filter(choice => {
        if (showSelectionOnly) {
          return value.includes(choice.value) || hasSelectedDescendants(choice);
        }
        return matchesSearch(choice, debouncedSearch);
      }).map(choice => ({
        ...choice,
        children: choice.children ? filterTree(choice.children) : undefined,
      }));
    };
    
    return filterTree(choices);
  }, [choices, debouncedSearch, showSelectionOnly, value, hasSelectedDescendants, matchesSearch]);

  // Handle checkbox toggle
  const handleToggle = useCallback((toggleValue: string | number | boolean, checked: boolean) => {
    if (disabled) {
      return;
    }

    const currentValue = value || [];
    let newValue: (string | number | boolean)[];

    // Find the choice being toggled
    const findChoice = (nodes: TreeChoice[], val: string | number | boolean): TreeChoice | null => {
      for (const node of nodes) {
        if (node.value === val) {
          return node;
        }
        if (node.children) {
          const found = findChoice(node.children, val);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };

    const toggledChoice = findChoice(choices, toggleValue);
    if (!toggledChoice) {
      return;
    }

    switch (valueCombining) {
      case 'all': {
        // Include/exclude the value and all its children
        const childrenValues = getChildrenValues(toggledChoice);
        const allAffectedValues = [toggleValue, ...childrenValues];
        
        if (checked) {
          // Add all values
          const valueSet = new Set([...currentValue, ...allAffectedValues]);
          newValue = Array.from(valueSet);
        } else {
          // Remove all values
          newValue = currentValue.filter(v => !allAffectedValues.includes(v));
        }
        break;
      }
      
      case 'branch': {
        // Only include/exclude the parent value, but respect children selections
        if (checked) {
          newValue = currentValue.includes(toggleValue) ? currentValue : [...currentValue, toggleValue];
        } else {
          newValue = currentValue.filter(v => v !== toggleValue);
        }
        break;
      }
      
      case 'leaf': {
        // Only include/exclude leaf nodes (nodes without children)
        if (!toggledChoice.children || toggledChoice.children.length === 0) {
          if (checked) {
            newValue = currentValue.includes(toggleValue) ? currentValue : [...currentValue, toggleValue];
          } else {
            newValue = currentValue.filter(v => v !== toggleValue);
          }
        } else {
          // For parent nodes, toggle all leaf children
          const leafChildren = getLeafValues(toggledChoice);
          if (checked) {
            const valueSet = new Set([...currentValue, ...leafChildren]);
            newValue = Array.from(valueSet);
          } else {
            newValue = currentValue.filter(v => !leafChildren.includes(v));
          }
        }
        break;
      }
      
      case 'exclusive': {
        // Only one value can be selected at a time within a parent group
        if (checked) {
          newValue = [toggleValue];
        } else {
          newValue = [];
        }
        break;
      }
      
      default: {
        // Default behavior: simple toggle
        if (checked) {
          newValue = currentValue.includes(toggleValue) ? currentValue : [...currentValue, toggleValue];
        } else {
          newValue = currentValue.filter(v => v !== toggleValue);
        }
      }
    }

    onChange?.(newValue.length > 0 ? newValue : null);
  }, [value, onChange, disabled, choices, valueCombining, getChildrenValues, getLeafValues]);

  // Show choices validation message
  if (!choices || choices.length === 0) {
    return (
      <Stack gap="xs" style={{ width }}>
        {label && (
          <Text size="sm" fw={500}>
            {label}
            {required && <Text component="span" c="red">*</Text>}
          </Text>
        )}
        <Text size="sm" c="orange" role="alert">
          Choices option configured incorrectly
        </Text>
        {error && (
          <Text size="xs" c="red" role="alert" aria-live="polite">
            {error}
          </Text>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="xs" style={{ width }}>
      {label && (
        <Text 
          size="sm" 
          fw={500}
          component="label"
          htmlFor={`checkbox-tree-${labelId}`}
        >
          {label}
          {required && <Text component="span" c="red" ml={4}>*</Text>}
        </Text>
      )}

      <Box
        style={{
          maxHeight: '300px',
          backgroundColor: 'var(--mantine-color-gray-0)',
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: 'var(--mantine-radius-xs)',
          overflow: 'hidden',
        }}
        role="tree"
        aria-label={label ? `${label} tree` : 'Tree selection'}
      >
        {/* Search input */}
        {choices.length > 10 && (
          <Box
            p="sm"
            style={{
              borderBottom: '1px solid var(--mantine-color-gray-3)',
              backgroundColor: 'var(--mantine-color-white)',
            }}
          >
            <SearchInput
              placeholder="Search..."
              onSearch={setSearch}
              disabled={disabled}
              showClearButton
            />
          </Box>
        )}

        {/* Tree content */}
        <ScrollArea h="200px" p="sm">
          <Stack gap="xs">
            {filteredChoices.map((choice, index) => (
              // Index-qualified: see the matching comment at the recursive
              // children.map below — choices whose values stringify
              // identically would otherwise collide on key={String(value)}.
              <TreeNode
                key={`${index}-${String(choice.value)}`}
                choice={choice}
                selectedValues={value}
                onToggle={handleToggle}
                valueCombining={valueCombining}
                searchQuery={debouncedSearch}
                showSelectionOnly={showSelectionOnly}
                disabled={disabled}
                level={0}
                color={color}
              />
            ))}
          </Stack>
        </ScrollArea>

        {/* Footer controls */}
        <Group
          justify="flex-end"
          gap="xs"
          p="xs"
          style={{
            borderTop: '1px solid var(--mantine-color-gray-3)',
            backgroundColor: 'var(--mantine-color-white)',
          }}
        >
          <Button
            variant={showSelectionOnly ? 'subtle' : 'light'}
            size="xs"
            onClick={() => setShowSelectionOnly(false)}
            disabled={disabled}
          >
            Show All
          </Button>
          <Text size="xs" c="dimmed">/</Text>
          <Button
            variant={showSelectionOnly ? 'light' : 'subtle'}
            size="xs"
            onClick={() => setShowSelectionOnly(true)}
            disabled={disabled}
          >
            Show Selected
          </Button>
        </Group>
      </Box>

      {error && (
        <Text size="xs" c="red" role="alert" aria-live="polite">
          {error}
        </Text>
      )}
    </Stack>
  );
}

// Tree Node Component
function TreeNode({
  choice,
  selectedValues,
  onToggle,
  valueCombining,
  searchQuery,
  showSelectionOnly,
  disabled,
  level,
  color,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = choice.children && choice.children.length > 0;

  // Calculate checkbox state based on selection and children
  const { checked, indeterminate } = useMemo(() => {
    const isSelected = selectedValues.includes(choice.value);
    
    if (!hasChildren) {
      return { checked: isSelected, indeterminate: false };
    }

    // For parent nodes, check children state
    const allChildValues: (string | number | boolean)[] = [];
    const collectChildValues = (nodes: TreeChoice[]) => {
      for (const node of nodes) {
        allChildValues.push(node.value);
        if (node.children) {
          collectChildValues(node.children);
        }
      }
    };
    collectChildValues(choice.children!);

    const selectedChildrenCount = allChildValues.filter(val => selectedValues.includes(val)).length;
    
    if (valueCombining === 'all') {
      if (selectedChildrenCount === 0) {
        return { checked: isSelected, indeterminate: false };
      } else if (selectedChildrenCount === allChildValues.length) {
        return { checked: true, indeterminate: false };
      }
      return { checked: false, indeterminate: true };
    }
    
    return { checked: isSelected, indeterminate: selectedChildrenCount > 0 && !isSelected };
  }, [selectedValues, choice, hasChildren, valueCombining]);

  // Highlight search matches
  const highlightedText = useMemo(() => {
    if (!searchQuery) {
      return choice.text;
    }
    
    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = choice.text.split(new RegExp(`(${escapedQuery})`, 'gi'));
    return (
      <span>
        {parts.map((part, index) =>
          part.toLowerCase() === searchQuery.toLowerCase() ? (
            <mark key={index}>
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  }, [choice.text, searchQuery]);

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onToggle(choice.value, event.currentTarget.checked);
  };

  const toggleExpanded = () => {
    if (hasChildren) {
      setExpanded(!expanded);
    }
  };

  return (
    <Box role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        {/* Expansion toggle */}
        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={toggleExpanded}
          style={{
            visibility: hasChildren ? 'visible' : 'hidden',
            marginLeft: level * 16,
          }}
          disabled={disabled}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
        </ActionIcon>

        {/* Checkbox */}
        <Checkbox
          checked={checked}
          indeterminate={indeterminate}
          onChange={handleCheckboxChange}
          disabled={disabled || choice.disabled}
          color={color}
          size="sm"
          label={highlightedText}
          aria-label={choice.text}
          wrapperProps={{
            'data-testid': `checkbox-${String(choice.value)}`,
          }}
          styles={{
            label: {
              cursor: disabled ? 'default' : 'pointer',
            },
          }}
        />
      </Group>

      {/* Children */}
      {hasChildren && (
        <Collapse in={expanded}>
          <Stack gap="xs" ml="md" mt="xs">
            {choice.children!.map((child, childIndex) => (
              // Index-qualified for the same reason as the top-level
              // filteredChoices.map above — colliding stringified values
              // (e.g. 1 vs '1') within the same children array would
              // otherwise produce a React duplicate-key warning.
              <TreeNode
                key={`${childIndex}-${String(child.value)}`}
                choice={child}
                selectedValues={selectedValues}
                onToggle={onToggle}
                valueCombining={valueCombining}
                searchQuery={searchQuery}
                showSelectionOnly={showSelectionOnly}
                disabled={disabled}
                level={level + 1}
                color={color}
              />
            ))}
          </Stack>
        </Collapse>
      )}
    </Box>
  );
}

export default SelectMultipleCheckboxTree;
