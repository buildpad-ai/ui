import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Box, Code, Stack, Text } from '@mantine/core';
import type { Field, FieldCondition } from '@buildpad/types';
import { ConditionsEditor } from './ConditionsEditor';

/**
 * ConditionsEditor — standalone (no DaaS required).
 *
 * Authors the `FieldCondition[]` for one field. Each row reuses `FilterPanel`
 * to build a DaaS-compatible rule plus hidden/required/readonly overrides. The
 * live JSON below the editor is the exact shape `apply-conditions.ts` consumes.
 */

/** A small in-memory field schema for FilterPanel to build rules against. */
const sampleFields: Field[] = [
  {
    collection: 'issues',
    field: 'issue_type',
    type: 'string',
    meta: { id: 1, collection: 'issues', field: 'issue_type', width: 'full', readonly: false, hidden: false },
  },
  {
    collection: 'issues',
    field: 'severity',
    type: 'string',
    meta: { id: 2, collection: 'issues', field: 'severity', width: 'full', readonly: false, hidden: false },
  },
  {
    collection: 'issues',
    field: 'is_blocking',
    type: 'boolean',
    meta: { id: 3, collection: 'issues', field: 'is_blocking', width: 'half', readonly: false, hidden: false },
  },
];

const ConditionsEditorHarness: React.FC<{ initial: FieldCondition[] }> = ({
  initial,
}) => {
  const [conditions, setConditions] = useState<FieldCondition[]>(initial);
  return (
    <Box maw={640}>
      <Stack gap="md">
        <ConditionsEditor
          fields={sampleFields}
          conditions={conditions}
          onChange={setConditions}
        />
        <div>
          <Text size="xs" fw={500} mb={4}>
            Emitted FieldCondition[] (verbatim, consumed by apply-conditions)
          </Text>
          <Code block style={{ fontSize: 11 }}>
            {JSON.stringify(conditions, null, 2)}
          </Code>
        </div>
      </Stack>
    </Box>
  );
};

const meta: Meta<typeof ConditionsEditor> = {
  title: 'Forms/ConditionsEditor',
  component: ConditionsEditor,
};

export default meta;
type Story = StoryObj<typeof ConditionsEditor>;

/** No conditions yet — the field always renders with its default settings. */
export const Empty: Story = {
  render: () => <ConditionsEditorHarness initial={[]} />,
};

/** Pre-populated: show `severity` only when `issue_type` is `bug`. */
export const Populated: Story = {
  render: () => (
    <ConditionsEditorHarness
      initial={[
        {
          name: 'Hide unless bug',
          rule: { issue_type: { _eq: 'bug' } },
          hidden: true,
        },
        {
          name: 'Require when blocking',
          rule: { is_blocking: { _eq: true } },
          required: true,
        },
      ]}
    />
  ),
};
