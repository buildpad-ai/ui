'use client';

import { useState, type CSSProperties } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconMessageChatbot, IconX } from '@tabler/icons-react';
import { AiChat, type AiChatProps } from './AiChat';
import { useAiChat, useChatStrings } from './AiChatProvider';

export interface AiChatWidgetProps extends AiChatProps {
  /** Shown or hidden. Default: the `AiChatProvider` state, or the widget's own. */
  opened?: boolean;
  /** Called when the launcher or the close button asks to open or close. */
  onOpenChange?: (opened: boolean) => void;
  /** Open on first render, when the widget keeps its own state. */
  defaultOpened?: boolean;
  /** Corner the launcher sits in. Default `bottom-right`. */
  position?: 'bottom-right' | 'bottom-left';
  /** The launcher's label (tooltip and accessible name). Default "Open assistant". */
  launcherLabel?: string;
  /** Window width in px. Default 400. */
  width?: number;
}

/**
 * The chat as a floating widget: a launcher bubble in a bottom corner that opens
 * a chat window above it. On phones the window fills the screen. Works on its own,
 * or shares state with `AiChatButton` inside an `AiChatProvider`.
 */
export function AiChatWidget({
  opened: openedProp,
  onOpenChange,
  defaultOpened = false,
  position = 'bottom-right',
  launcherLabel,
  width = 400,
  ...chat
}: AiChatWidgetProps) {
  const t = useChatStrings(chat.translations);
  const context = useAiChat();
  const [ownOpened, setOwnOpened] = useState(defaultOpened);
  const opened = openedProp ?? context?.opened ?? ownOpened;

  const setOpened = (next: boolean) => {
    if (openedProp === undefined) {
      if (context) {
        if (next) context.open();
        else context.close();
      } else {
        setOwnOpened(next);
      }
    }
    onOpenChange?.(next);
  };

  const label = opened ? t.widget.close : (launcherLabel ?? t.widget.open);

  return (
    <div className="bp-ai-chat-widget" data-position={position} style={{ '--bp-ai-chat-width': `${width}px` } as CSSProperties}>
      <div className="bp-ai-chat-window" data-opened={opened || undefined} aria-hidden={!opened} inert={!opened}>
        <AiChat {...chat} active={opened} onClose={() => setOpened(false)} />
      </div>
      <Tooltip label={label} position={position === 'bottom-left' ? 'right' : 'left'} withArrow>
        <ActionIcon
          className="bp-ai-chat-launcher"
          size={56}
          radius="xl"
          variant="filled"
          onClick={() => setOpened(!opened)}
          aria-label={label}
          aria-expanded={opened}
        >
          {opened ? <IconX size={24} /> : <IconMessageChatbot size={26} />}
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
