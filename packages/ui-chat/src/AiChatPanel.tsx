'use client';

import { useEffect, type CSSProperties } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { AiChat, type AiChatProps } from './AiChat';
import { useAiChat } from './AiChatProvider';

export interface AiChatPanelProps extends AiChatProps {
  /** Shown or hidden. Default: the `AiChatProvider` state. */
  opened?: boolean;
  /** Called by the close button and Escape. Default: the `AiChatProvider`'s close. */
  onClose?: () => void;
  /** Width in px. Default 420. */
  width?: number;
  /** From this viewport width the panel docks (the app makes room); below it, it overlays. Default `75em`. */
  dockFrom?: string;
}

/**
 * The chat as a panel docked to the right edge at full height. While it is open
 * and docked, it sets `--bp-ai-chat-offset` on `<html>`; give the app's main area
 * `margin-inline-end: var(--bp-ai-chat-offset, 0)` so the page makes room instead
 * of being covered. Below `dockFrom` it overlays the page; on phones it is full screen.
 */
export function AiChatPanel({ opened: openedProp, onClose: onCloseProp, width = 420, dockFrom = '75em', ...chat }: AiChatPanelProps) {
  const context = useAiChat();
  const opened = openedProp ?? context?.opened ?? false;
  const onClose = onCloseProp ?? context?.close;
  const docked = useMediaQuery(`(min-width: ${dockFrom})`) && opened;

  useEffect(() => {
    const root = document.documentElement;
    if (docked) root.style.setProperty('--bp-ai-chat-offset', `${width}px`);
    else root.style.removeProperty('--bp-ai-chat-offset');
    return () => {
      root.style.removeProperty('--bp-ai-chat-offset');
    };
  }, [docked, width]);

  return (
    <aside
      className="bp-ai-chat-panel"
      data-opened={opened || undefined}
      data-docked={docked || undefined}
      style={{ '--bp-ai-chat-width': `${width}px` } as CSSProperties}
      aria-hidden={!opened}
      inert={!opened}
    >
      <AiChat {...chat} active={opened} onClose={onClose} />
    </aside>
  );
}
