/**
 * InfoPanel unit tests: label/value rows and optional description callout.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect } from 'vitest';
import { InfoPanel } from '../src/InfoPanel';

function renderPanel(props: React.ComponentProps<typeof InfoPanel>) {
  return render(
    <MantineProvider>
      <InfoPanel {...props} />
    </MantineProvider>
  );
}

describe('InfoPanel', () => {
  it('renders the default title', () => {
    renderPanel({ items: [] });
    expect(screen.getByText('Information')).toBeInTheDocument();
  });

  it('renders a custom title', () => {
    renderPanel({ title: 'Role Information', items: [] });
    expect(screen.getByText('Role Information')).toBeInTheDocument();
  });

  it('renders every label/value row', () => {
    renderPanel({
      items: [
        { label: 'User ID', value: 'user-1' },
        { label: 'Policies', value: '2 policies' },
      ],
    });
    expect(screen.getByText('User ID')).toBeInTheDocument();
    expect(screen.getByText('user-1')).toBeInTheDocument();
    expect(screen.getByText('Policies')).toBeInTheDocument();
    expect(screen.getByText('2 policies')).toBeInTheDocument();
  });

  it('renders the description callout only when provided', () => {
    const { rerender } = render(
      <MantineProvider>
        <InfoPanel items={[]} />
      </MantineProvider>
    );
    expect(screen.queryByText('Extra context')).not.toBeInTheDocument();

    rerender(
      <MantineProvider>
        <InfoPanel items={[]} description="Extra context" />
      </MantineProvider>
    );
    expect(screen.getByText('Extra context')).toBeInTheDocument();
  });
});
