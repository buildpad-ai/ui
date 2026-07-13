import React, { useState, useEffect, useCallback } from 'react';
import {
  ActionIcon,
  Box,
  Group,
  Menu,
  NumberInput,
  Paper,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconAlertTriangle, IconChevronDown, IconChevronRight, IconX } from '@tabler/icons-react';
import type { Field } from '@buildpad/types';
import type { DynamicValue, FilterNode, FilterOperator, FilterValue, RelationInfo } from './PermissionFilterTypes';
import { DYNAMIC_VALUES, getOperatorsForRelation, getOperatorsForType } from './PermissionFilterTypes';
import { fetchCollectionFields } from './permissionMetadata';

/**
 * Format field name to Title Case (e.g., "user_created" -> "User Created")
 * Handles dot-notation: "roles.resource_uri" -> "Roles → Resource Uri"
 */
function formatFieldName(fieldName: string): string {
  if (fieldName.includes('.')) {
    const [relation, column] = fieldName.split('.', 2);
    return `${formatFieldName(relation)} → ${formatFieldName(column)}`;
  }
  return fieldName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Format an ISO date string for datetime-local input
 */
function formatDateForInput(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    // Format as YYYY-MM-DDTHH:mm
    return date.toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

export interface FilterRuleNodeProps {
  node: FilterNode;
  fields: Field[];
  relations?: RelationInfo[];
  collection: string;
  depth: number;
  onUpdate: (nodeId: string, updates: Partial<FilterNode>) => void;
  onRemove: (nodeId: string) => void;
  onAddRule: (parentGroupId: string | null, fieldName?: string) => void;
  onAddGroup: (parentGroupId: string | null) => void;
  onToggleGroupLogical: (groupId: string) => void;
  'data-testid'?: string;
}

export function FilterRuleNode({
  node,
  fields,
  relations,
  collection,
  depth,
  onUpdate,
  onRemove,
  onAddRule,
  onAddGroup,
  onToggleGroupLogical,
  'data-testid': testId,
}: FilterRuleNodeProps) {
  // Cache for lazy-loaded related collection fields
  const [relatedFieldsCache, setRelatedFieldsCache] = useState<Record<string, Field[]>>({});
  const [expandedRelation, setExpandedRelation] = useState<string | null>(null);
  const [fieldSearch, setFieldSearch] = useState('');

  // Check if the current field is a bare relation alias (no dot)
  // M2O FK columns default to value operators (e.g. _eq for uuid), but when the
  // user explicitly picks "Has related items" the operator is _has and we must
  // switch to relation operators so the operator dropdown stays consistent.
  const isRelationAlias = !!(node.field && !node.field.includes('.') && relations?.some((r) => r.field === node.field && (r.relationType !== 'm2o' || node.operator === '_has')));

  // For dot-notation fields, find the relation and related field info
  const dotIndex = node.field?.indexOf('.') ?? -1;
  const relationAlias = dotIndex > 0 ? node.field!.slice(0, dotIndex) : null;
  const relatedColumnName = dotIndex > 0 ? node.field!.slice(dotIndex + 1) : null;
  const matchedRelation = relationAlias ? relations?.find((r) => r.field === relationAlias) : null;

  // Lazy-fetch fields for a related collection when a relation sub-menu is expanded
  const fetchRelatedFields = useCallback(async (relatedCollection: string) => {
    if (relatedFieldsCache[relatedCollection]) return;
    try {
      const related = await fetchCollectionFields(relatedCollection);
      setRelatedFieldsCache((prev) => ({ ...prev, [relatedCollection]: related }));
    } catch {
      // Silently fail — user can retry by reopening the menu
    }
  }, [relatedFieldsCache]);

  // Pre-fetch related fields if current field is dot-notation (for existing filters)
  useEffect(() => {
    if (matchedRelation && relatedColumnName && !relatedFieldsCache[matchedRelation.relatedCollection]) {
      fetchRelatedFields(matchedRelation.relatedCollection);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedRelation?.relatedCollection, relatedColumnName]);

  // Resolve field type: bare relation → relation operators, dot-notation → related field type, else → local field type
  let resolvedFieldType = 'string';
  let selectedField: Field | undefined;

  if (isRelationAlias) {
    // Bare relation alias — use relation operators
    resolvedFieldType = '__relation__';
  } else if (matchedRelation && relatedColumnName) {
    // Dot-notation — look up the related column type from cache
    const relatedFields = relatedFieldsCache[matchedRelation.relatedCollection];
    const relatedField = relatedFields?.find((f) => f.field === relatedColumnName);
    resolvedFieldType = relatedField?.type || 'string';
    selectedField = relatedField;
  } else {
    selectedField = fields.find((f) => f.field === node.field);
    resolvedFieldType = selectedField?.type || 'string';
  }

  // Get operators based on resolved type
  const operators = resolvedFieldType === '__relation__'
    ? getOperatorsForRelation()
    : getOperatorsForType(resolvedFieldType);

  // Get the selected operator info
  const selectedOperator = operators.find((op) => op.value === node.operator);

  // Dynamic variable options
  const dynamicVariableOptions = Object.entries(DYNAMIC_VALUES).map(([key, label]) => ({
    value: key,
    label: `${key} - ${label}`,
  }));

  // Check if current value is a dynamic variable
  const isDynamicValue = typeof node.value === 'string' && node.value?.startsWith('$');

  // Handle field change
  const handleFieldChange = (value: string | null) => {
    if (!value) return;
    // Check if this is a bare relation alias (exclude M2O — those are physical FK columns)
    const isRel = relations?.some((r) => r.field === value && r.relationType !== 'm2o');
    if (isRel) {
      const relOps = getOperatorsForRelation();
      onUpdate(node.id, {
        field: value,
        operator: relOps[0]?.value || '_has',
        value: true,
      });
      return;
    }
    // Check if this is a dot-notation field (relation.column)
    const dotIdx = value.indexOf('.');
    if (dotIdx > 0) {
      const relAlias = value.slice(0, dotIdx);
      const col = value.slice(dotIdx + 1);
      const rel = relations?.find((r) => r.field === relAlias);
      const relFields = rel ? relatedFieldsCache[rel.relatedCollection] : null;
      const relField = relFields?.find((f) => f.field === col);
      const newType = relField?.type || 'string';
      const newOperators = getOperatorsForType(newType);
      onUpdate(node.id, {
        field: value,
        operator: newOperators[0]?.value || '_eq',
        value: null,
      });
      return;
    }
    // Regular local field
    const newField = fields.find((f) => f.field === value);
    const newType = newField?.type || 'string';
    const newOperators = getOperatorsForType(newType);

    // Reset operator to first available if current doesn't apply
    const currentOpValid = newOperators.some((op) => op.value === node.operator);

    onUpdate(node.id, {
      field: value,
      operator: currentOpValid ? node.operator : newOperators[0]?.value || '_eq',
      value: null, // Reset value on field change
    });
  };

  // Handle operator change
  const handleOperatorChange = (value: string | null) => {
    if (!value) return;
    const newOp = operators.find((op) => op.value === value);

    // Reset value if operator type changes
    let newValue: FilterValue = (node.value ?? null) as FilterValue;
    if (newOp?.valueType === 'none') {
      newValue = true; // For null/empty operators
    } else if (newOp?.valueType === 'array' && !Array.isArray(node.value)) {
      newValue = [];
    } else if (newOp?.valueType === 'range' && !Array.isArray(node.value)) {
      newValue = [null, null];
    }

    onUpdate(node.id, {
      operator: value as FilterOperator,
      value: newValue,
    });
  };

  const searchQuery = fieldSearch.toLowerCase().trim();
  const visibleFields = searchQuery
    ? fields.filter((f) => f.field.toLowerCase().includes(searchQuery))
    : fields;
  const visibleRelations = searchQuery
    ? (relations ?? []).filter((r) => r.field.toLowerCase().includes(searchQuery))
    : relations ?? [];

  // Render field filter - Directus pill style
  if (node.type === 'field') {
    return (
      <Box
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0',
          backgroundColor: 'var(--mantine-color-body)',
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: 'var(--mantine-radius-xl)',
          padding: '4px 8px',
          maxWidth: 'fit-content',
        }}
        data-testid={testId}
      >
        {/* Field name - clickable dropdown */}
        <Menu shadow="md" width={240} position="bottom-start" closeOnItemClick={false}>
          <Menu.Target>
            <UnstyledButton
              style={{
                fontWeight: 500,
                fontSize: 'var(--mantine-font-size-sm)',
                color: 'var(--mantine-color-text)',
                padding: '2px 4px',
                borderRadius: 'var(--mantine-radius-sm)',
              }}
              className="hover-highlight"
              data-testid={testId ? `${testId}-field` : undefined}
            >
              {formatFieldName(node.field || '')}
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <TextInput
              placeholder="Search"
              size="xs"
              mb="xs"
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.currentTarget.value)}
              styles={{ input: { border: 'none', borderBottom: '1px solid var(--mantine-color-gray-3)' } }}
            />
            {/* Local fields */}
            {visibleFields.map((f) => (
              <Menu.Item
                key={f.field}
                onClick={() => { handleFieldChange(f.field); }}
                closeMenuOnClick
                style={{
                  backgroundColor: f.field === node.field ? 'var(--mantine-color-blue-0)' : undefined,
                }}
              >
                {formatFieldName(f.field)}
              </Menu.Item>
            ))}
            {/* Relation sub-menus */}
            {visibleRelations.length > 0 && (
              <>
                <Menu.Divider />
                <Menu.Label>Related Fields</Menu.Label>
                {visibleRelations.map((rel) => (
                  <Box key={`rel-${rel.field}`}>
                    <Menu.Item
                      onClick={() => {
                        if (expandedRelation === rel.field) {
                          setExpandedRelation(null);
                        } else {
                          setExpandedRelation(rel.field);
                          fetchRelatedFields(rel.relatedCollection);
                        }
                      }}
                      rightSection={<IconChevronRight size={12} style={{ transform: expandedRelation === rel.field ? 'rotate(90deg)' : undefined, transition: 'transform 150ms' }} />}
                      style={{ fontStyle: 'italic' }}
                    >
                      {formatFieldName(rel.field)}
                    </Menu.Item>
                    {expandedRelation === rel.field && (
                      <Box pl="md">
                        {/* Bare relation alias option — sets _has directly for all relation types */}
                        <Menu.Item
                          onClick={() => {
                            onUpdate(node.id, {
                              field: rel.field,
                              operator: '_has',
                              value: true,
                            });
                          }}
                          closeMenuOnClick
                          style={{
                            backgroundColor: node.field === rel.field && node.operator === '_has' ? 'var(--mantine-color-blue-0)' : undefined,
                            fontWeight: 500,
                            color: 'var(--mantine-color-violet-7)',
                          }}
                        >
                          Has related items
                        </Menu.Item>
                        <Menu.Divider />
                        {/* Related collection columns */}
                        {relatedFieldsCache[rel.relatedCollection] ? (
                          relatedFieldsCache[rel.relatedCollection].map((rf) => (
                            <Menu.Item
                              key={`${rel.field}.${rf.field}`}
                              onClick={() => { handleFieldChange(`${rel.field}.${rf.field}`); }}
                              closeMenuOnClick
                              style={{
                                backgroundColor: node.field === `${rel.field}.${rf.field}` ? 'var(--mantine-color-blue-0)' : undefined,
                              }}
                            >
                              {formatFieldName(rf.field)}
                            </Menu.Item>
                          ))
                        ) : (
                          <Menu.Item disabled>
                            Loading...
                          </Menu.Item>
                        )}
                      </Box>
                    )}
                  </Box>
                ))}
              </>
            )}
          </Menu.Dropdown>
        </Menu>

        {/* Operator - clickable dropdown */}
        <Menu shadow="md" width={200} position="bottom-start">
          <Menu.Target>
            <UnstyledButton
              style={{
                fontWeight: 600,
                fontSize: 'var(--mantine-font-size-sm)',
                color: 'var(--mantine-color-text)',
                padding: '2px 4px',
                borderRadius: 'var(--mantine-radius-sm)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              className="hover-highlight"
              data-testid={testId ? `${testId}-operator` : undefined}
            >
              {selectedOperator?.label || 'Equals'}
              {selectedOperator?.relationalLimitation && (
                <Tooltip label={selectedOperator.relationalLimitation} multiline w={260}>
                  <IconAlertTriangle size={14} color="var(--mantine-color-yellow-6)" />
                </Tooltip>
              )}
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {operators.map((op) => (
              <Menu.Item
                key={op.value}
                onClick={() => handleOperatorChange(op.value)}
                style={{
                  backgroundColor: op.value === node.operator ? 'var(--mantine-color-blue-0)' : undefined,
                }}
                rightSection={op.relationalLimitation ? (
                  <Tooltip label={op.relationalLimitation} multiline w={260}>
                    <IconAlertTriangle size={14} color="var(--mantine-color-yellow-6)" />
                  </Tooltip>
                ) : undefined}
              >
                {op.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>

        {/* Field-level relational limitation warning */}
        {(isRelationAlias || (matchedRelation && relatedColumnName)) && (
          <Tooltip
            label={isRelationAlias
              ? 'Relational existence filters (_has) require a two-step query fallback on child mutations.'
              : 'Dot-notation filters have limited enforcement on relational mutations. On update/delete, a two-step query fallback is used (+1 SELECT).'}
            multiline
            w={280}
          >
            <IconAlertTriangle size={14} color="var(--mantine-color-yellow-6)" style={{ flexShrink: 0 }} />
          </Tooltip>
        )}

        {/* Value display/input */}
        {selectedOperator?.requiresValue && (
          <FilterValueInput
            field={selectedField}
            operator={selectedOperator}
            value={(node.value ?? null) as FilterValue | DynamicValue}
            isDynamic={isDynamicValue}
            dynamicOptions={dynamicVariableOptions}
            onChange={(value) => onUpdate(node.id, { value })}
          />
        )}

        {/* Remove button */}
        <ActionIcon
          variant="transparent"
          color="gray"
          size="xs"
          onClick={() => onRemove(node.id)}
          aria-label="Remove rule"
          style={{ marginLeft: '4px' }}
          data-testid={testId ? `${testId}-remove` : undefined}
        >
          <IconX size={14} />
        </ActionIcon>
      </Box>
    );
  }

  // Render group - Directus style
  if (node.type === 'group') {
    const isAnd = node.logical === '_and';

    return (
      <Paper
        p="sm"
        withBorder
        styles={{
          root: {
            borderColor: 'var(--mantine-color-gray-3)',
            backgroundColor: 'var(--mantine-color-body)',
            marginLeft: depth > 0 ? 16 : 0,
            position: 'relative',
          },
        }}
        data-testid={testId}
      >
        <Stack gap="xs">
          {/* AND/OR toggle button */}
          <Group gap="xs">
            <UnstyledButton
              onClick={() => onToggleGroupLogical(node.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: 'var(--mantine-radius-sm)',
                backgroundColor: isAnd ? 'var(--mantine-color-blue-0)' : 'var(--mantine-color-orange-0)',
                color: isAnd ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-orange-7)',
                fontWeight: 600,
                fontSize: 'var(--mantine-font-size-xs)',
              }}
              data-testid={testId ? `${testId}-logical` : undefined}
            >
              {isAnd ? 'AND' : 'OR'}
            </UnstyledButton>
          </Group>

          {/* Group children */}
          {node.children?.map((child) => (
            <FilterRuleNode
              key={child.id}
              node={child}
              fields={fields}
              relations={relations}
              collection={collection}
              depth={depth + 1}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onAddRule={onAddRule}
              onAddGroup={onAddGroup}
              onToggleGroupLogical={onToggleGroupLogical}
            />
          ))}

          {/* Add Filter Menu inside group */}
          <Menu shadow="md" width={220} position="bottom-start">
            <Menu.Target>
              <UnstyledButton
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: 'var(--mantine-color-blue-6)',
                  fontWeight: 500,
                  fontSize: 'var(--mantine-font-size-sm)',
                }}
              >
                Add Filter <IconChevronDown size={12} />
              </UnstyledButton>
            </Menu.Target>

            <Menu.Dropdown style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <Menu.Item
                onClick={() => onAddGroup(node.id)}
                style={{ fontWeight: 500 }}
              >
                And / Or group
              </Menu.Item>
              <Menu.Divider />
              {fields.length === 0 ? (
                <Menu.Item disabled>
                  Loading fields...
                </Menu.Item>
              ) : (
                <>
                  {fields.map((field) => (
                    <Menu.Item
                      key={field.field}
                      onClick={() => onAddRule(node.id, field.field)}
                    >
                      {formatFieldName(field.field)}
                    </Menu.Item>
                  ))}
                  {relations && relations.length > 0 && (
                    <>
                      <Menu.Divider />
                      <Menu.Label>Related Fields</Menu.Label>
                      {relations.map((rel) => (
                        <Menu.Item
                          key={`rel-${rel.field}`}
                          onClick={() => onAddRule(node.id, rel.field)}
                          style={{ fontStyle: 'italic' }}
                        >
                          {formatFieldName(rel.field)} →
                        </Menu.Item>
                      ))}
                    </>
                  )}
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Stack>

        {/* Group remove button */}
        <ActionIcon
          variant="transparent"
          color="gray"
          size="xs"
          onClick={() => onRemove(node.id)}
          aria-label="Remove group"
          style={{ position: 'absolute', top: '8px', right: '8px' }}
          data-testid={testId ? `${testId}-remove` : undefined}
        >
          <IconX size={14} />
        </ActionIcon>
      </Paper>
    );
  }

  return null;
}

// Value input component - Directus inline style
interface FilterValueInputProps {
  field?: Field;
  operator: { value: string; label: string; requiresValue: boolean; valueType: string };
  value: FilterValue | DynamicValue;
  isDynamic: boolean;
  dynamicOptions: { value: string; label: string }[];
  onChange: (value: FilterValue | DynamicValue) => void;
}

function FilterValueInput({
  field,
  operator,
  value,
  isDynamic,
  dynamicOptions,
  onChange,
}: FilterValueInputProps) {
  const fieldType = field?.type || 'string';

  // Common input style for inline appearance
  const inlineInputStyle = {
    input: {
      border: 'none',
      background: 'transparent',
      padding: '2px 4px',
      minHeight: 'auto',
      height: 'auto',
      fontSize: 'var(--mantine-font-size-sm)',
      color: 'var(--mantine-color-cyan-7)',
      fontWeight: 500,
    },
  };

  // Dynamic variable select with input
  if (isDynamic || (typeof value === 'string' && value?.startsWith('$'))) {
    return (
      <Select
        data={dynamicOptions}
        value={value as string}
        onChange={(v) => onChange(v || null)}
        placeholder="--"
        size="xs"
        variant="unstyled"
        styles={{
          input: {
            color: 'var(--mantine-color-cyan-7)',
            fontWeight: 500,
            fontSize: 'var(--mantine-font-size-sm)',
            minWidth: '80px',
            padding: '2px 4px',
          },
        }}
        comboboxProps={{ withinPortal: true }}
        aria-label="Value"
      />
    );
  }

  // Array input for _in and _nin
  if (operator.valueType === 'array') {
    const arrayValue = Array.isArray(value) ? value.map(String) : [];
    return (
      <TagsInput
        value={arrayValue}
        onChange={(v) => onChange(v)}
        placeholder="--"
        size="xs"
        variant="unstyled"
        styles={{
          input: {
            minWidth: '100px',
            padding: '2px 4px',
          },
          pill: {
            backgroundColor: 'var(--mantine-color-cyan-1)',
            color: 'var(--mantine-color-cyan-7)',
          },
        }}
        aria-label="Values"
      />
    );
  }

  // Range input for _between and _nbetween
  if (operator.valueType === 'range') {
    const rangeValue = Array.isArray(value) ? value : [null, null];
    return (
      <Group gap={4} wrap="nowrap">
        <TextInput
          value={rangeValue[0]?.toString() || ''}
          onChange={(e) => onChange([e.target.value || null, rangeValue[1]])}
          placeholder="--"
          size="xs"
          variant="unstyled"
          styles={inlineInputStyle}
          style={{ width: 50 }}
          aria-label="From value"
        />
        <Text size="xs" c="dimmed">to</Text>
        <TextInput
          value={rangeValue[1]?.toString() || ''}
          onChange={(e) => onChange([rangeValue[0], e.target.value || null])}
          placeholder="--"
          size="xs"
          variant="unstyled"
          styles={inlineInputStyle}
          style={{ width: 50 }}
          aria-label="To value"
        />
      </Group>
    );
  }

  // Boolean input
  if (operator.valueType === 'boolean' || fieldType === 'boolean') {
    return (
      <Select
        data={[
          { value: 'true', label: 'True' },
          { value: 'false', label: 'False' },
        ]}
        value={value === true ? 'true' : value === false ? 'false' : null}
        onChange={(v) => onChange(v === 'true' ? true : v === 'false' ? false : null)}
        placeholder="--"
        size="xs"
        variant="unstyled"
        styles={{
          input: {
            color: 'var(--mantine-color-cyan-7)',
            fontWeight: 500,
            fontSize: 'var(--mantine-font-size-sm)',
            minWidth: '60px',
            padding: '2px 4px',
          },
        }}
        comboboxProps={{ withinPortal: true }}
        aria-label="Value"
      />
    );
  }

  // Date input
  if (operator.valueType === 'date' || ['datetime', 'date', 'timestamp', 'timestamptz'].includes(fieldType)) {
    return (
      <TextInput
        type="datetime-local"
        value={value ? formatDateForInput(value as string) : ''}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        placeholder="--"
        size="xs"
        variant="unstyled"
        styles={inlineInputStyle}
        style={{ minWidth: '140px' }}
        aria-label="Date value"
      />
    );
  }

  // Number input
  if (operator.valueType === 'number' || ['integer', 'biginteger', 'float', 'decimal'].includes(fieldType)) {
    return (
      <NumberInput
        value={typeof value === 'number' ? value : undefined}
        onChange={(v) => onChange(typeof v === 'number' ? v : null)}
        placeholder="--"
        size="xs"
        variant="unstyled"
        styles={{
          input: {
            color: 'var(--mantine-color-cyan-7)',
            fontWeight: 500,
            fontSize: 'var(--mantine-font-size-sm)',
            minWidth: '60px',
            padding: '2px 4px',
            border: 'none',
          },
        }}
        hideControls
        aria-label="Value"
      />
    );
  }

  // Default text input - Directus shows value in cyan color
  return (
    <TextInput
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder="--"
      size="xs"
      variant="unstyled"
      styles={inlineInputStyle}
      style={{ minWidth: '60px' }}
      aria-label="Value"
    />
  );
}

export default FilterRuleNode;
