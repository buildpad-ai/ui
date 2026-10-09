/**
 * WorkflowAssignmentDetail unit tests: loading (and the three ways a load can
 * end without an assignment), the two pickers and where their options come
 * from, the Filter Rule field, saving, and the read-only form.
 * `@buildpad/hooks` is mocked, and so is the request the default collection
 * loader makes.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkflowAssignmentRecord } from '@buildpad/types';
import { DaaSRequestError } from '../../hooks/src/daasRequest';
import { WorkflowAssignmentDetail } from '../src/WorkflowAssignmentDetail';
import { manyMockWorkflows, mockAssignment, mockAssignments, mockCollectionNames, mockWorkflows } from '../src/_fixtures';

const mocks = vi.hoisted(() => ({
  getAssignment: vi.fn(),
  createAssignment: vi.fn(),
  updateAssignment: vi.fn(),
  fetchDefinitions: vi.fn(),
  fetchAllDefinitions: vi.fn(),
  usePermissions: vi.fn(),
  apiRequest: vi.fn(),
}));

vi.mock('@buildpad/hooks', async () => {
  const request = await import('../../hooks/src/daasRequest');
  return {
    DaaSRequestError: request.DaaSRequestError,
    toDaaSRequestError: request.toDaaSRequestError,
    useWorkflowAssignments: () => ({
      getAssignment: mocks.getAssignment,
      createAssignment: mocks.createAssignment,
      updateAssignment: mocks.updateAssignment,
    }),
    useWorkflowDefinitions: () => ({
      fetchDefinitions: mocks.fetchDefinitions,
      fetchAllDefinitions: mocks.fetchAllDefinitions,
    }),
    usePermissions: mocks.usePermissions,
  };
});

vi.mock('@buildpad/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@buildpad/services')>()),
  apiRequest: mocks.apiRequest,
}));

function renderDetail(props: Partial<React.ComponentProps<typeof WorkflowAssignmentDetail>> = {}) {
  const onBack = vi.fn();
  const onSaved = vi.fn();
  const utils = render(
    <MantineProvider>
      <WorkflowAssignmentDetail id={mockAssignment.id} onBack={onBack} onSaved={onSaved} {...props} />
    </MantineProvider>,
  );
  return { ...utils, onBack, onSaved };
}

/** The host gives the form that is on screen other props (another `id`, above all). */
function reopen(
  rerender: (ui: React.ReactElement) => void,
  props: React.ComponentProps<typeof WorkflowAssignmentDetail>,
) {
  rerender(
    <MantineProvider>
      <WorkflowAssignmentDetail {...props} />
    </MantineProvider>,
  );
}

/** A request the test answers when it chooses to. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function grant(actions: string[], isAdmin = false) {
  mocks.usePermissions.mockReturnValue({
    canPerform: (_collection: string, action: string) => actions.includes(action),
    isAdmin,
    loading: false,
  });
}

const workflowInput = () => screen.getByTestId('workflow-assignment-detail-workflow') as HTMLInputElement;
const collectionInput = () => screen.getByTestId('workflow-assignment-detail-collection') as HTMLInputElement;
const ruleInput = () => screen.getByTestId('workflow-assignment-detail-filter-rule') as HTMLTextAreaElement;
const saveButton = () => screen.getByTestId('workflow-assignment-detail-save-btn');
const loaded = () => waitFor(() => expect(workflowInput().value).toBe('Article review'));
/** The options of both pickers have arrived. */
const optionsLoaded = () =>
  waitFor(() => {
    expect(mocks.fetchAllDefinitions).toHaveBeenCalled();
    expect(mocks.apiRequest).toHaveBeenCalled();
  });

/** Picks `label` from the dropdown of the picker `input` belongs to. */
async function pick(input: HTMLElement, label: string) {
  fireEvent.click(input);
  // hidden: true — the dropdown stays display:none in jsdom (no transitions).
  const options = await screen.findAllByRole('option', { name: label, hidden: true });
  fireEvent.click(options[options.length - 1]);
}

function typeRule(text: string, { blur = false } = {}) {
  fireEvent.change(ruleInput(), { target: { value: text } });
  if (blur) fireEvent.blur(ruleInput());
}

/** Fills the two required fields of a new assignment. */
async function fillRequired() {
  await pick(workflowInput(), 'Support ticket');
  await pick(collectionInput(), 'pages');
}

/** The row the server answers a save with. */
const stored = (overrides: Partial<WorkflowAssignmentRecord> = {}): WorkflowAssignmentRecord => ({
  ...mockAssignment,
  ...overrides,
});

let show: ReturnType<typeof vi.spyOn>;
let historyBack: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mocks.getAssignment.mockReset().mockResolvedValue(mockAssignment);
  mocks.createAssignment.mockReset().mockResolvedValue(stored({ id: 'new-assignment-1' }));
  mocks.updateAssignment.mockReset().mockResolvedValue(stored());
  mocks.fetchDefinitions.mockReset();
  mocks.fetchAllDefinitions.mockReset().mockResolvedValue(mockWorkflows);
  mocks.apiRequest.mockReset().mockResolvedValue({ data: mockCollectionNames.map((collection) => ({ collection })) });
  mocks.usePermissions.mockReset();
  grant([], true);
  show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
  historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => {});
});

afterEach(() => {
  show.mockRestore();
  historyBack.mockRestore();
});

describe('WorkflowAssignmentDetail', () => {
  describe('loading an assignment', () => {
    it('shows its workflow, collection and filter rule', async () => {
      renderDetail();
      await loaded();

      expect(mocks.getAssignment).toHaveBeenCalledWith(mockAssignment.id);
      expect(screen.getByRole('heading', { name: 'Edit Workflow Assignment' })).toBeInTheDocument();
      expect(screen.getByText('Edit Assignment')).toBeInTheDocument();
      expect(collectionInput().value).toBe('articles');
      expect(JSON.parse(ruleInput().value)).toEqual({ status: { _eq: 'draft' } });
      // Shown the way the form formats it
      expect(ruleInput().value).toBe(JSON.stringify({ status: { _eq: 'draft' } }, null, 2));
      expect(screen.queryByTestId('workflow-assignment-detail-unsaved-badge')).not.toBeInTheDocument();
      expect(saveButton()).toHaveTextContent('Save Changes');
      expect(saveButton()).toBeDisabled();
    });

    it('an assignment without a rule has an empty Filter Rule field', async () => {
      mocks.getAssignment.mockResolvedValue(mockAssignments[1]);
      renderDetail({ id: mockAssignments[1].id });
      await waitFor(() => expect(collectionInput().value).toBe('tickets'));
      expect(ruleInput().value).toBe('');
    });

    it('id="new" loads nothing and offers an empty form', async () => {
      renderDetail({ id: 'new' });
      expect(await screen.findByRole('heading', { name: 'New Workflow Assignment' })).toBeInTheDocument();
      expect(screen.getByText('New Assignment')).toBeInTheDocument();
      expect(mocks.getAssignment).not.toHaveBeenCalled();
      expect(workflowInput().value).toBe('');
      expect(collectionInput().value).toBe('');
      expect(ruleInput().value).toBe('');
      expect(saveButton()).toHaveTextContent('Create Assignment');
      expect(saveButton()).not.toBeDisabled();
    });

    it('reads its strings from the translations prop', async () => {
      renderDetail({ translations: { assignmentDetail: { titleEdit: 'Ubah Penugasan' } } });
      expect(await screen.findByRole('heading', { name: 'Ubah Penugasan' })).toBeInTheDocument();
    });
  });

  describe('a load that ends without an assignment', () => {
    // WF-06: a missing id rendered a blank "Edit Workflow Assignment" form
    it('an id that names no assignment shows the not-found state, not a blank form', async () => {
      mocks.getAssignment.mockRejectedValue(
        new DaaSRequestError('Workflow assignment not found', { kind: 'notFound', status: 404 }),
      );
      const { onBack } = renderDetail({ id: 'missing' });

      const state = await screen.findByTestId('workflow-assignment-detail-not-found');
      expect(state).toHaveTextContent('Workflow assignment not found');
      expect(state).toHaveTextContent('It may have been deleted, or you may not have access to it.');
      expect(screen.queryByTestId('workflow-assignment-detail-workflow')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-assignment-detail-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Edit Workflow Assignment' })).not.toBeInTheDocument();
      // Missing is not an outage: no error toast, and no options asked for
      expect(show).not.toHaveBeenCalled();
      expect(mocks.fetchAllDefinitions).not.toHaveBeenCalled();

      fireEvent.click(within(state).getByRole('button', { name: 'Back' }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('an assignment the caller may not read shows the access-denied state', async () => {
      mocks.getAssignment.mockRejectedValue(
        new DaaSRequestError('Permission denied', { kind: 'forbidden', status: 403 }),
      );
      renderDetail();
      const state = await screen.findByTestId('workflow-assignment-detail-access-denied');
      expect(state).toHaveTextContent('Access denied');
      expect(state).toHaveTextContent('You do not have permission to view this.');
      expect(show).not.toHaveBeenCalled();
    });

    it('a session that needs a second factor is told what the server said', async () => {
      mocks.getAssignment.mockRejectedValue(
        new DaaSRequestError('Multi-factor authentication is required', { kind: 'mfaRequired', status: 403 }),
      );
      renderDetail();
      expect(await screen.findByTestId('workflow-assignment-detail-access-denied')).toHaveTextContent(
        'Multi-factor authentication is required',
      );
    });

    it('a failed load shows the load-error state, and Retry loads again', async () => {
      mocks.getAssignment.mockRejectedValueOnce(new DaaSRequestError('service unavailable', { kind: 'failure' }));
      renderDetail();

      const state = await screen.findByTestId('workflow-assignment-detail-load-error');
      expect(state).toHaveTextContent('Failed to load workflow assignment — service unavailable');
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to load workflow assignment', color: 'red' }),
      );

      fireEvent.click(within(state).getByRole('button', { name: 'Retry' }));
      await loaded();
    });

    it('a failure without a sentence uses the dictionary\'s', async () => {
      mocks.getAssignment.mockRejectedValue('nope');
      renderDetail();
      expect(await screen.findByTestId('workflow-assignment-detail-load-error')).toHaveTextContent(
        'Failed to load workflow assignment — Failed to load workflow assignment',
      );
    });

    it('draws only the assignment of the latest id', async () => {
      let answerFirst: (value: WorkflowAssignmentRecord) => void = () => {};
      mocks.getAssignment.mockImplementation((id: string) =>
        id === 'slow'
          ? new Promise((resolve) => {
              answerFirst = resolve;
            })
          : Promise.resolve(mockAssignments[1]),
      );
      const { rerender } = render(
        <MantineProvider>
          <WorkflowAssignmentDetail id="slow" />
        </MantineProvider>,
      );
      rerender(
        <MantineProvider>
          <WorkflowAssignmentDetail id={mockAssignments[1].id} />
        </MantineProvider>,
      );
      await waitFor(() => expect(collectionInput().value).toBe('tickets'));
      await act(async () => {
        answerFirst(mockAssignment);
      });
      expect(collectionInput().value).toBe('tickets');
    });
  });

  describe('the Workflow picker', () => {
    // WF-02: the picker loaded GET /api/workflows with no limit — the first 25 definitions
    it('offers every definition, not the first page of them', async () => {
      mocks.fetchAllDefinitions.mockResolvedValue(manyMockWorkflows(60));
      renderDetail({ id: 'new' });
      await optionsLoaded();

      fireEvent.click(workflowInput());
      expect(await screen.findByRole('option', { name: 'Workflow 26', hidden: true })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Workflow 60', hidden: true })).toBeInTheDocument();
      expect(screen.getAllByRole('option', { name: /^Workflow \d+$/, hidden: true })).toHaveLength(60);

      expect(mocks.fetchAllDefinitions).toHaveBeenCalledTimes(1);
      // The paged list request is never what feeds the picker
      expect(mocks.fetchDefinitions).not.toHaveBeenCalled();
    });

    // WF-02's other half: a saved definition from past the first page rendered blank
    it('shows the assigned definition by name even when the options do not hold it', async () => {
      mocks.fetchAllDefinitions.mockResolvedValue([]);
      renderDetail();
      await loaded();
      await optionsLoaded();
      expect(workflowInput().value).toBe('Article review');
    });

    it('shows the id of an assigned definition nothing names', async () => {
      mocks.fetchAllDefinitions.mockResolvedValue([]);
      mocks.getAssignment.mockResolvedValue(mockAssignments[2]);
      renderDetail({ id: mockAssignments[2].id });
      await waitFor(() => expect(workflowInput().value).toBe(mockAssignments[2].workflow));
    });

    it('a failed load of the definitions is a notification, and the form keeps what it has', async () => {
      mocks.fetchAllDefinitions.mockRejectedValue(
        new DaaSRequestError('Permission denied', { kind: 'forbidden', status: 403 }),
      );
      renderDetail();
      await loaded();
      await waitFor(() =>
        expect(show).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Failed to load workflows', message: 'Permission denied', color: 'red' }),
        ),
      );
      expect(workflowInput().value).toBe('Article review');
    });

    it('takes its options from the workflows prop, or from loadWorkflows, instead of loading them', async () => {
      const { unmount } = renderDetail({ id: 'new', workflows: [{ id: 'w-1', name: 'From the prop' }] });
      await pick(workflowInput(), 'From the prop');
      expect(workflowInput().value).toBe('From the prop');
      expect(mocks.fetchAllDefinitions).not.toHaveBeenCalled();
      unmount();

      const loadWorkflows = vi.fn().mockResolvedValue([{ id: 'w-2', name: '' }]);
      renderDetail({ id: 'new', loadWorkflows });
      await waitFor(() => expect(loadWorkflows).toHaveBeenCalledTimes(1));
      // A definition without a name is offered by its id
      await pick(workflowInput(), 'w-2');
      expect(workflowInput().value).toBe('w-2');
      expect(mocks.fetchAllDefinitions).not.toHaveBeenCalled();
    });
  });

  describe('the Collection picker', () => {
    it('offers the collections the API lists', async () => {
      renderDetail({ id: 'new' });
      await optionsLoaded();
      expect(mocks.apiRequest).toHaveBeenCalledWith('/api/collections');
      await pick(collectionInput(), 'tickets');
      expect(collectionInput().value).toBe('tickets');
    });

    it('keeps the assigned collection when the list does not hold it', async () => {
      mocks.apiRequest.mockResolvedValue({ data: [{ collection: 'pages' }] });
      renderDetail();
      await loaded();
      await optionsLoaded();
      expect(collectionInput().value).toBe('articles');
    });

    it('takes its options from the collections prop, or from loadCollections, instead of loading them', async () => {
      const { unmount } = renderDetail({ id: 'new', collections: ['only_this'] });
      await pick(collectionInput(), 'only_this');
      expect(collectionInput().value).toBe('only_this');
      expect(mocks.apiRequest).not.toHaveBeenCalled();
      unmount();

      const loadCollections = vi.fn().mockResolvedValue(['from_the_loader']);
      renderDetail({ id: 'new', loadCollections });
      await waitFor(() => expect(loadCollections).toHaveBeenCalledTimes(1));
      await pick(collectionInput(), 'from_the_loader');
      expect(mocks.apiRequest).not.toHaveBeenCalled();
    });

    it('becomes a text field when the collections cannot be listed, so the form still saves', async () => {
      mocks.apiRequest.mockRejectedValue(
        new Error('API error: 403 - {"errors":[{"message":"Admin access required","extensions":{"code":"FORBIDDEN"}}]}'),
      );
      renderDetail({ id: 'new' });
      await waitFor(() =>
        expect(show).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Failed to load collections',
            message: 'Admin access required',
            color: 'red',
          }),
        ),
      );

      await pick(workflowInput(), 'Support ticket');
      fireEvent.change(collectionInput(), { target: { value: '  tickets  ' } });
      fireEvent.click(saveButton());

      await waitFor(() => expect(mocks.createAssignment).toHaveBeenCalledTimes(1));
      expect(mocks.createAssignment).toHaveBeenCalledWith({
        workflow: mockWorkflows[1].id,
        collection: 'tickets',
        filter_rule: null,
      });
    });

    it('a loader that fails without a sentence uses the dictionary\'s', async () => {
      renderDetail({ id: 'new', loadCollections: () => Promise.reject('nope') });
      await waitFor(() =>
        expect(show).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Failed to load collections', message: 'Failed to load collections' }),
        ),
      );
    });
  });

  describe('the Filter Rule field', () => {
    it('formats a valid rule when the field is left', async () => {
      renderDetail({ id: 'new' });
      typeRule('{"status":{"_eq":"draft"}}', { blur: true });
      expect(ruleInput().value).toBe(JSON.stringify({ status: { _eq: 'draft' } }, null, 2));
      expect(ruleInput()).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('leaves text that is not JSON as it was typed, and says what is wrong with it', async () => {
      renderDetail({ id: 'new' });
      typeRule('{"status": ', { blur: true });
      expect(ruleInput().value).toBe('{"status": ');
      expect(screen.getByText('Filter Rule must be valid JSON')).toBeInTheDocument();
      expect(ruleInput()).toHaveAttribute('aria-invalid', 'true');

      // Typing again clears the message
      typeRule('{"status": 1}');
      expect(screen.queryByText('Filter Rule must be valid JSON')).not.toBeInTheDocument();
    });

    it('leaves an empty field and the JSON null alone: both mean no filter', async () => {
      renderDetail({ id: 'new' });
      typeRule('   ', { blur: true });
      expect(ruleInput().value).toBe('   ');
      typeRule('null', { blur: true });
      expect(ruleInput().value).toBe('null');
      expect(ruleInput()).not.toHaveAttribute('aria-invalid', 'true');
    });

    // WF-03: '[]' and '123' are valid JSON, and were saved as rules that narrow nothing
    it.each([
      ['an array', '[]'],
      ['a number', '123'],
      ['text', '"draft"'],
      ['a boolean', 'true'],
      ['an array of conditions', '[{"status":{"_eq":"draft"}}]'],
    ])('refuses %s on the form and sends no request (create)', async (_what, text) => {
      renderDetail({ id: 'new' });
      await optionsLoaded();
      await fillRequired();
      typeRule(text);
      fireEvent.click(saveButton());

      expect(await screen.findByText('Filter Rule must be a JSON object')).toBeInTheDocument();
      expect(ruleInput()).toHaveAttribute('aria-invalid', 'true');
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Validation Error',
          message: 'Filter Rule must be a JSON object',
          color: 'red',
        }),
      );
      expect(mocks.createAssignment).not.toHaveBeenCalled();
      expect(mocks.updateAssignment).not.toHaveBeenCalled();
      // The text is not rewritten into something the user did not type
      expect(ruleInput().value).toBe(text);
    });

    // WF-03, on an existing assignment
    it('refuses a rule that is not an object on an update too, as soon as the field is left', async () => {
      renderDetail();
      await loaded();
      typeRule('[]', { blur: true });
      expect(screen.getByText('Filter Rule must be a JSON object')).toBeInTheDocument();
      expect(ruleInput().value).toBe('[]');

      fireEvent.click(saveButton());
      await waitFor(() =>
        expect(show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Filter Rule must be a JSON object' })),
      );
      expect(mocks.updateAssignment).not.toHaveBeenCalled();
    });

    it('refuses text that is not JSON on save, and sends no request', async () => {
      renderDetail({ id: 'new' });
      await optionsLoaded();
      await fillRequired();
      typeRule('status = draft');
      fireEvent.click(saveButton());

      expect(await screen.findByText('Filter Rule must be valid JSON')).toBeInTheDocument();
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Validation Error', message: 'Filter Rule must be valid JSON' }),
      );
      expect(mocks.createAssignment).not.toHaveBeenCalled();
    });

    it('is not shown, and never sent, when the caller\'s grant withholds the rule', async () => {
      const { filter_rule: _withheld, ...withoutRule } = mockAssignment;
      mocks.getAssignment.mockResolvedValue(withoutRule);
      renderDetail();
      await loaded();
      await optionsLoaded();
      expect(screen.queryByTestId('workflow-assignment-detail-filter-rule')).not.toBeInTheDocument();

      await pick(collectionInput(), 'pages');
      fireEvent.click(saveButton());
      await waitFor(() => expect(mocks.updateAssignment).toHaveBeenCalledTimes(1));
      expect(mocks.updateAssignment).toHaveBeenCalledWith(mockAssignment.id, { collection: 'pages' });
    });
  });

  describe('creating', () => {
    it('requires a workflow and a collection, and sends nothing without them', async () => {
      renderDetail({ id: 'new' });
      await optionsLoaded();
      fireEvent.click(saveButton());

      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Validation Error',
          message: 'Workflow and Collection are required',
          color: 'red',
        }),
      );
      expect(workflowInput()).toHaveAttribute('aria-invalid', 'true');
      expect(collectionInput()).toHaveAttribute('aria-invalid', 'true');
      expect(mocks.createAssignment).not.toHaveBeenCalled();

      // Filling a field clears its mark
      await pick(workflowInput(), 'Support ticket');
      expect(workflowInput()).not.toHaveAttribute('aria-invalid', 'true');
      expect(collectionInput()).toHaveAttribute('aria-invalid', 'true');
      fireEvent.click(saveButton());
      expect(mocks.createAssignment).not.toHaveBeenCalled();
    });

    it('creates the assignment with its rule, says so, and hands the stored row to onSaved', async () => {
      const { onSaved } = renderDetail({ id: 'new' });
      await optionsLoaded();
      await fillRequired();
      typeRule('{"status":{"_eq":"draft"}}');
      expect(screen.getByTestId('workflow-assignment-detail-unsaved-badge')).toBeInTheDocument();
      fireEvent.click(saveButton());

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      expect(mocks.createAssignment).toHaveBeenCalledWith({
        workflow: mockWorkflows[1].id,
        collection: 'pages',
        filter_rule: { status: { _eq: 'draft' } },
      });
      expect(onSaved).toHaveBeenCalledWith(stored({ id: 'new-assignment-1' }));
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Workflow assignment created successfully', color: 'green' }),
      );
      expect(mocks.updateAssignment).not.toHaveBeenCalled();
      expect(screen.queryByTestId('workflow-assignment-detail-unsaved-badge')).not.toBeInTheDocument();
    });

    it('an empty Filter Rule creates an assignment for every item', async () => {
      renderDetail({ id: 'new' });
      await optionsLoaded();
      await fillRequired();
      fireEvent.click(saveButton());
      await waitFor(() => expect(mocks.createAssignment).toHaveBeenCalledTimes(1));
      expect(mocks.createAssignment).toHaveBeenCalledWith({
        workflow: mockWorkflows[1].id,
        collection: 'pages',
        filter_rule: null,
      });
    });

    it('a refused create shows the server\'s sentence and keeps the form', async () => {
      mocks.createAssignment.mockRejectedValue(
        new DaaSRequestError('An assignment for this collection already exists', { kind: 'invalid', status: 400 }),
      );
      const { onSaved } = renderDetail({ id: 'new' });
      await optionsLoaded();
      await fillRequired();
      fireEvent.click(saveButton());

      await waitFor(() =>
        expect(show).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Failed to create workflow assignment',
            message: 'An assignment for this collection already exists',
            color: 'red',
          }),
        ),
      );
      expect(onSaved).not.toHaveBeenCalled();
      expect(collectionInput().value).toBe('pages');
      await waitFor(() => expect(saveButton()).not.toBeDisabled());
    });

    it('a double click on Create sends one request, and the button is pending meanwhile', async () => {
      let finish: (value: WorkflowAssignmentRecord) => void = () => {};
      mocks.createAssignment.mockImplementation(
        () =>
          new Promise<WorkflowAssignmentRecord>((resolve) => {
            finish = resolve;
          }),
      );
      renderDetail({ id: 'new' });
      await optionsLoaded();
      await fillRequired();

      fireEvent.click(saveButton());
      fireEvent.click(saveButton());
      await waitFor(() => expect(saveButton()).toHaveAttribute('data-loading', 'true'));
      fireEvent.click(saveButton());
      expect(mocks.createAssignment).toHaveBeenCalledTimes(1);

      await act(async () => {
        finish(stored({ id: 'new-assignment-1' }));
      });
      expect(mocks.createAssignment).toHaveBeenCalledTimes(1);
    });

    // A host that does not navigate in onSaved (or is slow to) left an enabled
    // Create button on a form that had already been stored
    it('edits the assignment it created when the host does not navigate: a second Save updates it, and nothing is created twice', async () => {
      mocks.createAssignment.mockResolvedValue(
        stored({ id: 'new-assignment-1', workflow: mockWorkflows[1].id, collection: 'pages', filter_rule: null }),
      );
      const { onSaved } = renderDetail({ id: 'new' });
      await optionsLoaded();
      await fillRequired();
      fireEvent.click(saveButton());

      // The form is the stored assignment's now: its title, and a Save that waits for an edit
      expect(await screen.findByRole('heading', { name: 'Edit Workflow Assignment' })).toBeInTheDocument();
      expect(screen.getByText('Edit Assignment')).toBeInTheDocument();
      expect(screen.queryByText('New Assignment')).not.toBeInTheDocument();
      expect(saveButton()).toHaveTextContent('Save Changes');
      expect(saveButton()).toBeDisabled();
      expect(screen.queryByTestId('workflow-assignment-detail-unsaved-badge')).not.toBeInTheDocument();
      expect(onSaved).toHaveBeenCalledTimes(1);
      // Shown from what was sent, without a load for it
      expect(mocks.getAssignment).not.toHaveBeenCalled();
      expect(workflowInput().value).toBe('Support ticket');
      expect(collectionInput().value).toBe('pages');

      // The second click of a double click that arrives after the answer
      fireEvent.click(saveButton());
      expect(mocks.createAssignment).toHaveBeenCalledTimes(1);
      expect(mocks.updateAssignment).not.toHaveBeenCalled();

      await pick(collectionInput(), 'tickets');
      mocks.updateAssignment.mockResolvedValue(stored({ id: 'new-assignment-1', collection: 'tickets' }));
      fireEvent.click(saveButton());
      await waitFor(() =>
        expect(mocks.updateAssignment).toHaveBeenCalledWith('new-assignment-1', { collection: 'tickets' }),
      );
      expect(mocks.createAssignment).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
      expect(show).toHaveBeenLastCalledWith(
        expect.objectContaining({ message: 'Workflow assignment updated successfully' }),
      );
    });

    it('loads the created assignment once when the host then navigates to it', async () => {
      const { rerender } = renderDetail({ id: 'new' });
      await optionsLoaded();
      await fillRequired();
      fireEvent.click(saveButton());
      await screen.findByRole('heading', { name: 'Edit Workflow Assignment' });

      // As a host may do in onSaved: open the new assignment's own route
      mocks.getAssignment.mockResolvedValue(mockAssignments[1]);
      reopen(rerender, { id: 'new-assignment-1' });
      await waitFor(() => expect(mocks.getAssignment).toHaveBeenCalledWith('new-assignment-1'));
      await waitFor(() => expect(collectionInput().value).toBe('tickets'));
      expect(mocks.getAssignment).toHaveBeenCalledTimes(1);
      expect(saveButton()).toBeDisabled();
    });

    it('a new assignment opened after one was created here starts empty again', async () => {
      const { rerender } = renderDetail({ id: 'new' });
      await optionsLoaded();
      await fillRequired();
      fireEvent.click(saveButton());
      await screen.findByRole('heading', { name: 'Edit Workflow Assignment' });

      reopen(rerender, { id: mockAssignment.id });
      await loaded();
      reopen(rerender, { id: 'new' });
      expect(await screen.findByRole('heading', { name: 'New Workflow Assignment' })).toBeInTheDocument();
      expect(workflowInput().value).toBe('');
      expect(collectionInput().value).toBe('');
      expect(saveButton()).toHaveTextContent('Create Assignment');

      // And it creates: the assignment created before is not the one saved to
      await fillRequired();
      fireEvent.click(saveButton());
      await waitFor(() => expect(mocks.createAssignment).toHaveBeenCalledTimes(2));
      expect(mocks.updateAssignment).not.toHaveBeenCalled();
    });

    it('a create answered after another assignment was opened does not take that form over', async () => {
      const request = deferred<WorkflowAssignmentRecord>();
      mocks.createAssignment.mockImplementation(() => request.promise);
      const { rerender, onSaved } = renderDetail({ id: 'new' });
      await optionsLoaded();
      await fillRequired();
      fireEvent.click(saveButton());

      reopen(rerender, { id: mockAssignment.id, onSaved });
      await loaded();
      await act(async () => {
        request.resolve(stored({ id: 'new-assignment-1' }));
      });
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(stored({ id: 'new-assignment-1' })));
      expect(collectionInput().value).toBe('articles');
      expect(screen.queryByTestId('workflow-assignment-detail-unsaved-badge')).not.toBeInTheDocument();

      // A save here goes to the assignment that is open, not to the one that was created
      await pick(collectionInput(), 'tickets');
      await waitFor(() => expect(saveButton()).not.toBeDisabled());
      fireEvent.click(saveButton());
      await waitFor(() =>
        expect(mocks.updateAssignment).toHaveBeenCalledWith(mockAssignment.id, { collection: 'tickets' }),
      );
    });

    it('a user who may create but not update gets the assignment it created read-only', async () => {
      grant(['read', 'create']);
      renderDetail({ id: 'new' });
      await optionsLoaded();
      await fillRequired();
      fireEvent.click(saveButton());

      await screen.findByRole('heading', { name: 'Edit Workflow Assignment' });
      await waitFor(() =>
        expect(screen.queryByTestId('workflow-assignment-detail-save-btn')).not.toBeInTheDocument(),
      );
      expect(collectionInput()).toHaveAttribute('readonly');
      expect(screen.getByTestId('workflow-assignment-detail-cancel-btn')).toHaveTextContent('Back');
      expect(mocks.createAssignment).toHaveBeenCalledTimes(1);
    });
  });

  describe('updating', () => {
    it('sends only the keys that changed', async () => {
      const { onSaved } = renderDetail();
      await loaded();
      await optionsLoaded();
      expect(saveButton()).toBeDisabled();

      await pick(collectionInput(), 'pages');
      expect(screen.getByTestId('workflow-assignment-detail-unsaved-badge')).toBeInTheDocument();
      mocks.updateAssignment.mockResolvedValue(stored({ collection: 'pages' }));
      fireEvent.click(saveButton());

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      expect(mocks.updateAssignment).toHaveBeenCalledWith(mockAssignment.id, { collection: 'pages' });
      expect(onSaved).toHaveBeenCalledWith(stored({ collection: 'pages' }));
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Workflow assignment updated successfully', color: 'green' }),
      );
      expect(mocks.createAssignment).not.toHaveBeenCalled();
      // What is on screen is what is stored now
      expect(screen.queryByTestId('workflow-assignment-detail-unsaved-badge')).not.toBeInTheDocument();
      expect(saveButton()).toBeDisabled();
    });

    it('keeps what was typed while the save was in flight, as an edit that is not saved yet', async () => {
      const request = deferred<WorkflowAssignmentRecord>();
      mocks.updateAssignment.mockImplementation(() => request.promise);
      // The collections cannot be listed, so the name is typed
      renderDetail({ loadCollections: () => Promise.reject(new Error('Admin access required')) });
      await loaded();
      await waitFor(() => expect(collectionInput()).not.toHaveAttribute('aria-haspopup'));

      fireEvent.change(collectionInput(), { target: { value: 'pages' } });
      fireEvent.click(saveButton());
      expect(mocks.updateAssignment).toHaveBeenCalledWith(mockAssignment.id, { collection: 'pages' });
      // The request is slow, and the inputs stay open
      fireEvent.change(collectionInput(), { target: { value: 'tickets' } });
      typeRule('{"status":{"_eq":"review"}}');

      await act(async () => {
        request.resolve(stored({ collection: 'pages' }));
      });
      await waitFor(() => expect(saveButton()).not.toHaveAttribute('data-loading', 'true'));
      expect(collectionInput().value).toBe('tickets');
      expect(JSON.parse(ruleInput().value)).toEqual({ status: { _eq: 'review' } });
      expect(screen.getByTestId('workflow-assignment-detail-unsaved-badge')).toBeInTheDocument();

      // The next Save sends those edits, and only those
      mocks.updateAssignment.mockResolvedValue(stored({ collection: 'tickets' }));
      fireEvent.click(saveButton());
      await waitFor(() =>
        expect(mocks.updateAssignment).toHaveBeenLastCalledWith(mockAssignment.id, {
          collection: 'tickets',
          filter_rule: { status: { _eq: 'review' } },
        }),
      );
    });

    it('shows a typed collection the way it was sent when nothing was typed since', async () => {
      renderDetail({ loadCollections: () => Promise.reject(new Error('Admin access required')) });
      await loaded();
      await waitFor(() => expect(collectionInput()).not.toHaveAttribute('aria-haspopup'));

      fireEvent.change(collectionInput(), { target: { value: '  pages  ' } });
      mocks.updateAssignment.mockResolvedValue(stored({ collection: 'pages' }));
      fireEvent.click(saveButton());

      await waitFor(() => expect(mocks.updateAssignment).toHaveBeenCalledWith(mockAssignment.id, { collection: 'pages' }));
      await waitFor(() => expect(collectionInput().value).toBe('pages'));
      expect(screen.queryByTestId('workflow-assignment-detail-unsaved-badge')).not.toBeInTheDocument();
    });

    it('a save answered after another assignment was opened is not drawn over that assignment', async () => {
      const request = deferred<WorkflowAssignmentRecord>();
      mocks.updateAssignment.mockImplementation(() => request.promise);
      const { rerender, onSaved } = renderDetail();
      await loaded();
      await optionsLoaded();

      await pick(collectionInput(), 'pages');
      fireEvent.click(saveButton());
      // The host opens another assignment in the same form before the answer is in
      mocks.getAssignment.mockResolvedValue(mockAssignments[1]);
      reopen(rerender, { id: mockAssignments[1].id, onSaved });
      await waitFor(() => expect(collectionInput().value).toBe('tickets'));

      await act(async () => {
        request.resolve(stored({ collection: 'pages' }));
      });
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(stored({ collection: 'pages' })));
      // Still the assignment that is open, untouched and with nothing to save
      expect(collectionInput().value).toBe('tickets');
      expect(workflowInput().value).toBe('Support ticket');
      expect(screen.queryByTestId('workflow-assignment-detail-unsaved-badge')).not.toBeInTheDocument();
      await waitFor(() => expect(saveButton()).not.toHaveAttribute('data-loading', 'true'));
      expect(saveButton()).toBeDisabled();
    });

    it('changing the workflow and the rule sends both, and not the collection', async () => {
      renderDetail();
      await loaded();
      await optionsLoaded();
      await pick(workflowInput(), 'Support ticket');
      typeRule('{"status":{"_eq":"review"}}');
      fireEvent.click(saveButton());

      await waitFor(() => expect(mocks.updateAssignment).toHaveBeenCalledTimes(1));
      expect(mocks.updateAssignment).toHaveBeenCalledWith(mockAssignment.id, {
        workflow: mockWorkflows[1].id,
        filter_rule: { status: { _eq: 'review' } },
      });
    });

    it('emptying the Filter Rule clears the rule', async () => {
      renderDetail();
      await loaded();
      typeRule('');
      fireEvent.click(saveButton());
      await waitFor(() => expect(mocks.updateAssignment).toHaveBeenCalledTimes(1));
      expect(mocks.updateAssignment).toHaveBeenCalledWith(mockAssignment.id, { filter_rule: null });
    });

    it('the same rule written differently is not an edit', async () => {
      renderDetail();
      await loaded();
      typeRule('{ "status" : { "_eq" : "draft" } }');
      expect(screen.queryByTestId('workflow-assignment-detail-unsaved-badge')).not.toBeInTheDocument();
      expect(saveButton()).toBeDisabled();
    });

    it('a refused update shows the server\'s sentence', async () => {
      mocks.updateAssignment.mockRejectedValue(
        new DaaSRequestError('Permission denied', { kind: 'forbidden', status: 403 }),
      );
      const { onSaved } = renderDetail();
      await loaded();
      typeRule('');
      fireEvent.click(saveButton());
      await waitFor(() =>
        expect(show).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Failed to update workflow assignment',
            message: 'Permission denied',
            color: 'red',
          }),
        ),
      );
      expect(onSaved).not.toHaveBeenCalled();
      expect(screen.getByTestId('workflow-assignment-detail-unsaved-badge')).toBeInTheDocument();
    });

    it('an update that fails without a sentence uses the dictionary\'s', async () => {
      mocks.updateAssignment.mockRejectedValue('nope');
      renderDetail();
      await loaded();
      typeRule('');
      fireEvent.click(saveButton());
      await waitFor(() =>
        expect(show).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Failed to update workflow assignment', color: 'red' }),
        ),
      );
    });
  });

  describe('navigation is by callback', () => {
    // WF-04: Cancel was history.back(), which leaves the app on a directly opened form
    it('Cancel and the breadcrumb call onBack and never touch the browser history', async () => {
      const { onBack, container } = renderDetail();
      await loaded();

      fireEvent.click(screen.getByTestId('workflow-assignment-detail-cancel-btn'));
      expect(onBack).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByTestId('workflow-assignment-detail-breadcrumb-root'));
      expect(onBack).toHaveBeenCalledTimes(2);

      expect(historyBack).not.toHaveBeenCalled();
      expect(container.querySelector('a[href]')).toBeNull();
    });

    it('Cancel on a new form calls onBack too', async () => {
      const { onBack } = renderDetail({ id: 'new' });
      fireEvent.click(await screen.findByTestId('workflow-assignment-detail-cancel-btn'));
      expect(onBack).toHaveBeenCalledTimes(1);
      expect(historyBack).not.toHaveBeenCalled();
    });

    it('without onBack there is no Cancel button and the breadcrumb is text', async () => {
      render(
        <MantineProvider>
          <WorkflowAssignmentDetail id={mockAssignment.id} />
        </MantineProvider>,
      );
      await loaded();
      expect(screen.queryByTestId('workflow-assignment-detail-cancel-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-assignment-detail-breadcrumb-root')).not.toBeInTheDocument();
      expect(screen.getByText('Workflow Assignments')).toBeInTheDocument();
    });
  });

  describe('permission gates', () => {
    // WF-29, WF-30: the reference gated on 'daas_workflow_assignments', a name no backend knows
    it('checks permissions on the collection the API enforces', async () => {
      renderDetail();
      await loaded();
      expect(mocks.usePermissions).toHaveBeenCalledWith({ collections: ['daas_wf_assignment'] });
      expect(mocks.usePermissions).not.toHaveBeenCalledWith({ collections: ['daas_workflow_assignments'] });
    });

    it('the gated collection can be overridden', async () => {
      const canPerform = vi.fn(() => true);
      mocks.usePermissions.mockReturnValue({ canPerform, isAdmin: false, loading: false });
      renderDetail({ assignmentsCollection: 'my_assignments' });
      await loaded();
      expect(mocks.usePermissions).toHaveBeenCalledWith({ collections: ['my_assignments'] });
      expect(canPerform).toHaveBeenCalledWith('my_assignments', 'update');
    });

    // WF-30: a reader the API serves sees the assignment; it is read-only, not a redirect
    it('a reader gets the assignment read-only: Back, no Save, and no option requests', async () => {
      grant(['read']);
      const { onBack } = renderDetail();
      await loaded();

      expect(screen.queryByTestId('workflow-assignment-detail-save-btn')).not.toBeInTheDocument();
      expect(workflowInput()).toHaveAttribute('readonly');
      expect(collectionInput()).toHaveAttribute('readonly');
      expect(ruleInput()).toHaveAttribute('readonly');
      expect(collectionInput().value).toBe('articles');
      expect(mocks.fetchAllDefinitions).not.toHaveBeenCalled();
      expect(mocks.apiRequest).not.toHaveBeenCalled();

      // Leaving a read-only rule neither rewrites nor judges it
      fireEvent.blur(ruleInput());
      expect(ruleInput()).not.toHaveAttribute('aria-invalid', 'true');

      const back = screen.getByTestId('workflow-assignment-detail-cancel-btn');
      expect(back).toHaveTextContent('Back');
      fireEvent.click(back);
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('readOnly gives an administrator the same view', async () => {
      renderDetail({ readOnly: true });
      await loaded();
      expect(screen.queryByTestId('workflow-assignment-detail-save-btn')).not.toBeInTheDocument();
      expect(ruleInput()).toHaveAttribute('readonly');
    });

    it('a user who may not create gets the access-denied state for id="new"', async () => {
      grant(['read', 'update']);
      renderDetail({ id: 'new' });
      expect(await screen.findByTestId('workflow-assignment-detail-access-denied')).toHaveTextContent(
        'You do not have permission to view this.',
      );
      expect(screen.queryByTestId('workflow-assignment-detail-save-btn')).not.toBeInTheDocument();
    });

    it('create without update can create, and update without create can save', async () => {
      grant(['read', 'create']);
      const { unmount } = renderDetail({ id: 'new' });
      expect(await screen.findByTestId('workflow-assignment-detail-save-btn')).toHaveTextContent('Create Assignment');
      unmount();

      grant(['read', 'update']);
      renderDetail();
      await loaded();
      expect(saveButton()).toHaveTextContent('Save Changes');
    });

    it('stays optimistic while permissions load, and waits for them before asking for options', async () => {
      mocks.usePermissions.mockReturnValue({ canPerform: () => false, isAdmin: false, loading: true });
      renderDetail();
      await loaded();
      expect(saveButton()).toBeInTheDocument();
      expect(mocks.fetchAllDefinitions).not.toHaveBeenCalled();
    });
  });
});
