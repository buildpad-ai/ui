/**
 * Keyboard and screen-reader behaviour of the comments kit.
 *
 * Each case is something a keyboard or screen-reader user could not do, or could not know, before:
 * the emoji and reaction pickers were out of reach in a portal, focus fell to the page whenever the
 * control holding it disappeared, and several things that change on screen were never announced.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentsKit, type CommentsKitProps } from '../src/CommentsKit';
import { mockAdapter, type MockOptions } from '../src/_mockAdapter';
import { MAX_BODY, type Comment } from '../src/core/types';
import { renderWithMantine } from './helpers';

const ME = { id: 'me', name: 'Mira' };
const ANA = { id: 'ana', name: 'Ana' };

const c = (id: string, parent: string | null, body: string, at: number, by = ANA, extra: Partial<Comment> = {}): Comment => ({
  id,
  parent,
  root: null,
  author: by,
  body,
  photos: null,
  createdAt: new Date(Date.UTC(2026, 10, 5, 10, 0, at)).toISOString(),
  ...extra,
});

const seed = (): Comment[] => [c('a', null, 'first comment', 1), c('b', 'a', 'my reply', 2, ME), c('z', null, 'another thread', 3)];

function setup(options: Partial<MockOptions> = {}, props: Partial<CommentsKitProps> = {}, comments: Comment[] = seed()) {
  const adapter = mockAdapter({ me: ME, people: [ANA], comments, ...options });
  return renderWithMantine(<CommentsKit adapter={adapter} meId={ME.id} meName={ME.name} {...props} />);
}

const ready = () => screen.findByText('first comment');
const empty = () => screen.findByText('No comments yet. Start the conversation.');
const mainBox = () => screen.getAllByRole('textbox').at(-1)! as HTMLTextAreaElement;
/** Focus an element the way Tab would, then press keys on it. */
const press = async (element: HTMLElement, keys: string) => {
  act(() => element.focus());
  await userEvent.keyboard(keys);
};
const file = (name = 'a.png', type = 'image/png') => new File([new Uint8Array(10)], name, { type });
const fileInput = () => screen.getByTestId('bp-cm-file-input') as HTMLInputElement;

describe('structure', () => {
  it('titles the section with a heading, level 2 by default', async () => {
    setup();
    await ready();
    const heading = screen.getByRole('heading', { level: 2, name: 'Comments' });
    expect(screen.getByRole('region', { name: 'Comments' })).toContainElement(heading);
  });

  it('takes the heading level from the page it sits in', async () => {
    setup({}, { headingLevel: 4, title: 'Discussion' });
    expect(await screen.findByRole('heading', { level: 4, name: 'Discussion' })).toBeInTheDocument();
  });

  it('says it is loading, in a status', async () => {
    setup({ latency: 200 });
    expect(screen.getByText('Loading comments…').closest('[role="status"]')).not.toBeNull();
    await ready();
    expect(screen.queryByText('Loading comments…')).toBeNull();
  });
});

describe('the emoji picker', () => {
  const opener = () => screen.getByRole('button', { name: 'Add emoji' });
  const picker = () => screen.findByRole('dialog', { name: 'Choose an emoji' });

  // It renders in a portal at the end of the page: Tab from the button never reaches it.
  it('takes focus when opened from the keyboard, and gives it back on Esc', async () => {
    setup();
    await ready();
    await press(opener(), '{Enter}');
    const dialog = await picker();
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Choose an emoji' })).toBeNull());
    expect(opener()).toHaveFocus();
  });

  it('puts the emoji chosen from the keyboard at the caret, and focus back in the box', async () => {
    setup();
    await ready();
    const box = mainBox();
    await userEvent.type(box, 'nice');
    await press(opener(), '{Enter}');
    const dialog = await picker();
    await press(within(dialog).getByRole('button', { name: 'Insert 😀' }), '{Enter}');
    expect(box).toHaveValue('nice😀');
    expect(box).toHaveFocus();
  });

  it('leaves focus in the box when opened with the mouse', async () => {
    setup();
    await ready();
    const box = mainBox();
    await userEvent.click(box);
    await userEvent.click(opener());
    await picker();
    expect(box).toHaveFocus();
  });

  it('shows the open category as a pressed toggle, not as a tab', async () => {
    setup();
    await ready();
    await userEvent.click(opener());
    const dialog = await picker();
    expect(within(dialog).queryByRole('tab')).toBeNull();
    const other = within(dialog).getByRole('button', { name: 'Other' });
    expect(other).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(other);
    expect(other).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByRole('button', { name: 'Smileys' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('the reaction picker', () => {
  it('takes focus when it opens, and gives it back to "+" when it closes', async () => {
    setup({ react: true });
    await ready();
    const add = screen.getAllByRole('button', { name: 'Add reaction' })[0];
    await press(add, '{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Choose a reaction' });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Choose a reaction' })).toBeNull());
    await waitFor(() => expect(add).toHaveFocus());
  });
});

describe('focus never falls to the page', () => {
  it('stays in the box while a Ctrl+Enter send is saved', async () => {
    setup({ latency: 150 });
    await ready();
    const box = mainBox();
    await userEvent.type(box, 'hello');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    // Read-only, not disabled: disabling the focused field would drop focus.
    expect(box).toHaveAttribute('readonly');
    expect(box).toHaveFocus();
    await screen.findByText('hello', { selector: 'p' });
    expect(box).not.toHaveAttribute('readonly');
    expect(box).toHaveFocus();
  });

  // Send disables itself while saving, and a browser then drops its focus to the page. jsdom keeps it
  // on the disabled button (and ignores blur() on it), so start from focus on the page instead.
  it('comes back to the box when a send leaves focus on the page', async () => {
    setup({ latency: 80 });
    await ready();
    const box = mainBox();
    await userEvent.type(box, 'by button');
    act(() => box.blur());
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    await screen.findByText('by button', { selector: 'p' });
    await waitFor(() => expect(box).toHaveFocus());
  });

  it('moves into the delete confirmation, and back to Delete on Cancel', async () => {
    setup({ remove: true });
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this comment and its replies?' });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
  });

  it('lands on the heading once a deleted comment is gone', async () => {
    setup({ remove: true });
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('my reply')).toBeNull());
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Comments' })).toHaveFocus());
  });

  it('goes back to Edit when the editor closes', async () => {
    setup({ edit: true });
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getAllByRole('textbox')[0]).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
  });

  it('goes back to Reply when the reply box closes, and Reply says whether it is open', async () => {
    setup();
    await ready();
    const reply = screen.getAllByRole('button', { name: /^Reply to/ })[0];
    expect(reply).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(reply);
    expect(reply).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByPlaceholderText('Write a reply…')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByPlaceholderText('Write a reply…')).toBeNull();
    expect(reply).toHaveAttribute('aria-expanded', 'false');
    expect(reply).toHaveFocus();
  });

  // Opening a second reply box closes the first; the new box has focus and must keep it.
  it('does not pull focus back when another comment’s Reply opens a new box', async () => {
    setup();
    await ready();
    const [first, second] = screen.getAllByRole('button', { name: /^Reply to/ });
    await userEvent.click(first);
    await userEvent.click(second);
    expect(screen.getByPlaceholderText('Write a reply…')).toHaveFocus();
    expect(first).not.toHaveFocus();
  });
});

describe('announcements', () => {
  it('announces a refused picture as an alert', async () => {
    setup({}, {}, []);
    await empty();
    fireEvent.change(fileInput(), { target: { files: [file('a.pdf', 'application/pdf')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Use a PNG, JPEG, GIF or WebP picture');
  });

  it('does not announce the over-limit count, which changes on every keystroke', async () => {
    setup({}, {}, []);
    await empty();
    fireEvent.change(mainBox(), { target: { value: 'x'.repeat(MAX_BODY + 3) } });
    const count = await screen.findByText('3 characters too many');
    expect(count.closest('[role="alert"]')).toBeNull();
  });

  it('says a picture is uploading, in a status, until it is done', async () => {
    setup({ latency: 120 }, {}, []);
    await empty();
    fireEvent.change(fileInput(), { target: { files: [file()] } });
    expect(await screen.findByText('Uploading picture', { selector: '[role="status"]' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Uploading picture', { selector: '[role="status"]' })).toBeNull());
  });

  it('says which picture the viewer shows after paging', async () => {
    setup({}, {}, [c('p', null, 'screens', 1, ANA, { photos: ['f1', 'f2'] })]);
    await screen.findByText('screens');
    await userEvent.click(screen.getByRole('button', { name: 'Open picture 1 of 2' }));
    const viewer = await screen.findByRole('dialog', { name: 'Picture viewer' });
    const live = viewer.querySelector('[aria-live="polite"]')!;
    expect(live).toHaveTextContent('Picture 1');
    await userEvent.click(within(viewer).getByRole('button', { name: 'Next picture' }));
    expect(live).toHaveTextContent('Picture 2');
  });

  it('announces that a link was copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup({ link: (id) => `https://app.test/t/1?comment=${id}` });
    await ready();
    await userEvent.click(screen.getAllByRole('button', { name: 'Copy link' })[0]);
    expect(await screen.findByText('Link copied', { selector: '[role="status"]' })).toBeInTheDocument();
  });
});
