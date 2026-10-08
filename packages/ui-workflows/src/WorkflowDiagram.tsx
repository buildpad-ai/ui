'use client';

import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnBeforeDelete,
} from '@xyflow/react';
// React Flow's own stylesheet. Imported here, by the component that needs it,
// the way MapWithRealMap imports maplibre's: a consumer's bundler (Next.js,
// Vite) accepts a stylesheet imported from node_modules by a component, and an
// app that installs this file through the CLI gets the import with it.
import '@xyflow/react/dist/style.css';
import {
  ActionIcon,
  Badge,
  Box,
  Card,
  Group,
  Menu,
  Text,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDots,
  IconEdit,
  IconFlag,
  IconGripVertical,
  IconPlayerPlay,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useBuildpadTranslations } from '@buildpad/services';
import type { WorkflowJson, WorkflowJsonCommand, WorkflowJsonState } from '@buildpad/types';
import {
  interpolate,
  removeWorkflowCommand,
  removeWorkflowState,
  type DeepPartial,
  type WorkflowConnectionProblem,
  type WorkflowsTranslations,
} from '@buildpad/utils';
import {
  WORKFLOW_HANDLES,
  WORKFLOW_NODE_WIDTH,
  WORKFLOW_STATE_NODE,
  buildWorkflowEdges,
  commandRefOfEdge,
  deleteFromWorkflowCanvas,
  dropWorkflowStates,
  findWorkflowCommand,
  layoutWorkflowStates,
  reconnectWorkflowEdge,
  requestWorkflowCommand,
  type WorkflowEdgeData,
} from './workflowDiagramModel';

/** Class of the grip a state card is dragged by (React Flow's `dragHandle` selector). */
const DRAG_HANDLE_CLASS = 'bp-workflow-drag-handle';

/** Stroke of an edge and its arrow head; readable on a light and on a dark canvas. */
const EDGE_COLOR = 'var(--mantine-color-gray-6)';

/**
 * A connection point. Blue, as the card's hint says ("Drag from a blue dot to
 * another state"); the fill follows the color scheme.
 */
const HANDLE_STYLE: React.CSSProperties = {
  width: 12,
  height: 12,
  background: 'var(--mantine-color-body)',
  border: '2px solid var(--mantine-color-blue-6)',
  borderRadius: '50%',
};

/** The ten connection points of a card: three on top and bottom, two on each side. */
const HANDLES: Array<{ id: string; position: Position; offset: React.CSSProperties }> = [
  ...WORKFLOW_HANDLES.top.map((id, index) => ({
    id,
    position: Position.Top,
    offset: { left: `${25 * (index + 1)}%` },
  })),
  ...WORKFLOW_HANDLES.bottom.map((id, index) => ({
    id,
    position: Position.Bottom,
    offset: { left: `${25 * (index + 1)}%` },
  })),
  ...WORKFLOW_HANDLES.left.map((id, index) => ({
    id,
    position: Position.Left,
    offset: { top: `${35 + 30 * index}%` },
  })),
  ...WORKFLOW_HANDLES.right.map((id, index) => ({
    id,
    position: Position.Right,
    offset: { top: `${35 + 30 * index}%` },
  })),
];

interface StateNodeData extends Record<string, unknown> {
  state: WorkflowJsonState;
  isInitial: boolean;
  /** False for the only state of the workflow, which cannot be deleted. */
  canDelete: boolean;
}

type StateNode = Node<StateNodeData>;
type CommandEdge = Edge<WorkflowEdgeData>;

/** What a state card needs from the diagram that is not part of its state. */
interface DiagramContextValue {
  readOnly: boolean;
  translations?: DeepPartial<WorkflowsTranslations>;
  onEditState: (state: WorkflowJsonState) => void;
  onDeleteState: (stateName: string) => void;
  onAddCommand: (stateName: string) => void;
  onEditCommand: (stateName: string, command: WorkflowJsonCommand) => void;
  onDeleteCommand: (stateName: string, commandName: string) => void;
}

const DiagramContext = createContext<DiagramContextValue | null>(null);

/**
 * A state of the workflow as a card: its name, its markers, its menu, and its
 * commands. It is dragged by its grip only, so a click on the card selects it
 * and nothing else.
 */
function WorkflowStateNode({ data, selected, isConnectable }: NodeProps<StateNode>) {
  const { state, isInitial, canDelete } = data;
  const diagram = useContext(DiagramContext);
  const t = useBuildpadTranslations((d) => d.workflows, diagram?.translations);
  const readOnly = diagram?.readOnly ?? true;
  const commands = state.commands ?? [];

  let borderColor: string;
  if (selected) {
    borderColor = 'var(--mantine-color-blue-6)';
  } else if (isInitial) {
    borderColor = 'var(--mantine-color-green-6)';
  } else if (state.isEndState) {
    borderColor = 'var(--mantine-color-red-6)';
  } else {
    borderColor = 'var(--mantine-color-default-border)';
  }

  return (
    <Card
      shadow={selected ? 'md' : 'sm'}
      padding="sm"
      radius="md"
      withBorder
      data-testid="workflow-diagram-state"
      data-state={state.name}
      style={{
        width: WORKFLOW_NODE_WIDTH,
        borderColor,
        borderWidth: selected || isInitial || state.isEndState ? 2 : 1,
        background: 'var(--mantine-color-body)',
        color: 'var(--mantine-color-text)',
        cursor: 'default',
        overflow: 'visible',
      }}
    >
      {/* Every handle follows the canvas lock (`isConnectable`, off while the
          canvas is locked or read-only). React Flow itself only uses that flag
          to style the handle; what stops a drag from starting is
          `isConnectableStart`, so the lock is passed there too. An end state's
          handles never start a connection: an end state has no outgoing
          commands. */}
      {HANDLES.map((handle) => (
        <Handle
          key={handle.id}
          type="source"
          id={handle.id}
          position={handle.position}
          isConnectable={isConnectable}
          isConnectableStart={isConnectable && !state.isEndState}
          isConnectableEnd={isConnectable}
          style={{ ...HANDLE_STYLE, ...handle.offset }}
        />
      ))}

      <Group
        justify="space-between"
        mb="xs"
        wrap="nowrap"
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)', paddingBottom: 8 }}
      >
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          {!readOnly && (
            <Box
              className={DRAG_HANDLE_CLASS}
              style={{
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                padding: 4,
                borderRadius: 4,
                background: 'var(--mantine-color-default-hover)',
              }}
            >
              <IconGripVertical size={16} color="var(--mantine-color-dimmed)" />
            </Box>
          )}
          {isInitial && (
            <Tooltip label={t.diagram.initialStateTooltip}>
              <IconPlayerPlay
                size={14}
                color="var(--mantine-color-green-6)"
                aria-label={t.diagram.initialStateTooltip}
              />
            </Tooltip>
          )}
          {state.isEndState && (
            <Tooltip label={t.diagram.endStateTooltip}>
              <IconFlag size={14} color="var(--mantine-color-red-6)" aria-label={t.diagram.endStateTooltip} />
            </Tooltip>
          )}
          <Text fw={600} size="sm" truncate>
            {state.name}
          </Text>
        </Group>
        {!readOnly && (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={interpolate(t.diagram.stateActionsAriaLabel, { name: state.name })}
              >
                <IconDots size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => diagram?.onEditState(state)}>
                {t.diagram.editState}
              </Menu.Item>
              {/* The way to add a command without a pointer: a connection can
                  only be dragged. An end state has no outgoing commands. */}
              {!state.isEndState && (
                <Menu.Item leftSection={<IconPlus size={14} />} onClick={() => diagram?.onAddCommand(state.name)}>
                  {t.commandModal.addCommand}
                </Menu.Item>
              )}
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconTrash size={14} />}
                color="red"
                disabled={!canDelete}
                onClick={() => diagram?.onDeleteState(state.name)}
              >
                {t.diagram.deleteState}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>

      {commands.map((command) => {
        const label = (
          <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
            <Badge size="xs" variant="light" color="blue" style={{ flexShrink: 0, maxWidth: '60%' }}>
              {command.name}
            </Badge>
            <Text size="xs" c="dimmed" truncate>
              {interpolate(t.diagram.commandTarget, { state: command.next_state })}
            </Text>
          </Group>
        );

        return (
          <Group
            key={command.name}
            justify="space-between"
            gap="xs"
            mb={4}
            p={4}
            wrap="nowrap"
            data-testid="workflow-diagram-command"
            data-command={command.name}
            style={{ borderRadius: 4, background: 'var(--mantine-color-default-hover)' }}
          >
            {readOnly ? (
              label
            ) : (
              <>
                <UnstyledButton
                  onClick={() => diagram?.onEditCommand(state.name, command)}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  {label}
                </UnstyledButton>
                <ActionIcon
                  variant="subtle"
                  size="xs"
                  color="red"
                  aria-label={interpolate(t.diagram.deleteCommandAriaLabel, { name: command.name })}
                  onClick={() => diagram?.onDeleteCommand(state.name, command.name)}
                >
                  <IconTrash size={12} />
                </ActionIcon>
              </>
            )}
          </Group>
        );
      })}

      {commands.length === 0 && !state.isEndState && !readOnly && (
        <Text size="xs" c="dimmed" ta="center" py="xs">
          {t.diagram.connectHint}
        </Text>
      )}

      {state.isEndState && (
        <Text size="xs" c="dimmed" ta="center" py="xs" fs="italic">
          {t.diagram.endStateNote}
        </Text>
      )}
    </Card>
  );
}

const nodeTypes = { [WORKFLOW_STATE_NODE]: WorkflowStateNode };

/** The nodes of `workflowJson`, keeping what the canvas knows about each (size, selection). */
function toNodes(workflowJson: WorkflowJson, current: StateNode[]): StateNode[] {
  const known = new Map(current.map((node) => [node.id, node]));
  const layout = layoutWorkflowStates(
    workflowJson,
    Object.fromEntries(current.map((node) => [node.id, node.position])),
  );
  const canDelete = workflowJson.states.length > 1;

  return workflowJson.states.map((state) => ({
    ...known.get(state.name),
    id: state.name,
    type: WORKFLOW_STATE_NODE,
    position: layout[state.name],
    dragHandle: `.${DRAG_HANDLE_CLASS}`,
    data: { state, isInitial: state.name === workflowJson.initial_state, canDelete },
  }));
}

/** The edges of `workflowJson`, keeping the selection of the edges that are still there. */
function toEdges(workflowJson: WorkflowJson, current: CommandEdge[], readOnly: boolean): CommandEdge[] {
  const selected = new Set(current.filter((edge) => edge.selected).map((edge) => edge.id));

  return buildWorkflowEdges(workflowJson).map((edge) => ({
    ...edge,
    type: 'default',
    animated: false,
    selected: selected.has(edge.id),
    reconnectable: !readOnly,
    markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR, width: 20, height: 20 },
    style: { stroke: EDGE_COLOR, strokeWidth: 2, cursor: readOnly ? 'default' : 'pointer' },
    labelStyle: { fontSize: 11, fontWeight: 500, fill: 'var(--mantine-color-text)' },
    labelBgStyle: { fill: 'var(--mantine-color-body)', fillOpacity: 0.9 },
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 4,
  }));
}

export interface WorkflowDiagramProps {
  /** The state machine to draw. The diagram is controlled: it draws this document and nothing else. */
  workflowJson: WorkflowJson;
  /**
   * Called with the next document after a gesture changed the machine: a state
   * dropped at a new position, a state or command deleted (from its menu, its
   * trash icon, or the Backspace/Delete key), a command's edge moved to
   * another state. The canvas changes only when the new document comes back
   * in `workflowJson`.
   */
  onChange?: (workflowJson: WorkflowJson) => void;
  /** Called by a state's "Edit State" menu item. */
  onEditState?: (state: WorkflowJsonState) => void;
  /** Called when a command is clicked — its row on the state's card, or its edge. */
  onEditCommand?: (stateName: string, command: WorkflowJsonCommand) => void;
  /** Called by the "+" button and by the empty canvas' button. */
  onAddState?: () => void;
  /**
   * Called when a connection is drawn from one state to another, with the
   * handles it was drawn between, and by a state's "Add Command" menu item,
   * with the state alone (the Command dialog asks for the target). Not called
   * for a connection the workflow cannot have (out of an end state, or back
   * to the same state); an end state's menu has no such item.
   */
  onAddCommand?: (fromState: string, toState?: string, sourceHandle?: string, targetHandle?: string) => void;
  /**
   * Draw the machine without any way to change it: no drag, no connect, no
   * menus, no delete, no "+" button. Selecting, panning and zooming still
   * work. Default: false.
   */
  readOnly?: boolean;
  /** Height of the canvas (CSS length or pixels). Default: 600. */
  height?: number | string;
  /**
   * Hide the "React Flow" attribution in the corner of the canvas. Default:
   * false — the attribution is shown. @xyflow/react is MIT-licensed, and its
   * authors ask organisations that remove the attribution to support the
   * project (https://reactflow.dev/learn/troubleshooting/remove-attribution),
   * so hiding it is the consuming team's decision, not this component's.
   */
  hideAttribution?: boolean;
  /** Per-instance overrides of the `workflows` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<WorkflowsTranslations>;
}

/**
 * The state diagram of a workflow: states as cards, commands as arrows.
 * Ported from the buildpad-daas reference `components/WorkflowDiagram.tsx`.
 *
 * How it is worked (the editor's hint, `workflowDetail.diagramHint`, says the
 * same three things): a state is dragged by its grip; a state is edited from
 * its menu — a click on a card only selects it; a click on a command, on its
 * row or on its arrow, edits the command. A command is added by dragging from
 * one state's dot to another state, or from the state's menu.
 *
 * The canvas is a view of `workflowJson`. A gesture never changes the canvas
 * on its own: it is turned into the next document (the functions of
 * `workflowDiagramModel`) and handed to `onChange`, and the canvas redraws
 * from the document that comes back. What the reference did differently:
 *
 * - Backspace/Delete removed the selection from the canvas only, and the state
 *   came back on the next render. The key now deletes from the document, with
 *   the rules of the menu (the last state stays).
 * - Moving an edge found its command by taking the edge id apart on '-', which
 *   fails for a name with a dash. An edge now carries its state and command.
 * - The canvas lock left the dots connectable. Every dot follows the lock.
 * - An end state could start a command. Its dots start nothing, and a command
 *   moved onto an end state is refused with the dictionary's sentence.
 * - Cards and edge labels were white; they follow the color scheme.
 */
export const WorkflowDiagram: React.FC<WorkflowDiagramProps> = ({
  workflowJson,
  onChange,
  onEditState,
  onEditCommand,
  onAddState,
  onAddCommand,
  readOnly = false,
  height = 600,
  hideAttribution = false,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.workflows, translations);
  const colorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const flowId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Gestures that end asynchronously (a key press, a drop) must act on the
  // document as it is then, not as it was when the handler was created.
  const documentRef = useRef(workflowJson);
  documentRef.current = workflowJson;

  const change = useCallback(
    (next: WorkflowJson) => {
      if (next !== documentRef.current) onChange?.(next);
    },
    [onChange],
  );

  /** Tells the user why a connection was not made, when the reason is the end-state rule. */
  const explainRefusal = useCallback(
    (problem: WorkflowConnectionProblem) => {
      if (problem.code !== 'endStateSource') return;
      notifications.show({
        title: t.validationErrorTitle,
        message: t.stateModal.fields.endStateDescription,
        color: 'red',
      });
    },
    [t],
  );

  const [initialNodes] = useState(() => toNodes(workflowJson, []));
  const [initialEdges] = useState(() => toEdges(workflowJson, [], readOnly));
  const [nodes, setNodes, onNodesChange] = useNodesState<StateNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CommandEdge>(initialEdges);

  // Redraw from the document whenever it changes
  useEffect(() => {
    setNodes((current) => toNodes(workflowJson, current));
    setEdges((current) => toEdges(workflowJson, current, readOnly));
  }, [workflowJson, readOnly, setNodes, setEdges]);

  const context = useMemo<DiagramContextValue>(
    () => ({
      readOnly,
      translations,
      onEditState: (state) => onEditState?.(state),
      onDeleteState: (stateName) => change(removeWorkflowState(documentRef.current, stateName)),
      onAddCommand: (stateName) => onAddCommand?.(stateName),
      onEditCommand: (stateName, command) => onEditCommand?.(stateName, command),
      onDeleteCommand: (stateName, commandName) =>
        change(removeWorkflowCommand(documentRef.current, stateName, commandName)),
    }),
    [readOnly, translations, onEditState, onAddCommand, onEditCommand, change],
  );

  // A connection drawn from one state to another opens Add Command
  const onConnect = useCallback(
    (connection: Connection) => {
      const request = requestWorkflowCommand(documentRef.current, connection);
      if (!request.ok) {
        explainRefusal(request.problem);
        return;
      }
      onAddCommand?.(request.from, request.to, request.sourceHandle, request.targetHandle);
    },
    [onAddCommand, explainRefusal],
  );

  // An end of an edge dropped on another state or handle
  const onReconnect = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      const result = reconnectWorkflowEdge(documentRef.current, oldEdge, connection);
      if (!result.ok) {
        explainRefusal(result.problem);
        return;
      }
      change(result.workflowJson);
    },
    [change, explainRefusal],
  );

  // A state (or a selection of states) dropped after a drag
  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node, dragged: Node[]) => {
      change(dropWorkflowStates(documentRef.current, dragged.length > 0 ? dragged : [node]));
    },
    [change],
  );

  // Backspace/Delete on a selection. The canvas deletes nothing itself (the
  // answer is always false): the deletion is made in the document, and the
  // canvas redraws from it — or stays as it is when the deletion is refused.
  const onBeforeDelete = useCallback<OnBeforeDelete<StateNode, CommandEdge>>(
    async ({ nodes: doomedNodes, edges: doomedEdges }) => {
      // React Flow listens for the key on the whole document. Only a key
      // pressed in the diagram (or with nothing focused) deletes from it; one
      // pressed on a button of a dialog above it does not.
      const focused = typeof document === 'undefined' ? null : document.activeElement;
      const elsewhere =
        focused !== null && focused !== document.body && !containerRef.current?.contains(focused);
      if (!elsewhere) {
        change(deleteFromWorkflowCanvas(documentRef.current, { nodes: doomedNodes, edges: doomedEdges }));
      }
      return false;
    },
    [change],
  );

  // A click on a command's arrow edits the command, as a click on its row does
  const onEdgeClick = useCallback(
    (_event: unknown, edge: Edge) => {
      const found = findWorkflowCommand(documentRef.current, commandRefOfEdge(edge));
      if (found) onEditCommand?.(found.state.name, found.command);
    },
    [onEditCommand],
  );

  return (
    <Box
      ref={containerRef}
      data-testid="workflow-diagram"
      style={{
        width: '100%',
        height,
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <DiagramContext.Provider value={context}>
        <ReactFlow
          id={flowId}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onReconnect={readOnly ? undefined : onReconnect}
          onNodeDragStop={readOnly ? undefined : onNodeDragStop}
          onEdgeClick={readOnly ? undefined : onEdgeClick}
          onBeforeDelete={onBeforeDelete}
          deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
          nodeTypes={nodeTypes}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          edgesReconnectable={!readOnly}
          colorMode={colorScheme}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          connectionLineStyle={{ stroke: EDGE_COLOR, strokeWidth: 2 }}
          defaultEdgeOptions={{ type: 'default', markerEnd: { type: MarkerType.ArrowClosed } }}
          connectionMode={ConnectionMode.Loose}
          proOptions={{ hideAttribution }}
        >
          <Controls showInteractive={!readOnly} />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        </ReactFlow>
      </DiagramContext.Provider>

      {!readOnly && workflowJson.states.length > 0 && (
        <ActionIcon
          variant="filled"
          color="blue"
          size="lg"
          radius="xl"
          aria-label={t.diagram.addStateAriaLabel}
          data-testid="workflow-diagram-add-state"
          style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 100 }}
          onClick={() => onAddState?.()}
        >
          <IconPlus size={20} />
        </ActionIcon>
      )}

      {workflowJson.states.length === 0 && (
        <Box
          data-testid="workflow-diagram-empty"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          <Text c="dimmed" mb="md">
            {t.diagram.emptyTitle}
          </Text>
          {!readOnly && (
            <>
              <ActionIcon
                variant="filled"
                color="blue"
                size="xl"
                radius="xl"
                aria-label={t.diagram.addStateAriaLabel}
                data-testid="workflow-diagram-add-first-state"
                onClick={() => onAddState?.()}
              >
                <IconPlus size={24} />
              </ActionIcon>
              <Text size="sm" c="dimmed" mt="xs">
                {t.diagram.emptyHint}
              </Text>
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

export default WorkflowDiagram;
