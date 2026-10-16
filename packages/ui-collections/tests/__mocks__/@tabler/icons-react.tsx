/**
 * Mock for @tabler/icons-react — provides simple span-based icons as named exports.
 */
import React from 'react';

function makeIcon(name: string) {
  const Icon = (props: Record<string, unknown>) =>
    React.createElement('span', { 'data-icon': name, ...props });
  Icon.displayName = name;
  return Icon;
}

export const IconAlertCircle = makeIcon('IconAlertCircle');
export const IconAlignCenter = makeIcon('IconAlignCenter');
export const IconAlignLeft = makeIcon('IconAlignLeft');
export const IconAlignRight = makeIcon('IconAlignRight');
export const IconArchive = makeIcon('IconArchive');
export const IconCheck = makeIcon('IconCheck');
export const IconChevronDown = makeIcon('IconChevronDown');
export const IconChevronUp = makeIcon('IconChevronUp');
export const IconEdit = makeIcon('IconEdit');
export const IconEyeOff = makeIcon('IconEyeOff');
export const IconFilter = makeIcon('IconFilter');
export const IconFilterOff = makeIcon('IconFilterOff');
export const IconPlus = makeIcon('IconPlus');
export const IconRefresh = makeIcon('IconRefresh');
export const IconSearch = makeIcon('IconSearch');
export const IconSortAscending = makeIcon('IconSortAscending');
export const IconSortDescending = makeIcon('IconSortDescending');
export const IconTrash = makeIcon('IconTrash');
export const IconX = makeIcon('IconX');
export const IconArrowDown = makeIcon('IconArrowDown');
export const IconArrowUp = makeIcon('IconArrowUp');
export const IconArrowsSort = makeIcon('IconArrowsSort');
export const IconGripVertical = makeIcon('IconGripVertical');
