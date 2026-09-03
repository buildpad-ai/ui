/**
 * SaveOptions Component
 *
 * Dropdown menu attached to the primary save button providing
 * additional save actions: save & stay, save & add new, save as copy, discard.
 *
 * Ported from DaaS save-options.vue.
 *
 * @package @buildpad/ui-collections
 */

"use client";

import React from 'react';
import {
  Menu,
  ActionIcon,
  Text,
  Kbd,
  Group,
} from '@mantine/core';
import {
  IconCheck,
  IconPlus,
  IconCopy,
  IconArrowBack,
  IconChevronDown,
  IconDeviceFloppy,
} from '@tabler/icons-react';
import { useBuildpadTranslations } from '@buildpad/services';
import type { CollectionsTranslations, DeepPartial } from '@buildpad/utils';

export type SaveAction = 'save-and-stay' | 'save-and-add-new' | 'save-as-copy' | 'discard-and-stay';

export interface SaveOptionsProps {
  /** Disabled options */
  disabledOptions?: SaveAction[];
  /** Save and stay on current item */
  onSaveAndStay?: () => void;
  /** Save and navigate to create new */
  onSaveAndAddNew?: () => void;
  /** Save a copy of the current item */
  onSaveAsCopy?: () => void;
  /** Discard all changes */
  onDiscardAndStay?: () => void;
  /** Whether the menu trigger is disabled */
  disabled?: boolean;
  /** Platform for keyboard shortcut display (default: auto-detect) */
  platform?: 'mac' | 'win';
  /** Per-instance overrides of the `collections` dictionary namespace (prop > provider > defaults) */
  translations?: DeepPartial<CollectionsTranslations>;
}

/**
 * SaveOptions — Dropdown for additional save actions
 *
 * Designed to be placed adjacent to the primary Save button.
 *
 * @example
 * ```tsx
 * <Group gap={0}>
 *   <Button onClick={handleSave} loading={saving} disabled={!hasEdits}>
 *     <IconCheck size={16} />
 *   </Button>
 *   <SaveOptions
 *     onSaveAndStay={handleSaveAndStay}
 *     onSaveAndAddNew={handleSaveAndAddNew}
 *     onSaveAsCopy={handleSaveAsCopy}
 *     onDiscardAndStay={handleDiscard}
 *     disabledOptions={isNew ? ['save-as-copy'] : []}
 *   />
 * </Group>
 * ```
 */
export const SaveOptions: React.FC<SaveOptionsProps> = ({
  disabledOptions = [],
  onSaveAndStay,
  onSaveAndAddNew,
  onSaveAsCopy,
  onDiscardAndStay,
  disabled = false,
  platform,
  translations,
}) => {
  // Strings: component prop > provider dictionary > English defaults.
  const t = useBuildpadTranslations((d) => d.collections.saveOptions, translations?.saveOptions);

  const isMac = platform
    ? platform === 'mac'
    : typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);

  // Key caps: the ⌘ / ⇧ / S glyphs are the physical keys of the binding and
  // stay as they are; only the "Ctrl" cap has locale variants (e.g. "Strg").
  const metaKey = isMac ? '⌘' : t.kbd.ctrl;

  const isDisabled = (action: SaveAction) => disabledOptions.includes(action);

  return (
    <Menu shadow="md" width={280} position="bottom-end" withArrow>
      <Menu.Target>
        <ActionIcon
          variant="filled"
          size="input-sm"
          disabled={disabled}
          aria-label={t.moreOptions}
          style={{
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            marginLeft: -1,
          }}
        >
          <IconChevronDown size={14} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconDeviceFloppy size={16} />}
          disabled={isDisabled('save-and-stay')}
          onClick={onSaveAndStay}
          rightSection={
            <Group gap={2}>
              <Kbd size="xs">{metaKey}</Kbd>
              <Kbd size="xs">S</Kbd>
            </Group>
          }
        >
          {t.saveAndStay}
        </Menu.Item>

        <Menu.Item
          leftSection={<IconPlus size={16} />}
          disabled={isDisabled('save-and-add-new')}
          onClick={onSaveAndAddNew}
          rightSection={
            <Group gap={2}>
              <Kbd size="xs">{metaKey}</Kbd>
              <Kbd size="xs">⇧</Kbd>
              <Kbd size="xs">S</Kbd>
            </Group>
          }
        >
          {t.saveAndCreateNew}
        </Menu.Item>

        <Menu.Item
          leftSection={<IconCopy size={16} />}
          disabled={isDisabled('save-as-copy')}
          onClick={onSaveAsCopy}
        >
          {t.saveAsCopy}
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item
          leftSection={<IconArrowBack size={16} />}
          disabled={isDisabled('discard-and-stay')}
          onClick={onDiscardAndStay}
          color="red"
        >
          {t.discardChanges}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default SaveOptions;
