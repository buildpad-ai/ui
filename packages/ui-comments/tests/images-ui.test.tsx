import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentsKit } from '../src/CommentsKit';
import { mockAdapter, type MockOptions } from '../src/_mockAdapter';
import { MAX_PHOTOS, type Comment } from '../src/core/types';
import { renderWithMantine } from './helpers';

const ME = { id: 'me', name: 'Mira' };
const ANA = { id: 'ana', name: 'Ana' };

const setup = (options: Partial<MockOptions> = {}, comments: Comment[] = []) => {
  const adapter = mockAdapter({ me: ME, people: [ANA], comments, ...options });
  renderWithMantine(<CommentsKit adapter={adapter} meId={ME.id} meName={ME.name} />);
  return adapter;
};

const box = () => screen.getAllByRole('textbox').at(-1)! as HTMLTextAreaElement;
const ready = () => screen.findByText('No comments yet. Start the conversation.');
const file = (name = 'a.png', type = 'image/png', size = 10) => new File([new Uint8Array(size)], name, { type });
const input = () => screen.getByTestId('bp-cm-file-input') as HTMLInputElement;
const thumbs = () => document.querySelectorAll('.bp-cm-composer .bp-cm-photo:not(.bp-cm-photo--wait)');

/** A clipboard holding these items. Returns false when the paste was taken over (default prevented). */
const paste = (items: Array<{ kind: string; type: string; file?: File }>) =>
  fireEvent.paste(box(), {
    clipboardData: { items: items.map((i) => ({ kind: i.kind, type: i.type, getAsFile: () => i.file ?? null })) },
  });

describe('attaching pictures', () => {
  it('offers the picture button only when the adapter can upload', async () => {
    setup({ images: false });
    await ready();
    expect(screen.queryByRole('button', { name: 'Add picture' })).toBeNull();
  });

  it('picks files with the button, shows thumbnails and sends the file ids with the comment', async () => {
    const adapter = setup();
    await ready();
    expect(screen.getByRole('button', { name: 'Add picture' })).toBeInTheDocument();
    await userEvent.upload(input(), [file('one.png'), file('two.jpg', 'image/jpeg')]);
    await waitFor(() => expect(thumbs()).toHaveLength(2));
    await userEvent.type(box(), 'see attached');
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));
    await waitFor(() => expect(adapter.calls.some((c) => c.startsWith('add:top:see attached'))).toBe(true));
    const [made] = await adapter.list();
    expect(made.photos).toEqual(['file-1', 'file-2']);
    // The comment shows them, and the box is empty again.
    await waitFor(() => expect(document.querySelectorAll('.bp-cm-msg .bp-cm-photo')).toHaveLength(2));
    expect(thumbs()).toHaveLength(0);
  });

  it('lets a picture alone be a comment', async () => {
    const adapter = setup();
    await ready();
    await userEvent.upload(input(), file());
    await waitFor(() => expect(thumbs()).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));
    await waitFor(() => expect(adapter.calls).toContain('add:top:'));
    expect(screen.queryByText('Write a comment')).toBeNull();
  });

  it('takes over a paste that holds a picture and names an unnamed screenshot', async () => {
    const adapter = setup();
    await ready();
    const taken = paste([{ kind: 'file', type: 'image/png', file: file('image.png') }]);
    expect(taken).toBe(false);
    await waitFor(() => expect(thumbs()).toHaveLength(1));
    expect(adapter.calls.find((c) => c.startsWith('upload:'))).toMatch(/^upload:pasted-\d+\.png:image\/png$/);
  });

  it('leaves a plain-text paste alone', async () => {
    const adapter = setup();
    await ready();
    const taken = paste([{ kind: 'string', type: 'text/plain' }]);
    expect(taken).toBe(true);
    expect(adapter.calls.some((c) => c.startsWith('upload:'))).toBe(false);
  });

  it('ignores a paste when the adapter cannot upload', async () => {
    setup({ images: false });
    await ready();
    expect(paste([{ kind: 'file', type: 'image/png', file: file() }])).toBe(true);
  });

  it('refuses a file that is not a picture, and an SVG', async () => {
    const adapter = setup();
    await ready();
    fireEvent.change(input(), { target: { files: [file('a.pdf', 'application/pdf')] } });
    expect(await screen.findByText('Use a PNG, JPEG, GIF or WebP picture')).toBeInTheDocument();
    fireEvent.change(input(), { target: { files: [file('a.svg', 'image/svg+xml')] } });
    expect(await screen.findByText('Use a PNG, JPEG, GIF or WebP picture')).toBeInTheDocument();
    expect(adapter.calls.some((c) => c.startsWith('upload:'))).toBe(false);
  });

  it('refuses a picture over 10 MB, and still takes the others in the same choice', async () => {
    const adapter = setup();
    await ready();
    fireEvent.change(input(), { target: { files: [file('big.png', 'image/png', 10 * 1024 * 1024 + 1), file('ok.png')] } });
    expect(await screen.findByText('Pictures can be up to 10 MB')).toBeInTheDocument();
    await waitFor(() => expect(thumbs()).toHaveLength(1));
    expect(adapter.calls.filter((c) => c.startsWith('upload:'))).toHaveLength(1);
  });

  it('stops at the limit', async () => {
    const adapter = setup();
    await ready();
    const many = Array.from({ length: MAX_PHOTOS + 1 }, (_, i) => file(`p${i}.png`));
    fireEvent.change(input(), { target: { files: many } });
    expect(await screen.findByText('Attach fewer pictures')).toBeInTheDocument();
    await waitFor(() => expect(thumbs()).toHaveLength(MAX_PHOTOS));
    expect(adapter.calls.filter((c) => c.startsWith('upload:'))).toHaveLength(MAX_PHOTOS);
  });

  it('frees a slot when a picture is removed', async () => {
    setup();
    await ready();
    await userEvent.upload(input(), [file('a.png'), file('b.png')]);
    await waitFor(() => expect(thumbs()).toHaveLength(2));
    await userEvent.click(screen.getByRole('button', { name: 'Remove picture 1' }));
    expect(thumbs()).toHaveLength(1);
  });

  it('shows a placeholder and holds Send back while a picture uploads', async () => {
    setup({ latency: 120 });
    await screen.findByText('No comments yet. Start the conversation.');
    await userEvent.type(box(), 'wait for it');
    fireEvent.change(input(), { target: { files: [file()] } });
    expect(await screen.findByRole('img', { name: 'Uploading picture' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
    await waitFor(() => expect(screen.queryByRole('img', { name: 'Uploading picture' })).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Comment' })).toBeEnabled());
  });

  it('says so when an upload fails, and keeps the rest', async () => {
    setup({ failOn: ['upload'] });
    await ready();
    await userEvent.type(box(), 'text stays');
    await userEvent.upload(input(), file());
    expect(await screen.findByText("Couldn't upload that picture.")).toBeInTheDocument();
    expect(box()).toHaveValue('text stays');
    expect(thumbs()).toHaveLength(0);
  });

  it('lets the same file be chosen again', async () => {
    setup();
    await ready();
    await userEvent.upload(input(), file('same.png'));
    await waitFor(() => expect(thumbs()).toHaveLength(1));
    expect(input().value).toBe('');
  });
});

describe('the viewer', () => {
  const seed: Comment[] = [
    { id: 'a', parent: null, root: null, author: ANA, body: 'screens', photos: ['f1', 'f2', 'f3'], createdAt: '2026-11-05T10:00:00Z' },
  ];

  it('opens a picture full size, pages with the buttons and the arrow keys, and wraps', async () => {
    setup({}, seed);
    await screen.findByText('screens');
    await userEvent.click(screen.getByRole('button', { name: 'Open picture 1 of 3' }));
    const viewer = await screen.findByRole('dialog', { name: 'Picture viewer' });
    const shown = () => within(viewer).getByRole('img').getAttribute('alt');
    expect(shown()).toBe('Picture 1');
    await userEvent.click(within(viewer).getByRole('button', { name: 'Next picture' }));
    expect(shown()).toBe('Picture 2');
    await userEvent.keyboard('{ArrowRight}');
    expect(shown()).toBe('Picture 3');
    await userEvent.keyboard('{ArrowRight}');
    expect(shown()).toBe('Picture 1');
    await userEvent.keyboard('{ArrowLeft}');
    expect(shown()).toBe('Picture 3');
    await userEvent.click(within(viewer).getByRole('button', { name: 'Previous picture' }));
    expect(shown()).toBe('Picture 2');
  });

  it('closes with its button and with Esc', async () => {
    setup({}, seed);
    await screen.findByText('screens');
    await userEvent.click(screen.getByRole('button', { name: 'Open picture 2 of 3' }));
    await screen.findByRole('dialog', { name: 'Picture viewer' });
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Picture viewer' })).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Open picture 2 of 3' }));
    await screen.findByRole('dialog', { name: 'Picture viewer' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Picture viewer' })).toBeNull());
  });

  it('has no paging for a single picture', async () => {
    setup({}, [{ ...seed[0], photos: ['only'] }]);
    await screen.findByText('screens');
    await userEvent.click(screen.getByRole('button', { name: 'Open picture 1 of 1' }));
    await screen.findByRole('dialog', { name: 'Picture viewer' });
    expect(screen.queryByRole('button', { name: 'Next picture' })).toBeNull();
    await userEvent.keyboard('{ArrowRight}');
    expect(within(screen.getByRole('dialog', { name: 'Picture viewer' })).getByRole('img')).toHaveAttribute('alt', 'Picture 1');
  });

  it('shows no pictures when the adapter cannot say where they are', async () => {
    setup({ images: false }, seed);
    await screen.findByText('screens');
    expect(screen.queryByRole('button', { name: /Open picture/ })).toBeNull();
  });

  it('has no remove buttons on a posted comment', async () => {
    setup({}, seed);
    await screen.findByText('screens');
    expect(screen.queryByRole('button', { name: /Remove picture/ })).toBeNull();
  });
});
