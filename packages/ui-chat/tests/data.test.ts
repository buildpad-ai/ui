import { afterEach, describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import { isAttachmentLinkText, isShowableImage, parseImagePart } from '../src/attachments';
import { toUIMessages } from '../src/history';
import {
  deleteTranscript,
  forgetChat,
  loadChatMemory,
  loadTranscript,
  MAX_RECENT,
  rememberChat,
  saveChatMemory,
  saveTranscript,
} from '../src/storage';
import { isAnswerText, isStepNote, isWorking, messageText } from '../src/AiChatMessage';
import { defaultLinkTarget } from '../src/AiChatMarkdown';
import { isAllowedImage } from '../src/AiChatImage';
import { formatHotkey } from '../src/AiChatButton';
import { dataUrlToBlob, localStamp } from '../src/capture';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('parseImagePart', () => {
  it('accepts an inline image of a supported type, with a cleaned file name', () => {
    expect(parseImagePart({ type: 'file', mediaType: 'image/png', url: PNG, filename: '../a/b<c>.png' })).toEqual({
      type: 'file',
      mediaType: 'image/png',
      filename: 'bc.png',
      url: PNG,
    });
    expect(parseImagePart({ type: 'file', mediaType: 'image/png', url: PNG, filename: '///' })).toEqual({ type: 'file', mediaType: 'image/png', url: PNG });
  });

  it('refuses remote URLs, other types, mismatched types and oversized data', () => {
    expect(parseImagePart({ type: 'file', mediaType: 'image/png', url: 'https://evil.example.com/x.png' })).toBeNull();
    expect(parseImagePart({ type: 'file', mediaType: 'image/svg+xml', url: 'data:image/svg+xml;base64,AA==' })).toBeNull();
    expect(parseImagePart({ type: 'file', mediaType: 'image/jpeg', url: PNG })).toBeNull();
    expect(parseImagePart({ type: 'file', mediaType: 'image/png', url: `data:image/png;base64,${'A'.repeat(2_200_001)}` })).toBeNull();
    expect(parseImagePart({ type: 'text', text: 'x' })).toBeNull();
    expect(parseImagePart(null)).toBeNull();
  });
});

describe('attachment helpers', () => {
  it("recognises Chocolate Factory's attachment link text", () => {
    expect(isAttachmentLinkText('[Attachment: a.png]\nFile URL: https://x/y')).toBe(true);
    expect(isAttachmentLinkText('Here is my question')).toBe(false);
  });

  it('shows data URLs and HTTPS links, nothing else', () => {
    expect(isShowableImage({ type: 'file', mediaType: 'image/png', url: PNG })).toBe(true);
    expect(isShowableImage({ type: 'file', mediaType: 'image/png', url: 'https://x/y.png' })).toBe(true);
    expect(isShowableImage({ type: 'file', mediaType: 'image/png', url: 'http://x/y.png' })).toBe(false);
    expect(isShowableImage({ type: 'file', mediaType: 'application/pdf', url: PNG })).toBe(false);
    expect(isShowableImage({ type: 'text' })).toBe(false);
  });

  it('turns a data URL back into a blob and stamps screenshot names', async () => {
    const blob = dataUrlToBlob(PNG);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
    expect(localStamp(new Date(2026, 10, 2, 14, 5, 9))).toBe('2026-11-02 14.05.09');
  });
});

describe('toUIMessages', () => {
  it("reads Chocolate Factory's stored conversation and drops what the chat can't show", () => {
    expect(
      toUIMessages({
        id: 'c',
        messages: [
          { role: 'user', parts: [{ type: 'text', text: 'Hi' }, { type: 'text', text: '[Attachment: a.png]\nFile URL: https://x' }] },
          { id: '', role: 'assistant', parts: [{ type: 'step-start' }, { type: 'text', text: 'Hello' }, { type: 'tool-search', state: 'output-available' }] },
          { id: 7, role: 'assistant', content: 'Plain' },
          { role: 'system', content: 'prompt' },
          { role: 'user', parts: [{ type: 'text', text: '[Attachment: a.png]\nFile URL: https://x' }] },
          'junk',
        ],
      })
    ).toEqual([
      { id: 'stored-0', role: 'user', parts: [{ type: 'text', text: 'Hi' }] },
      { id: 'stored-1', role: 'assistant', parts: [{ type: 'text', text: 'Hello' }, { type: 'tool-search', state: 'output-available' }] },
      { id: '7', role: 'assistant', parts: [{ type: 'text', text: 'Plain' }] },
    ]);
    expect(toUIMessages({ data: [{ id: 'x', role: 'user', content: 'Q' }] })).toHaveLength(1);
    expect(toUIMessages('nope')).toEqual([]);
  });
});

describe('storage', () => {
  afterEach(() => window.localStorage.clear());

  it('keeps the recent list per storage key, newest first, and reports evictions', () => {
    let memory = loadChatMemory('u1');
    expect(memory).toEqual({ current: null, recent: [] });
    const evictedAll: string[] = [];
    for (let i = 0; i < MAX_RECENT + 2; i += 1) {
      const { memory: next, evicted } = rememberChat(memory, { id: `c${i}`, title: `Chat ${i}`, at: i });
      memory = next;
      evictedAll.push(...evicted);
    }
    expect(memory.current).toBe(`c${MAX_RECENT + 1}`);
    expect(memory.recent).toHaveLength(MAX_RECENT);
    expect(evictedAll).toEqual(['c0', 'c1']);

    saveChatMemory('u1', memory);
    expect(loadChatMemory('u1').recent[0].id).toBe(`c${MAX_RECENT + 1}`);
    expect(loadChatMemory('u2').recent).toEqual([]);

    const forgotten = forgetChat(memory, memory.current!);
    expect(forgotten.current).toBeNull();
    expect(forgotten.recent.some((item) => item.id === memory.current)).toBe(false);
    expect(forgetChat(memory, 'c5').current).toBe(memory.current);
  });

  it('ignores corrupt storage', () => {
    window.localStorage.setItem('buildpad.ai-chat.v1.bad', '{not json');
    expect(loadChatMemory('bad')).toEqual({ current: null, recent: [] });
    window.localStorage.setItem('buildpad.ai-chat.v1.odd', JSON.stringify({ current: 4, recent: [{ id: 1 }, { id: 'a', title: 'A', at: 1 }] }));
    expect(loadChatMemory('odd')).toEqual({ current: null, recent: [{ id: 'a', title: 'A', at: 1 }] });
  });

  it('stores transcripts without image data and deletes them', () => {
    const messages: UIMessage[] = [
      { id: 'u', role: 'user', parts: [{ type: 'text', text: 'Look' }, { type: 'file', mediaType: 'image/png', url: PNG }] },
      { id: 'a', role: 'assistant', parts: [{ type: 'file', mediaType: 'image/png', url: 'https://x/y.png' }] },
    ];
    saveTranscript('u1', 'c1', messages);
    const stored = loadTranscript('u1', 'c1')!;
    expect(stored[0].parts[1]).toEqual({ type: 'file', mediaType: 'image/png', url: '' });
    expect(stored[1].parts[0]).toEqual({ type: 'file', mediaType: 'image/png', url: 'https://x/y.png' });
    deleteTranscript('u1', 'c1');
    expect(loadTranscript('u1', 'c1')).toBeNull();
  });
});

describe('message helpers', () => {
  const narrated: UIMessage = {
    id: 'a',
    role: 'assistant',
    parts: [
      { type: 'text', text: "I'll look that up." },
      { type: 'dynamic-tool', toolName: 'search', toolCallId: 't', state: 'output-available', input: {}, output: 'x' },
      { type: 'text', text: 'The answer.' },
    ],
  };

  it('treats short text before a tool call as narration, not the answer', () => {
    expect(isStepNote(narrated.parts, 0)).toBe(true);
    expect(isStepNote(narrated.parts, 2)).toBe(false);
    expect(messageText(narrated)).toBe('The answer.');
    expect(isAnswerText(narrated.parts, 2, false)).toBe(true);
    // While streaming, short trailing text could still be narration.
    expect(isAnswerText(narrated.parts, 2, true)).toBe(false);
    expect(isAnswerText(narrated.parts, 1, false)).toBe(false);
  });

  it('is working until answer text follows the last tool call', () => {
    expect(isWorking(undefined)).toBe(true);
    expect(isWorking({ id: 'u', role: 'user', parts: [] })).toBe(true);
    expect(isWorking({ ...narrated, parts: narrated.parts.slice(0, 2) })).toBe(true);
    const long = 'A long answer. '.repeat(30);
    expect(isWorking({ ...narrated, parts: [...narrated.parts.slice(0, 2), { type: 'text', text: long }] })).toBe(false);
  });

  it('opens app pages in place and the rest in a new tab', () => {
    expect(defaultLinkTarget('/settings', 'https://app.example.com')).toBe('_self');
    expect(defaultLinkTarget('#top')).toBe('_self');
    expect(defaultLinkTarget('https://app.example.com/x', 'https://app.example.com')).toBe('_self');
    expect(defaultLinkTarget('https://other.example.com/x', 'https://app.example.com')).toBe('_blank');
    expect(defaultLinkTarget('//other.example.com/x')).toBe('_blank');
    expect(defaultLinkTarget('not a url')).toBe('_blank');
  });

  it('only loads answer images from allowed HTTPS hosts', () => {
    expect(isAllowedImage('https://docs.example.com/a.png', ['docs.example.com'])).toBe(true);
    expect(isAllowedImage('http://docs.example.com/a.png', ['docs.example.com'])).toBe(false);
    expect(isAllowedImage('https://evil.example.com/a.png?d=secret', ['docs.example.com'])).toBe(false);
    expect(isAllowedImage('nope', ['docs.example.com'])).toBe(false);
  });

  it('prints shortcuts the way each platform does', () => {
    expect(formatHotkey('mod+I', true)).toBe('⌘ I');
    expect(formatHotkey('mod+I', false)).toBe('Ctrl I');
    expect(formatHotkey('mod+shift+k', true)).toBe('⌘ ⇧ K');
    expect(formatHotkey('alt+ctrl+Enter', false)).toBe('Alt Ctrl Enter');
    expect(formatHotkey('shift+alt+j', false)).toBe('Shift Alt J');
    expect(formatHotkey('alt+j', true)).toBe('⌥ J');
  });
});
