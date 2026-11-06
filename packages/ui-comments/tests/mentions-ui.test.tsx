import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentsKit } from '../src/CommentsKit';
import { itemsAdapter, usersSearch } from '../src/CommentsAdapter';
import { mockAdapter, type MockOptions } from '../src/_mockAdapter';
import { makeToken } from '../src/core/mentions';
import type { Comment } from '../src/core/types';
import { renderWithMantine } from './helpers';

const ME = { id: '99999999-9999-4999-8999-999999999999', name: 'Mira' };
const ANA = { id: '11111111-1111-4111-8111-111111111111', name: 'Ana Putri' };
const ANI = { id: '22222222-2222-4222-8222-222222222222', name: 'Ani Wijaya' };
const BUDI = { id: '33333333-3333-4333-8333-333333333333', name: 'Budi' };

const setup = (options: Partial<MockOptions> = {}, comments: Comment[] = []) => {
  const adapter = mockAdapter({ me: ME, people: [ANA, ANI, BUDI], comments, ...options });
  renderWithMantine(<CommentsKit adapter={adapter} meId={ME.id} meName={ME.name} />);
  return adapter;
};

const box = () => screen.getAllByRole('textbox').at(-1)! as HTMLTextAreaElement;
const waitList = () => screen.findByRole('listbox', { name: 'People you can mention' });

describe('the @ picker', () => {
  it('opens on @, lists matching people and inserts the chosen one', async () => {
    const adapter = setup();
    await screen.findByText('No comments yet. Start the conversation.');
    await userEvent.type(box(), 'hi @an');
    await waitList();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Ana Putri', 'Ani Wijaya']);
    await userEvent.click(screen.getByRole('option', { name: /Ani Wijaya/ }));
    expect(box()).toHaveValue('hi @Ani Wijaya ');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(adapter.calls).toContain('people:an');
  });

  it('stores the pick as a token and shows it as a chip', async () => {
    const adapter = setup();
    await screen.findByText('No comments yet. Start the conversation.');
    await userEvent.type(box(), '@bud');
    await waitList();
    await userEvent.keyboard('{Enter}');
    await userEvent.type(box(), 'please look');
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));
    await waitFor(() => expect(adapter.calls.some((c) => c.startsWith('add:top:'))).toBe(true));
    const sent = adapter.calls.find((c) => c.startsWith('add:top:'))!.slice('add:top:'.length);
    expect(sent).toBe(`${makeToken('Budi', BUDI.id)} please look`);
    const chip = await screen.findByText('@Budi');
    expect(chip).toHaveClass('bp-cm-mention');
    expect(chip).toHaveAttribute('data-user-id', BUDI.id);
  });

  it('moves with the arrow keys (wrapping) and chooses with Tab', async () => {
    setup();
    await screen.findByText('No comments yet. Start the conversation.');
    await userEvent.type(box(), '@an');
    await waitList();
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}{Tab}');
    expect(box()).toHaveValue('@Ani Wijaya ');
  });

  it('closes the list with the first Esc and cancels with the second', async () => {
    renderWithMantine(<div />);
    const adapter = mockAdapter({
      me: ME,
      people: [ANA],
      comments: [{ id: 'a', parent: null, root: null, author: ANA, body: 'first', photos: null, createdAt: '2026-11-05T10:00:00Z' }],
    });
    renderWithMantine(<CommentsKit adapter={adapter} meId={ME.id} meName={ME.name} />);
    await screen.findByText('first');
    await userEvent.click(screen.getByRole('button', { name: 'Reply to Ana Putri' }));
    const reply = screen.getByPlaceholderText('Write a reply…');
    await userEvent.type(reply, '@an');
    await waitList();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByPlaceholderText('Write a reply…')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByPlaceholderText('Write a reply…')).toBeNull();
  });

  it('says so when no one matches', async () => {
    setup();
    await screen.findByText('No comments yet. Start the conversation.');
    await userEvent.type(box(), '@zzz');
    expect(await screen.findByText('No one named “zzz”.')).toBeInTheDocument();
  });

  it('does nothing for an @ in the middle of a word', async () => {
    const adapter = setup();
    await screen.findByText('No comments yet. Start the conversation.');
    await userEvent.type(box(), 'mail me at x@an');
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(adapter.calls.some((c) => c.startsWith('people:'))).toBe(false);
  });

  it('is plain text when the adapter has no people search', async () => {
    const adapter = setup({ mentions: false });
    await screen.findByText('No comments yet. Start the conversation.');
    await userEvent.type(box(), '@an');
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box()).not.toHaveAttribute('aria-autocomplete');
    expect(adapter.calls.some((c) => c.startsWith('people:'))).toBe(false);
  });

  it('drops the token of a person whose @Name was deleted before sending', async () => {
    const adapter = setup();
    await screen.findByText('No comments yet. Start the conversation.');
    await userEvent.type(box(), '@bud');
    await waitList();
    await userEvent.keyboard('{Enter}');
    await userEvent.clear(box());
    await userEvent.type(box(), 'never mind');
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));
    await waitFor(() => expect(adapter.calls).toContain('add:top:never mind'));
  });

  it('keeps the first answer on screen while the next query is searched', async () => {
    setup({ latency: 60 });
    await screen.findByText('No comments yet. Start the conversation.');
    await userEvent.type(box(), '@a');
    await waitList();
    await userEvent.type(box(), 'n');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});

describe('mentions in a comment', () => {
  const body = `hello ${makeToken('Mira', ME.id)} and ${makeToken('Ana Putri', ANA.id)}`;
  const seed: Comment[] = [{ id: 'a', parent: null, root: null, author: ANA, body, photos: null, createdAt: '2026-11-05T10:00:00Z' }];

  it('draws chips, and the viewer’s own stands out', async () => {
    setup({}, seed);
    const mine = await screen.findByText('@Mira');
    expect(mine).toHaveAttribute('data-me', 'true');
    expect(screen.getByText('@Ana Putri')).not.toHaveAttribute('data-me');
  });

  it('shows plain @Name when editing and puts the tokens back on save', async () => {
    const adapter = setup(
      { edit: true },
      [{ ...seed[0], author: ME }]
    );
    await screen.findByText('@Mira');
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const editor = screen.getByDisplayValue('hello @Mira and @Ana Putri');
    await userEvent.type(editor, '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(adapter.calls).toContain('edit:a'));
    const [saved] = await adapter.list();
    expect(saved.body).toBe(`${body}!`);
  });

  it('never turns a forged token into anything but a chip of text', async () => {
    setup({}, [{ ...seed[0], body: '@[<img src=x onerror=alert(1)>](user:11111111-1111-4111-8111-111111111111)' }]);
    await screen.findByText(/img src/);
    expect(document.querySelector('.bp-cm-body img')).toBeNull();
  });
});

describe('usersSearch and itemsAdapter.mentions', () => {
  const rows = { data: [{ id: 'ABC', first_name: 'Ana', last_name: 'Putri', email: 'a@x.io' }, { first_name: 'No id' }] };

  it('asks /api/users for active people and maps them, dropping rows without an id', async () => {
    const request = vi.fn().mockResolvedValue(rows);
    const found = await usersSearch(request as never)('an');
    const url = String(request.mock.calls[0][0]);
    expect(url).toContain('/api/users?');
    expect(url).toContain('search=an');
    expect(url).toContain('status=active');
    expect(url).toContain('limit=8');
    expect(found).toEqual([{ id: 'abc', name: 'Ana Putri', email: 'a@x.io' }]);
  });

  it('sends no search term for a bare @', async () => {
    const request = vi.fn().mockResolvedValue({ data: [] });
    await usersSearch(request as never)('');
    expect(String(request.mock.calls[0][0])).not.toContain('search=');
  });

  it('is off by default, on with true, and replaceable with a function', async () => {
    const base = { collection: 'c', hostField: 'h', hostId: '1', meId: 'me' };
    expect(itemsAdapter(base).searchPeople).toBeUndefined();
    expect(itemsAdapter({ ...base, mentions: true, request: vi.fn().mockResolvedValue({ data: [] }) as never }).searchPeople).toBeTypeOf('function');
    const mine = vi.fn().mockResolvedValue([]);
    expect(itemsAdapter({ ...base, mentions: mine }).searchPeople).toBe(mine);
  });
});
