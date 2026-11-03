/**
 * Turns a conversation Chocolate Factory stored into AI SDK UIMessages the chat
 * can show. The conversations endpoint returns `{ …, messages: [{ role, parts }] }`;
 * this also accepts a bare array or a `data` wrapper, and drops anything it can't
 * place. Safe on the server (the proxy's history route uses it) and in the browser.
 */
import { isAttachmentLinkText } from './attachments';

export interface StoredUIMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<Record<string, unknown> & { type: string }>;
}

// Parts the chat knows how to render; tool parts are `tool-<name>` or `dynamic-tool`.
const KEPT_PART = /^(text|reasoning|source-url|source-document|file|dynamic-tool|tool-.+)$/;

function findMessageArray(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== 'object') return [];
  const record = json as Record<string, unknown>;
  for (const key of ['messages', 'data', 'conversation']) {
    const found = findMessageArray(record[key]);
    if (found.length) return found;
  }
  return [];
}

export function toUIMessages(json: unknown): StoredUIMessage[] {
  return findMessageArray(json).flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const message = raw as Record<string, unknown>;
    if (message.role !== 'user' && message.role !== 'assistant') return [];

    let parts: StoredUIMessage['parts'] = [];
    if (Array.isArray(message.parts)) {
      parts = message.parts.filter(
        (part): part is StoredUIMessage['parts'][number] =>
          !!part &&
          typeof part === 'object' &&
          typeof (part as { type?: unknown }).type === 'string' &&
          KEPT_PART.test((part as { type: string }).type)
      );
    } else if (typeof message.content === 'string') {
      parts = [{ type: 'text', text: message.content }];
    }
    if (message.role === 'user') {
      // Chocolate Factory's attachment links are for the agent; the chat shows the image itself.
      parts = parts.filter((part) => !(part.type === 'text' && typeof part.text === 'string' && isAttachmentLinkText(part.text)));
    }
    if (!parts.length) return [];

    // Chocolate Factory stores assistant messages with an empty id; the chat keys messages by id.
    const id = (typeof message.id === 'string' && message.id) || typeof message.id === 'number' ? String(message.id) : `stored-${index}`;
    return [{ id, role: message.role, parts }];
  });
}
