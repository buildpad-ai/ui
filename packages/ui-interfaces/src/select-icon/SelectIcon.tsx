'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Menu,
  Button,
  Box,
  Group,
  Text,
  ActionIcon,
  ScrollArea,
  TextInput,
  Divider,
  Stack,
  UnstyledButton,
} from '@mantine/core';
import {
  IconChevronDown,
  IconX,
  IconSearch,
  IconQuestionMark,
  IconEdit,
  IconIdBadge2,
  IconShield,
  IconShieldCheck,
  IconShieldLock,
  IconHome,
  IconSettings,
  IconInfoCircle,
  IconHelp,
  IconCircleCheck,
  IconTrash,
  IconCheck,
  IconHeart,
  IconLock,
  IconEye,
  IconBookmark,
  IconStar,
  IconThumbUp,
  IconThumbDown,
  IconBriefcase,
  IconShoppingCart,
  IconUserCircle,
  IconAlarm,
  IconCalendar,
  IconWorld,
  IconCode,
  IconTool,
  IconPuzzle,
  IconTrendingUp,
  IconHistory,
  IconExternalLink,
  IconLayoutDashboard,
  IconClipboardCheck,
  IconBug,
  IconRefresh,
  IconCreditCard,
  IconClock,
  IconReceipt,
  IconCompass,
  IconFingerprint,
  IconHourglass,
  IconPower,
  IconZoomIn,
  IconZoomOut,
  IconCircleX,
  IconAlertTriangle,
  IconBellRinging,
  IconBellPlus,
  IconMail,
  IconPhone,
  IconMessage,
  IconMessageCircle,
  IconMessages,
  IconMailbox,
  IconAddressBook,
  IconUsers,
  IconKeyboard,
  IconKey,
  IconHeadset,
  IconHeadphones,
  IconRss,
  IconScreenShare,
  IconPlus,
  IconMinus,
  IconSquarePlus,
  IconCirclePlus,
  IconArchive,
  IconBan,
  IconCopy,
  IconCut,
  IconClipboard,
  IconPencil,
  IconTrashX,
  IconFileText,
  IconFilter,
  IconFlag,
  IconArrowForward,
  IconHandFinger,
  IconInbox,
  IconLink,
  IconLinkOff,
  IconArrowForwardUp,
  IconCircleMinus,
  IconCornerUpLeft,
  IconCornerUpLeftDouble,
  IconAlertCircle,
  IconDeviceFloppy,
  IconCheckbox,
  IconSend,
  IconArrowsSort,
  IconArrowBackUp,
  IconPin,
  IconShare,
  IconArchiveOff,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconArrowDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconChevronsLeft,
  IconChevronsRight,
  IconMenu2,
  IconMaximize,
  IconMinimize,
  IconDotsCircleHorizontal,
  IconDotsVertical,
  IconApps,
  IconArrowsVertical,
  IconFolder,
  IconFolderOpen,
  IconFolderShare,
  IconFolderPlus,
  IconFiles,
  IconDownload,
  IconUpload,
  IconCloud,
  IconCloudUpload,
  IconCloudDownload,
  IconCloudOff,
  IconCloudCheck,
  IconPaperclip,
  IconFileUpload,
  IconFileDescription,
  IconPhoto,
  IconCamera,
  IconPanoramaHorizontal,
  IconCrop,
  IconRotate,
  IconRotateClockwise,
  IconFlipVertical,
  IconAdjustments,
  IconBrush,
  IconColorPicker,
  IconPalette,
  IconSlideshow,
  IconAdjustmentsHorizontal,
  IconLayoutGrid,
  IconMountain,
  IconSun,
  IconBolt,
  IconMap,
  IconMapPin,
  IconCurrentLocation,
  IconNavigation,
  IconDirections,
  IconCar,
  IconBike,
  IconWalk,
  IconBus,
  IconPlane,
  IconBuilding,
  IconToolsKitchen2,
  IconCoffee,
  IconSatellite,
  IconStack,
  IconMapPinPlus,
  IconUsersPlus,
  IconUsersGroup,
  IconUser,
  IconUserPlus,
  IconUserMinus,
  IconMoodSmile,
  IconMoodSad,
  IconMoodEmpty,
  IconCake,
  IconSchool,
  IconChartBar,
  IconBell,
  IconBellOff,
  IconRefreshOff,
  IconWifi,
  IconWifiOff,
  IconBluetooth,
  IconBluetoothOff,
  IconSquareCheck,
  IconSquare,
  IconCircle,
  IconStarHalf,
  IconToggleLeft,
  IconToggleRight,
  IconDeviceMobile,
  IconDeviceTablet,
  IconDeviceLaptop,
  IconDeviceDesktop,
  IconMouse,
  IconCpu,
  IconDatabase,
  IconDeviceSdCard,
  IconUsb,
  IconBattery4,
  IconBold,
  IconItalic,
  IconUnderline,
  IconStrikethrough,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconAlignJustified,
  IconList,
  IconListNumbers,
  IconQuote,
  IconTable,
  IconHeading,
  IconMathFunction,
  IconTextResize,
  IconNote,
  IconTypography,
  IconHighlight,
} from '@tabler/icons-react';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import { interpolate, type DeepPartial, type InterfacesTranslations } from '@buildpad/utils';

/** Dictionary key of an icon category heading (`interfaces.selectIcon.category`). */
type IconCategoryKey = keyof InterfacesTranslations['selectIcon']['category'];

/**
 * Icon categories based on Material Design icon categories
 * Adapted from DaaS icons.json structure. `name` is the dictionary key of the
 * category heading, not the display text.
 */
const ICON_CATEGORIES_RAW: { name: IconCategoryKey; icons: string[] }[] = [
  {
    name: 'action',
    icons: [
      'home', 'search', 'settings', 'info', 'help', 'check_circle', 'delete',
      'done', 'favorite', 'lock', 'visibility', 'bookmark', 'star', 'thumb_up',
      'thumb_down', 'work', 'shopping_cart', 'account_circle', 'alarm', 'calendar_today',
      'language', 'code', 'build', 'extension', 'trending_up',
      'history', 'launch', 'dashboard', 'assignment', 'bug_report', 'cached',
      'payment', 'schedule', 'receipt', 'explore', 'fingerprint', 'hourglass_empty',
      'power_settings_new', 'zoom_in', 'zoom_out',
    ],
  },
  {
    name: 'alert',
    icons: [
      'error', 'warning', 'notification_important', 'add_alert',
    ],
  },
  {
    name: 'communication',
    icons: [
      'email', 'call', 'chat', 'comment', 'forum', 'message', 'phone', 'contact_mail',
      'contact_phone', 'contacts', 'vpn_key', 'mail', 'headset', 'headset_mic',
      'rss_feed', 'screen_share',
    ],
  },
  {
    name: 'content',
    icons: [
      'add', 'remove', 'add_box', 'add_circle', 'archive', 'block', 'clear',
      'content_copy', 'content_cut', 'content_paste', 'create', 'delete_forever',
      'drafts', 'filter_list', 'flag', 'forward', 'gesture', 'inbox', 'link',
      'link_off', 'redo', 'refresh', 'remove_circle', 'reply',
      'reply_all', 'report', 'save', 'select_all', 'send', 'sort', 'undo',
      'push_pin', 'share', 'unarchive',
    ],
  },
  {
    name: 'device',
    icons: [
      'smartphone', 'tablet', 'laptop', 'desktop_windows', 'computer', 'keyboard',
      'mouse', 'memory', 'storage', 'sd_card', 'usb', 'battery_full', 'bluetooth', 'wifi',
    ],
  },
  {
    name: 'editor',
    icons: [
      'format_bold', 'format_italic', 'format_underlined', 'format_strikethrough',
      'format_align_left', 'format_align_center', 'format_align_right', 'format_align_justify',
      'format_list_bulleted', 'format_list_numbered', 'format_quote', 'attach_file',
      'insert_photo', 'insert_link', 'insert_chart', 'table_chart', 'title', 'functions',
      'short_text', 'notes', 'text_fields', 'highlight',
    ],
  },
  {
    name: 'file',
    icons: [
      'folder', 'folder_open', 'folder_shared', 'create_new_folder', 'file_copy',
      'file_download', 'file_upload', 'cloud', 'cloud_upload', 'cloud_download',
      'cloud_off', 'cloud_done', 'attachment', 'upload_file', 'description',
    ],
  },
  {
    name: 'image',
    icons: [
      'image', 'photo', 'photo_camera', 'camera', 'panorama',
      'crop', 'rotate_left', 'rotate_right', 'flip', 'filter', 'adjust',
      'brush', 'colorize', 'palette', 'slideshow', 'tune', 'collections',
      'landscape', 'wb_sunny', 'flash_on',
    ],
  },
  {
    name: 'maps',
    icons: [
      'map', 'place', 'location_on', 'my_location', 'near_me', 'navigation',
      'directions', 'directions_car', 'directions_bike', 'directions_walk',
      'directions_bus', 'flight', 'hotel', 'restaurant',
      'local_cafe', 'terrain', 'satellite', 'layers',
      'public', 'explore', 'pin_drop', 'add_location',
    ],
  },
  {
    name: 'navigation',
    icons: [
      'arrow_back', 'arrow_forward', 'arrow_upward', 'arrow_downward',
      'arrow_back_ios', 'arrow_forward_ios', 'arrow_left', 'arrow_right',
      'arrow_drop_down', 'arrow_drop_up', 'chevron_left', 'chevron_right',
      'expand_less', 'expand_more', 'first_page', 'last_page', 'menu', 'close',
      'fullscreen', 'fullscreen_exit', 'more_horiz', 'more_vert', 'apps', 'refresh',
      'unfold_less', 'unfold_more',
    ],
  },
  {
    name: 'notification',
    icons: [
      'notifications', 'notifications_active', 'notifications_none', 'notifications_off',
      'sync', 'sync_disabled', 'wifi', 'wifi_off', 'bluetooth', 'bluetooth_disabled',
    ],
  },
  {
    name: 'social',
    icons: [
      'group', 'group_add', 'groups', 'person', 'person_add', 'person_remove',
      'people', 'public', 'share', 'mood', 'mood_bad', 'sentiment_satisfied', 
      'sentiment_dissatisfied', 'sentiment_neutral', 'cake', 'domain', 'school', 'poll',
    ],
  },
  {
    name: 'toggle',
    icons: [
      'check_box', 'check_box_outline_blank', 'radio_button_checked',
      'radio_button_unchecked', 'star', 'star_border', 'star_half', 'toggle_off', 'toggle_on',
    ],
  },
  {
    name: 'securityIdentity',
    icons: [
      'security', 'shield', 'verified_user', 'admin_panel_settings', 'policy',
      'lock', 'key', 'vpn_key', 'fingerprint', 'badge', 'supervised_user_circle', 'edit',
    ],
  },
];

/**
 * Several Material icon names legitimately fit more than one category (e.g.
 * "lock" reads as both an Action and a Security & Identity icon), so
 * ICON_CATEGORIES_RAW lists a handful of names twice. Rendered as-is, each
 * duplicate produces two options sharing one `data-testid`, both
 * independently highlighting on selection (S5.2). Keep every name in only
 * its first category so the picker has a single entry per icon.
 */
function dedupeIconCategories(categories: typeof ICON_CATEGORIES_RAW) {
  const seen = new Set<string>();
  return categories.map((category) => ({
    ...category,
    icons: category.icons.filter((iconName) => {
      if (seen.has(iconName)) return false;
      seen.add(iconName);
      return true;
    }),
  }));
}

const ICON_CATEGORIES = dedupeIconCategories(ICON_CATEGORIES_RAW);

/**
 * Format icon name to display title (matching DaaS format-title behavior)
 */
const formatTitle = (str: unknown): string => {
  if (typeof str !== 'string') return '';
  return str.replace(/[_-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

/** Prop surface shared by every Tabler icon we map to. */
export interface MappedIconProps {
  size?: number | string;
  stroke?: number | string;
  style?: React.CSSProperties;
  'aria-hidden'?: boolean;
  /**
   * Tabler renders this as a real `<svg><title>…</title></svg>` — the canonical
   * accessible SVG tooltip, which reaches assistive tech rather than being
   * hover-only. Declaring it here avoids wrapping icons in a `<span title>`.
   */
  title?: string;
}

/**
 * Map Material Design icon names to Tabler icons
 * Provides visual representation for common icons
 */
const ICON_MAP: Record<string, React.ComponentType<MappedIconProps>> = {
  // Security & identity icons (daas_roles / daas_policies defaults)
  security: IconShield,
  shield: IconShield,
  verified_user: IconShieldCheck,
  admin_panel_settings: IconShieldLock,
  policy: IconShieldCheck,
  key: IconKey,
  badge: IconIdBadge2,
  supervised_user_circle: IconUsersGroup,
  edit: IconEdit,
  // Action icons
  home: IconHome,
  search: IconSearch,
  settings: IconSettings,
  info: IconInfoCircle,
  help: IconHelp,
  check_circle: IconCircleCheck,
  delete: IconTrash,
  done: IconCheck,
  favorite: IconHeart,
  lock: IconLock,
  visibility: IconEye,
  bookmark: IconBookmark,
  star: IconStar,
  thumb_up: IconThumbUp,
  thumb_down: IconThumbDown,
  work: IconBriefcase,
  shopping_cart: IconShoppingCart,
  account_circle: IconUserCircle,
  alarm: IconAlarm,
  calendar_today: IconCalendar,
  language: IconWorld,
  code: IconCode,
  build: IconTool,
  extension: IconPuzzle,
  verified: IconCircleCheck,
  trending_up: IconTrendingUp,
  history: IconHistory,
  launch: IconExternalLink,
  dashboard: IconLayoutDashboard,
  assignment: IconClipboardCheck,
  bug_report: IconBug,
  cached: IconRefresh,
  payment: IconCreditCard,
  schedule: IconClock,
  receipt: IconReceipt,
  explore: IconCompass,
  fingerprint: IconFingerprint,
  hourglass_empty: IconHourglass,
  power_settings_new: IconPower,
  zoom_in: IconZoomIn,
  zoom_out: IconZoomOut,
  // Alert icons
  error: IconCircleX,
  warning: IconAlertTriangle,
  notification_important: IconBellRinging,
  add_alert: IconBellPlus,
  // Communication icons
  email: IconMail,
  call: IconPhone,
  chat: IconMessage,
  comment: IconMessageCircle,
  forum: IconMessages,
  message: IconMessage,
  phone: IconPhone,
  contact_mail: IconMailbox,
  contact_phone: IconAddressBook,
  contacts: IconUsers,
  dialpad: IconKeyboard,
  vpn_key: IconKey,
  mail: IconMail,
  headset: IconHeadset,
  headset_mic: IconHeadphones,
  rss_feed: IconRss,
  screen_share: IconScreenShare,
  // Content icons
  add: IconPlus,
  remove: IconMinus,
  add_box: IconSquarePlus,
  add_circle: IconCirclePlus,
  archive: IconArchive,
  block: IconBan,
  clear: IconX,
  content_copy: IconCopy,
  content_cut: IconCut,
  content_paste: IconClipboard,
  create: IconPencil,
  delete_forever: IconTrashX,
  drafts: IconFileText,
  filter_list: IconFilter,
  flag: IconFlag,
  forward: IconArrowForward,
  gesture: IconHandFinger,
  inbox: IconInbox,
  link: IconLink,
  link_off: IconLinkOff,
  redo: IconArrowForwardUp,
  refresh: IconRefresh,
  remove_circle: IconCircleMinus,
  reply: IconCornerUpLeft,
  reply_all: IconCornerUpLeftDouble,
  report: IconAlertCircle,
  save: IconDeviceFloppy,
  select_all: IconCheckbox,
  send: IconSend,
  sort: IconArrowsSort,
  undo: IconArrowBackUp,
  push_pin: IconPin,
  share: IconShare,
  unarchive: IconArchiveOff,
  // Navigation icons
  arrow_back: IconArrowLeft,
  arrow_forward: IconArrowRight,
  arrow_upward: IconArrowUp,
  arrow_downward: IconArrowDown,
  arrow_back_ios: IconChevronLeft,
  arrow_forward_ios: IconChevronRight,
  arrow_left: IconArrowLeft,
  arrow_right: IconArrowRight,
  arrow_drop_down: IconChevronDown,
  arrow_drop_up: IconChevronUp,
  chevron_left: IconChevronLeft,
  chevron_right: IconChevronRight,
  expand_less: IconChevronUp,
  expand_more: IconChevronDown,
  first_page: IconChevronsLeft,
  last_page: IconChevronsRight,
  menu: IconMenu2,
  close: IconX,
  fullscreen: IconMaximize,
  fullscreen_exit: IconMinimize,
  more_horiz: IconDotsCircleHorizontal,
  more_vert: IconDotsVertical,
  apps: IconApps,
  unfold_less: IconArrowsVertical,
  unfold_more: IconArrowsVertical,
  // File icons
  folder: IconFolder,
  folder_open: IconFolderOpen,
  folder_shared: IconFolderShare,
  create_new_folder: IconFolderPlus,
  file_copy: IconFiles,
  file_download: IconDownload,
  file_upload: IconUpload,
  cloud: IconCloud,
  cloud_upload: IconCloudUpload,
  cloud_download: IconCloudDownload,
  cloud_off: IconCloudOff,
  cloud_done: IconCloudCheck,
  attachment: IconPaperclip,
  upload_file: IconFileUpload,
  description: IconFileDescription,
  // Image icons
  image: IconPhoto,
  photo: IconPhoto,
  photo_camera: IconCamera,
  camera: IconCamera,
  camera_alt: IconCamera,
  panorama: IconPanoramaHorizontal,
  crop: IconCrop,
  rotate_left: IconRotate,
  rotate_right: IconRotateClockwise,
  flip: IconFlipVertical,
  filter: IconFilter,
  adjust: IconAdjustments,
  brush: IconBrush,
  colorize: IconColorPicker,
  palette: IconPalette,
  photo_library: IconPhoto,
  slideshow: IconSlideshow,
  tune: IconAdjustmentsHorizontal,
  collections: IconLayoutGrid,
  landscape: IconMountain,
  wb_sunny: IconSun,
  flash_on: IconBolt,
  // Maps icons
  map: IconMap,
  place: IconMapPin,
  location_on: IconMapPin,
  my_location: IconCurrentLocation,
  near_me: IconNavigation,
  navigation: IconNavigation,
  directions: IconDirections,
  directions_car: IconCar,
  directions_bike: IconBike,
  directions_walk: IconWalk,
  directions_bus: IconBus,
  flight: IconPlane,
  hotel: IconBuilding,
  restaurant: IconToolsKitchen2,
  local_cafe: IconCoffee,
  terrain: IconMountain,
  satellite: IconSatellite,
  layers: IconStack,
  public: IconWorld,
  pin_drop: IconMapPin,
  add_location: IconMapPinPlus,
  // Social icons
  group: IconUsers,
  group_add: IconUsersPlus,
  groups: IconUsersGroup,
  person: IconUser,
  person_add: IconUserPlus,
  person_remove: IconUserMinus,
  people: IconUsers,
  mood: IconMoodSmile,
  mood_bad: IconMoodSad,
  sentiment_satisfied: IconMoodSmile,
  sentiment_dissatisfied: IconMoodSad,
  sentiment_neutral: IconMoodEmpty,
  cake: IconCake,
  domain: IconBuilding,
  school: IconSchool,
  poll: IconChartBar,
  // Notification icons
  notifications: IconBell,
  notifications_active: IconBellRinging,
  notifications_none: IconBell,
  notifications_off: IconBellOff,
  sync: IconRefresh,
  sync_disabled: IconRefreshOff,
  wifi: IconWifi,
  wifi_off: IconWifiOff,
  bluetooth: IconBluetooth,
  bluetooth_disabled: IconBluetoothOff,
  // Toggle icons
  check_box: IconSquareCheck,
  check_box_outline_blank: IconSquare,
  radio_button_checked: IconCircleCheck,
  radio_button_unchecked: IconCircle,
  star_border: IconStar,
  star_half: IconStarHalf,
  toggle_off: IconToggleLeft,
  toggle_on: IconToggleRight,
  // Device icons
  smartphone: IconDeviceMobile,
  tablet: IconDeviceTablet,
  laptop: IconDeviceLaptop,
  desktop_windows: IconDeviceDesktop,
  computer: IconDeviceDesktop,
  keyboard: IconKeyboard,
  mouse: IconMouse,
  memory: IconCpu,
  storage: IconDatabase,
  sd_card: IconDeviceSdCard,
  usb: IconUsb,
  battery_full: IconBattery4,
  developer_mode: IconCode,
  // Editor icons
  format_bold: IconBold,
  format_italic: IconItalic,
  format_underlined: IconUnderline,
  format_strikethrough: IconStrikethrough,
  format_align_left: IconAlignLeft,
  format_align_center: IconAlignCenter,
  format_align_right: IconAlignRight,
  format_align_justify: IconAlignJustified,
  format_list_bulleted: IconList,
  format_list_numbered: IconListNumbers,
  format_quote: IconQuote,
  attach_file: IconPaperclip,
  insert_photo: IconPhoto,
  insert_link: IconLink,
  insert_chart: IconChartBar,
  table_chart: IconTable,
  title: IconHeading,
  functions: IconMathFunction,
  short_text: IconTextResize,
  notes: IconNote,
  text_fields: IconTypography,
  highlight: IconHighlight,
};

// S5.7: SelectIcon's own trigger (`renderIcon` below) and this read-only
// companion used two different "unknown icon" glyphs (IconQuestionMark vs
// IconUsersGroup) for the exact same condition — a stored name with no
// ICON_MAP entry. Both now default to the same glyph so an unmapped icon
// looks the same everywhere it's rendered.
export const DEFAULT_UNKNOWN_ICON: React.ComponentType<MappedIconProps> = IconQuestionMark;

/**
 * Strip a `var(--mantine-color-X-6)` wrapper down to the bare palette name `X`.
 *
 * Only for props that require a PALETTE NAME and cannot accept a CSS value —
 * in practice, string interpolation that rebuilds a var() name. Do NOT use it
 * for Mantine's `color` prop or for `ColorSwatch`:
 *
 *   - `color` already accepts any CSS value (parseThemeColor returns a
 *     non-palette string untouched), so `var(--mantine-color-blue-3)` works
 *     as-is, while normalizing it yields `blue-3` — not a palette reference
 *     and not valid CSS, so the checked state computes to transparent.
 *   - `ColorSwatch` never theme-resolves; it assigns `color` straight to
 *     backgroundColor, so a bare palette name renders no colour at all.
 *
 * Returns the input unchanged unless it matches the exact var() shape, and
 * anchors the shade suffix so a palette name containing `-6` (e.g. `brand-600`)
 * is not silently mangled.
 */
export function paletteNameFromColor(color: string): string {
  const match = /^var\(--mantine-color-(.+?)(?:-\d+)?\)$/.exec(color.trim());
  return match ? match[1] : color;
}

export interface IconDisplayProps {
  /** Material Design icon name as stored on the entity (e.g. `role.icon`, `policy.icon`). */
  icon?: string | null;
  /** Icon size in px. Default: 20. */
  size?: number;
  /** Tabler icon component rendered when the name is unknown/empty. Default: `DEFAULT_UNKNOWN_ICON`. */
  fallback?: React.ComponentType<MappedIconProps>;
  /** Stroke width passed to the Tabler icon. Default: 1.5. */
  stroke?: number;
}

/**
 * Read-only companion to `SelectIcon`: renders the Tabler equivalent of a
 * stored Material Design icon name from the same `ICON_MAP` the picker uses,
 * so anything pickable displays consistently in lists and detail views.
 */
export const IconDisplay: React.FC<IconDisplayProps> = ({
  icon,
  size = 20,
  fallback: Fallback = DEFAULT_UNKNOWN_ICON,
  stroke = 1.5,
}) => {
  const Component = (icon && ICON_MAP[icon]) || Fallback;
  return <Component size={size} stroke={stroke} aria-hidden />;
};

export interface SelectIconProps {
  /** Currently selected icon name */
  value?: string | null;
  /** Callback when icon selection changes */
  onChange?: (value: string | null) => void;
  /** Field label */
  label?: string;
  /** Input placeholder text */
  placeholder?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /**
   * Value is visible but not editable. The icon grid is a set of buttons with
   * no native readOnly, so this neutralises the emitter and suppresses pointer
   * events on the picker.
   */
  readOnly?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Width of the component */
  width?: string | number;
  /** Test ID for the component */
  'data-testid'?: string;
  /** Accessible name for the trigger button, used when no visible `label` is set */
  'aria-label'?: string;
  /** Autofocus the trigger button on mount */
  autoFocus?: boolean;
  /**
   * Lowercase alias for `autoFocus`. This is the spelling the form pipeline
   * sends (VForm → FormField → FormFieldInterface), so it must be accepted here
   * or the feature never fires for the only caller that matters — and the
   * unmatched key would otherwise reach the DOM as an invalid attribute.
   */
  autofocus?: boolean;
  /** Per-instance overrides of the dictionary strings (`interfaces.selectIcon`) */
  translations?: DeepPartial<InterfacesTranslations['selectIcon']>;

  // DaaS schema metadata props — declared so they can be destructured and
  // discarded below, preventing them from being forwarded to DOM elements
  // (which causes React unknown-prop warnings). Mirrors the same guard in
  // input/Input.tsx. `type` in particular MUST NOT reach the trigger: it is a
  // DaaS abstract type ('string', 'uuid', …), never a valid button type, and an
  // invalid button@type falls back to "submit".
  /** DaaS field type. Discarded — never forwarded to the trigger. */
  type?: string;
  /** Owning collection. Discarded. */
  collection?: string;
  /** Field key. Discarded. */
  field?: string;
  /** Record primary key. Discarded. */
  primaryKey?: string | number | null;
  /** Column max length. Discarded. */
  maxLength?: number | null;
  /** Column nullability. Discarded. */
  nullable?: boolean;
  /** Column default. Discarded. */
  defaultValue?: unknown;
}

/**
 * Extra props forwarded verbatim to the Mantine `Button` trigger.
 *
 * Deliberately a typed rest rather than an index signature: an
 * `[key: string]: unknown` on the props interface disables excess-property
 * checking, so every prop typo (`valeu`, `onChagne`) would compile and then
 * ship to the DOM. `data-*` attributes do NOT need it — TypeScript always
 * permits non-identifier JSX attribute names.
 *
 * `type` is excluded: it is pinned to "button" after the spread.
 */
export type SelectIconTriggerProps = Omit<
  React.ComponentPropsWithoutRef<'button'>,
  'value' | 'onChange' | 'type' | 'defaultValue'
>;

/**
 * SelectIcon - Icon selection interface component
 * 
 * DaaS-compatible icon picker interface that allows users to search and select
 * from a categorized list of Material Design icons. Icons are displayed as Tabler
 * icons for visual consistency with the Mantine design system.
 * 
 * @example
 * ```tsx
 * <SelectIcon
 *   label="Choose an icon"
 *   value="home"
 *   onChange={(icon) => console.log(icon)}
 *   placeholder="Select an icon..."
 * />
 * ```
 */
export function SelectIcon({
  value,
  onChange: onChangeProp,
  label,
  placeholder,
  disabled = false,
  readOnly = false,
  required = false,
  error,
  width,
  'data-testid': testId,
  'aria-label': ariaLabel,
  autoFocus = false,
  autofocus,
  translations,
  // DaaS schema metadata props — destructured and discarded to prevent them
  // from being forwarded to DOM elements (which causes React unknown-prop
  // warnings, and for `type` would turn the trigger into a submit button).
  /* eslint-disable @typescript-eslint/no-unused-vars */
  type: _type,
  collection: _collection,
  field: _field,
  primaryKey: _primaryKey,
  maxLength: _maxLength,
  nullable: _nullable,
  defaultValue: _defaultValue,
  /* eslint-enable @typescript-eslint/no-unused-vars */
  ...rest
}: SelectIconProps & SelectIconTriggerProps) {
  // Accept either spelling: the form pipeline sends lowercase `autofocus`,
  // while a direct consumer would reach for React's camelCase `autoFocus`.
  const shouldAutoFocus = autoFocus || autofocus === true;
  // Neutralise the emitter so neither picking an icon nor clearing can mutate
  // the value while read-only.
  const onChange = disabled || readOnly ? undefined : onChangeProp;
  // Dictionary strings; the `placeholder` prop wins over both the
  // `translations` prop and the provider dictionary.
  const t = useBuildpadTranslations((d) => d.interfaces.selectIcon, translations, { placeholder });
  const { formatCount } = useBuildpadI18n();
  const [searchValue, setSearchValue] = useState('');
  const [opened, setOpened] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (opened && searchInputRef.current) {
      // Small delay to ensure dropdown is rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [opened]);

  // Filter icons based on search query
  const filteredCategories = useMemo(() => {
    if (!searchValue.trim()) {
      return ICON_CATEGORIES;
    }

    const searchTerm = searchValue.toLowerCase();
    return ICON_CATEGORIES.map((category) => ({
      ...category,
      icons: category.icons.filter(
        (icon) =>
          icon.toLowerCase().includes(searchTerm) ||
          formatTitle(icon).toLowerCase().includes(searchTerm)
      ),
    })).filter((category) => category.icons.length > 0);
  }, [searchValue]);

  // Count total filtered icons
  const totalFilteredIcons = useMemo(() => {
    return filteredCategories.reduce((acc, cat) => acc + cat.icons.length, 0);
  }, [filteredCategories]);

  const handleIconSelect = useCallback(
    (iconName: string) => {
      onChange?.(iconName);
      setOpened(false);
      setSearchValue('');
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.(null);
    },
    [onChange]
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchValue('');
    searchInputRef.current?.focus();
  }, []);

  // Render icon component.
  //
  // `showRawName` surfaces the stored name as the icon's own SVG <title> when
  // the name has no ICON_MAP entry. Only the trigger passes it: the picker grid
  // cell already carries a formatted `title`, and an inner title would shadow it
  // on hover with the raw snake_case name.
  const renderIcon = useCallback((iconName: unknown, size = 20, showRawName = false) => {
    const IconComponent = typeof iconName === 'string' ? ICON_MAP[iconName] : undefined;

    if (IconComponent) {
      return <IconComponent size={size} />;
    }

    // S5.7: same fallback glyph IconDisplay defaults to, for the same
    // "unknown/unmapped" condition — and with the same stroke and aria-hidden
    // IconDisplay applies, so the two renderings are genuinely identical
    // rather than merely sharing a component. S5.1: the picker itself is a
    // fixed curated set (Material has thousands of icon names — mapping all
    // of them isn't bounded), so a stored name outside it stays unpickable;
    // this at least surfaces the raw name instead of a bare '?'.
    return (
      <DEFAULT_UNKNOWN_ICON
        size={size}
        stroke={1.5}
        aria-hidden
        title={showRawName && typeof iconName === 'string' ? iconName : undefined}
      />
    );
  }, []);

  return (
    <Stack gap="xs" w={width} data-testid={testId}>
      {label && (
        <Text size="sm" fw={500}>
          {label}
          {required && (
            <Text component="span" c="red" ml={4}>
              *
            </Text>
          )}
        </Text>
      )}

      <Group gap={4} align="center" wrap="nowrap">
        <Menu
          opened={opened}
          onChange={setOpened}
          position="bottom-start"
          width={400}
          withinPortal
          closeOnItemClick={false}
          trapFocus={false}
        >
          <Menu.Target>
            <Button
              // Forwarded props come FIRST: everything this component owns is
              // declared below and therefore wins. The rule is "rest may add,
              // never override" — which prop of two adjacent ones wins should
              // not be accidental, and the pipeline injects admin-authored
              // meta.options into this spread unfiltered.
              {...rest}
              variant="default"
              justify="space-between"
              fullWidth
              rightSection={
                <IconChevronDown
                  size={16}
                  style={{
                    transform: opened ? 'rotate(180deg)' : undefined,
                    transition: 'transform 200ms ease',
                  }}
                />
              }
              // `type` above all: Mantine's UnstyledButton applies its own
              // `type: "button"` default *before* its rest spread, so a
              // forwarded `type` would win — and any invalid button@type value
              // falls back to "submit", which inside CollectionForm's <form>
              // would save the record when the user clicks to open the picker.
              type="button"
              disabled={disabled}
              data-testid="select-icon-trigger"
              aria-label={!label ? (ariaLabel || t.triggerAriaLabel) : undefined}
              autoFocus={shouldAutoFocus}
              styles={{
                root: {
                  fontWeight: 400,
                  color: value
                    ? 'var(--mantine-color-text)'
                    : 'var(--mantine-color-placeholder)',
                  borderColor: error ? 'var(--mantine-color-error)' : undefined,
                },
                inner: {
                  justifyContent: 'flex-start',
                },
              }}
            >
              <Group gap="xs">
                {value ? (
                  <>
                    {renderIcon(value, 18, true)}
                    <Text size="sm">{formatTitle(value)}</Text>
                  </>
                ) : (
                  <Text size="sm" c="dimmed">
                    {t.placeholder}
                  </Text>
                )}
              </Group>
            </Button>
          </Menu.Target>

        <Menu.Dropdown p={0}>
          <Box p="sm">
            {/* Search Input */}
            <TextInput
              ref={searchInputRef}
              placeholder={t.searchPlaceholder}
              value={searchValue}
              onChange={handleSearchChange}
              leftSection={<IconSearch size={16} />}
              rightSection={
                searchValue && (
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={handleClearSearch}
                    data-testid="clear-search-button"
                  >
                    <IconX size={14} />
                  </ActionIcon>
                )
              }
              data-testid="icon-search-input"
              mb="sm"
            />

            {/* Icon Grid */}
            <ScrollArea.Autosize
              mah={350}
              ref={scrollAreaRef}
              type="auto"
              offsetScrollbars
            >
              {filteredCategories.length > 0 ? (
                <Stack gap="md">
                  {filteredCategories.map((category) => (
                    <Box key={category.name}>
                      <Divider
                        label={
                          <Text size="xs" fw={600} c="dimmed">
                            {t.category[category.name]}
                          </Text>
                        }
                        labelPosition="left"
                        mb="xs"
                      />
                      <Group gap={4}>
                        {category.icons.map((iconName) => (
                          <UnstyledButton
                            key={iconName}
                            onClick={() => handleIconSelect(iconName)}
                            data-testid={`icon-${iconName}`}
                            title={formatTitle(iconName)}
                            style={{
                              padding: '8px',
                              borderRadius: 'var(--mantine-radius-sm)',
                              backgroundColor:
                                value === iconName
                                  ? 'var(--mantine-primary-color-light)'
                                  : 'transparent',
                              color:
                                value === iconName
                                  ? 'var(--mantine-primary-color-6)'
                                  : 'var(--mantine-color-gray-7)',
                              transition: 'all 150ms ease',
                            }}
                            onMouseEnter={(e) => {
                              if (value !== iconName) {
                                e.currentTarget.style.backgroundColor =
                                  'var(--mantine-color-gray-1)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (value !== iconName) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                          >
                            {renderIcon(iconName, 20)}
                          </UnstyledButton>
                        ))}
                      </Group>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Text ta="center" c="dimmed" py="xl" data-testid="no-icons-message">
                  {interpolate(t.noIconsFound, { search: searchValue })}
                </Text>
              )}
            </ScrollArea.Autosize>

            {/* Footer with count */}
            {filteredCategories.length > 0 && (
              <Text size="xs" c="dimmed" ta="right" mt="sm">
                {formatCount(totalFilteredIcons, searchValue ? t.iconCountFound : t.iconCount)}
              </Text>
            )}
          </Box>
        </Menu.Dropdown>
      </Menu>

        {/* Clear button - outside the Menu to avoid button nesting */}
        {value && !disabled && !readOnly && (
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={handleClear}
            title={t.clearSelection}
            data-testid="clear-icon-button"
          >
            <IconX size={16} />
          </ActionIcon>
        )}
      </Group>

      {error && (
        <Text size="xs" c="red" data-testid="error-message">
          {error}
        </Text>
      )}
    </Stack>
  );
}

export default SelectIcon;
