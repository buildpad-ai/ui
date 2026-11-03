'use client';

import { useState } from 'react';
import { Anchor, Group, Modal, Text } from '@mantine/core';
import { IconExternalLink, IconPhotoOff } from '@tabler/icons-react';
import { interpolate, type ChatTranslations } from '@buildpad/utils';

/** Whether an answer may show an image from `src`: HTTPS on one of the allowed hosts. */
export function isAllowedImage(src: string, hosts: readonly string[]): boolean {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && hosts.includes(url.hostname);
  } catch {
    return false;
  }
}

function FullSizeImage({ src, alt, opened, onClose, title, t }: { src: string; alt: string; opened: boolean; onClose: () => void; title: string; t: ChatTranslations }) {
  return (
    <Modal opened={opened} onClose={onClose} size="min(1100px, 92vw)" centered title={<Text size="sm" fw={600} lineClamp={2}>{title}</Text>}>
      <img src={src} alt={alt} className="bp-ai-chat-image-full" />
      {src.startsWith('https://') && (
        <Group justify="flex-end" mt="xs">
          <Anchor href={src} target="_blank" rel="noopener noreferrer" size="xs">
            {t.message.openInNewTab} <IconExternalLink size={12} style={{ verticalAlign: -1 }} />
          </Anchor>
        </Group>
      )}
    </Modal>
  );
}

/**
 * An image the user sent with a question: a thumbnail above their message that
 * opens full size on click. Chocolate Factory's links to stored images expire
 * after 7 days, and transcripts kept in the browser hold no image data, so an
 * older chat shows a placeholder instead.
 */
export function SentImage({ src, name, t }: { src: string; name?: string; t: ChatTranslations }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const label = name || t.message.attachedImage;

  if (failed || !src) {
    return (
      <span className="bp-ai-chat-image-blocked" title={label}>
        <IconPhotoOff size={12} />
        {t.message.imageUnavailable}
      </span>
    );
  }

  return (
    <>
      <button type="button" className="bp-ai-chat-sent-image" onClick={() => setOpen(true)} aria-label={interpolate(t.message.enlarge, { name: label })}>
        <img src={src} alt={label} loading="lazy" onError={() => setFailed(true)} />
      </button>
      <FullSizeImage src={src} alt={label} title={label} opened={open} onClose={() => setOpen(false)} t={t} />
    </>
  );
}

/**
 * An image inside an answer. Only allowed hosts are fetched (an answer is model
 * output, and an image URL can carry data out to any server); anything else shows
 * its alt text instead. Fits the chat, captioned with its alt text, full size on click.
 */
export function AnswerImage({ src, alt, hosts, t }: { src: string; alt: string; hosts: readonly string[]; t: ChatTranslations }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  if (!isAllowedImage(src, hosts)) {
    return (
      <span className="bp-ai-chat-image-blocked">
        <IconPhotoOff size={12} />
        {alt || t.message.image}
      </span>
    );
  }
  // A dead link is noise in an answer; the text around it still stands.
  if (failed) return null;

  return (
    <>
      {/* <button> and <span>, not <figure>: react-markdown puts images inside a <p>. */}
      <button type="button" className="bp-ai-chat-figure" onClick={() => setOpen(true)} aria-label={interpolate(t.message.enlarge, { name: alt || t.message.image })}>
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="bp-ai-chat-image" />
        {alt && <span className="bp-ai-chat-image-caption">{alt}</span>}
      </button>
      <FullSizeImage src={src} alt={alt} title={alt || t.message.image} opened={open} onClose={() => setOpen(false)} t={t} />
    </>
  );
}
