/**
 * The package's private chrome: the delete confirmation, the list footer, the
 * empty state, the page state, the row menu, the search box and rich text.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Badge, MantineProvider } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';
import { WorkflowDeleteConfirmModal } from '../src/WorkflowDeleteConfirmModal';
import { WorkflowListEmptyState } from '../src/WorkflowListEmptyState';
import { WorkflowListFooter } from '../src/WorkflowListFooter';
import { WorkflowPageState } from '../src/WorkflowPageState';
import { WorkflowRichText } from '../src/WorkflowRichText';
import { WorkflowRowActionsMenu } from '../src/WorkflowRowActionsMenu';
import { WorkflowSearchInput } from '../src/WorkflowSearchInput';

const ui = (node: React.ReactNode) => render(<MantineProvider>{node}</MantineProvider>);

describe('WorkflowDeleteConfirmModal', () => {
  const props = { opened: true, onClose: vi.fn(), onConfirm: vi.fn(), description: 'Delete this workflow?' };

  it('shows its description under the default title, and confirms', () => {
    const onConfirm = vi.fn();
    ui(<WorkflowDeleteConfirmModal {...props} onConfirm={onConfirm} />);
    expect(screen.getByText('Confirm delete')).toBeInTheDocument();
    expect(screen.getByText('Delete this workflow?')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('workflow-delete-confirm-btn'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('takes a title and a confirm label', () => {
    ui(<WorkflowDeleteConfirmModal {...props} title="Delete workflow" confirmLabel="Remove" />);
    expect(screen.getByText('Delete workflow')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-delete-confirm-btn')).toHaveTextContent('Remove');
  });

  it('Cancel closes', () => {
    const onClose = vi.fn();
    ui(<WorkflowDeleteConfirmModal {...props} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('while loading, takes no click on either button and cannot be dismissed', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    ui(<WorkflowDeleteConfirmModal {...props} onClose={onClose} onConfirm={onConfirm} loading />);
    const confirm = screen.getByTestId('workflow-delete-confirm-btn');
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute('data-loading', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    // No close button to press either
    expect(screen.getByRole('dialog').querySelector('.mantine-Modal-close')).toBeNull();
  });

  it('renders no dialog while closed', () => {
    ui(<WorkflowDeleteConfirmModal {...props} opened={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('WorkflowListFooter', () => {
  const props = {
    shown: 25,
    totalCount: 26,
    itemsLabel: { one: 'workflow', other: 'workflows' },
    page: 1,
    totalPages: 2,
    onPageChange: vi.fn(),
    limit: 25,
    sizeOptions: [10, 25, 50],
    onLimitChange: vi.fn(),
  };

  it('says how many rows are shown and offers the pager for more than one page', () => {
    const onPageChange = vi.fn();
    ui(<WorkflowListFooter {...props} onPageChange={onPageChange} />);
    expect(screen.getByText('Showing 25 of 26 workflows')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('draws no pager for a single page', () => {
    ui(<WorkflowListFooter {...props} shown={3} totalCount={3} totalPages={1} />);
    expect(screen.getByText('Showing 3 of 3 workflows')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
  });

  it('names one row in the singular: the noun follows the total', () => {
    ui(<WorkflowListFooter {...props} shown={1} totalCount={1} totalPages={1} />);
    expect(screen.getByText('Showing 1 of 1 workflow')).toBeInTheDocument();
    expect(screen.queryByText('Showing 1 of 1 workflows')).not.toBeInTheDocument();
  });

  it('keeps the plural for the one row of a last page', () => {
    ui(<WorkflowListFooter {...props} shown={1} totalCount={26} page={2} />);
    expect(screen.getByText('Showing 1 of 26 workflows')).toBeInTheDocument();
  });

  it('uses the one form a noun has in a language without plurals', () => {
    ui(<WorkflowListFooter {...props} shown={1} totalCount={1} totalPages={1} itemsLabel={{ other: 'alur kerja' }} />);
    expect(screen.getByText('Showing 1 of 1 alur kerja')).toBeInTheDocument();
  });

  // A host dictionary written when the entry was one string
  it('shows a noun given as one string as it is', () => {
    ui(<WorkflowListFooter {...props} shown={1} totalCount={1} totalPages={1} itemsLabel="flows" />);
    expect(screen.getByText('Showing 1 of 1 flows')).toBeInTheDocument();
  });

  it('draws nothing for an empty list', () => {
    const { container } = ui(<WorkflowListFooter {...props} shown={0} totalCount={0} totalPages={1} />);
    expect(container.querySelector('.mantine-Group-root')).toBeNull();
  });

  it('changes the page size', async () => {
    const onLimitChange = vi.fn();
    ui(<WorkflowListFooter {...props} onLimitChange={onLimitChange} data-testid="size" />);
    fireEvent.click(screen.getByTestId('size'));
    fireEvent.click(await screen.findByRole('option', { name: '50 / page', hidden: true }));
    expect(onLimitChange).toHaveBeenCalledWith(50);
  });
});

describe('WorkflowListEmptyState', () => {
  it('shows a title and a hint', () => {
    ui(<WorkflowListEmptyState title="Nothing here" hint="Add one" data-testid="empty" />);
    expect(screen.getByTestId('empty')).toHaveTextContent('Nothing here');
    expect(screen.getByTestId('empty')).toHaveTextContent('Add one');
    expect(screen.getByTestId('empty')).not.toHaveAttribute('role');
  });

  it('announces the error variant', () => {
    ui(<WorkflowListEmptyState error title="Failed to load" data-testid="empty" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load');
  });
});

describe('WorkflowPageState', () => {
  it('shows the title and the description, with no buttons unless asked', () => {
    ui(<WorkflowPageState variant="notFound" title="Not found" description="It may be gone" data-testid="state" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Not found');
    expect(screen.getByRole('alert')).toHaveTextContent('It may be gone');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers Back and Retry when given the callbacks', () => {
    const onBack = vi.fn();
    const onRetry = vi.fn();
    ui(<WorkflowPageState variant="error" title="Failed" onBack={onBack} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('draws each variant', () => {
    const { unmount } = ui(<WorkflowPageState variant="accessDenied" title="Access denied" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Access denied');
    unmount();
  });
});

describe('WorkflowRowActionsMenu', () => {
  it('renders nothing when the user may do neither', () => {
    ui(<WorkflowRowActionsMenu />);
    expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
  });

  it('offers what it was given, without letting the click reach the row', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onRow = vi.fn();
    ui(
      <div onClick={onRow}>
        <WorkflowRowActionsMenu onEdit={onEdit} onDelete={onDelete} />
      </div>,
    );
    fireEvent.click(screen.getByLabelText('Row actions'));
    fireEvent.click(await screen.findByText('Edit'));
    expect(onEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Row actions'));
    fireEvent.click(await screen.findByText('Delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onRow).not.toHaveBeenCalled();
  });
});

describe('WorkflowSearchInput', () => {
  it('reports typing and clears with its affordance', () => {
    const onChange = vi.fn();
    ui(<WorkflowSearchInput value="abc" onChange={onChange} data-testid="search" />);
    fireEvent.change(screen.getByTestId('search'), { target: { value: 'abcd' } });
    expect(onChange).toHaveBeenCalledWith('abcd');
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('has no clear affordance while empty, and falls back to the common placeholder', () => {
    ui(<WorkflowSearchInput value="" onChange={vi.fn()} />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });
});

describe('WorkflowRichText', () => {
  it('draws each tag with its renderer and fills the placeholders', () => {
    const { container } = ui(
      <p>
        <WorkflowRichText
          template="From: <from>{from}</from> → To: <to>{to}</to>"
          values={{ from: 'Draft', to: 'Review' }}
          tags={{ from: (text) => <Badge>{text}</Badge>, to: (text) => <strong>{text}</strong> }}
        />
      </p>,
    );
    expect(container.querySelector('p')).toHaveTextContent('From: Draft → To: Review');
    expect(container.querySelector('strong')).toHaveTextContent('Review');
    expect(container.querySelector('.mantine-Badge-root')).toHaveTextContent('Draft');
  });

  it('draws a tag without a renderer as plain text', () => {
    const { container } = ui(
      <p>
        <WorkflowRichText template="Use <code>x.y</code> now" />
      </p>,
    );
    expect(container.querySelector('p')).toHaveTextContent('Use x.y now');
    expect(container.querySelector('code')).toBeNull();
  });

  it('never reads a value as markup', () => {
    const { container } = ui(
      <p>
        <WorkflowRichText
          template="Delete <strong>{name}</strong>?"
          values={{ name: '<img src=x onerror=alert(1)>' }}
          tags={{ strong: (text) => <strong>{text}</strong> }}
        />
      </p>,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('strong')).toHaveTextContent('<img src=x onerror=alert(1)>');
  });
});
