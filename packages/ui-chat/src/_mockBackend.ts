/**
 * Story-only backend: answers with a scripted AI SDK UI message stream (a docs
 * search, then Markdown with a code block, a table and a source), so the stories
 * run without a Chocolate Factory agent. Not shipped (not in the registry).
 */
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import type { AiChatBackend } from './backends';

const ANSWER = `To invite a teammate:

1. Open **Settings › Members**.
2. Click **Invite member** and enter their email address.
3. Pick a role, then click **Send invite**.

They get an email with a link that expires after 7 days. To resend it:

\`\`\`bash
curl -X POST https://example.com/api/invites/42/resend
\`\`\`

| Role | Can invite |
| --- | --- |
| Owner | Yes |
| Member | No |

See [Managing members](https://example.com/docs/members) for more.`;

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

export interface MockBackendOptions {
  /** Fail every request with this message instead of answering. */
  fail?: string;
  /** Milliseconds between streamed pieces. Default 30. */
  pace?: number;
}

export function mockBackend({ fail, pace = 30 }: MockBackendOptions = {}): AiChatBackend {
  const transport: ChatTransport<UIMessage> = {
    async sendMessages({ abortSignal }) {
      if (fail) {
        await wait(500, abortSignal);
        throw new Error(fail);
      }
      return new ReadableStream<UIMessageChunk>({
        async start(controller) {
          try {
            controller.enqueue({ type: 'start' });
            controller.enqueue({ type: 'start-step' });
            controller.enqueue({ type: 'text-start', id: 'n' });
            controller.enqueue({ type: 'text-delta', id: 'n', delta: "I'll look that up." });
            controller.enqueue({ type: 'text-end', id: 'n' });
            controller.enqueue({ type: 'tool-input-start', toolCallId: 't1', toolName: 'search_docs' });
            controller.enqueue({ type: 'tool-input-available', toolCallId: 't1', toolName: 'search_docs', input: { query: 'invite member' } });
            await wait(1200, abortSignal);
            controller.enqueue({ type: 'tool-output-available', toolCallId: 't1', output: 'Settings › Members › Invite member' });
            controller.enqueue({ type: 'finish-step' });
            controller.enqueue({ type: 'start-step' });
            controller.enqueue({ type: 'text-start', id: 'a' });
            for (const piece of ANSWER.match(/[\s\S]{1,14}/g) ?? []) {
              controller.enqueue({ type: 'text-delta', id: 'a', delta: piece });
              await wait(pace, abortSignal);
            }
            controller.enqueue({ type: 'text-end', id: 'a' });
            controller.enqueue({ type: 'source-url', sourceId: 's1', url: 'https://example.com/docs/members', title: 'Managing members' });
            controller.enqueue({ type: 'finish-step' });
            controller.enqueue({ type: 'finish' });
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
    },
    reconnectToStream: async () => null,
  };
  return { history: 'client', createTransport: () => transport };
}
