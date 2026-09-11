/**
 * ConditionsEditor — row identity across removal.
 *
 * Conditions carry no id of their own (plain FieldCondition objects), so
 * removing a row by index alone would misattribute a later row's name/value
 * to the wrong condition once indices shift. ConditionsEditor keeps a
 * parallel conditionKeysRef in lockstep with add/remove so each row's React
 * key stays stable — exercised here end-to-end via the rendered inputs.
 */
import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';
import { ConditionsEditor } from '../src/ConditionsEditor';
import type { Field, FieldCondition } from '@buildpad/types';

vi.mock('@buildpad/ui-collections', () => ({
  FilterPanel: () => <div data-testid="filter-panel-mock" />,
}));

const FIELDS: Field[] = [
  { collection: 'posts', field: 'status', type: 'string' },
];

function Harness({ initial }: { initial: FieldCondition[] }) {
  const [conditions, setConditions] = useState(initial);
  return (
    <MantineProvider>
      <ConditionsEditor fields={FIELDS} conditions={conditions} onChange={setConditions} />
    </MantineProvider>
  );
}

describe('ConditionsEditor — row key stability', () => {
  it('preserves each remaining row\'s name when a row above it is removed', () => {
    render(
      <Harness
        initial={[
          { name: 'first', rule: {}, hidden: false },
          { name: 'second', rule: {}, hidden: false },
          { name: 'third', rule: {}, hidden: false },
        ]}
      />,
    );

    const namesBefore = screen.getAllByLabelText('Name').map((el) => (el as HTMLInputElement).value);
    expect(namesBefore).toEqual(['first', 'second', 'third']);

    // Remove the first row — the remaining two must shift up as
    // "second" then "third", not be corrupted or duplicated.
    const removeButtons = screen.getAllByRole('button', { name: 'Remove condition' });
    fireEvent.click(removeButtons[0]);

    const namesAfter = screen.getAllByLabelText('Name').map((el) => (el as HTMLInputElement).value);
    expect(namesAfter).toEqual(['second', 'third']);
  });

  it('shows the empty state with no conditions and adds a new one via "Add condition"', () => {
    render(<Harness initial={[]} />);

    expect(screen.getByText(/No conditions\./)).toBeInTheDocument();
    expect(screen.queryAllByLabelText('Name')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Add condition' }));

    const names = screen.getAllByLabelText('Name').map((el) => (el as HTMLInputElement).value);
    expect(names).toEqual(['Condition 1']);
  });
});
