/**
 * FormFieldInterface — the record's key reaches the leaf as `primaryKey`.
 *
 * Contract coverage: `primaryKey` (with `collection`) is the only name the
 * container passes the record's key by. Leaves that need the record read it
 * under that name — the relational lists, Files, SystemPermissions and, since
 * it stopped reading `itemId` alone, WorkflowButton. Inside a form that button
 * used to get no id at all, so an existing item showed no workflow state and
 * no transitions.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

jest.mock('@buildpad/ui-interfaces', () => require('./helpers/leafProbe').makeInterfacesMock());

import { resetProbe, lastProps } from './helpers/leafProbe';
import { FormFieldInterface } from '../components/FormFieldInterface';

const wrap = (ui: React.ReactNode) => <MantineProvider>{ui}</MantineProvider>;

const workflowField = {
    collection: 'articles',
    field: 'status',
    name: 'Status',
    type: 'string',
    meta: { interface: 'workflow-button' },
    schema: {},
} as any;

beforeEach(() => {
    resetProbe();
});

describe('FormFieldInterface primaryKey propagation', () => {
    it("hands the workflow-button leaf an existing item's key and collection", () => {
        render(wrap(<FormFieldInterface field={workflowField} value="Draft" primaryKey={42} />));

        expect(lastProps()).toMatchObject({ primaryKey: 42, collection: 'articles' });
    });

    it("passes the '+' of a create form through unchanged", () => {
        render(wrap(<FormFieldInterface field={workflowField} value={null} primaryKey="+" />));

        expect(lastProps()?.primaryKey).toBe('+');
    });
});
