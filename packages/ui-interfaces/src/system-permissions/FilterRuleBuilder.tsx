import React, { useState, useCallback, useMemo } from 'react';
import {
  ActionIcon,
  Alert,
  Box,
  Code,
  Divider,
  Menu,
  Paper,
  Stack,
  Text,
  Textarea,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconAlertTriangle, IconBraces, IconChevronDown, IconInfoCircle, IconListTree } from '@tabler/icons-react';
import type { Field, Filter, Permission } from '@buildpad/types';
import type { FilterNode, RelationInfo } from './PermissionFilterTypes';
import {
  addNodeToGroup,
  createFieldNode,
  createGroupNode,
  hasRelationalFilterKeys,
  nodesToFilter,
  parseFilterToNodes,
  removeNodeById,
  toggleGroupLogical,
  updateNodeById,
} from './PermissionFilterUtils';
import { FilterRuleNode } from './FilterRuleNode';

/**
 * Format field name to Title Case (e.g., "user_created" -> "User Created")
 */
function formatFieldName(fieldName: string): string {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export interface FilterRuleBuilderProps {
  /** Draft permission being edited (must carry `collection` and `action`). */
  permission: Partial<Permission>;
  policyName?: string;
  collection: string;
  fields: Field[];
  relations?: RelationInfo[];
  /** Item-filter rules locked in by app-access minimal permissions. */
  appMinimal?: Filter | null;
  onChange: (permission: Partial<Permission>) => void;
  'data-testid'?: string;
}

/**
 * Directus-style visual filter editor for a permission's item rules, with a
 * JSON mode toggle producing identical output. Edits stay local — changes
 * flow up through `onChange` into the caller's draft.
 */
export function FilterRuleBuilder({
  permission,
  policyName,
  collection,
  fields,
  relations,
  appMinimal,
  onChange,
  'data-testid': testId,
}: FilterRuleBuilderProps) {
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Compute initial state from permission.permissions
  const initialState = useMemo(() => {
    const filter = permission.permissions as Filter | null;
    if (filter && typeof filter === 'object' && Object.keys(filter).length > 0) {
      try {
        return {
          json: JSON.stringify(filter, null, 2),
          nodes: parseFilterToNodes(filter),
        };
      } catch {
        return {
          json: JSON.stringify(filter, null, 2),
          nodes: [],
        };
      }
    }
    return { json: '{}', nodes: [] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only compute once on mount

  const [filterJson, setFilterJson] = useState<string>(initialState.json);
  const [nodes, setNodes] = useState<FilterNode[]>(initialState.nodes);

  // Update permission when nodes change (visual mode)
  const updatePermissionFromNodes = useCallback((newNodes: FilterNode[]) => {
    setNodes(newNodes);
    const filter = nodesToFilter(newNodes);
    setFilterJson(filter ? JSON.stringify(filter, null, 2) : '{}');
    onChange({
      ...permission,
      permissions: filter,
    });
  }, [permission, onChange]);

  // Handle JSON change (JSON mode)
  const handleJsonChange = (value: string) => {
    setFilterJson(value);
    setJsonError(null);

    if (!value || value.trim() === '' || value.trim() === '{}') {
      setNodes([]);
      onChange({
        ...permission,
        permissions: null,
      });
      return;
    }

    try {
      const parsed = JSON.parse(value);
      const parsedNodes = parseFilterToNodes(parsed);
      setNodes(parsedNodes);
      onChange({
        ...permission,
        permissions: Object.keys(parsed).length > 0 ? parsed : null,
      });
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON');
    }
  };

  // Add a new filter rule with specific field
  const handleAddRule = (parentGroupId: string | null = null, fieldName?: string) => {
    const field = fieldName || fields[0]?.field || 'id';
    // If it's a bare relation alias (O2M/M2M, not M2O), default to _has operator
    const isRelation = relations?.some((r) => r.field === field && r.relationType !== 'm2o');
    const defaultOp = isRelation ? '_has' as const : '_eq' as const;
    const defaultVal = isRelation ? true : null;
    const newNode = createFieldNode(field, defaultOp, defaultVal);

    if (parentGroupId) {
      updatePermissionFromNodes(addNodeToGroup(nodes, parentGroupId, newNode));
    } else {
      updatePermissionFromNodes([...nodes, newNode]);
    }
  };

  // Add a new group
  const handleAddGroup = (parentGroupId: string | null = null) => {
    const defaultField = fields[0]?.field || 'id';
    const newNode = createGroupNode('_and', [
      createFieldNode(defaultField, '_eq', null),
    ]);

    if (parentGroupId) {
      updatePermissionFromNodes(addNodeToGroup(nodes, parentGroupId, newNode));
    } else {
      updatePermissionFromNodes([...nodes, newNode]);
    }
  };

  // Update a node
  const handleUpdateNode = (nodeId: string, updates: Partial<FilterNode>) => {
    updatePermissionFromNodes(updateNodeById(nodes, nodeId, updates));
  };

  // Remove a node
  const handleRemoveNode = (nodeId: string) => {
    updatePermissionFromNodes(removeNodeById(nodes, nodeId));
  };

  // Toggle group logical operator
  const handleToggleGroupLogical = (groupId: string) => {
    updatePermissionFromNodes(toggleGroupLogical(nodes, groupId));
  };

  const actionText =
    permission.action === 'delete'
      ? 'can delete'
      : permission.action === 'create'
      ? 'can create'
      : permission.action === 'update'
      ? 'can update'
      : permission.action === 'share'
      ? 'can share'
      : 'can read';

  return (
    <Stack gap="md" data-testid={testId}>
      {/* Info Alert - Directus style */}
      <Alert
        icon={<IconInfoCircle size={16} />}
        color="blue"
        variant="light"
        styles={{
          root: {
            borderLeft: '3px solid var(--mantine-color-blue-5)',
            borderRadius: '4px',
          },
        }}
      >
        Items the {policyName || 'Policy'} {actionText}.
      </Alert>

      {/* Create-action info: filters don't apply to inserts */}
      {permission.action === 'create' && (
        <Alert
          icon={<IconInfoCircle size={16} />}
          color="blue"
          variant="light"
          styles={{
            root: {
              borderLeft: '3px solid var(--mantine-color-blue-5)',
              borderRadius: '4px',
            },
          }}
        >
          <Text size="xs">
            Filter rules do not apply to create actions. Use the <b>Fields</b>, <b>Validation</b>, and <b>Presets</b> tabs to restrict inserts.
          </Text>
        </Alert>
      )}

      {/* Header with JSON toggle */}
      <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text size="sm" fw={600}>
          • Rule
        </Text>
        <Tooltip label={isJsonMode ? 'Switch to Visual Editor' : 'Switch to JSON Editor'}>
          <ActionIcon
            variant="subtle"
            size="sm"
            color="gray"
            onClick={() => setIsJsonMode(!isJsonMode)}
            data-testid={testId ? `${testId}-mode-toggle` : undefined}
          >
            {isJsonMode ? <IconListTree size={16} /> : <IconBraces size={16} />}
          </ActionIcon>
        </Tooltip>
      </Box>
      {isJsonMode ? (
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Enter a filter object using Directus filter syntax. Leave empty for no restrictions.
          </Text>
          <Textarea
            value={filterJson}
            onChange={(e) => handleJsonChange(e.target.value)}
            minRows={6}
            autosize
            error={jsonError}
            styles={{
              input: {
                fontFamily: 'monospace',
                fontSize: 'var(--mantine-font-size-xs)',
                resize: 'vertical',
                overflow: 'auto',
              },
            }}
            placeholder={`{
  "_and": [
    {
      "status": {
        "_eq": "published"
      }
    },
    {
      "user_created": {
        "_eq": "$CURRENT_USER"
      }
    }
  ]
}`}
            data-testid={testId ? `${testId}-json` : undefined}
          />
          {/* Relational limitation warning in JSON mode */}
          {(() => {
            try {
              const parsed = filterJson && filterJson.trim() !== '{}' ? JSON.parse(filterJson) : null;
              if (parsed && typeof parsed === 'object' && hasRelationalFilterKeys(parsed)) {
                return (
                  <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light">
                    <Text size="xs">
                      This filter contains operators with limited relational enforcement (<code>_has</code>, dot-notation, or <code>_some</code>/<code>_none</code>). A two-step query fallback is used for child mutations.
                    </Text>
                  </Alert>
                );
              }
            } catch {
              // Invalid JSON — skip warning
            }
            return null;
          })()}
        </Stack>
      ) : (
        <Stack gap="md">
          {/* Rules Container - Directus style */}
          <Paper
            p="md"
            withBorder
            styles={{
              root: {
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderColor: 'var(--mantine-color-gray-3)',
              },
            }}
            data-testid={testId ? `${testId}-rules` : undefined}
          >
            {nodes.length === 0 ? (
              <Text size="sm" c="dimmed" style={{ fontStyle: 'italic' }}>
                No configured rules
              </Text>
            ) : (
              <Stack gap="xs">
                {nodes.map((node, index) => (
                  <FilterRuleNode
                    key={node.id}
                    node={node}
                    fields={fields}
                    relations={relations}
                    collection={collection}
                    depth={0}
                    onUpdate={handleUpdateNode}
                    onRemove={handleRemoveNode}
                    onAddRule={handleAddRule}
                    onAddGroup={handleAddGroup}
                    onToggleGroupLogical={handleToggleGroupLogical}
                    data-testid={testId ? `${testId}-node-${index}` : undefined}
                  />
                ))}
              </Stack>
            )}
          </Paper>

          {/* Add Filter Menu - Directus style */}
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
                data-testid={testId ? `${testId}-add-filter` : undefined}
              >
                Add Filter <IconChevronDown size={14} />
              </UnstyledButton>
            </Menu.Target>

            <Menu.Dropdown style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <Menu.Item
                onClick={() => handleAddGroup(null)}
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
                      onClick={() => handleAddRule(null, field.field)}
                      data-testid={testId ? `${testId}-add-field-${field.field}` : undefined}
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
                          onClick={() => handleAddRule(null, rel.field)}
                          style={{ fontStyle: 'italic' }}
                          data-testid={testId ? `${testId}-add-relation-${rel.field}` : undefined}
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
      )}

      {appMinimal && Object.keys(appMinimal).length > 0 && (
        <>
          <Divider />
          <Alert color="yellow" variant="light" icon={<IconInfoCircle size={16} />}>
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Minimum Permissions (App Access)
              </Text>
              <Text size="xs" c="dimmed">
                The following filter rules are automatically applied with app access:
              </Text>
              <Code block fz="xs">
                {JSON.stringify(appMinimal, null, 2)}
              </Code>
            </Stack>
          </Alert>
        </>
      )}
    </Stack>
  );
}

export default FilterRuleBuilder;
