/**
 * The package's private chrome: the delete confirmation, the list footer, the
 * empty state, the page state, the row menu, the search box, rich text and
 * the built-in code editor.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';
import { CronCodeEditor } from '../src/CronCodeEditor';
import { CronDeleteConfirmModal } from '../src/CronDeleteConfirmModal';
import { CronListEmptyState } from '../src/CronListEmptyState';
import { CronListFooter } from '../src/CronListFooter';
import { CronPageState } from '../src/CronPageState';
import { CronRichText } from '../src/CronRichText';
import { CronRowActionsMenu } from '../src/CronRowActionsMenu';
import { CronSearchInput } from '../src/CronSearchInput';

const ui = (node: React.ReactNode) => render(<MantineProvider>{node}</MantineProvider>);

describe('CronDeleteConfirmModal', () => {
  const props = { opened: true, onClose: vi.fn(), onConfirm: vi.fn(), description: 'Delete this job?' };

  it('shows its description under the default title, and confirms', () => {
    const onConfirm = vi.fn();
    ui(<CronDeleteConfirmModal {...props} onConfirm={onConfirm} />);
    expect(screen.getByText('Confirm delete')).toBeInTheDocument();
    expect(screen.getByText('Delete this job?')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cron-delete-confirm-btn'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('takes a title and a confirm label', () => {
    ui(<CronDeleteConfirmModal {...props} title="Delete cron job" confirmLabel="Remove" />);
    expect(screen.getByText('Delete cron job')).toBeInTheDocument();
    expect(screen.getByTestId('cron-delete-confirm-btn')).toHaveTextContent('Remove');
  });

  it('Cancel closes', () => {
    const onClose = vi.fn();
    ui(<CronDeleteConfirmModal {...props} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('while loading, takes no click on either button and cannot be dismissed', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    ui(<CronDeleteConfirmModal {...props} onClose={onClose} onConfirm={onConfirm} loading />);
    const confirm = screen.getByTestId('cron-delete-confirm-btn');
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
    ui(<CronDeleteConfirmModal {...props} opened={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('CronListFooter', () => {
  const props = {
    shown: 25,
    totalCount: 26,
    itemsLabel: 'jobs',
    page: 1,
    totalPages: 2,
    onPageChange: vi.fn(),
    limit: 25,
    sizeOptions: [10, 25, 50],
    onLimitChange: vi.fn(),
  };

  it('says how many rows are shown and offers the pager for more than one page', () => {
    const onPageChange = vi.fn();
    ui(<CronListFooter {...props} onPageChange={onPageChange} />);
    expect(screen.getByText('Showing 25 of 26 jobs')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('has no pager for a single page, but keeps the count and the page size', () => {
    ui(<CronListFooter {...props} shown={3} totalCount={3} totalPages={1} data-testid="size" />);
    expect(screen.getByText('Showing 3 of 3 jobs')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
    expect(screen.getByTestId('size')).toHaveValue('25 / page');
  });

  it('changes the page size', async () => {
    const onLimitChange = vi.fn();
    ui(<CronListFooter {...props} onLimitChange={onLimitChange} data-testid="size" />);
    fireEvent.click(screen.getByTestId('size'));
    // hidden: true — the dropdown stays display:none in jsdom (no transitions).
    fireEvent.click(await screen.findByRole('option', { name: '50 / page', hidden: true }));
    expect(onLimitChange).toHaveBeenCalledWith(50);
  });

  it('renders nothing for an empty list', () => {
    ui(<CronListFooter {...props} shown={0} totalCount={0} totalPages={1} data-testid="size" />);
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('size')).not.toBeInTheDocument();
  });

  it('reads its strings from the translations prop', () => {
    ui(
      <CronListFooter
        {...props}
        translations={{ listFooter: { showing: '{shown} dari {totalCount} {itemsLabel}' } }}
      />,
    );
    expect(screen.getByText('25 dari 26 jobs')).toBeInTheDocument();
  });
});

describe('CronListEmptyState', () => {
  it('shows a title and a hint', () => {
    ui(<CronListEmptyState title="No cron jobs yet." hint="Create one." data-testid="empty" />);
    const empty = screen.getByTestId('empty');
    expect(empty).toHaveTextContent('No cron jobs yet.');
    expect(empty).toHaveTextContent('Create one.');
    expect(empty).not.toHaveAttribute('role');
  });

  it('the error variant is an alert', () => {
    ui(<CronListEmptyState error title="Failed to load cron jobs — down" data-testid="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load cron jobs — down');
  });
});

describe('CronPageState', () => {
  it.each(['notFound', 'accessDenied', 'error'] as const)('draws the %s state as an alert', (variant) => {
    ui(<CronPageState variant={variant} title="Title" description="Why" data-testid="state" />);
    const state = screen.getByRole('alert');
    expect(state).toHaveTextContent('Title');
    expect(state).toHaveTextContent('Why');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers Back and Retry when given the handlers', () => {
    const onBack = vi.fn();
    const onRetry = vi.fn();
    ui(<CronPageState variant="error" title="Failed" onBack={onBack} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('CronRowActionsMenu', () => {
  const all = () => ({
    onEdit: vi.fn(),
    onRunNow: vi.fn(),
    onDeactivate: vi.fn(),
    onClone: vi.fn(),
    onDelete: vi.fn(),
  });

  it('offers the actions it is given, in order, and names its trigger after the job', async () => {
    const handlers = all();
    ui(<CronRowActionsMenu jobName="Nightly report" {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Nightly report' }));

    const items = await screen.findAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['Edit', 'Run Now', 'Deactivate', 'Clone', 'Delete']);
  });

  it.each([
    ['Edit', 'onEdit'],
    ['Run Now', 'onRunNow'],
    ['Deactivate', 'onDeactivate'],
    ['Clone', 'onClone'],
    ['Delete', 'onDelete'],
  ] as const)('%s calls its handler and not the row\'s click', async (label, handler) => {
    const handlers = all();
    const onRowClick = vi.fn();
    ui(
      <div onClick={onRowClick}>
        <CronRowActionsMenu {...handlers} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: label }));
    expect(handlers[handler]).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('offers Activate for an inactive job', async () => {
    const onActivate = vi.fn();
    ui(<CronRowActionsMenu onActivate={onActivate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Activate' }));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menuitem', { name: 'Deactivate' })).not.toBeInTheDocument();
  });

  it('Delete alone has no divider above it', async () => {
    ui(<CronRowActionsMenu onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    await screen.findByRole('menuitem', { name: 'Delete' });
    expect(document.querySelector('.mantine-Menu-divider')).toBeNull();
  });

  // CR-14: the reference drew a trigger that opened an empty menu for a reader
  it('CR-14: renders nothing at all when the user has no action', () => {
    const { container } = ui(<CronRowActionsMenu jobName="Nightly report" />);
    expect(container.querySelector('button')).toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('while an action is pending, the trigger is a loader that does not open', () => {
    ui(<CronRowActionsMenu {...all()} pending />);
    const trigger = screen.getByRole('button', { name: 'Row actions' });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('data-loading', 'true');
    fireEvent.click(trigger);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
});

describe('CronSearchInput', () => {
  it('reports what is typed and clears with the clear affordance', () => {
    const onChange = vi.fn();
    const { rerender } = ui(<CronSearchInput value="" onChange={onChange} data-testid="search" />);
    expect(screen.getByTestId('search')).toHaveAttribute('placeholder', 'Search...');
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('search'), { target: { value: 'night' } });
    expect(onChange).toHaveBeenCalledWith('night');

    rerender(
      <MantineProvider>
        <CronSearchInput value="night" onChange={onChange} placeholder="Search jobs" data-testid="search" />
      </MantineProvider>,
    );
    expect(screen.getByTestId('search')).toHaveAttribute('placeholder', 'Search jobs');
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});

describe('CronRichText', () => {
  it('draws each tag with its renderer and leaves the rest as text', () => {
    ui(
      <p data-testid="text">
        <CronRichText
          template="Use <code>context</code> and {what}, or <other>this</other>."
          values={{ what: '<b>console</b>' }}
          tags={{ code: (text) => <code>{text}</code> }}
        />
      </p>,
    );
    const text = screen.getByTestId('text');
    expect(text.querySelector('code')).toHaveTextContent('context');
    // A value is never read as markup, and a tag without a renderer is plain text
    expect(text).toHaveTextContent('Use context and <b>console</b>, or this.');
    expect(text.querySelector('b')).toBeNull();
  });

  it('draws a template without tags as it is', () => {
    ui(
      <p data-testid="text">
        <CronRichText template="Plain text" />
      </p>,
    );
    expect(screen.getByTestId('text')).toHaveTextContent('Plain text');
  });
});

describe('CronCodeEditor', () => {
  const props = {
    value: "console.log('hi');",
    onChange: vi.fn(),
    readOnly: false,
    minHeight: 440,
    placeholder: '// Your cron code here...',
    id: 'code',
    'aria-labelledby': 'code-label',
    'aria-describedby': 'code-description',
  };

  it('is a textarea named by the label it is given, holding the code', () => {
    ui(
      <>
        <span id="code-label">Job Code</span>
        <span id="code-description">JavaScript</span>
        <CronCodeEditor {...props} />
      </>,
    );
    const editor = screen.getByRole('textbox', { name: 'Job Code' });
    expect(editor.tagName).toBe('TEXTAREA');
    expect(editor).toHaveValue("console.log('hi');");
    expect(editor).toHaveAttribute('id', 'code');
    expect(editor).toHaveAttribute('aria-describedby', 'code-description');
    expect(editor).toHaveAttribute('placeholder', '// Your cron code here...');
  });

  it('reports an edit as a string, and an emptied editor as an empty string', () => {
    const onChange = vi.fn();
    ui(<CronCodeEditor {...props} onChange={onChange} />);
    const editor = screen.getByPlaceholderText('// Your cron code here...');

    fireEvent.change(editor, { target: { value: 'return 1;' } });
    expect(onChange).toHaveBeenLastCalledWith('return 1;');
    // InputCode emits null here; the form holds ''
    fireEvent.change(editor, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('takes no edit while read-only', () => {
    const onChange = vi.fn();
    ui(<CronCodeEditor {...props} onChange={onChange} readOnly />);
    const editor = screen.getByPlaceholderText('// Your cron code here...');
    expect(editor).toHaveAttribute('readonly');
    fireEvent.change(editor, { target: { value: 'changed' } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
