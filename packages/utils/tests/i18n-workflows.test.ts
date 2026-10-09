/**
 * `workflows` namespace tests. Key and placeholder parity with the Indonesian
 * catalog is covered for every namespace in i18n.test.ts; these pin what is
 * particular to this one: the wording taken from the reference admin UI, the
 * strings that carry inline tags or JSON samples, and the counts.
 */
import { describe, it, expect } from 'vitest';
import { defaultTranslations, formatCount, hasPlaceholders, id, interpolate } from '../src/i18n';
import { workflowsDefaults, workflowsId } from '../src/i18n/namespaces/workflows';
import { findWorkflowStateProblem } from '../src/workflow';

/** Every string of a catalog, by dotted path. Plural forms count as strings. */
function strings(value: unknown, path = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[path, value]];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => strings(child, path ? `${path}.${key}` : key));
  }
  return [];
}

/** The inline tags of a rich-text string, in order: ['<strong>', '</strong>']. */
function tags(text: string): string[] {
  return text.match(/<\/?[a-z]+>/g) ?? [];
}

describe('workflows namespace', () => {
  it('is part of the defaults and of the Indonesian catalog', () => {
    expect(defaultTranslations.workflows).toBe(workflowsDefaults);
    expect(id.workflows).toBe(workflowsId);
  });

  it('has no empty string in either catalog', () => {
    for (const catalog of [workflowsDefaults, workflowsId]) {
      expect(strings(catalog).filter(([, text]) => !text.trim())).toEqual([]);
    }
  });

  it('keeps the wording of the reference pages', () => {
    const t = workflowsDefaults;
    expect(t.workflowsManager.title).toBe('Workflow Definitions');
    expect(t.workflowsManager.searchPlaceholder).toBe('Search workflows by name or description...');
    expect(t.workflowsManager.emptyState.title).toBe('No workflow definitions found');
    expect(t.workflowDetail.notifications.created).toBe('Workflow created successfully');
    expect(t.workflowDetail.validation.noStates).toBe('Please add at least one state to the workflow');
    expect(t.stateModal.fields.endStateDescription).toBe('End states cannot have outgoing commands');
    // The refusal the description promises; same sentence as findWorkflowStateProblem's
    expect(t.stateModal.validation.endStateHasCommands).toBe(
      findWorkflowStateProblem({ name: 'Done', siblingNames: [], isEndState: true, commandCount: 1 })?.error,
    );
    expect(t.commandModal.validation.duplicateName).toBe('A command with this name already exists in this state');
    expect(t.assignmentsManager.emptyState.pristine).toBe(
      'No workflow assignments found. Create your first assignment to link a workflow with a collection.',
    );
    expect(t.assignmentDetail.validation.filterRuleInvalidJson).toBe('Filter Rule must be valid JSON');
    expect(t.instancesManager.searchPlaceholder).toBe('Search by collection, state, or item ID...');
    expect(t.instanceDetail.history.emptyState).toBe(
      'No transitions recorded yet. This instance is in its initial state.',
    );
  });

  it('does not tell the user that a click edits a state', () => {
    // A click on a state selects it; the state's menu edits it.
    expect(workflowsDefaults.workflowDetail.diagramHint).not.toMatch(/• Click to edit$/);
    expect(workflowsDefaults.workflowDetail.diagramHint).toContain('Drag states to reposition');
    expect(workflowsDefaults.workflowDetail.diagramHint).toMatch(/menu/i);
  });

  it('counts in both languages', () => {
    const { count } = workflowsDefaults;
    expect(formatCount('en', 1, count.workflows)).toBe('1 workflow');
    expect(formatCount('en', 0, count.workflows)).toBe('0 workflows');
    expect(formatCount('en', 26, count.workflows)).toBe('26 workflows');
    expect(formatCount('en', 1, count.assignments)).toBe('1 assignment');
    expect(formatCount('en', 2, count.instances)).toBe('2 instances');
    expect(formatCount('en', 1, count.transitions)).toBe('1 transition');
    expect(formatCount('en', 3, count.transitions)).toBe('3 transitions');
    expect(formatCount('id', 1, workflowsId.count.workflows)).toBe('1 alur kerja');
    expect(formatCount('id', 3, workflowsId.count.transitions)).toBe('3 transisi');
  });

  it("the footer's noun follows the total: one workflow, many workflows", () => {
    type List = 'workflowsManager' | 'assignmentsManager' | 'instancesManager';
    /** The footer line, as WorkflowListFooter composes it. */
    const showing = (locale: string, catalog: typeof workflowsDefaults, list: List, shown: number, totalCount: number) =>
      interpolate(catalog.listFooter.showing, {
        shown,
        totalCount,
        itemsLabel: formatCount(locale, totalCount, catalog[list].itemsLabel),
      });

    expect(showing('en', workflowsDefaults, 'workflowsManager', 1, 1)).toBe('Showing 1 of 1 workflow');
    expect(showing('en', workflowsDefaults, 'assignmentsManager', 1, 1)).toBe('Showing 1 of 1 assignment');
    expect(showing('en', workflowsDefaults, 'instancesManager', 1, 1)).toBe('Showing 1 of 1 instance');
    // The noun is the total's, not the shown rows': one row of 26 is still "workflows"
    expect(showing('en', workflowsDefaults, 'workflowsManager', 1, 26)).toBe('Showing 1 of 26 workflows');
    expect(showing('en', workflowsDefaults, 'assignmentsManager', 2, 2)).toBe('Showing 2 of 2 assignments');
    expect(showing('en', workflowsDefaults, 'instancesManager', 50, 120)).toBe('Showing 50 of 120 instances');
    // Indonesian nouns have one form for every number
    expect(workflowsId.workflowsManager.itemsLabel).toEqual({ other: 'alur kerja' });
    expect(workflowsId.assignmentsManager.itemsLabel).toEqual({ other: 'penugasan' });
    expect(workflowsId.instancesManager.itemsLabel).toEqual({ other: 'instans' });
    expect(showing('id', workflowsId, 'workflowsManager', 1, 1)).toBe('Menampilkan 1 dari 1 alur kerja');
    expect(showing('id', workflowsId, 'instancesManager', 50, 120)).toBe('Menampilkan 50 dari 120 instans');
    // A noun, not a count: it carries no {count} of its own
    for (const list of ['workflowsManager', 'assignmentsManager', 'instancesManager'] as const) {
      expect(Object.values(workflowsDefaults[list].itemsLabel).some((form) => hasPlaceholders(form))).toBe(false);
    }
  });

  it('fills the placeholders of its templates', () => {
    const t = workflowsDefaults;
    expect(
      interpolate(t.listFooter.showing, {
        shown: 25,
        totalCount: 26,
        itemsLabel: formatCount('en', 26, t.workflowsManager.itemsLabel),
      }),
    ).toBe('Showing 25 of 26 workflows');
    expect(interpolate(t.commandModal.tabs.actions, { count: 2 })).toBe('Actions (2)');
    expect(interpolate(t.commandModal.tabs.policies, { count: 0 })).toBe('Policies (0)');
    expect(interpolate(t.commandModal.general.endStateOption, { name: 'Published' })).toBe('Published (End State)');
    expect(interpolate(t.commandModal.actions.fallbackName, { number: 1 })).toBe('Action 1');
    expect(interpolate(t.commandModal.validation.invalidJson, { reason: 'Unexpected end of JSON input' })).toBe(
      'Invalid JSON: Unexpected end of JSON input',
    );
    expect(interpolate(t.workflowDetail.statesOverview.commandCount, { count: 3 })).toBe('3 cmd');
    expect(interpolate(t.workflowsManager.emptyState.loadError, { error: 'Permission denied' })).toBe(
      'Failed to load workflow definitions — Permission denied',
    );
  });

  it('carries the same inline tags in both catalogs', () => {
    const rich = strings(workflowsDefaults).filter(([, text]) => tags(text).length > 0);
    expect(rich.map(([path]) => path).sort()).toEqual([
      'assignmentsManager.deleteModal.description',
      'commandModal.actions.promotionBody',
      'commandModal.general.route',
    ]);

    const translated = new Map(strings(workflowsId));
    for (const [path, text] of rich) {
      expect(tags(translated.get(path) ?? ''), path).toEqual(tags(text));
    }
  });

  it('keeps its JSON samples valid and free of placeholders', () => {
    for (const catalog of [workflowsDefaults, workflowsId]) {
      const filterRule = catalog.assignmentDetail.fields.filterRulePlaceholder;
      expect(JSON.parse(filterRule)).toEqual({ status: { _eq: 'draft' } });
      expect(hasPlaceholders(filterRule)).toBe(false);

      const parameters = catalog.commandModal.actions.parametersPlaceholder;
      const sample = parameters.slice(parameters.indexOf('{'));
      expect(Object.keys(JSON.parse(sample))).toEqual(['subject', 'message']);
      expect(hasPlaceholders(parameters)).toBe(false);
    }
  });
});
