'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Box,
  Button,
  Code,
  Group,
  Modal,
  MultiSelect,
  Paper,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconBolt, IconPlus, IconSettings, IconShield, IconTrash } from '@tabler/icons-react';
import { useBuildpadTranslations } from '@buildpad/services';
import type { WorkflowJson, WorkflowJsonAction, WorkflowJsonCommand } from '@buildpad/types';
import {
  buildWorkflowCommand,
  findWorkflowCommandProblem,
  interpolate,
  parseWorkflowActionParameters,
  removeIndexed,
  type DeepPartial,
  type WorkflowParametersProblemCode,
  type WorkflowsTranslations,
} from '@buildpad/utils';
import { WorkflowRichText } from './WorkflowRichText';
import type { WorkflowPolicyOption } from './workflowPolicies';

export interface WorkflowCommandModalProps {
  opened: boolean;
  onClose: () => void;
  /** The stored command to edit, or null to add one. */
  command: WorkflowJsonCommand | null;
  /** Name of the state the command leaves. */
  stateName: string;
  /** Target state to start with, for a command drawn on the diagram. */
  targetState?: string;
  /** Handle the new command's edge leaves its state from (a drawn connection). */
  sourceHandle?: string;
  /** Handle the new command's edge enters its target at (a drawn connection). */
  targetHandle?: string;
  /** The document the command belongs to: the target states and the sibling commands. */
  workflowJson: WorkflowJson;
  /**
   * Called with the command to store and whether it is new. Apply it with
   * `applyWorkflowCommandSave`. The dialog closes itself afterwards.
   */
  onSave: (command: WorkflowJsonCommand, isNew: boolean) => void;
  /**
   * The policies the Policies tab offers. Pass every policy the user may pick,
   * not one page of them. When given, `loadPolicies` is not called.
   */
  policies?: WorkflowPolicyOption[];
  /**
   * Loads the policies the Policies tab offers; called each time the dialog
   * opens. It has to resolve to every policy, not to the first page of a paged
   * list (see `loadAllWorkflowPolicyOptions`). While it runs the picker is
   * disabled; when it rejects the picker says so and keeps the stored ids.
   */
  loadPolicies?: () => Promise<WorkflowPolicyOption[]>;
  /** Per-instance overrides of the `workflows` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<WorkflowsTranslations>;
}

/**
 * Add/Edit Command dialog of the workflow editor, in three tabs: General
 * (name and target state), Actions (the events the command emits, each with
 * JSON parameters) and Policies (who may run it). Ported from the
 * buildpad-daas reference `components/CommandModal.tsx`.
 *
 * Kept from the reference's fixed dialog:
 *
 * - The saved command is built on the stored one (`buildWorkflowCommand`), so
 *   keys the form has no field for survive — `module_access_keys` above all,
 *   without which a key-gated command would be saved open to everyone — and
 *   the stored key order is kept, so saving a command unchanged is not an edit.
 * - A refused save opens the tab that holds the failing field, and the action
 *   whose Parameters are not JSON; that text is marked and blocks the save
 *   instead of being dropped for the last parameters that did parse.
 * - Parameters have to be a JSON object. The reference stored any JSON; an
 *   array or a number there makes one backend refuse the whole definition.
 *
 * What differs from the reference, on purpose:
 *
 * - The policy options come through `policies` or `loadPolicies`. The
 *   reference fetched `/api/policies` itself and so offered the first 25.
 * - Clearing Target State clears the field (the value is `null`, which is what
 *   resets the text of a Mantine Select; the reference passed `''`).
 * - A command stored without `actions` or `policies` opens (both read as
 *   empty); the reference threw.
 * - A command gated by module access keys says so, and is not told it is
 *   "available to all users" for having no policy.
 */
export const WorkflowCommandModal: React.FC<WorkflowCommandModalProps> = ({
  opened,
  onClose,
  command,
  stateName,
  targetState,
  sourceHandle,
  targetHandle,
  workflowJson,
  onSave,
  policies,
  loadPolicies,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.workflows, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const isNew = !command;

  const [name, setName] = useState('');
  const [nextState, setNextState] = useState('');
  const [actions, setActions] = useState<WorkflowJsonAction[]>([]);
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);
  const [loadedPolicies, setLoadedPolicies] = useState<WorkflowPolicyOption[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [policiesFailed, setPoliciesFailed] = useState(false);
  // The failing General field and its message
  const [fieldError, setFieldError] = useState<{ field: 'name' | 'nextState'; message: string } | null>(null);
  const [jsonTextValues, setJsonTextValues] = useState<Record<number, string>>({});
  // Invalid-JSON error of each action's Parameters field, by action index:
  // true marks the field (on blur), a string is the message a refused save shows
  const [parameterErrors, setParameterErrors] = useState<Record<number, string | true | undefined>>({});
  // The open tab and action are controlled so that a refused save can show the failing field
  const [activeTab, setActiveTab] = useState<string | null>('general');
  const [openAction, setOpenAction] = useState<string | null>(null);
  // The action a refused save still has to scroll into view, and whether its
  // item is still opening: a closed item has no place in the dialog to scroll to
  const [reveal, setReveal] = useState<{ action: number; opening: boolean } | null>(null);
  const actionPanels = useRef<Record<number, HTMLDivElement | null>>({});

  // The loader may be an inline function (a new identity every render); only
  // opening the dialog loads.
  const loadPoliciesRef = useRef(loadPolicies);
  loadPoliciesRef.current = loadPolicies;
  const hasPolicyList = policies !== undefined;

  useEffect(() => {
    const load = loadPoliciesRef.current;
    if (!opened || hasPolicyList || !load) return undefined;

    let cancelled = false;
    setLoadingPolicies(true);
    setPoliciesFailed(false);
    load()
      .then((list) => {
        if (!cancelled) setLoadedPolicies(list);
      })
      .catch(() => {
        if (!cancelled) setPoliciesFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingPolicies(false);
      });
    return () => {
      cancelled = true;
    };
  }, [opened, hasPolicyList]);

  useEffect(() => {
    if (opened) {
      if (command) {
        // A command written through the API may lack either array
        const storedActions = Array.isArray(command.actions) ? command.actions : [];
        setName(command.name);
        setNextState(command.next_state);
        setActions(storedActions);
        setSelectedPolicies(Array.isArray(command.policies) ? command.policies : []);
        // Initialize JSON text values from command
        const initialJsonValues: Record<number, string> = {};
        storedActions.forEach((action, index) => {
          initialJsonValues[index] = JSON.stringify(action.parameters ?? {}, null, 2);
        });
        setJsonTextValues(initialJsonValues);
      } else {
        setName('');
        setNextState(targetState || '');
        setActions([]);
        setSelectedPolicies([]);
        setJsonTextValues({});
      }
      setFieldError(null);
      setParameterErrors({});
      setActiveTab('general');
      setOpenAction(null);
      setReveal(null);
    }
  }, [opened, command, targetState]);

  // The action of a refused save is scrolled into view once its item is open:
  // the dialog scrolls as a whole, and the field can sit below what is shown
  useEffect(() => {
    if (reveal && !reveal.opening) {
      actionPanels.current[reveal.action]?.scrollIntoView?.({ block: 'nearest' });
      setReveal(null);
    }
  }, [reveal]);

  // Every other state can be the target (a command cannot lead to its own state)
  const targetStateOptions = workflowJson.states
    .filter((s) => s.name !== stateName)
    .map((s) => ({
      value: s.name,
      label: s.isEndState ? interpolate(t.commandModal.general.endStateOption, { name: s.name }) : s.name,
    }));

  // Parameters that do not parse, or that parse to something that is no object
  const describeParametersProblem = (reason: string, code: WorkflowParametersProblemCode) =>
    code === 'notObject'
      ? t.commandModal.validation.parametersNotObject
      : interpolate(t.commandModal.validation.invalidJson, { reason });

  const handleAddAction = () => {
    const newIndex = actions.length;
    setActions([...actions, { name: '', event_name: '', parameters: {} }]);
    // Initialize JSON text for new action
    setJsonTextValues({ ...jsonTextValues, [newIndex]: '' });
  };

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
    // Remove JSON text value and its error, and reindex
    setJsonTextValues(removeIndexed(jsonTextValues, index));
    setParameterErrors(removeIndexed(parameterErrors, index));
    // Remove Action sits in the open item, so nothing is open afterwards
    setOpenAction(null);
  };

  const handleActionChange = (index: number, field: keyof WorkflowJsonAction, value: unknown) => {
    setActions((current) => {
      const next = [...current];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSave = () => {
    // Validate: name, target state, duplicate command names in the same
    // state, then each action's Parameters JSON
    const currentState = workflowJson.states.find((s) => s.name === stateName);
    const siblingNames = (currentState?.commands ?? [])
      .filter((c) => c.name !== command?.name)
      .map((c) => c.name);

    const problem = findWorkflowCommandProblem(
      { name, nextState, siblingNames, parameterTexts: jsonTextValues },
      describeParametersProblem,
    );

    if (problem) {
      // Open the tab that holds the failing field, whichever tab Save was pressed on
      setActiveTab(problem.tab);
      if (problem.tab === 'general') {
        setFieldError({ field: problem.field, message: t.commandModal.validation[problem.code] });
      } else {
        // The General fields passed. The Parameters field also sits in an
        // accordion item that may be closed
        setFieldError(null);
        setParameterErrors(problem.parameterErrors);
        const item = `action-${problem.action}`;
        setOpenAction(item);
        setReveal({ action: problem.action, opening: openAction !== item });
      }
      return;
    }

    // Built on the stored command, so keys this form has no field for
    // (module_access_keys) and the stored key order are kept
    onSave(
      buildWorkflowCommand(command, {
        name,
        nextState,
        actions,
        policies: selectedPolicies,
        sourceHandle,
        targetHandle,
      }),
      isNew,
    );
    onClose();
  };

  const policyList = policies ?? loadedPolicies;
  const policyOptions = policyList.map((p) => ({ value: p.id, label: p.name }));
  const policyName = (id: string) => policyList.find((p) => p.id === id)?.name || id;

  // Keys the transition route honours beside the policies. The dialog has no
  // field for them; it keeps them and says that they are there.
  const moduleAccessKeys = (command?.module_access_keys ?? []).filter(
    (key): key is string => typeof key === 'string' && key !== '',
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isNew ? t.commandModal.titleAdd : t.commandModal.titleEdit}
      size="lg"
      data-testid="workflow-command-modal"
    >
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab
            value="general"
            leftSection={<IconSettings size={14} />}
            data-testid="workflow-command-tab-general"
          >
            {t.commandModal.tabs.general}
          </Tabs.Tab>
          <Tabs.Tab value="actions" leftSection={<IconBolt size={14} />} data-testid="workflow-command-tab-actions">
            {interpolate(t.commandModal.tabs.actions, { count: actions.length })}
          </Tabs.Tab>
          <Tabs.Tab
            value="policies"
            leftSection={<IconShield size={14} />}
            data-testid="workflow-command-tab-policies"
          >
            {interpolate(t.commandModal.tabs.policies, { count: selectedPolicies.length })}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="general" pt="md">
          <Stack gap="md">
            {targetStateOptions.length === 0 && (
              <Alert color="yellow" variant="light" data-testid="workflow-command-no-targets">
                {t.commandModal.general.noTargetStates}
              </Alert>
            )}

            <TextInput
              label={t.commandModal.general.name}
              placeholder={t.commandModal.general.namePlaceholder}
              value={name}
              onChange={(e) => {
                setName(e.currentTarget.value);
                setFieldError(null);
              }}
              error={fieldError?.field === 'name' ? fieldError.message : undefined}
              required
              data-autofocus
              data-testid="workflow-command-name"
            />

            <Select
              label={t.commandModal.general.targetState}
              placeholder={
                targetStateOptions.length === 0
                  ? t.commandModal.general.targetStatePlaceholderNone
                  : t.commandModal.general.targetStatePlaceholder
              }
              data={targetStateOptions}
              // null, not '': Mantine clears the text of the field only for a
              // null value, so '' leaves the name of a state that is no longer chosen
              value={nextState || null}
              onChange={(value) => {
                setNextState(value ?? '');
                setFieldError(null);
              }}
              error={fieldError?.field === 'nextState' ? fieldError.message : undefined}
              required
              disabled={targetStateOptions.length === 0}
              searchable
              data-testid="workflow-command-target"
            />

            <Box
              style={{ fontSize: 'var(--mantine-font-size-sm)', color: 'var(--mantine-color-dimmed)' }}
              data-testid="workflow-command-route"
            >
              <WorkflowRichText
                template={t.commandModal.general.route}
                values={{ from: stateName, to: nextState || t.commandModal.general.routeUnsetTarget }}
                tags={{
                  from: (text) => <Badge variant="light">{text}</Badge>,
                  to: (text) =>
                    nextState ? (
                      <Badge variant="light" color="blue">
                        {text}
                      </Badge>
                    ) : (
                      text
                    ),
                }}
              />
            </Box>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="actions" pt="md">
          <Stack gap="md">
            <Alert color="blue" variant="light" title={t.commandModal.actions.promotionTitle}>
              <Text size="xs">
                <WorkflowRichText
                  template={t.commandModal.actions.promotionBody}
                  tags={{ code: (text) => <Code>{text}</Code> }}
                />
              </Text>
            </Alert>

            <Group justify="space-between">
              <Text size="sm" fw={500}>
                {t.commandModal.actions.heading}
              </Text>
              <Button
                variant="light"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={handleAddAction}
                data-testid="workflow-command-add-action"
              >
                {t.commandModal.actions.addAction}
              </Button>
            </Group>

            {actions.length === 0 ? (
              <Paper p="md" withBorder>
                <Text ta="center" c="dimmed" size="sm">
                  {t.commandModal.actions.emptyState}
                </Text>
              </Paper>
            ) : (
              <Accordion variant="separated" value={openAction} onChange={setOpenAction}>
                {actions.map((action, index) => {
                  const parameterError = parameterErrors[index];
                  return (
                    // Actions have no identity but their place in the list
                    <Accordion.Item key={index} value={`action-${index}`}>
                      <Accordion.Control>
                        <Group justify="space-between" wrap="nowrap">
                          <Text size="sm">
                            {action.name || interpolate(t.commandModal.actions.fallbackName, { number: index + 1 })}
                          </Text>
                          {action.event_name && (
                            <Badge size="sm" variant="light" styles={{ label: { fontFamily: 'monospace' } }}>
                              {action.event_name}
                            </Badge>
                          )}
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel
                        onTransitionEnd={() => {
                          // The item a refused save opened is laid out now
                          if (reveal?.opening && reveal.action === index) {
                            setReveal({ action: index, opening: false });
                          }
                        }}
                      >
                        <Stack
                          gap="sm"
                          ref={(panel: HTMLDivElement | null) => {
                            actionPanels.current[index] = panel;
                          }}
                        >
                          <TextInput
                            label={t.commandModal.actions.name}
                            placeholder={t.commandModal.actions.namePlaceholder}
                            value={action.name}
                            onChange={(e) => handleActionChange(index, 'name', e.currentTarget.value)}
                            size="sm"
                            data-testid={`workflow-command-action-name-${index}`}
                          />
                          <TextInput
                            label={t.commandModal.actions.eventName}
                            description={t.commandModal.actions.eventNameDescription}
                            placeholder={t.commandModal.actions.eventNamePlaceholder}
                            value={action.event_name}
                            onChange={(e) => handleActionChange(index, 'event_name', e.currentTarget.value)}
                            size="sm"
                            styles={{ input: { fontFamily: 'monospace', fontSize: 13 } }}
                            data-testid={`workflow-command-action-event-${index}`}
                          />

                          <Textarea
                            label={t.commandModal.actions.parameters}
                            description={t.commandModal.actions.parametersDescription}
                            placeholder={t.commandModal.actions.parametersPlaceholder}
                            value={jsonTextValues[index] || ''}
                            error={parameterError}
                            onChange={(e) => {
                              const newValue = e.currentTarget.value;
                              // Update the text value immediately for smooth typing
                              setJsonTextValues((texts) => ({ ...texts, [index]: newValue }));
                              setParameterErrors((errors) => ({ ...errors, [index]: undefined }));

                              // Update the actual parameters when the text is a JSON
                              // object (an empty value is an empty object). Anything
                              // else is not reported yet: the user is still typing
                              const parsed = parseWorkflowActionParameters(newValue);
                              if (parsed.valid) {
                                handleActionChange(index, 'parameters', parsed.parameters);
                              }
                            }}
                            onBlur={(e) => {
                              // On blur, mark text that is no JSON object on the field and keep it as is.
                              // The message is left to Save: its extra line would move the
                              // buttons below the field out from under the click that took the focus
                              const text = e.currentTarget.value;
                              const parsed = parseWorkflowActionParameters(text);
                              if (!parsed.valid) {
                                setParameterErrors((errors) => ({ ...errors, [index]: errors[index] || true }));
                                return;
                              }
                              // Valid: format the JSON (an empty field stays empty)
                              if (text.trim()) {
                                setJsonTextValues((texts) => ({
                                  ...texts,
                                  [index]: JSON.stringify(parsed.parameters, null, 2),
                                }));
                              }
                              handleActionChange(index, 'parameters', parsed.parameters);
                            }}
                            size="sm"
                            minRows={8}
                            autosize
                            styles={{ input: { fontFamily: 'monospace', fontSize: 13, resize: 'vertical' } }}
                            data-testid={`workflow-command-action-parameters-${index}`}
                          />

                          <Group justify="flex-end">
                            <Button
                              variant="light"
                              color="red"
                              size="xs"
                              leftSection={<IconTrash size={14} />}
                              onClick={() => handleRemoveAction(index)}
                            >
                              {t.commandModal.actions.removeAction}
                            </Button>
                          </Group>
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="policies" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t.commandModal.policies.intro}
            </Text>

            <MultiSelect
              label={t.commandModal.policies.label}
              placeholder={loadingPolicies ? t.commandModal.policies.loading : t.commandModal.policies.placeholder}
              data={policyOptions}
              value={selectedPolicies}
              onChange={setSelectedPolicies}
              error={policiesFailed ? t.commandModal.policies.loadFailed : undefined}
              searchable
              clearable
              disabled={loadingPolicies}
              data-testid="workflow-command-policies"
            />

            {selectedPolicies.length > 0 && (
              <Box>
                <Text size="sm" fw={500} mb="xs">
                  {t.commandModal.policies.selectedHeading}
                </Text>
                <Group gap="xs">
                  {selectedPolicies.map((policyId) => (
                    <Badge key={policyId} variant="light">
                      {policyName(policyId)}
                    </Badge>
                  ))}
                </Group>
              </Box>
            )}

            {moduleAccessKeys.length > 0 && (
              <Alert color="blue" variant="light" data-testid="workflow-command-keys-notice">
                {interpolate(t.commandModal.policies.moduleAccessKeysNotice, { keys: moduleAccessKeys.join(', ') })}
              </Alert>
            )}

            {/* Open to everyone only when neither gate is set: a command with
                module access keys and no policy is not open */}
            {selectedPolicies.length === 0 && moduleAccessKeys.length === 0 && (
              <Alert color="yellow" variant="light" data-testid="workflow-command-open-warning">
                {t.commandModal.policies.openToAllWarning}
              </Alert>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Group justify="flex-end" mt="xl">
        <Button variant="light" onClick={onClose}>
          {common.cancel}
        </Button>
        <Button onClick={handleSave} data-testid="workflow-command-save-btn">
          {isNew ? t.commandModal.addCommand : t.saveChanges}
        </Button>
      </Group>
    </Modal>
  );
};

export default WorkflowCommandModal;
