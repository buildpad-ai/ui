/**
 * NewFolderDialog unit tests: the create/rename dialog submits a trimmed name,
 * by its button or by Enter, and once per save.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';
import { NewFolderDialog } from '../src/NewFolderDialog';

function ui(props: Partial<React.ComponentProps<typeof NewFolderDialog>> = {}) {
  return (
    <MantineProvider>
      <NewFolderDialog opened onSubmit={vi.fn()} onClose={vi.fn()} {...props} />
    </MantineProvider>
  );
}

const nameInput = () => screen.getByTestId('new-folder-name') as HTMLInputElement;

describe('NewFolderDialog', () => {
  it('submits the trimmed name by its button and by Enter, and nothing for a blank name', () => {
    const onSubmit = vi.fn();
    render(ui({ onSubmit }));
    expect(screen.getByTestId('new-folder-submit')).toBeDisabled();
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(nameInput(), { target: { value: '  Campaigns ' } });
    fireEvent.click(screen.getByTestId('new-folder-submit'));
    expect(onSubmit).toHaveBeenLastCalledWith('Campaigns');
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('pre-fills the name when renaming, with the given title and button', () => {
    render(ui({ initialName: 'Marketing', title: 'Rename Folder', submitLabel: 'Rename' }));
    expect(nameInput().value).toBe('Marketing');
    expect(screen.getByText('Rename Folder')).toBeInTheDocument();
    expect(screen.getByTestId('new-folder-submit')).toHaveTextContent('Rename');
  });

  // The button is disabled while the save is out; Enter was not
  it('Enter pressed again while the save is in flight does not submit a second time', () => {
    const onSubmit = vi.fn();
    const view = render(ui({ onSubmit }));
    fireEvent.change(nameInput(), { target: { value: 'Campaigns' } });
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // The host is saving now
    view.rerender(ui({ onSubmit, loading: true }));
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('new-folder-submit')).toBeDisabled();
  });
});
