'use client';

import { memo, useMemo, type MouseEvent } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ActionIcon, Code, CopyButton, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy, IconExternalLink } from '@tabler/icons-react';
import type { ChatTranslations } from '@buildpad/utils';
import { AnswerImage } from './AiChatImage';

export type LinkTarget = '_self' | '_blank';

/** Default link behaviour: this app's own pages open in place, everything else in a new tab. */
export function defaultLinkTarget(href: string, origin?: string): LinkTarget {
  if (href.startsWith('#') || (href.startsWith('/') && !href.startsWith('//'))) return '_self';
  try {
    return origin && new URL(href).origin === origin ? '_self' : '_blank';
  } catch {
    return '_blank';
  }
}

export interface AiChatMarkdownProps {
  text: string;
  t: ChatTranslations;
  linkTarget?: (href: string) => LinkTarget;
  /** Client-side navigation for links that open in place (e.g. Next.js `router.push`). */
  onNavigate?: (href: string) => void;
  imageHosts: readonly string[];
}

/** An answer's Markdown: GitHub-flavoured, with copyable code blocks, scrollable tables and guarded images. */
export const AiChatMarkdown = memo(function AiChatMarkdown({ text, t, linkTarget, onNavigate, imageHosts }: AiChatMarkdownProps) {
  const components = useMemo<Components>(
    () => ({
      a({ href = '', children }) {
        const origin = typeof window === 'undefined' ? undefined : window.location.origin;
        const target = linkTarget ? linkTarget(href) : defaultLinkTarget(href, origin);
        if (target === '_self') {
          const onClick = onNavigate
            ? (event: MouseEvent<HTMLAnchorElement>) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                event.preventDefault();
                onNavigate(href);
              }
            : undefined;
          return (
            <a href={href} onClick={onClick}>
              {children}
            </a>
          );
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
            <IconExternalLink size={12} className="bp-ai-chat-external-icon" aria-label={t.message.opensInNewTab} />
          </a>
        );
      },
      pre({ children }) {
        return <>{children}</>;
      },
      code({ className, children }) {
        const code = String(children ?? '').replace(/\n$/, '');
        const isBlock = /language-/.test(className ?? '') || code.includes('\n');
        if (!isBlock) return <Code>{children}</Code>;
        return (
          <div className="bp-ai-chat-code-block">
            <Code block>{code}</Code>
            <CopyButton value={code} timeout={1500}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? t.message.copied : t.message.copyCode} withArrow position="left">
                  <ActionIcon className="bp-ai-chat-code-copy" variant="subtle" color={copied ? 'teal' : 'gray'} size="sm" onClick={copy} aria-label={t.message.copyCode}>
                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </div>
        );
      },
      img({ src, alt }) {
        return typeof src === 'string' ? <AnswerImage src={src} alt={alt ?? ''} hosts={imageHosts} t={t} /> : null;
      },
      table({ children }) {
        return (
          <div className="bp-ai-chat-table-scroll">
            <table>{children}</table>
          </div>
        );
      },
    }),
    [t, linkTarget, onNavigate, imageHosts]
  );

  return (
    <div className="bp-ai-chat-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
