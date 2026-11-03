'use client';

import type { ReactNode } from 'react';
import { Tooltip, UnstyledButton } from '@mantine/core';
import { IconMapPin, IconX } from '@tabler/icons-react';

export interface AiChatContextChipProps {
  /** What is shared, e.g. "Orders › #1042". */
  label: ReactNode;
  /** Full text on hover, e.g. the page's path. */
  title?: string;
  icon?: ReactNode;
  /** Shows a remove button; call it to stop sharing. */
  onRemove?: () => void;
  /** The remove button's tooltip and accessible name. */
  removeLabel?: string;
}

/**
 * A small chip for the chat's `context` slot, saying what the agent is told about
 * (the current page, a selected record). Pair it with the `vars` you send.
 */
export function AiChatContextChip({ label, title, icon, onRemove, removeLabel }: AiChatContextChipProps) {
  return (
    <span className="bp-ai-chat-context-chip" title={title}>
      {icon ?? <IconMapPin size={12} />}
      <span className="bp-ai-chat-context-text">{label}</span>
      {onRemove && (
        <Tooltip label={removeLabel} withArrow disabled={!removeLabel}>
          <UnstyledButton className="bp-ai-chat-context-remove" onClick={onRemove} aria-label={removeLabel}>
            <IconX size={12} />
          </UnstyledButton>
        </Tooltip>
      )}
    </span>
  );
}
