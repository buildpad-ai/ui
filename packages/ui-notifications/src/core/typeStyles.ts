import type { ComponentType } from 'react';
import {
  IconAt,
  IconBell,
  IconInfoCircle,
  IconMessage,
  IconMessageReply,
  IconProgressCheck,
  IconSettings,
  IconUserCheck,
} from '@tabler/icons-react';

export type TypeIcon = ComponentType<{ size?: number | string; stroke?: number }>;

export interface TypeStyle {
  label: string;
  /** A Mantine color name. */
  color: string;
  icon: TypeIcon;
}

export type TypeStyles = Record<string, Partial<TypeStyle>>;

export const DEFAULT_TYPE_STYLES: Record<string, TypeStyle> = {
  info: { label: 'Info', color: 'blue', icon: IconInfoCircle },
  mention: { label: 'Mention', color: 'violet', icon: IconAt },
  comment: { label: 'Comment', color: 'teal', icon: IconMessage },
  reply: { label: 'Reply', color: 'cyan', icon: IconMessageReply },
  assigned: { label: 'Assigned', color: 'orange', icon: IconUserCheck },
  status: { label: 'Status', color: 'green', icon: IconProgressCheck },
  system: { label: 'System', color: 'gray', icon: IconSettings },
};

const humanize = (type: string) => type.replace(/_/g, ' ');

/** The look of a type: app overrides, then defaults, then gray bell with the type as label. */
export function typeStyle(type: string, overrides: TypeStyles = {}, labels: Partial<Record<string, string>> = {}): TypeStyle {
  const base = DEFAULT_TYPE_STYLES[type] ?? { label: humanize(type), color: 'gray', icon: IconBell };
  const label = labels[type] ?? base.label;
  return { ...base, label, ...overrides[type] };
}
