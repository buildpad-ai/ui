'use client';

import { memo, useState } from 'react';
import type { UIMessage } from 'ai';
import { ActionIcon, Anchor, CopyButton, Group, Text, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy, IconFileText, IconLink, IconSparkles } from '@tabler/icons-react';
import type { ChatTranslations } from '@buildpad/utils';
import { isShowableImage } from './attachments';
import { SentImage } from './AiChatImage';
import { AiChatMarkdown, type LinkTarget } from './AiChatMarkdown';

type Part = UIMessage['parts'][number];

const isToolPart = (part: Part) => part.type === 'dynamic-tool' || part.type.startsWith('tool-');

// Agents tend to narrate before each tool call ("I'll look that up.") even when
// their prompt says not to. A short text part that a tool call follows is that
// narration, not the answer: like the tool calls and reasoning, the chat leaves it
// out, shows one working word instead (WorkingWord), and keeps it out of Copy.
const MAX_NOTE_CHARS = 240;

export function isStepNote(parts: Part[], index: number): boolean {
  const part = parts[index];
  if (part?.type !== 'text' || part.text.trim().length > MAX_NOTE_CHARS || part.text.trim().includes('\n\n')) return false;
  return parts.slice(index + 1).some(isToolPart);
}

/**
 * Whether a part is answer text to show. While the reply streams, its newest text
 * could still turn out to be narration (the tool call that would make it one
 * hasn't arrived yet), so short text waits until it's clearly the answer.
 */
export function isAnswerText(parts: Part[], index: number, streaming: boolean): boolean {
  const part = parts[index];
  if (part?.type !== 'text' || !part.text.trim() || isStepNote(parts, index)) return false;
  const couldBeNarration = part.text.trim().length <= MAX_NOTE_CHARS && !part.text.trim().includes('\n\n');
  return !(streaming && index === parts.length - 1 && couldBeNarration);
}

/** Whether a reply that is still streaming is searching, reading or thinking, rather than writing its answer. */
export function isWorking(message: UIMessage | undefined): boolean {
  if (message?.role !== 'assistant') return true;
  const { parts } = message;
  const lastActivity = parts.reduce((last, part, index) => (isToolPart(part) || part.type === 'reasoning' ? index : last), -1);
  return !parts.some((_, index) => index > lastActivity && isAnswerText(parts, index, true));
}

/** A message's text without step notes: what Copy copies and what a chat's title is made from. */
export function messageText(message: UIMessage): string {
  return message.parts
    .filter((part, index): part is Extract<Part, { type: 'text' }> => part.type === 'text' && !isStepNote(message.parts, index))
    .map((part) => part.text)
    .join('\n\n')
    .trim();
}

function Sources({ parts, t }: { parts: Part[]; t: ChatTranslations }) {
  const sources = parts.flatMap((part): Array<{ key: string; href: string | null; title: string }> => {
    if (part.type === 'source-url') return [{ key: part.sourceId, href: part.url, title: part.title || part.url }];
    if (part.type === 'source-document') return [{ key: part.sourceId, href: null, title: part.title || part.filename || t.message.document }];
    return [];
  });
  if (!sources.length) return null;

  return (
    <div className="bp-ai-chat-sources">
      <Text size="xs" fw={600} c="dimmed" mb={4}>
        {t.message.sources}
      </Text>
      <Group gap={6}>
        {sources.map((source, index) =>
          source.href ? (
            <Anchor key={source.key ?? index} href={source.href} target="_blank" rel="noopener noreferrer" className="bp-ai-chat-chip">
              <IconLink size={12} />
              <span>{source.title}</span>
            </Anchor>
          ) : (
            <span key={source.key ?? index} className="bp-ai-chat-chip">
              <IconFileText size={12} />
              <span>{source.title}</span>
            </span>
          )
        )}
      </Group>
    </div>
  );
}

/** One word, picked per wait, from the moment a question is sent until the answer starts to appear. */
export function WorkingWord({ t }: { t: ChatTranslations }) {
  const [key] = useState(() => {
    const keys = Object.keys(t.working) as Array<keyof ChatTranslations['working']>;
    return keys[Math.floor(Math.random() * keys.length)];
  });
  return (
    <div className="bp-ai-chat-working" role="status">
      <IconSparkles size={14} className="bp-ai-chat-working-mark" aria-hidden />
      <span className="bp-ai-chat-working-word">{t.working[key]}…</span>
    </div>
  );
}

export interface AiChatMessageProps {
  message: UIMessage;
  /** This is the reply still being written. */
  streaming: boolean;
  t: ChatTranslations;
  linkTarget?: (href: string) => LinkTarget;
  onNavigate?: (href: string) => void;
  imageHosts: readonly string[];
}

export const AiChatMessage = memo(function AiChatMessage({ message, streaming, t, linkTarget, onNavigate, imageHosts }: AiChatMessageProps) {
  if (message.role === 'user') {
    const images = message.parts.filter((part) => part.type === 'file' && (part.url === '' || isShowableImage(part)));
    const text = messageText(message);
    return (
      <div className="bp-ai-chat-user-row">
        {images.length > 0 && (
          <div className="bp-ai-chat-sent-images">
            {images.map((part, index) => (
              <SentImage key={index} src={part.type === 'file' ? part.url : ''} name={part.type === 'file' ? part.filename : undefined} t={t} />
            ))}
          </div>
        )}
        {text && <div className="bp-ai-chat-user-bubble">{text}</div>}
      </div>
    );
  }

  const text = messageText(message);

  return (
    <div className="bp-ai-chat-assistant-row">
      {message.parts.map((part, index) => {
        if (part.type === 'text') {
          return isAnswerText(message.parts, index, streaming) ? (
            <AiChatMarkdown key={index} text={part.text} t={t} linkTarget={linkTarget} onNavigate={onNavigate} imageHosts={imageHosts} />
          ) : null;
        }
        if (part.type === 'file') {
          return (
            <Anchor key={index} href={part.url} target="_blank" rel="noopener noreferrer" size="sm" className="bp-ai-chat-chip">
              <IconFileText size={12} />
              <span>{part.filename ?? t.message.file}</span>
            </Anchor>
          );
        }
        // Tool calls, reasoning and step markers: the working word stands in for them.
        return null;
      })}

      <Sources parts={message.parts} t={t} />

      {!streaming && text && (
        <Group gap={2} className="bp-ai-chat-message-actions">
          <CopyButton value={text} timeout={1500}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? t.message.copied : t.message.copyAnswer} withArrow>
                <ActionIcon variant="subtle" color={copied ? 'teal' : 'gray'} size="sm" onClick={copy} aria-label={t.message.copyAnswer}>
                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </Group>
      )}
    </div>
  );
});
