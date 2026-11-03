/**
 * How the chat reaches its agent. A backend turns the chat's newest message into a
 * request and streams the answer back (an AI SDK transport); it also says who keeps
 * the conversation. Two ship with the module:
 *
 * - `chocolateFactoryBackend` calls the Chocolate Factory run endpoint straight from
 *   the browser. No server route is in the way, so answers stream even where the
 *   app's routes are buffered Lambdas (Amplify Hosting). The key is visible to the
 *   browser. Chocolate Factory's CORS headers don't expose `X-Conversation-Id`, so
 *   the browser can't continue a conversation Chocolate Factory stores: this backend
 *   sends the whole transcript every turn (stateless mode) and the chat keeps
 *   transcripts in the browser.
 * - `routeBackend` posts to the app's own route (scaffolded by `ai-chat-proxy-routes`),
 *   which adds the key on the server and keeps the conversation in Chocolate Factory.
 *   It streams only where that route runs on a long-lived server.
 */
import { DefaultChatTransport, type ChatTransport, type UIMessage } from 'ai';

export interface AiChatBackendHandlers {
  /** The conversation the next message continues, or null for a new one. */
  getConversation(): string | null;
  /** The backend learned the open conversation's id (a server backend, on the first turn). */
  onConversation(id: string): void;
  /** Template variables for the agent's prompt, sent with every message. */
  getVars(): Record<string, unknown> | undefined;
}

export interface AiChatBackend {
  /**
   * Who keeps the transcript. `server`: the backend stores conversations and loads
   * them back by id (`loadConversation`). `client`: the chat keeps transcripts in the
   * browser (local storage, without image data).
   */
  history: 'server' | 'client';
  createTransport(handlers: AiChatBackendHandlers): ChatTransport<UIMessage>;
  /** `server` history: a stored conversation's messages, or null when it no longer exists. */
  loadConversation?(id: string): Promise<UIMessage[] | null>;
}

export interface ChocolateFactoryConfig {
  /** The Chocolate Factory instance, e.g. https://app.chocolatefactory.ai (a Run API URL is trimmed to it). */
  baseUrl: string;
  agentId: string;
  /** An agent key (`agk_…`) or a project/organization key (`cf_…`). */
  apiKey: string;
}

/** The instance's base URL, also when given the agent's full Run API URL. */
export function chocolateFactoryBaseUrl(url: string): string {
  return url.trim().replace(/\/api\/agents(\/.*)?$/, '').replace(/\/+$/, '');
}

/**
 * The auth header for a key: an agent key (`agk_…`) goes in `x-agent-key` and can
 * only reach that agent; a project/organization key (`cf_…`) goes in `cf-api-key`.
 */
export function chocolateFactoryAuthHeaders(apiKey: string): Record<string, string> {
  return apiKey.startsWith('agk_') ? { 'x-agent-key': apiKey } : { 'cf-api-key': apiKey };
}

/**
 * A message as the agent should see it again: its text and images. Tool calls,
 * reasoning and sources are the agent's own working; images reopened from local
 * storage have no data left and are dropped.
 */
export function forAgent(message: UIMessage): UIMessage | null {
  const parts = message.parts.filter(
    (part) => (part.type === 'text' && part.text.trim() !== '') || (part.type === 'file' && part.url !== '')
  );
  return parts.length ? { id: message.id, role: message.role, parts } : null;
}

function resolveVars(getVars: () => Record<string, unknown> | undefined) {
  const vars = getVars();
  return vars && Object.keys(vars).length ? { vars } : {};
}

/** Browser-direct Chocolate Factory (stateless mode). See the file header for the trade-off. */
export function chocolateFactoryBackend(config: ChocolateFactoryConfig): AiChatBackend {
  const baseUrl = chocolateFactoryBaseUrl(config.baseUrl);
  return {
    history: 'client',
    createTransport: ({ getVars }) =>
      new DefaultChatTransport({
        api: `${baseUrl}/api/agents/${encodeURIComponent(config.agentId)}/run`,
        headers: { Accept: 'text/event-stream', ...chocolateFactoryAuthHeaders(config.apiKey) },
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages: messages.map(forAgent).filter((message): message is UIMessage => message !== null),
            ...resolveVars(getVars),
          },
        }),
      }),
  };
}

/** Response header the proxy route returns a new conversation's signed id in. */
export const AI_CHAT_CONVERSATION_HEADER = 'X-Ai-Chat-Conversation';

export interface RouteBackendOptions {
  /** The chat route. Default `/api/ai-chat`. */
  api?: string;
  /** The history route. Default `${api}/history`. */
  historyApi?: string;
  /** Extra request headers, e.g. a CSRF token. */
  headers?: Record<string, string>;
}

/** The app's own proxy route (`ai-chat-proxy-routes`), which keeps conversations in Chocolate Factory. */
export function routeBackend({ api = '/api/ai-chat', historyApi, headers }: RouteBackendOptions = {}): AiChatBackend {
  const history = historyApi ?? `${api}/history`;
  return {
    history: 'server',
    createTransport: ({ getConversation, onConversation, getVars }) =>
      new DefaultChatTransport({
        api,
        headers,
        // Chocolate Factory keeps the history, so only the newest turn is sent.
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            message: messages[messages.length - 1],
            conversation: getConversation(),
            ...resolveVars(getVars),
          },
        }),
        fetch: async (url, init) => {
          const res = await fetch(url, init);
          const conversation = res.headers.get(AI_CHAT_CONVERSATION_HEADER);
          if (conversation) onConversation(conversation);
          return res;
        },
      }),
    async loadConversation(id) {
      const res = await fetch(`${history}?conversation=${encodeURIComponent(id)}`, { headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Loading the conversation failed (${res.status})`);
      const data = (await res.json()) as { messages?: unknown };
      return Array.isArray(data.messages) ? (data.messages as UIMessage[]) : [];
    },
  };
}
