'use client';

import React from 'react';
import {
  IconEdit,
  IconEye,
  IconIdBadge2,
  IconKey,
  IconLock,
  IconSettings,
  IconShield,
  IconShieldCheck,
  IconShieldLock,
  IconUser,
  IconUserCircle,
  IconUsers,
  IconUsersGroup,
  IconWorld,
  type IconProps,
} from '@tabler/icons-react';

/**
 * Material Design icon names (as stored on `daas_roles.icon` /
 * `daas_policies.icon`) → Tabler equivalents. Covers the names the DaaS
 * backend defaults to plus the common picks from the `SelectIcon` interface;
 * anything unknown falls back to `fallback`.
 */
const ICON_MAP: Record<string, React.ComponentType<IconProps>> = {
  supervised_user_circle: IconUsersGroup,
  group: IconUsers,
  groups: IconUsersGroup,
  people: IconUsers,
  person: IconUser,
  account_circle: IconUserCircle,
  badge: IconIdBadge2,
  security: IconShield,
  shield: IconShield,
  verified_user: IconShieldCheck,
  admin_panel_settings: IconShieldLock,
  policy: IconShieldCheck,
  lock: IconLock,
  key: IconKey,
  vpn_key: IconKey,
  edit: IconEdit,
  visibility: IconEye,
  settings: IconSettings,
  public: IconWorld,
};

export interface IconDisplayProps {
  /** Material Design icon name as stored on the entity (`role.icon`, `policy.icon`). */
  icon?: string | null;
  /** Icon size in px. Default: 20. */
  size?: number;
  /** Tabler icon component rendered when the name is unknown/empty. Default: `IconUsersGroup`. */
  fallback?: React.ComponentType<IconProps>;
  /** Stroke width passed to the Tabler icon. Default: 1.5. */
  stroke?: number;
}

/**
 * Renders the Tabler equivalent of a stored Material Design icon name —
 * a lightweight port of the buildpad-daas `IconDisplay` used in the roles
 * and policies list rows.
 */
export const IconDisplay: React.FC<IconDisplayProps> = ({
  icon,
  size = 20,
  fallback: Fallback = IconUsersGroup,
  stroke = 1.5,
}) => {
  const Component = (icon && ICON_MAP[icon]) || Fallback;
  return <Component size={size} stroke={stroke} aria-hidden />;
};

export default IconDisplay;
