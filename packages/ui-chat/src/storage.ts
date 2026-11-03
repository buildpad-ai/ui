/**
 * What the chat remembers in the browser, per `storageKey` (pass the signed-in
 * user's id): the open conversation and a short recent list. A backend that keeps
 * conversations itself (the server proxy) is only given their ids here; with a
 * backend that doesn't (browser-direct Chocolate Factory), the transcripts are
 * kept here too, without image data.
 */
import type { UIMessage } from 'ai';

export interface RecentChat {
  id: string;
  title: string;
  at: number;
}

export interface ChatMemory {
  current: string | null;
  recent: RecentChat[];
}

export const MAX_RECENT = 8;
/** Messages kept per stored transcript: the newest ones. */
const MAX_STORED_MESSAGES = 60;

const EMPTY: ChatMemory = { current: null, recent: [] };

const memoryKey = (storageKey: string) => `buildpad.ai-chat.v1.${storageKey}`;
const transcriptKey = (storageKey: string, id: string) => `${memoryKey(storageKey)}.chat.${id}`;

function read(key: string): unknown {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows and full storage just lose the memory; the chat still works.
  }
}

function remove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // As above.
  }
}

export function loadChatMemory(storageKey: string): ChatMemory {
  const raw = read(memoryKey(storageKey)) as Partial<ChatMemory> | null;
  if (!raw || typeof raw !== 'object') return EMPTY;
  return {
    current: typeof raw.current === 'string' ? raw.current : null,
    recent: Array.isArray(raw.recent)
      ? raw.recent.filter((item) => typeof item?.id === 'string' && typeof item?.title === 'string').slice(0, MAX_RECENT)
      : [],
  };
}

export function saveChatMemory(storageKey: string, memory: ChatMemory) {
  write(memoryKey(storageKey), memory);
}

/** Puts a chat at the top of the recent list (adding or refreshing it); returns the ids pushed off the end. */
export function rememberChat(memory: ChatMemory, entry: RecentChat): { memory: ChatMemory; evicted: string[] } {
  const rest = memory.recent.filter((item) => item.id !== entry.id);
  const recent = [entry, ...rest];
  return {
    memory: { ...memory, current: entry.id, recent: recent.slice(0, MAX_RECENT) },
    evicted: recent.slice(MAX_RECENT).map((item) => item.id),
  };
}

/**
 * Drops a chat from the recent list (and closes it if it was open). This only
 * forgets the browser's link to it: a backend that stored the conversation keeps it.
 */
export function forgetChat(memory: ChatMemory, id: string): ChatMemory {
  return {
    ...memory,
    current: memory.current === id ? null : memory.current,
    recent: memory.recent.filter((item) => item.id !== id),
  };
}

/** Image data is too large for local storage; a stored image reopens as "no longer available". */
function withoutImageData(message: UIMessage): UIMessage {
  return {
    ...message,
    parts: message.parts.map((part) =>
      part.type === 'file' && part.url.startsWith('data:') ? { ...part, url: '' } : part
    ),
  };
}

export function loadTranscript(storageKey: string, id: string): UIMessage[] | null {
  const raw = read(transcriptKey(storageKey, id));
  return Array.isArray(raw) ? (raw as UIMessage[]) : null;
}

export function saveTranscript(storageKey: string, id: string, messages: UIMessage[]) {
  write(transcriptKey(storageKey, id), messages.slice(-MAX_STORED_MESSAGES).map(withoutImageData));
}

export function deleteTranscript(storageKey: string, id: string) {
  remove(transcriptKey(storageKey, id));
}
