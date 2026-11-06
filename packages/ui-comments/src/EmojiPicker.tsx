'use client';

import { useState } from 'react';
import { ActionIcon, Popover, Tooltip } from '@mantine/core';
import { IconMoodSmile } from '@tabler/icons-react';
import { interpolate, type CommentsTranslations } from '@buildpad/utils';

type Tab = keyof CommentsTranslations['emoji']['tabs'];

/** About a hundred curated emoji in four tabs: enough for a comment, no dependency. */
export const EMOJI_TABS: Record<Tab, string[]> = {
  smileys: [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🙂', '😉', '😊',
    '😍', '🥰', '😘', '😎', '🤔', '😐', '😴', '😢', '😭', '😮',
    '😱', '😡', '🤯', '🥳', '😇', '🙃', '😬', '🤗', '😌', '🤝',
  ],
  gestures: [
    '👍', '👎', '👏', '🙌', '🙏', '👌', '✌️', '🤞', '💪', '👋',
    '👀', '🫡', '🤷', '🙋', '🤦', '☝️', '👇', '👉', '👈', '🫶',
  ],
  work: [
    '✅', '❌', '⚠️', '❗', '❓', '💡', '📌', '📎', '📝', '📅',
    '📈', '📉', '🔍', '🔧', '🛠️', '🐛', '🚀', '🎯', '⏰', '🔒',
    '🔥', '⭐', '🏁', '📣', '💬',
  ],
  other: [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🎉', '🎊', '☕', '🍕',
    '🌞', '🌧️', '🌈', '🎵', '🏆', '💯', '✨', '🙈', '🤖', '👻',
    '🍀', '🎁', '☀️', '🌙', '🧠',
  ],
};

export interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  strings: CommentsTranslations;
  disabled?: boolean;
}

/**
 * A toolbar button that opens a popover of emoji. Its buttons use `onMouseDown` + `preventDefault`
 * so clicking one does not take the text selection away from the editor.
 */
export function EmojiPicker({ onPick, strings, disabled }: EmojiPickerProps) {
  const [opened, setOpened] = useState(false);
  const [tab, setTab] = useState<Tab>('smileys');
  const keep = (event: React.MouseEvent) => event.preventDefault();

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" withArrow shadow="md" trapFocus={false}>
      <Popover.Target>
        <Tooltip label={strings.toolbar.emoji}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            disabled={disabled}
            aria-label={strings.toolbar.emoji}
            aria-haspopup="dialog"
            aria-expanded={opened}
            onMouseDown={keep}
            onClick={() => setOpened((open) => !open)}
          >
            <IconMoodSmile size={16} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown p="xs" role="dialog" aria-label={strings.emoji.pickerLabel}>
        <div className="bp-cm-emoji-tabs" role="tablist">
          {(Object.keys(EMOJI_TABS) as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className="bp-cm-emoji-tab"
              data-active={tab === key || undefined}
              onMouseDown={keep}
              onClick={() => setTab(key)}
            >
              {strings.emoji.tabs[key]}
            </button>
          ))}
        </div>
        <div className="bp-cm-emoji-grid">
          {EMOJI_TABS[tab].map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={interpolate(strings.emoji.insert, { emoji })}
              onMouseDown={keep}
              onClick={() => {
                onPick(emoji);
                setOpened(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
