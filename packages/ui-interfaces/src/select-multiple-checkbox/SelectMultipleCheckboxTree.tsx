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
import { useBuildpadTranslations } from '@buildpad/services';
import { interpolate, type DeepPartial, type InterfacesTranslations } from '@buildpad/utils';

/** Resolved dictionary strings of the tree (`interfaces.selectMultipleCheckbox.tree`). */
type TreeStrings = InterfacesTranslations['selectMultipleCheckbox']['tree'];

// Depth cap for the recursive tree walkers (S4.10). `choices` is normally
// plain JSON, which can't encode a cycle — but a programmatic consumer could
// still hand this component a cyclic in-memory structure, which would
// otherwise overflow the stack in every recursive helper below.
const MAX_TREE_DEPTH = 100;

export interface TreeChoice {
  text: string;
  value: string | number | boolean;
  children?: TreeChoice[];
  disabled?: boolean;
}

// Internal: TreeChoice annotated with a key derived from its position in the
// *unfiltered* `choices` tree. Search/showSelectionOnly filtering changes
// which siblings appear (and therefore their index within the filtered
// array) without changing each node's identity — keying on the filtered
// index remounted every node whenever the filtered set changed size,
// resetting each TreeNode's local `expanded` state back to its default.
interface KeyedTreeChoice extends Omit<TreeChoice, 'children'> {
  __key: string;
  /**
   * Position in the UNFILTERED sibling array. `__key` mixes this with the
   * value for React reconciliation; `__index` is the same stability without
   * the value, so a data-testid path stays short and keeps the documented
   * `0-2-1` shape. Sibling indices are already distinct, so index-only path
   * segments satisfy the S4.8 collision scoping on their own.
   */
  __index: number;
  children?: KeyedTreeChoice[];
}

export interface SelectMultipleCheckboxTreeProps {
  /**
   * Registered for `types: ['json', 'csv']` — a `csv`-typed field delivers a
   * raw comma-separated string, not an array. `type` lets this component
   * normalize on read and re-serialize on write when used standalone
   * (outside the FormFieldInterface pipeline, which already normalizes this
   * for its own three multi-select leaves but can't help a direct consumer
   * of this exported component — and the registry ships this file on its own).
   * Without normalization a csv string breaks every operation below:
   * substring-match reads via String.includes, character-spread on add
   * ([...str, v]), and TypeError on remove (str.filter is not a function).
   */
  type?: 'csv' | 'json';
  value?: (string | number | boolean)[] | string | null;
  onChange?: (value: (string | number | boolean)[] | string | null) => void;
  label?: string;
  disabled?: boolean;
  /**
   * Value is visible but not editable. Enforced at the `handleToggle`
   * chokepoint plus pointer suppression, not by setting `disabled` — the tree
   * stays readable, searchable and focusable.
   */
  readOnly?: boolean;
  required?: boolean;
  error?: string;
  choices?: TreeChoice[];
  valueCombining?: 'all' | 'branch' | 'leaf' | 'indeterminate' | 'exclusive';
  width?: string;
  color?: string;
  /**
   * Accessible name. FormFieldInterface forwards one (it renders the visible
   * label itself, so `label` is intentionally not passed); without this the
   * fixed destructure below would drop it and every tree field on every form
   * would be announced as the same literal string.
   */
  'aria-label'?: string;
  /** Per-instance overrides of the dictionary strings (`interfaces.selectMultipleCheckbox`) */
  translations?: DeepPartial<InterfacesTranslations['selectMultipleCheckbox']>;
}

interface TreeNodeProps {
  choice: KeyedTreeChoice;
  selectedValues: (string | number | boolean)[];
  onToggle: (value: string | number | boolean, checked: boolean) => void;
  valueCombining: 'all' | 'branch' | 'leaf' | 'indeterminate' | 'exclusive';
  searchQuery: string;
  showSelectionOnly: boolean;
  disabled: boolean;
  /** Selection is locked, but the tree stays browsable (chevrons remain live). */
  readOnly: boolean;
  level: number;
  color: string;
  /** Values whose subtree contains a search/selection match — force-expanded regardless of prior manual collapse (S4.9) */
  autoExpandValues: Set<string | number | boolean> | null;
  /**
   * Index path from the root (e.g. "0-2-1"), built from each node's position
   * in the UNFILTERED sibling array so it does not shift when search or
   * "Show Selected" changes which siblings are visible. Scopes data-testid so
   * stringify-colliding sibling values don't share one testid (S4.8).
   */
  nodePath: string;
  /** Resolved dictionary strings (expand / collapse labels) */
  t: TreeStrings;
}

// Inline SearchInput component to avoid external dependency. The strings are
// resolved by the tree (which owns the `translations` prop) and passed in.
function SearchInput({
  onSearch,
  placeholder,
  clearLabel,
  showClearButton = true,
  disabled = false,
}: {
  onSearch: (value: string) => void;
  placeholder: string;
  /** aria-label of the clear button */
  clearLabel: string;
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
            aria-label={clearLabel}
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
  type,
  value: rawValue = [],
  onChange: onChangeProp,
  label,
  disabled = false,
  readOnly = false,
  required = false,
  error,
  choices = [],
  valueCombining = 'all',
  width,
  color = 'blue',
  'aria-label': ariaLabel,
  translations,
}: SelectMultipleCheckboxTreeProps) {
  const t = useBuildpadTranslations((d) => d.interfaces.selectMultipleCheckbox, translations);
  const [search, setSearch] = useState('');
  const [showSelectionOnly, setShowSelectionOnly] = useState(false);
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const labelId = useId();

  // Flattened choice values, used to restore the original type of each token
  // parsed out of a csv string. A csv column stores "1,3" as text, so a naive
  // split yields the STRINGS ['1','3'] while the choices carry the NUMBERS
  // 1 and 3 — and every comparison below is SameValueZero, so nothing would
  // ever match and each click would append a duplicate.
  // Every node in the tree, keyed by value, built once per `choices`.
  //
  // A `WeakSet` of already-visited nodes rather than a depth cap: a cycle
  // revisits the same object, so detecting that is exact and terminates on any
  // shape — including a node listed twice in its own children, which a depth
  // cap does not survive (it fans out 2^depth before the cap ever bites). It
  // also has no false negatives on a legitimately deep tree, where a cap
  // silently stops resolving nodes that are still on screen.
  //
  // First occurrence wins, preserving the depth-first search this replaces.
  const choiceByValue = useMemo(() => {
    const map = new Map<string | number | boolean, TreeChoice>();
    const seen = new WeakSet<TreeChoice>();
    const walk = (nodes: TreeChoice[]) => {
      for (const n of nodes) {
        if (seen.has(n)) continue;
        seen.add(n);
        if (!map.has(n.value)) map.set(n.value, n);
        if (n.children) walk(n.children);
      }
    };
    walk(choices);
    return map;
  }, [choices]);

  // Flattened values, derived from the same single walk.
  const choiceValues = useMemo(() => [...choiceByValue.keys()], [choiceByValue]);

  // Normalize a raw csv-string value to an array before anything below reads
  // it. `type === 'csv'` is the documented signal, but also trust what was
  // actually observed (a string) — some backends report the underlying
  // column type instead of the abstract 'csv' interface type. `?? []` also
  // covers a null, which a freshly-provisioned nullable column holds and
  // which the destructuring default above cannot catch.
  const value = useMemo(() => {
    if (Array.isArray(rawValue)) return rawValue;
    if (typeof rawValue === 'string') {
      return rawValue
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((token) => choiceValues.find((cv) => String(cv) === token) ?? token);
    }
    return rawValue ?? [];
  }, [rawValue, choiceValues]);

  const isCsvStorage = type === 'csv' || typeof rawValue === 'string';

  // Emit an array or, for csv storage, join it back to a comma-string.
  const onChange = useCallback(
    (next: (string | number | boolean)[] | null) => {
      if (isCsvStorage && Array.isArray(next)) {
        onChangeProp?.(next.join(','));
      } else {
        onChangeProp?.(next);
      }
    },
    [onChangeProp, isCsvStorage],
  );

  // Strip a `var(--mantine-color-X-6)` wrapper down to the bare palette name
  // before handing it to Mantine's `color` prop (S4.11) — mirrors the
  // normalization SelectMultipleCheckbox already does. Forwarding the raw
  // `var(...)` string as-is silently drops the color in Mantine v8.
  const normalizedColor = useMemo(() => {
    if (color.startsWith('var(--mantine-color-')) {
      return color.replace('var(--mantine-color-', '').replace(')', '').replace('-6', '');
    }
    return color;
  }, [color]);

  // Get children values for a specific parent. Disabled nodes are excluded
  // from cascade toggles (S4.7) — a disabled node should stay untouched
  // when its ancestor is checked/unchecked, though its own (enabled)
  // children are still collected.
  const getChildrenValues = useCallback((choice: TreeChoice): (string | number | boolean)[] => {
    if (!choice.children) {
      return [];
    }
    const collectChildValues = (nodes: TreeChoice[], depth: number): (string | number | boolean)[] => {
      if (depth > MAX_TREE_DEPTH) return [];
      const values: (string | number | boolean)[] = [];
      for (const node of nodes) {
        if (!node.disabled) values.push(node.value);
        if (node.children) {
          values.push(...collectChildValues(node.children, depth + 1));
        }
      }
      return values;
    };
    return collectChildValues(choice.children, 0);
  }, []);

  // Get leaf values from a choice, excluding disabled leaves (S4.7).
  const getLeafValues = useCallback((choice: TreeChoice, depth = 0): (string | number | boolean)[] => {
    if (depth > MAX_TREE_DEPTH) return [];
    if (!choice.children || choice.children.length === 0) {
      return choice.disabled ? [] : [choice.value];
    }

    const leafValues: (string | number | boolean)[] = [];
    for (const child of choice.children) {
      leafValues.push(...getLeafValues(child, depth + 1));
    }
    return leafValues;
  }, []);

  // Check if node matches search
  const matchesSearch = useCallback((choice: TreeChoice, query: string, depth = 0): boolean => {
    if (!query) {
      return true;
    }
    if (depth > MAX_TREE_DEPTH) return false;
    const lowerQuery = query.toLowerCase();

    // Check current node
    if (choice.text.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Check children recursively
    if (choice.children) {
      return choice.children.some(child => matchesSearch(child, query, depth + 1));
    }

    return false;
  }, []);

  // Check if node has any selected descendants
  const hasSelectedDescendants = useCallback((choice: TreeChoice, depth = 0): boolean => {
    if (!choice.children || depth > MAX_TREE_DEPTH) {
      return false;
    }

    for (const child of choice.children) {
      if (value.includes(child.value) || hasSelectedDescendants(child, depth + 1)) {
        return true;
      }
    }
    return false;
  }, [value]);

  // Check if a node's own text (not descendants) matches the query
  const matchesOwnText = useCallback((choice: TreeChoice, query: string): boolean => {
    if (!query) return false;
    return choice.text.toLowerCase().includes(query.toLowerCase());
  }, []);

  // Filter choices based on search and show selection only. Keys are
  // derived from each node's index in the *unfiltered* `choices`/`children`
  // array (via `origIndex`, computed before the `.filter()` below), so they
  // stay stable across search/showSelectionOnly changes even though the
  // filtered array's own indices shift (see KeyedTreeChoice above).
  const filteredChoices = useMemo(() => {
    // Recursively annotate an unfiltered subtree with stable keys — used by
    // the own-text-match branch below, which keeps ALL children rather than
    // re-filtering them.
    // `ancestors` carries the chain from the root to this node. A child that
    // is already in its own ancestor chain is a cycle, and is dropped rather
    // than descended into. The depth cap alone cannot do this: a node listed
    // twice in its own children fans out 2^depth and exhausts memory long
    // before the cap bites, which is what turns a malformed API response into
    // a frozen tab instead of an empty branch.
    const annotateKeys = (
      node: TreeChoice,
      origIndex: number,
      depth: number,
      ancestors: ReadonlySet<TreeChoice>,
    ): KeyedTreeChoice => {
      const nextAncestors = new Set(ancestors).add(node);
      return {
        ...node,
        __key: `${origIndex}-${String(node.value)}`,
        __index: origIndex,
        children:
          depth > MAX_TREE_DEPTH
            ? undefined
            : node.children
                ?.filter((child) => !nextAncestors.has(child))
                .map((child, childIndex) => annotateKeys(child, childIndex, depth + 1, nextAncestors)),
      };
    };

    const filterTree = (
      nodes: TreeChoice[],
      depth: number,
      ancestors: ReadonlySet<TreeChoice> = new Set(),
    ): KeyedTreeChoice[] => {
      if (depth > MAX_TREE_DEPTH) return [];
      return nodes
        .filter((choice) => !ancestors.has(choice))
        .map((choice, origIndex) => ({ choice, origIndex }))
        .filter(({ choice }) => {
          if (showSelectionOnly) {
            return value.includes(choice.value) || hasSelectedDescendants(choice);
          }
          return matchesSearch(choice, debouncedSearch);
        })
        .map(({ choice, origIndex }) => {
          // A node whose own text matched keeps ALL its children unfiltered —
          // re-filtering them with the same predicate would otherwise drop
          // every child that doesn't itself match, hiding the whole subtree
          // under a parent the user was actually searching for.
          if (!showSelectionOnly && debouncedSearch && matchesOwnText(choice, debouncedSearch)) {
            return annotateKeys(choice, origIndex, depth, ancestors);
          }
          return {
            ...choice,
            __key: `${origIndex}-${String(choice.value)}`,
            __index: origIndex,
            children: choice.children
              ? filterTree(choice.children, depth + 1, new Set(ancestors).add(choice))
              : undefined,
          };
        });
    };

    return filterTree(choices, 0);
  }, [choices, debouncedSearch, showSelectionOnly, value, hasSelectedDescendants, matchesSearch, matchesOwnText]);

  // Nodes to force-expand: those on the path to a search match or a
  // showSelectionOnly match, so per-node collapsed state (which persists
  // across searches) can't hide a result under a collapsed ancestor (S4.9).
  const autoExpandValues = useMemo(() => {
    if (!debouncedSearch && !showSelectionOnly) return null;
    const expand = new Set<string | number | boolean>();
    const walk = (nodes: TreeChoice[], depth: number): boolean => {
      if (depth > MAX_TREE_DEPTH) return false;
      let anyMatch = false;
      for (const node of nodes) {
        const ownMatch = showSelectionOnly
          ? value.includes(node.value)
          : matchesSearch(node, debouncedSearch);
        const childMatch = node.children ? walk(node.children, depth + 1) : false;
        if (ownMatch || childMatch) {
          anyMatch = true;
          if (childMatch) expand.add(node.value);
        }
      }
      return anyMatch;
    };
    walk(choices, 0);
    return expand;
  }, [choices, debouncedSearch, showSelectionOnly, value, matchesSearch]);

  // Handle checkbox toggle
  const handleToggle = useCallback((toggleValue: string | number | boolean, checked: boolean) => {
    if (disabled || readOnly) {
      return;
    }

    const currentValue = value || [];
    let newValue: (string | number | boolean)[];

    const toggledChoice = choiceByValue.get(toggleValue) ?? null;
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
  }, [value, onChange, disabled, readOnly, choiceByValue, valueCombining, getChildrenValues, getLeafValues]);

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
          {t.misconfigured}
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
        id={`checkbox-tree-${labelId}`}
        style={{
          maxHeight: '300px',
          backgroundColor: 'var(--mantine-color-gray-0)',
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: 'var(--mantine-radius-xs)',
          overflow: 'hidden',
        }}
        role="tree"
        // Prefer the caller-supplied accessible name. FormFieldInterface renders
        // the visible label itself and forwards a name here instead, so falling
        // back to the constant would give every tree field on a form the same
        // announcement.
        aria-label={label ? interpolate(t.tree.treeLabelWithLabel, { label }) : (ariaLabel ?? t.tree.treeLabel)}
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
              placeholder={t.tree.searchPlaceholder}
              clearLabel={t.tree.clearSearch}
              onSearch={setSearch}
              disabled={disabled}
              showClearButton
            />
          </Box>
        )}

        {/* Tree content */}
        <ScrollArea h="200px" p="sm">
          <Stack gap="xs">
            {filteredChoices.map((choice) => (
              <TreeNode
                key={choice.__key}
                choice={choice}
                selectedValues={value}
                onToggle={handleToggle}
                valueCombining={valueCombining}
                searchQuery={debouncedSearch}
                showSelectionOnly={showSelectionOnly}
                disabled={disabled}
                readOnly={readOnly}
                level={0}
                color={normalizedColor}
                autoExpandValues={autoExpandValues}
                // V3-7: derived from the stable __key (origIndex-in-the-
                // unfiltered-array + value), not the filtered position —
                // testids used to shift under search/showSelectionOnly
                // filtering even though __key itself (the React key) was
                // already stable.
                nodePath={String(choice.__index)}
                t={t.tree}
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
            {t.tree.showAll}
          </Button>
          <Text size="xs" c="dimmed">/</Text>
          <Button
            variant={showSelectionOnly ? 'light' : 'subtle'}
            size="xs"
            onClick={() => setShowSelectionOnly(true)}
            disabled={disabled}
          >
            {t.tree.showSelected}
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
  readOnly,
  level,
  color,
  autoExpandValues,
  nodePath,
  t,
}: TreeNodeProps) {
  const hasChildren = choice.children && choice.children.length > 0;

  // V3-7: an explicit chevron click must always visibly toggle, even on an
  // auto-expanded ancestor — previously the toggle only flipped a
  // `manuallyExpanded` boolean, so collapsing an auto-expanded node recomputed
  // back to `true` through the OR below and the click was a silent no-op.
  //
  // The user's choice is stored together with the auto-expand context it was
  // made in, so it wins for exactly as long as that context holds. Deriving it
  // this way (rather than a separate override flag reset by an effect) means
  // there is no second state to keep in sync, and no way to reset it for one
  // input that drives auto-expansion while forgetting the other: BOTH
  // `searchQuery` and `showSelectionOnly` feed `autoExpandValues`, and an
  // earlier form of this fix keyed only on `searchQuery` — which left a
  // user-collapsed node collapsed when "Show Selected" was clicked, hiding
  // the very selection that mode exists to reveal (S4.9).
  const autoExpandContext = `${searchQuery} ${showSelectionOnly}`;
  const [userChoice, setUserChoice] = useState<{ context: string; expanded: boolean } | null>(null);

  // Force-expanded while this node's subtree holds a search/selection match,
  // regardless of a prior manual collapse — otherwise the match stays hidden
  // under a collapsed ancestor (S4.9).
  const autoExpanded = autoExpandValues?.has(choice.value) ?? false;
  const expanded =
    userChoice && userChoice.context === autoExpandContext
      ? userChoice.expanded
      : autoExpanded || (userChoice?.expanded ?? true);

  // Calculate checkbox state based on selection and children
  const { checked, indeterminate } = useMemo(() => {
    const isSelected = selectedValues.includes(choice.value);
    
    if (!hasChildren) {
      return { checked: isSelected, indeterminate: false };
    }

    // For parent nodes, check children state
    // Disabled descendants are excluded, matching `getChildrenValues` — the
    // cascade toggle deliberately refuses to select them (S4.7), so counting
    // them here put values in the denominator that the numerator could never
    // reach: with valueCombining='all', a single disabled descendant left the
    // parent permanently indeterminate and every further click re-emitted the
    // identical selection. The 'leaf' branch below already carries this fix.
    const allChildValues: (string | number | boolean)[] = [];
    const collectChildValues = (nodes: TreeChoice[], depth: number) => {
      if (depth > MAX_TREE_DEPTH) return;
      for (const node of nodes) {
        if (!node.disabled) allChildValues.push(node.value);
        if (node.children) {
          collectChildValues(node.children, depth + 1);
        }
      }
    };
    collectChildValues(choice.children!, 0);

    const selectedChildrenCount = allChildValues.filter(val => selectedValues.includes(val)).length;

    if (valueCombining === 'all') {
      if (selectedChildrenCount === 0) {
        return { checked: isSelected, indeterminate: false };
      } else if (selectedChildrenCount === allChildValues.length) {
        return { checked: true, indeterminate: false };
      }
      return { checked: false, indeterminate: true };
    }

    if (valueCombining === 'leaf') {
      // In leaf mode a parent's own value is never stored (only leaves are
      // toggled), so `isSelected` is always false and this fell through to
      // indeterminate even when every descendant leaf was selected (S4.5).
      // Derive checked/indeterminate from leaf selection instead.
      const leafValues: (string | number | boolean)[] = [];
      const collectLeafValues = (nodes: TreeChoice[], depth: number) => {
        if (depth > MAX_TREE_DEPTH) return;
        for (const node of nodes) {
          if (!node.children || node.children.length === 0) {
            // Count only leaves the user can actually affect: enabled ones,
            // plus disabled ones that are already selected (stored data).
            // The cascade toggle skips disabled leaves (S4.7), so counting
            // an unselected disabled leaf in the denominator would make
            // "all leaves selected" unreachable — an indeterminate state no
            // interaction can ever resolve, the same stuck-state class S4.5
            // fixed for the plain case.
            if (!node.disabled || selectedValues.includes(node.value)) {
              leafValues.push(node.value);
            }
          } else {
            collectLeafValues(node.children, depth + 1);
          }
        }
      };
      collectLeafValues(choice.children!, 0);
      const selectedLeafCount = leafValues.filter(val => selectedValues.includes(val)).length;
      if (selectedLeafCount === 0) return { checked: false, indeterminate: false };
      if (selectedLeafCount === leafValues.length) return { checked: true, indeterminate: false };
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
      setUserChoice({ context: autoExpandContext, expanded: !expanded });
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
          aria-label={expanded ? t.collapse : t.expand}
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
            'data-testid': `checkbox-${nodePath}`,
          }}
          {...(readOnly && {
            style: { pointerEvents: 'none' as const, opacity: 0.8 },
            'aria-readonly': true,
          })}
          styles={{
            label: {
              cursor: disabled || readOnly ? 'default' : 'pointer',
            },
          }}
        />
      </Group>

      {/* Children */}
      {hasChildren && (
        <Collapse in={expanded}>
          <Stack gap="xs" ml="md" mt="xs">
            {choice.children!.map((child) => (
              <TreeNode
                key={child.__key}
                choice={child}
                selectedValues={selectedValues}
                onToggle={onToggle}
                valueCombining={valueCombining}
                searchQuery={searchQuery}
                showSelectionOnly={showSelectionOnly}
                disabled={disabled}
                readOnly={readOnly}
                level={level + 1}
                color={color}
                autoExpandValues={autoExpandValues}
                // V3-7: same stable child.__key used for the React key, not
                // the filtered-position childIndex.
                nodePath={`${nodePath}-${child.__index}`}
                t={t}
              />
            ))}
          </Stack>
        </Collapse>
      )}
    </Box>
  );
}

export default SelectMultipleCheckboxTree;
