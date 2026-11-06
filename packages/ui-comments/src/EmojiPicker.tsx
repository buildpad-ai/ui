'use client';

import { useRef, useState } from 'react';
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
 *
 * Opened from the keyboard, focus moves into the popover and Esc brings it back to the button: the
 * popover renders in a portal at the end of the page, so Tab from the button would never reach it.
 * Opened with the mouse, focus stays in the comment box. Picking an emoji hands focus back to the
 * box either way (the box focuses itself when text is inserted).
 */
export function EmojiPicker({ onPick, strings, disabled }: EmojiPickerProps) {
  const [opened, setOpened] = useState(false);
  const [tab, setTab] = useState<Tab>('smileys');
  const [fromKeyboard, setFromKeyboard] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const keep = (event: React.MouseEvent) => event.preventDefault();

  return (
    <Popover
      opened={opened}
      onChange={(next) => {
        setOpened(next);
        // Closed by Esc or a click outside — not by picking, which never comes through here.
        if (!next && fromKeyboard) button.current?.focus();
      }}
      position="bottom-start"
      withArrow
      shadow="md"
      trapFocus={fromKeyboard}
      returnFocus={false}
      // Its own roles and states are set by hand. Mantine's would label the dialog by an id that the
      // Tooltip wrapper never puts on the button, leaving a reference to nothing.
      withRoles={false}
    >
      <Popover.Target>
        <Tooltip label={strings.toolbar.emoji}>
          <ActionIcon
            ref={button}
            variant="subtle"
            color="gray"
            size="sm"
            disabled={disabled}
            aria-label={strings.toolbar.emoji}
            aria-haspopup="dialog"
            aria-expanded={opened}
            onMouseDown={(event) => {
              keep(event);
              setFromKeyboard(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') setFromKeyboard(true);
            }}
            onClick={() => setOpened((open) => !open)}
          >
            <IconMoodSmile size={16} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown p="xs" role="dialog" aria-label={strings.emoji.pickerLabel}>
        {/* Toggle buttons, not tabs: the tab pattern promises arrow-key navigation this does not have. */}
        <div className="bp-cm-emoji-tabs">
          {(Object.keys(EMOJI_TABS) as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
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
