import React from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import type { AiChatBackend } from '../src/backends';

export function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

/** A backend whose transport streams `answer` (or fails with `fail`), recording what it was sent. */
export function scriptedBackend(options: { answer?: string; fail?: string; history?: 'client' | 'server'; steps?: boolean } = {}) {
  const sent: UIMessage[][] = [];
  const transport: ChatTransport<UIMessage> = {
    async sendMessages({ messages }) {
      sent.push(messages);
      if (options.fail) throw new Error(options.fail);
      const chunks: UIMessageChunk[] = [{ type: 'start' }, { type: 'start-step' }];
      if (options.steps) {
        chunks.push(
          { type: 'text-start', id: 'n' },
          { type: 'text-delta', id: 'n', delta: "I'll look that up." },
          { type: 'text-end', id: 'n' },
          { type: 'tool-input-available', toolCallId: 't', toolName: 'search', input: {} },
          { type: 'tool-output-available', toolCallId: 't', output: 'found' },
          { type: 'finish-step' },
          { type: 'start-step' }
        );
      }
      chunks.push(
        { type: 'text-start', id: 'a' },
        { type: 'text-delta', id: 'a', delta: options.answer ?? 'Open **Settings** to invite a teammate.' },
        { type: 'text-end', id: 'a' },
        { type: 'source-url', sourceId: 's', url: 'https://example.com/docs', title: 'Docs' },
        { type: 'finish-step' },
        { type: 'finish' }
      );
      return new ReadableStream<UIMessageChunk>({
        start(controller) {
          chunks.forEach((chunk) => controller.enqueue(chunk));
          controller.close();
        },
      });
    },
    reconnectToStream: async () => null,
  };
  const backend: AiChatBackend = { history: options.history ?? 'client', createTransport: () => transport };
  return { backend, sent };
}
