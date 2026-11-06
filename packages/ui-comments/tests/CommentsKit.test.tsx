import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentsKit, type CommentsKitProps } from '../src/CommentsKit';
import { mockAdapter, type MockOptions } from '../src/_mockAdapter';
import type { Comment } from '../src/core/types';
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

/** A thread four levels deep, plus a second top-level comment. */
const seed = (): Comment[] => [
  c('a', null, 'first comment', 1),
  c('b', 'a', 'level one', 2, ME),
  c('d', 'b', 'level two', 3),
  c('e', 'd', 'level three', 4),
  c('z', null, 'another thread', 5),
];

function setup(options: Partial<MockOptions> = {}, props: Partial<CommentsKitProps> = {}) {
  const adapter = mockAdapter({ me: ME, people: [ANA], comments: seed(), ...options });
  const view = renderWithMantine(<CommentsKit adapter={adapter} meId={ME.id} meName={ME.name} {...props} />);
  return { adapter, ...view };
}

const ready = () => screen.findByText('first comment');
const boxes = () => screen.getAllByRole('textbox');

describe('CommentsKit: reading', () => {
  it('shows the threads with replies at every depth, and a count', async () => {
    setup();
    await ready();
    for (const text of ['level one', 'level two', 'level three', 'another thread']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(screen.getByText('5 comments')).toBeInTheDocument();
    // Four levels means three nested lists under the first thread.
    const first = screen.getByText('first comment').closest('li')!;
    expect(first.querySelectorAll('ul.bp-cm-list')).toHaveLength(3);
  });

  it('shrinks the indent per level', async () => {
    setup();
    await ready();
    const indent = (text: string) => Number.parseInt(screen.getByText(text).closest('li')!.style.marginInlineStart, 10);
    expect(indent('first comment')).toBe(0);
    expect(indent('level one')).toBe(41);
    expect(indent('level two')).toBe(22);
    expect(indent('level three')).toBe(22);
  });

  it('says so when there are no comments, differently for a reader', async () => {
    setup({ comments: [] });
    expect(await screen.findByText('No comments yet. Start the conversation.')).toBeInTheDocument();
  });

  it('shows a read-only viewer the list and the chips, but no box, Reply or picker', async () => {
    setup({ comments: [c('a', null, 'first comment', 1, ANA, { reactions: [{ emoji: '👍', count: 1, mine: false, names: ['Ana'] }] })] }, { canComment: false });
    await ready();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reply/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add reaction' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: '👍 1' })).toBeInTheDocument();
  });

  it('tells a reader with nothing to read that there is nothing yet', async () => {
    setup({ comments: [] }, { canComment: false });
    expect(await screen.findByText('No comments yet.')).toBeInTheDocument();
  });

  it('marks new comments and highlights a linked one', async () => {
    setup({}, { newIds: ['z'], focusId: 'd' });
    await ready();
    expect(screen.getByText('another thread').closest('[data-comment-id]')).toHaveAttribute('data-new');
    expect(screen.getByText('level two').closest('[data-comment-id]')).toHaveAttribute('data-linked');
  });

  it('scrolls to a linked comment once', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    setup({}, { focusId: 'e' });
    await ready();
    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
    scroll.mockRestore();
  });

  it('reports a failed load without crashing', async () => {
    const onError = vi.fn();
    setup({ failOn: ['list'] }, { onError });
    expect(await screen.findByText("Couldn't load the comments.")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith('load', expect.any(Error));
  });

  it('never turns comment text into markup', async () => {
    setup({ comments: [c('a', null, '<b>raw</b> and **bold** and ++under++ and *it*', 1)] });
    expect(await screen.findByText(/<b>raw<\/b>/)).toBeInTheDocument();
    expect(document.querySelector('.bp-cm-body b')).toBeNull();
    expect(document.querySelector('.bp-cm-body strong')?.textContent).toBe('bold');
    expect(document.querySelector('.bp-cm-body u')?.textContent).toBe('under');
    expect(document.querySelector('.bp-cm-body em')?.textContent).toBe('it');
  });

  it('draws a bullet list', async () => {
    setup({ comments: [c('a', null, 'Todo:\n- one\n- two', 1)] });
    await screen.findByText('Todo:');
    expect(Array.from(document.querySelectorAll('.bp-cm-body li')).map((li) => li.textContent)).toEqual(['one', 'two']);
  });

  it('takes its words from the translations prop', async () => {
    setup({}, { translations: { title: 'Diskusi' } });
    await ready();
    expect(screen.getByRole('region', { name: 'Diskusi' })).toBeInTheDocument();
  });
});

describe('CommentsKit: writing', () => {
  it('posts a top-level comment and clears the box', async () => {
    const { adapter } = setup();
    await ready();
    const box = boxes().at(-1)!;
    await userEvent.type(box, 'hello there');
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));
    await screen.findByText('hello there', { selector: 'p' });
    expect(adapter.calls).toContain('add:top:hello there');
    expect(box).toHaveValue('');
  });

  it('sends with Ctrl+Enter', async () => {
    const { adapter } = setup();
    await ready();
    await userEvent.type(boxes().at(-1)!, 'quick{Control>}{Enter}{/Control}');
    await waitFor(() => expect(adapter.calls).toContain('add:top:quick'));
  });

  it('refuses an empty comment with a message and sends nothing', async () => {
    const { adapter } = setup();
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));
    expect(await screen.findByText('Write a comment')).toBeInTheDocument();
    expect(adapter.calls.filter((call) => call.startsWith('add'))).toEqual([]);
  });

  it('cannot send text over the limit', async () => {
    setup();
    await ready();
    const box = boxes().at(-1)!;
    await userEvent.click(box);
    await userEvent.paste('a'.repeat(20001));
    expect(await screen.findByText('1 character too many')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
  });

  it('replies to a reply three levels down and stamps the thread root', async () => {
    const { adapter } = setup();
    await ready();
    const deepest = screen.getByText('level three').closest('[data-comment-id]') as HTMLElement;
    await userEvent.click(within(deepest).getByRole('button', { name: 'Reply to Ana' }));
    const box = screen.getByPlaceholderText('Write a reply…');
    await userEvent.type(box, 'going deeper');
    await userEvent.click(screen.getByRole('button', { name: 'Reply' }));
    await screen.findByText('going deeper');
    expect(adapter.calls).toContain('add:e:going deeper');
    const listed = await adapter.list();
    const made = listed.find((x) => x.body === 'going deeper')!;
    expect(made.parent).toBe('e');
    // The mock stamps like the hook: the parent's root, or the parent itself when it is top-level.
    expect(made.root).toBe('e');
    expect(screen.queryByPlaceholderText('Write a reply…')).not.toBeInTheDocument();
  });

  it('opens one reply box at a time and closes it with Esc', async () => {
    setup();
    await ready();
    const buttons = screen.getAllByRole('button', { name: /^Reply to/ });
    await userEvent.click(buttons[0]);
    await userEvent.click(screen.getAllByRole('button', { name: /^Reply to/ })[1]);
    expect(screen.getAllByPlaceholderText('Write a reply…')).toHaveLength(1);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByPlaceholderText('Write a reply…')).not.toBeInTheDocument();
  });

  it('keeps the list on screen while a post is being saved and refetched', async () => {
    setup({ latency: 30 });
    await ready();
    await userEvent.type(boxes().at(-1)!, 'slow one');
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));
    // Sample until the new comment shows: the old ones must be there every single time.
    await waitFor(
      () => {
        expect(screen.getByText('first comment')).toBeInTheDocument();
        expect(screen.getByText('level three')).toBeInTheDocument();
        expect(screen.queryByRole('progressbar')).toBeNull();
        expect(screen.getByText('slow one', { selector: 'p' })).toBeInTheDocument();
      },
      { timeout: 4000 }
    );
  });

  it('keeps the text and shows an error when saving fails', async () => {
    const onError = vi.fn();
    const { adapter } = setup({ failOn: ['add'] }, { onError });
    await ready();
    const box = boxes().at(-1)!;
    await userEvent.type(box, 'do not lose me');
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));
    expect(await screen.findByText("Couldn't save the comment.")).toBeInTheDocument();
    expect(box).toHaveValue('do not lose me');
    expect(onError).toHaveBeenCalledWith('save', expect.any(Error));
    expect(adapter.listed).toBe(1);
  });
});

describe('CommentsKit: the box', () => {
  it('wraps the selection in bold', async () => {
    setup();
    await ready();
    const box = boxes().at(-1)! as HTMLTextAreaElement;
    await userEvent.type(box, 'say hi now');
    box.setSelectionRange(4, 6);
    await userEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(box).toHaveValue('say **hi** now');
  });

  it('turns lines into a list and continues it with Enter', async () => {
    setup();
    await ready();
    const box = boxes().at(-1)! as HTMLTextAreaElement;
    await userEvent.type(box, 'one');
    await userEvent.click(screen.getByRole('button', { name: 'Bulleted list' }));
    expect(box).toHaveValue('- one');
    await userEvent.type(box, '{Enter}two');
    expect(box).toHaveValue('- one\n- two');
  });

  it('inserts an emoji from the picker where the caret is', async () => {
    setup();
    await ready();
    const box = boxes().at(-1)! as HTMLTextAreaElement;
    await userEvent.type(box, 'great');
    await userEvent.click(screen.getByRole('button', { name: 'Add emoji' }));
    await userEvent.click(await screen.findByRole('tab', { name: 'Other' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Insert 🎉' }));
    expect(box).toHaveValue('great🎉');
  });
});

describe('CommentsKit: reactions', () => {
  it('adds a reaction at once, then the server confirms it', async () => {
    const { adapter } = setup({ latency: 20 });
    await ready();
    const first = screen.getByText('first comment').closest('[data-comment-id]') as HTMLElement;
    await userEvent.click(within(first).getByRole('button', { name: 'Add reaction' }));
    await userEvent.click(await screen.findByRole('button', { name: 'React with 🔥' }));
    // Optimistic: the chip is there before the adapter has answered.
    expect(within(first).getByRole('button', { name: '🔥 1, you reacted' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(adapter.calls).toContain('react:a:🔥:true'));
    await waitFor(() => expect(adapter.listed).toBeGreaterThan(1));
    expect(within(first).getByRole('button', { name: '🔥 1, you reacted' })).toBeInTheDocument();
  });

  it('takes a reaction back with a second click', async () => {
    const { adapter } = setup({
      comments: [c('a', null, 'first comment', 1, ANA, { reactions: [{ emoji: '👍', count: 1, mine: true, names: ['Mira'] }] })],
    });
    await ready();
    await userEvent.click(screen.getByRole('button', { name: '👍 1, you reacted' }));
    await waitFor(() => expect(adapter.calls).toContain('react:a:👍:false'));
    await waitFor(() => expect(screen.queryByRole('button', { name: /👍/ })).toBeNull());
  });

  it('puts the chips back and says so when the server refuses', async () => {
    const onError = vi.fn();
    setup({ failOn: ['react'], latency: 10 }, { onError });
    await ready();
    const first = screen.getByText('first comment').closest('[data-comment-id]') as HTMLElement;
    await userEvent.click(within(first).getByRole('button', { name: 'Add reaction' }));
    await userEvent.click(await screen.findByRole('button', { name: 'React with 🚀' }));
    expect(await screen.findByText("Couldn't save the reaction.")).toBeInTheDocument();
    expect(within(first).queryByRole('button', { name: /🚀/ })).toBeNull();
    expect(onError).toHaveBeenCalledWith('react', expect.any(Error));
  });

  it('shows read-only chips when the adapter cannot react', async () => {
    setup({ react: false, comments: [c('a', null, 'first comment', 1, ANA, { reactions: [{ emoji: '🎉', count: 2, mine: false, names: ['Ana', 'Budi'] }] })] });
    await ready();
    expect(screen.getByRole('img', { name: '🎉 2' })).toHaveAttribute('title', 'Ana, Budi');
    expect(screen.queryByRole('button', { name: 'Add reaction' })).toBeNull();
  });

  it('cuts the names in a tooltip after three', async () => {
    const names = ['A', 'B', 'C', 'D', 'E'];
    setup({ react: false, comments: [c('a', null, 'first comment', 1, ANA, { reactions: [{ emoji: '🎉', count: 5, mine: false, names }] })] });
    await ready();
    expect(screen.getByRole('img', { name: '🎉 5' })).toHaveAttribute('title', 'A, B, C and 2 more');
  });
});

describe('CommentsKit: edit, delete, resolve, link', () => {
  it('has no Edit, Delete or Resolve when the adapter has none: comments are immutable', async () => {
    setup();
    await ready();
    for (const name of ['Edit', 'Delete', 'Resolve', 'Copy link']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });

  it('lets people edit only their own comment', async () => {
    const { adapter } = setup({ edit: true });
    await ready();
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const box = screen.getByDisplayValue('level one');
    await userEvent.clear(box);
    await userEvent.type(box, 'level one, fixed');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('level one, fixed');
    expect(adapter.calls).toContain('edit:b');
  });

  it('closes the editor without a call when nothing changed', async () => {
    const { adapter } = setup({ edit: true });
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByDisplayValue('level one')).toBeNull();
    expect(adapter.calls.some((call) => call.startsWith('edit'))).toBe(false);
  });

  it('asks before deleting and takes the replies with it', async () => {
    const { adapter } = setup({ remove: true });
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete this comment and its replies?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(adapter.calls.some((call) => call.startsWith('remove'))).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('level one')).toBeNull());
    // Level one answered 'a'; its replies d and e went with it.
    expect(screen.queryByText('level three')).toBeNull();
    expect(screen.getByText('first comment')).toBeInTheDocument();
  });

  it('lets a moderator delete anyone’s comment', async () => {
    setup({ remove: true }, { canModerate: true });
    await ready();
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(5);
  });

  it('resolves and reopens a thread, on the top comment only', async () => {
    const { adapter } = setup({ resolve: true }, { canModerate: true });
    await ready();
    expect(screen.getAllByRole('button', { name: 'Resolve' })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: 'Resolve' })[0]);
    await screen.findByText('Resolved');
    expect(adapter.calls).toContain('resolve:a:true');
    await userEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    await waitFor(() => expect(screen.queryByText('Resolved')).toBeNull());
  });

  it('copies the link to a comment', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup({ link: (id) => `https://app.test/t/1?comment=${id}` });
    await ready();
    await userEvent.click(screen.getAllByRole('button', { name: 'Copy link' })[0]);
    expect(writeText).toHaveBeenCalledWith('https://app.test/t/1?comment=a');
    expect(await screen.findByRole('button', { name: 'Link copied' })).toBeInTheDocument();
  });

  it('reports a failed delete', async () => {
    setup({ remove: true, failOn: ['remove'] });
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText("Couldn't delete the comment.")).toBeInTheDocument();
    expect(screen.getByText('level one')).toBeInTheDocument();
  });
});
