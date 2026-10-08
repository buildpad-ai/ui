'use client';

import React, { useEffect, useState } from 'react';
import { Button, Group, Modal, Stack, Switch, TextInput } from '@mantine/core';
import { useBuildpadTranslations } from '@buildpad/services';
import type { WorkflowJson, WorkflowJsonState } from '@buildpad/types';
import {
  buildWorkflowState,
  findWorkflowStateProblem,
  type DeepPartial,
  type WorkflowStateProblem,
  type WorkflowsTranslations,
} from '@buildpad/utils';

export interface WorkflowStateModalProps {
  opened: boolean;
  onClose: () => void;
  /** The stored state to edit, or null to add one. */
  state: WorkflowJsonState | null;
  /** The document the state belongs to: its other state names and its initial state. */
  workflowJson: WorkflowJson;
  /**
   * Called with the state to store, whether it is new, and whether the Initial
   * State switch is on. Apply it with `applyWorkflowStateSave`. The dialog
   * closes itself afterwards.
   */
  onSave: (state: WorkflowJsonState, isNew: boolean, isInitial: boolean) => void;
  /** Per-instance overrides of the `workflows` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<WorkflowsTranslations>;
}

/**
 * Add/Edit State dialog of the workflow editor: the state's name, whether it
 * is an end state, and whether it is the initial state. Ported from the
 * buildpad-daas reference `components/StateModal.tsx`.
 *
 * The saved state is built on the stored one (`buildWorkflowState`), so its
 * commands, its position and its stored key order carry over and saving a
 * state unchanged is not an edit.
 *
 * One rule is new: End State cannot be turned on for a state that has
 * commands. The switch has always said "End states cannot have outgoing
 * commands"; the reference let the state keep them.
 */
export const WorkflowStateModal: React.FC<WorkflowStateModalProps> = ({
  opened,
  onClose,
  state,
  workflowJson,
  onSave,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.workflows, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const isNew = !state;

  const [name, setName] = useState('');
  const [isEndState, setIsEndState] = useState(false);
  const [isInitial, setIsInitial] = useState(false);
  const [problem, setProblem] = useState<WorkflowStateProblem | null>(null);

  useEffect(() => {
    if (opened) {
      if (state) {
        setName(state.name);
        setIsEndState(Boolean(state.isEndState));
        setIsInitial(state.name === workflowJson.initial_state);
      } else {
        setName('');
        setIsEndState(false);
        setIsInitial(workflowJson.states.length === 0); // First state is initial by default
      }
      setProblem(null);
    }
  }, [opened, state, workflowJson]);

  const handleSave = () => {
    const found = findWorkflowStateProblem({
      name,
      // The state's own stored name is not a sibling: it may keep its name
      siblingNames: workflowJson.states.filter((s) => s.name !== state?.name).map((s) => s.name),
      isEndState,
      wasEndState: Boolean(state?.isEndState),
      commandCount: state?.commands?.length ?? 0,
    });
    if (found) {
      setProblem(found);
      return;
    }

    // Built on the stored state, so its commands, position and key order are kept
    onSave(buildWorkflowState(state, { name, isEndState }), isNew, isInitial);
    onClose();
  };

  const nameError =
    problem && problem.code !== 'endStateHasCommands' ? t.stateModal.validation[problem.code] : undefined;
  const endStateError =
    problem?.code === 'endStateHasCommands' ? t.stateModal.validation.endStateHasCommands : undefined;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isNew ? t.stateModal.titleAdd : t.stateModal.titleEdit}
      size="md"
      data-testid="workflow-state-modal"
    >
      <Stack gap="md">
        <TextInput
          label={t.stateModal.fields.name}
          placeholder={t.stateModal.fields.namePlaceholder}
          value={name}
          onChange={(e) => {
            setName(e.currentTarget.value);
            setProblem(null);
          }}
          error={nameError}
          required
          data-autofocus
          data-testid="workflow-state-name"
        />

        <Switch
          label={t.stateModal.fields.endState}
          description={t.stateModal.fields.endStateDescription}
          checked={isEndState}
          onChange={(e) => {
            setIsEndState(e.currentTarget.checked);
            setProblem(null);
          }}
          error={endStateError}
          data-testid="workflow-state-end-switch"
        />

        <Switch
          label={t.stateModal.fields.initialState}
          description={t.stateModal.fields.initialStateDescription}
          checked={isInitial}
          onChange={(e) => setIsInitial(e.currentTarget.checked)}
          data-testid="workflow-state-initial-switch"
        />

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            {common.cancel}
          </Button>
          <Button onClick={handleSave} data-testid="workflow-state-save-btn">
            {isNew ? t.stateModal.addState : t.saveChanges}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default WorkflowStateModal;
