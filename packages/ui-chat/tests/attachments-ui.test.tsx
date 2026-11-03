import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvent, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { defaultTranslations } from '@buildpad/utils';

const imagePart = (filename: string) => ({ type: 'file' as const, mediaType: 'image/png' as const, filename, url: `data:image/png;base64,${btoa(filename)}` });

const imagePartFromFile = vi.fn(async (_file: Blob, filename: string) => imagePart(filename));
const takeScreenshot = vi.fn();
const annotateImage = vi.fn();
vi.mock('../src/capture', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/capture')>();
  return {
    ...actual,
    imagePartFromFile: (...args: [Blob, string]) => imagePartFromFile(...args),
    takeScreenshot: (...args: unknown[]) => takeScreenshot(...args),
    annotateImage: (...args: unknown[]) => annotateImage(...args),
  };
});

import { AttachmentError } from '../src/capture';
import { AiChat } from '../src/index';
import { renderWithMantine, scriptedBackend } from './helpers';

const file = (name: string, type = 'image/png') => new File(['x'], name, { type });

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('AiChat image attachments', () => {
  it('attaches chosen images, sends them with the question and shows them in the thread', async () => {
    const { backend, sent } = scriptedBackend();
    renderWithMantine(<AiChat backend={backend} />);
    fireEvent.change(screen.getByTestId('ai-chat-file-input'), { target: { files: [file('a.png'), file('b.png')] } });

    expect(await screen.findByRole('img', { name: 'a.png' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask about the image…')).toBeInTheDocument();
    expect(screen.getByText('Images are sent to the assistant and kept with this chat.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove b.png' }));
    expect(screen.queryByRole('img', { name: 'b.png' })).not.toBeInTheDocument();

    // An image alone can be sent, without a question.
    await userEvent.click(screen.getByRole('button', { name: 'Send question' }));
    await screen.findByText('Settings');
    expect(sent[0].at(-1)?.parts).toEqual([expect.objectContaining({ type: 'file', filename: 'a.png' })]);
    expect(screen.getByRole('button', { name: 'Enlarge a.png' })).toBeInTheDocument();
  });

  it('caps a question at four images and reports images it could not read', async () => {
    imagePartFromFile.mockRejectedValueOnce(new AttachmentError('c.png is too large to attach.'));
    const { backend } = scriptedBackend();
    renderWithMantine(<AiChat backend={backend} />);
    const input = screen.getByTestId('ai-chat-file-input');

    fireEvent.change(input, { target: { files: [file('c.png'), file('d.png')] } });
    expect(await screen.findByText('c.png is too large to attach.')).toBeInTheDocument();

    fireEvent.change(input, { target: { files: [file('e.png'), file('f.png'), file('g.png'), file('h.png')] } });
    expect(await screen.findByText('You can attach up to 4 images to one question.')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(4);

    fireEvent.change(input, { target: { files: [file('i.png')] } });
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(4));
    expect(screen.getByRole('button', { name: 'Attach images' })).toBeDisabled();
  });

  it('attaches a pasted image but still pastes text copied with it', async () => {
    const { backend } = scriptedBackend();
    renderWithMantine(<AiChat backend={backend} />);
    const box = screen.getByRole('textbox');

    const paste = createEvent.paste(box, { clipboardData: { files: [file('pasted.png')], getData: () => '' } });
    fireEvent(box, paste);
    expect(paste.defaultPrevented).toBe(true);
    expect(await screen.findByRole('img', { name: 'pasted.png' })).toBeInTheDocument();

    const withText = createEvent.paste(box, { clipboardData: { files: [file('two.png')], getData: () => 'some text' } });
    fireEvent(box, withText);
    expect(withText.defaultPrevented).toBe(false);
    const textOnly = createEvent.paste(box, { clipboardData: { files: [], getData: () => 'text' } });
    fireEvent(box, textOnly);
    expect(textOnly.defaultPrevented).toBe(false);
  });

  it('attaches dropped images and shows the drop hint while dragging', async () => {
    const { backend } = scriptedBackend();
    renderWithMantine(<AiChat backend={backend} />);
    const chat = document.querySelector('.bp-ai-chat')!;
    const dataTransfer = { types: ['Files'], files: [file('dropped.png')], dropEffect: 'none' };

    fireEvent.dragOver(chat, { dataTransfer });
    expect(screen.getByText('Drop images to attach')).toBeInTheDocument();
    fireEvent.dragLeave(chat, { dataTransfer, relatedTarget: null });
    expect(screen.queryByText('Drop images to attach')).not.toBeInTheDocument();
    fireEvent.dragOver(chat, { dataTransfer });
    fireEvent.drop(chat, { dataTransfer });
    expect(await screen.findByRole('img', { name: 'dropped.png' })).toBeInTheDocument();

    // Dragging text, not files, does nothing.
    fireEvent.dragOver(chat, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(screen.queryByText('Drop images to attach')).not.toBeInTheDocument();
  });

  it('takes a screenshot, annotates an attachment, and reports failures of both', async () => {
    const { backend } = scriptedBackend();
    renderWithMantine(<AiChat backend={backend} />);

    takeScreenshot.mockImplementationOnce(async (hide: () => () => void) => {
      const restore = hide();
      expect(document.documentElement).toHaveAttribute('data-ai-chat-capturing');
      restore();
      return imagePart('Screenshot.png');
    });
    await userEvent.click(screen.getByRole('button', { name: 'Take a screenshot' }));
    expect(await screen.findByRole('img', { name: 'Screenshot.png' })).toBeInTheDocument();
    expect(document.documentElement).not.toHaveAttribute('data-ai-chat-capturing');

    annotateImage.mockResolvedValueOnce(imagePart('Screenshot-marked.png'));
    await userEvent.click(screen.getByRole('button', { name: 'Annotate Screenshot.png' }));
    expect(await screen.findByRole('img', { name: 'Screenshot-marked.png' })).toBeInTheDocument();

    annotateImage.mockRejectedValueOnce(new Error('canvas'));
    await userEvent.click(screen.getByRole('button', { name: 'Annotate Screenshot-marked.png' }));
    expect(await screen.findByText("The image couldn't be annotated.")).toBeInTheDocument();

    takeScreenshot.mockRejectedValueOnce(new Error('nope'));
    await userEvent.click(screen.getByRole('button', { name: 'Take a screenshot' }));
    expect(await screen.findByText("The screenshot couldn't be taken. Try again.")).toBeInTheDocument();

    takeScreenshot.mockRejectedValueOnce(new AttachmentError('Specific problem.'));
    await userEvent.click(screen.getByRole('button', { name: 'Take a screenshot' }));
    expect(await screen.findByText('Specific problem.')).toBeInTheDocument();
    expect(takeScreenshot.mock.calls[0][1]).toEqual(expect.objectContaining({ annotator: defaultTranslations.chat.annotator }));
  });
});
