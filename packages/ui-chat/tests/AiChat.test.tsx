import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UIMessage } from 'ai';
import { AiChat } from '../src/AiChat';
import type { AiChatBackend } from '../src/backends';
import { renderWithMantine, scriptedBackend } from './helpers';

afterEach(() => window.localStorage.clear());

describe('AiChat', () => {
  it('shows the empty state, sends a starter question and streams the answer', async () => {
    const { backend, sent } = scriptedBackend({ steps: true });
    renderWithMantine(
      <AiChat backend={backend} title="Ask Acme" badge="Beta" description="Ask anything." suggestions={['How do I invite a teammate?']} />
    );

    expect(screen.getByText('Ask Acme')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('How can I help?')).toBeInTheDocument();
    expect(screen.getByText('Ask anything.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'How do I invite a teammate?' }));

    expect(await screen.findByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('How do I invite a teammate?')).toBeInTheDocument();
    // The agent's narration before its tool call stays out of the thread.
    expect(screen.queryByText("I'll look that up.")).not.toBeInTheDocument();
    expect(screen.getByText('Docs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy answer' })).toBeInTheDocument();
    expect(sent[0].at(-1)?.parts).toEqual([{ type: 'text', text: 'How do I invite a teammate?' }]);
  });

  it('sends typed questions with Enter, keeps Shift+Enter for new lines, and refuses overlong ones', async () => {
    const { backend, sent } = scriptedBackend();
    renderWithMantine(<AiChat backend={backend} />);
    const box = screen.getByRole('textbox', { name: 'Ask the assistant a question' });

    await userEvent.type(box, 'Line one{Shift>}{Enter}{/Shift}line two');
    expect(box).toHaveValue('Line one\nline two');
    await userEvent.type(box, '{Enter}');
    await screen.findByText('Settings');
    expect(sent).toHaveLength(1);
    expect(box).toHaveValue('');

    fireEvent.change(box, { target: { value: 'x'.repeat(8002) } });
    expect(screen.getByText('2 characters over the limit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled();
  });

  it('remembers chats in the recent list, reopens them after a remount, and removes them', async () => {
    const { backend } = scriptedBackend();
    const { unmount } = renderWithMantine(<AiChat backend={backend} storageKey="user-1" />);
    await userEvent.type(screen.getByRole('textbox'), 'Where is billing?{Enter}');
    await screen.findByText('Settings');
    await waitFor(() => expect(Object.keys(window.localStorage).some((key) => key.includes('.chat.'))).toBe(true));
    unmount();

    renderWithMantine(<AiChat backend={backend} storageKey="user-1" />);
    // The open chat comes back from the browser-kept transcript.
    expect(await screen.findByText('Where is billing?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Recent chats' }));
    // jsdom lays nothing out, so Mantine's hideDetached keeps the open popover `display: none`.
    const row = await screen.findByRole('button', { name: /^Where is billing\?/, hidden: true });
    expect(within(row).getByText('just now')).toBeInTheDocument();
    // Browser-kept chats are gone once removed; no "kept in the logs" note.
    expect(screen.queryByText(/isn't deleted/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove "Where is billing?" from recent chats', hidden: true }));
    await waitFor(() => expect(screen.queryByText('Where is billing?')).not.toBeInTheDocument());
    expect(Object.keys(window.localStorage).some((key) => key.includes('.chat.'))).toBe(false);
  });

  it('starts a new chat', async () => {
    const { backend } = scriptedBackend();
    renderWithMantine(<AiChat backend={backend} />);
    expect(screen.getByRole('button', { name: 'New chat' })).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox'), 'Hi{Enter}');
    await screen.findByText('Settings');
    await userEvent.click(screen.getByRole('button', { name: 'New chat' }));
    expect(await screen.findByText('How can I help?')).toBeInTheDocument();
  });

  it('loads a server-kept conversation, and forgets one that is gone', async () => {
    const stored: UIMessage[] = [
      { id: 'u', role: 'user', parts: [{ type: 'text', text: 'Earlier question' }] },
      { id: 'a', role: 'assistant', parts: [{ type: 'text', text: 'Earlier answer' }] },
    ];
    const loadConversation = vi.fn(async (id: string) => (id === 'kept' ? stored : null));
    const { backend: scripted } = scriptedBackend({ history: 'server' });
    const backend: AiChatBackend = { ...scripted, loadConversation };

    window.localStorage.setItem(
      'buildpad.ai-chat.v1.u',
      JSON.stringify({ current: 'kept', recent: [{ id: 'kept', title: 'Earlier question', at: Date.now() }, { id: 'gone', title: 'Old one', at: 0 }] })
    );
    renderWithMantine(<AiChat backend={backend} storageKey="u" />);
    expect(await screen.findByText('Earlier answer')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Recent chats' }));
    expect(await screen.findByText(/isn't deleted from the assistant's logs/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Old one/, hidden: true }));
    expect(await screen.findByText('That conversation is no longer available.')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('buildpad.ai-chat.v1.u')!).recent).toHaveLength(1);
  });

  it('says so when loading a conversation fails', async () => {
    const onError = vi.fn();
    const { backend: scripted } = scriptedBackend({ history: 'server' });
    const backend: AiChatBackend = { ...scripted, loadConversation: async () => Promise.reject(new Error('boom')) };
    window.localStorage.setItem('buildpad.ai-chat.v1.u', JSON.stringify({ current: 'x', recent: [] }));
    renderWithMantine(<AiChat backend={backend} storageKey="u" onError={onError} />);
    expect(await screen.findByText("Couldn't load this conversation.")).toBeInTheDocument();
    expect(onError).toHaveBeenCalled();
  });

  it('shows a failed answer with Try again, and reports the error', async () => {
    const onError = vi.fn();
    const { backend, sent } = scriptedBackend({ fail: 'The assistant is misconfigured.' });
    renderWithMantine(<AiChat backend={backend} onError={onError} />);
    await userEvent.type(screen.getByRole('textbox'), 'Hi{Enter}');
    expect(await screen.findByText('No answer this time')).toBeInTheDocument();
    expect(screen.getByText('The assistant is misconfigured.')).toBeInTheDocument();
    expect(onError).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(sent).toHaveLength(2));
  });

  it('hides an unreadable error behind a friendly sentence', async () => {
    const { backend } = scriptedBackend({ fail: '{"error":"Unauthorized"}' });
    renderWithMantine(<AiChat backend={backend} onError={() => {}} />);
    await userEvent.type(screen.getByRole('textbox'), 'Hi{Enter}');
    expect(await screen.findByText('Something went wrong while answering. Try again in a moment.')).toBeInTheDocument();
  });

  it('turns features off and renders the context slot', () => {
    const { backend } = scriptedBackend();
    renderWithMantine(
      <AiChat backend={backend} features={{ attachments: false, screenshot: false, recentChats: false }} context={<span>Sharing this page</span>} disclaimer="Be careful." />
    );
    expect(screen.queryByRole('button', { name: 'Attach images' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take a screenshot' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Recent chats' })).not.toBeInTheDocument();
    expect(screen.getByText('Sharing this page')).toBeInTheDocument();
    expect(screen.getByText('Be careful.')).toBeInTheDocument();
  });

  it('sends vars from a function with each message', async () => {
    const { backend } = scriptedBackend();
    const getVars = vi.fn();
    const createTransport = vi.spyOn(backend, 'createTransport');
    renderWithMantine(<AiChat backend={backend} vars={() => ({ page: 'Members' })} />);
    await userEvent.type(screen.getByRole('textbox'), 'Hi{Enter}');
    await screen.findByText('Settings');
    const handlers = createTransport.mock.calls[0][0];
    expect(handlers.getVars()).toEqual({ page: 'Members' });
    expect(handlers.getConversation()).toEqual(expect.any(String));
    expect(getVars).not.toHaveBeenCalled();
  });

  it('navigates app links in place through onNavigate, and blocks images from other hosts', async () => {
    const onNavigate = vi.fn();
    const { backend } = scriptedBackend({
      answer: 'See [members](/settings/members), [docs](https://docs.example.com/x) and ![Shot](https://evil.example.com/a.png)',
    });
    renderWithMantine(<AiChat backend={backend} onNavigate={onNavigate} imageHosts={['docs.example.com']} />);
    await userEvent.type(screen.getByRole('textbox'), 'Hi{Enter}');
    await userEvent.click(await screen.findByRole('link', { name: 'members' }));
    expect(onNavigate).toHaveBeenCalledWith('/settings/members');
    expect(screen.getByRole('link', { name: /docs/ })).toHaveAttribute('target', '_blank');
    expect(screen.queryByRole('img', { name: 'Shot' })).not.toBeInTheDocument();
    expect(screen.getByText('Shot')).toBeInTheDocument();
  });

  it('closes on Escape when it has onClose, and takes per-instance strings', async () => {
    const onClose = vi.fn();
    const { backend } = scriptedBackend();
    renderWithMantine(<AiChat backend={backend} onClose={onClose} translations={{ composer: { placeholder: 'Tanya…' } }} />);
    expect(screen.getByPlaceholderText('Tanya…')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Close assistant' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('rejects non-image files and too many images', async () => {
    const { backend } = scriptedBackend();
    renderWithMantine(<AiChat backend={backend} />);
    const input = screen.getByTestId('ai-chat-file-input');
    fireEvent.change(input, { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText('Only images can be attached: PNG, JPEG, WebP or GIF.')).toBeInTheDocument();
  });
});
