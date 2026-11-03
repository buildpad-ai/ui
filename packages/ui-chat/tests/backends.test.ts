import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UIMessage, UIMessageChunk } from 'ai';
import {
  AI_CHAT_CONVERSATION_HEADER,
  chocolateFactoryAuthHeaders,
  chocolateFactoryBackend,
  chocolateFactoryBaseUrl,
  forAgent,
  routeBackend,
  type AiChatBackendHandlers,
} from '../src/backends';

const sse = (chunks: object[]) =>
  new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n', {
    headers: { 'Content-Type': 'text/event-stream' },
  });

const ANSWER = [
  { type: 'start' },
  { type: 'text-start', id: 'a' },
  { type: 'text-delta', id: 'a', delta: 'Hi' },
  { type: 'text-end', id: 'a' },
  { type: 'finish' },
];

const user = (text: string, id = 'u1'): UIMessage => ({ id, role: 'user', parts: [{ type: 'text', text }] });

function handlers(overrides: Partial<AiChatBackendHandlers> = {}): AiChatBackendHandlers {
  return { getConversation: () => null, onConversation: vi.fn(), getVars: () => undefined, ...overrides };
}

async function drain(stream: ReadableStream<UIMessageChunk>) {
  const chunks: UIMessageChunk[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return chunks;
    chunks.push(value);
  }
}

function send(transport: ReturnType<ReturnType<typeof chocolateFactoryBackend>['createTransport']>, messages: UIMessage[]) {
  return transport.sendMessages({ trigger: 'submit-message', chatId: 'c', messageId: undefined, messages, abortSignal: undefined });
}

afterEach(() => vi.unstubAllGlobals());

describe('chocolateFactoryBaseUrl', () => {
  it('keeps only the instance, also from a Run API URL', () => {
    expect(chocolateFactoryBaseUrl('https://cf.example.com/')).toBe('https://cf.example.com');
    expect(chocolateFactoryBaseUrl(' https://cf.example.com/api/agents ')).toBe('https://cf.example.com');
    expect(chocolateFactoryBaseUrl('https://cf.example.com/api/agents/a1/run')).toBe('https://cf.example.com');
  });
});

describe('chocolateFactoryAuthHeaders', () => {
  it('sends an agent key as x-agent-key and any other key as cf-api-key', () => {
    expect(chocolateFactoryAuthHeaders('agk_1')).toEqual({ 'x-agent-key': 'agk_1' });
    expect(chocolateFactoryAuthHeaders('cf_1')).toEqual({ 'cf-api-key': 'cf_1' });
  });
});

describe('forAgent', () => {
  it("keeps text and images, drops the agent's working and stripped images", () => {
    const message: UIMessage = {
      id: 'a',
      role: 'assistant',
      parts: [
        { type: 'reasoning', text: 'hm' },
        { type: 'text', text: 'Answer' },
        { type: 'text', text: '  ' },
        { type: 'file', mediaType: 'image/png', url: '' },
        { type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,AA==' },
      ],
    };
    expect(forAgent(message)?.parts).toEqual([
      { type: 'text', text: 'Answer' },
      { type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,AA==' },
    ]);
    expect(forAgent({ id: 'x', role: 'assistant', parts: [{ type: 'reasoning', text: 'hm' }] })).toBeNull();
  });
});

describe('chocolateFactoryBackend', () => {
  it('posts the whole transcript (stateless mode) with the vars, straight to the run endpoint', async () => {
    const fetchMock = vi.fn(async () => sse(ANSWER));
    vi.stubGlobal('fetch', fetchMock);
    const backend = chocolateFactoryBackend({ baseUrl: 'https://cf.example.com/api/agents', agentId: 'agent 1', apiKey: 'cf_key' });
    expect(backend.history).toBe('client');

    const transport = backend.createTransport(handlers({ getVars: () => ({ page: 'Members' }) }));
    const answer: UIMessage = { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Hello' }] };
    const chunks = await drain(await send(transport, [user('Hi'), answer, user('And?', 'u2')]));

    expect(chunks.map((chunk) => chunk.type)).toContain('text-delta');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://cf.example.com/api/agents/agent%201/run');
    const headers = new Headers(init.headers);
    expect(headers.get('cf-api-key')).toBe('cf_key');
    expect(headers.get('accept')).toBe('text/event-stream');
    const body = JSON.parse(String(init.body));
    expect(body.messages.map((m: UIMessage) => m.id)).toEqual(['u1', 'a1', 'u2']);
    expect(body.vars).toEqual({ page: 'Members' });
    expect(body.conversationId).toBeUndefined();
  });

  it('leaves vars out when there are none', async () => {
    const fetchMock = vi.fn(async () => sse(ANSWER));
    vi.stubGlobal('fetch', fetchMock);
    const transport = chocolateFactoryBackend({ baseUrl: 'https://cf.example.com', agentId: 'a', apiKey: 'agk_1' }).createTransport(
      handlers({ getVars: () => ({}) })
    );
    await drain(await send(transport, [user('Hi')]));
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(String(init.body)).vars).toBeUndefined();
    expect(new Headers(init.headers).get('x-agent-key')).toBe('agk_1');
  });
});

describe('routeBackend', () => {
  it('sends the newest turn with the open conversation, and reports a new one', async () => {
    const fetchMock = vi.fn(async () => {
      const response = sse(ANSWER);
      response.headers.set(AI_CHAT_CONVERSATION_HEADER, 'conv.sig');
      return response;
    });
    vi.stubGlobal('fetch', fetchMock);
    const onConversation = vi.fn();
    const backend = routeBackend({ headers: { 'x-csrf': '1' } });
    expect(backend.history).toBe('server');

    const transport = backend.createTransport(handlers({ getConversation: () => 'old.sig', onConversation, getVars: () => ({ page: 'x' }) }));
    await drain(await send(transport, [user('Hi'), user('Again', 'u2')]));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ai-chat');
    const body = JSON.parse(String(init.body));
    expect(body.message.id).toBe('u2');
    expect(body.conversation).toBe('old.sig');
    expect(body.vars).toEqual({ page: 'x' });
    expect(new Headers(init.headers).get('x-csrf')).toBe('1');
    expect(onConversation).toHaveBeenCalledWith('conv.sig');
  });

  it('loads a stored conversation, null when it is gone, and throws on a failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [user('Hi')] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('no', { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);
    const backend = routeBackend({ api: '/api/help' });

    expect(await backend.loadConversation!('a b')).toEqual([user('Hi')]);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/help/history?conversation=a%20b');
    expect(await backend.loadConversation!('gone')).toBeNull();
    expect(await backend.loadConversation!('empty')).toEqual([]);
    await expect(backend.loadConversation!('broken')).rejects.toThrow('502');
  });
});
