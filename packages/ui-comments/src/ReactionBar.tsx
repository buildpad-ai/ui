'use client';

import { useState } from 'react';
import { ActionIcon, Popover } from '@mantine/core';
import { IconMoodPlus } from '@tabler/icons-react';
import { useBuildpadI18n } from '@buildpad/services';
import { interpolate, type CommentsTranslations } from '@buildpad/utils';
import { REACTIONS, reactorNames, type ReactionSummary } from './core/reactions';

export interface ReactionBarProps {
  chips: readonly ReactionSummary[];
  /** Add (`on`) or take back my reaction. Leave out and the chips are read-only. */
  onToggle?: (emoji: string, on: boolean) => void;
  strings: CommentsTranslations;
}

/** One chip per emoji in use (count, highlighted when mine, names in the tooltip) and a "+" for the rest. */
export function ReactionBar({ chips, onToggle, strings }: ReactionBarProps) {
  const [opened, setOpened] = useState(false);
  const { formatCount } = useBuildpadI18n();

  if (chips.length === 0 && !onToggle) return null;

  const mineOf = (emoji: string) => chips.find((chip) => chip.emoji === emoji)?.mine ?? false;
  const who = (chip: ReactionSummary) =>
    reactorNames(chip.names, (rest) => formatCount(rest, strings.reactions.andMore));

  return (
    <div className="bp-cm-reactions" role="group" aria-label={strings.reactions.groupLabel}>
      {chips.map((chip) => {
        const label = interpolate(chip.mine ? strings.reactions.chipMine : strings.reactions.chip, {
          emoji: chip.emoji,
          count: chip.count,
        });
        const inside = (
          <>
            <span aria-hidden="true">{chip.emoji}</span>
            <span className="bp-cm-reaction-n" aria-hidden="true">
              {chip.count}
            </span>
          </>
        );
        return onToggle ? (
          <button
            key={chip.emoji}
            type="button"
            className="bp-cm-reaction"
            aria-pressed={chip.mine}
            aria-label={label}
            title={who(chip)}
            onClick={() => onToggle(chip.emoji, !chip.mine)}
          >
            {inside}
          </button>
        ) : (
          <span key={chip.emoji} className="bp-cm-reaction" role="img" aria-label={label} title={who(chip)}>
            {inside}
          </span>
        );
      })}

      {onToggle && (
        // Focus moves into the picker and back to "+" when it closes: the popover renders in a portal
        // at the end of the page, so without this Tab from "+" never reaches the emoji. There is no
        // text selection here to protect, unlike the comment box's emoji picker. withRoles={false}:
        // Mantine would label the dialog by the "+" button, overriding "Choose a reaction"; the roles
        // and states it would add are set by hand below.
        <Popover opened={opened} onChange={setOpened} position="bottom-start" withArrow shadow="md" trapFocus returnFocus withRoles={false}>
          <Popover.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={strings.reactions.add}
              aria-haspopup="dialog"
              aria-expanded={opened}
              title={strings.reactions.add}
              onClick={() => setOpened((open) => !open)}
            >
              <IconMoodPlus size={16} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown p="xs" role="dialog" aria-label={strings.reactions.pickerLabel}>
            <div className="bp-cm-emoji-grid bp-cm-emoji-grid--reactions">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={interpolate(strings.reactions.reactWith, { emoji })}
                  aria-pressed={mineOf(emoji)}
                  onClick={() => {
                    onToggle(emoji, !mineOf(emoji));
                    setOpened(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </Popover.Dropdown>
        </Popover>
      )}
    </div>
  );
}
