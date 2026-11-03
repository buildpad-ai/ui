'use client';

import { ActionIcon, Button, Group, Kbd, Tooltip } from '@mantine/core';
import { useOs } from '@mantine/hooks';
import { IconSparkles } from '@tabler/icons-react';
import type { ChatTranslations, DeepPartial } from '@buildpad/utils';
import { useAiChat, useChatStrings } from './AiChatProvider';

/** "mod+I" → "⌘ I" on macOS, "Ctrl I" elsewhere. */
export function formatHotkey(hotkey: string, macos: boolean): string {
  return hotkey
    .split('+')
    .map((key) => {
      const lower = key.toLowerCase();
      if (lower === 'mod') return macos ? '⌘' : 'Ctrl';
      if (lower === 'shift') return macos ? '⇧' : 'Shift';
      if (lower === 'alt') return macos ? '⌥' : 'Alt';
      if (lower === 'ctrl') return 'Ctrl';
      return key.length === 1 ? key.toUpperCase() : key;
    })
    .join(' ');
}

export interface AiChatButtonProps {
  /** Button text. Default "Ask AI". */
  label?: string;
  translations?: DeepPartial<ChatTranslations>;
}

/**
 * Header button that opens and closes the chat, with the shortcut in its tooltip.
 * A labelled button rather than a bare icon: the label is what tells people the
 * app can answer questions. Below the `md` breakpoint it collapses to the icon.
 * Needs an `AiChatProvider` above it; renders nothing without one.
 */
export function AiChatButton({ label, translations }: AiChatButtonProps) {
  const t = useChatStrings(translations);
  const chat = useAiChat();
  const os = useOs();
  if (!chat) return null;

  const { opened, toggle, hotkey } = chat;
  const tooltip = (
    <Group gap={6} wrap="nowrap">
      <span>{opened ? t.button.close : t.button.open}</span>
      {hotkey && <Kbd size="xs">{formatHotkey(hotkey, os === 'macos')}</Kbd>}
    </Group>
  );
  const shortcut = hotkey ? hotkey.replace(/mod/i, os === 'macos' ? 'Meta' : 'Control') : undefined;
  const text = label ?? t.button.label;

  return (
    <Tooltip label={tooltip}>
      <span>
        <Button
          visibleFrom="md"
          variant={opened ? 'filled' : 'light'}
          size="sm"
          radius="xl"
          leftSection={<IconSparkles size={16} />}
          onClick={toggle}
          aria-pressed={opened}
          aria-keyshortcuts={shortcut}
        >
          {text}
        </Button>
        <ActionIcon
          hiddenFrom="md"
          variant={opened ? 'filled' : 'light'}
          size="lg"
          onClick={toggle}
          aria-label={text}
          aria-pressed={opened}
          aria-keyshortcuts={shortcut}
        >
          <IconSparkles size={20} />
        </ActionIcon>
      </span>
    </Tooltip>
  );
}
