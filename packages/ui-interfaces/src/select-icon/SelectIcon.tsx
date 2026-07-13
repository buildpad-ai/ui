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

/**
 * Icon categories based on Material Design icon categories
 * Adapted from DaaS icons.json structure
 */
const ICON_CATEGORIES = [
  {
    name: 'Action',
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
    name: 'Alert',
    icons: [
      'error', 'warning', 'notification_important', 'add_alert',
    ],
  },
  {
    name: 'Communication',
    icons: [
      'email', 'call', 'chat', 'comment', 'forum', 'message', 'phone', 'contact_mail',
      'contact_phone', 'contacts', 'vpn_key', 'mail', 'headset', 'headset_mic',
      'rss_feed', 'screen_share',
    ],
  },
  {
    name: 'Content',
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
    name: 'Device',
    icons: [
      'smartphone', 'tablet', 'laptop', 'desktop_windows', 'computer', 'keyboard',
      'mouse', 'memory', 'storage', 'sd_card', 'usb', 'battery_full', 'bluetooth', 'wifi',
    ],
  },
  {
    name: 'Editor',
    icons: [
      'format_bold', 'format_italic', 'format_underlined', 'format_strikethrough',
      'format_align_left', 'format_align_center', 'format_align_right', 'format_align_justify',
      'format_list_bulleted', 'format_list_numbered', 'format_quote', 'attach_file',
      'insert_photo', 'insert_link', 'insert_chart', 'table_chart', 'title', 'functions',
      'short_text', 'notes', 'text_fields', 'highlight',
    ],
  },
  {
    name: 'File',
    icons: [
      'folder', 'folder_open', 'folder_shared', 'create_new_folder', 'file_copy',
      'file_download', 'file_upload', 'cloud', 'cloud_upload', 'cloud_download',
      'cloud_off', 'cloud_done', 'attachment', 'upload_file', 'description',
    ],
  },
  {
    name: 'Image',
    icons: [
      'image', 'photo', 'photo_camera', 'camera', 'panorama',
      'crop', 'rotate_left', 'rotate_right', 'flip', 'filter', 'adjust',
      'brush', 'colorize', 'palette', 'slideshow', 'tune', 'collections',
      'landscape', 'wb_sunny', 'flash_on',
    ],
  },
  {
    name: 'Maps',
    icons: [
      'map', 'place', 'location_on', 'my_location', 'near_me', 'navigation',
      'directions', 'directions_car', 'directions_bike', 'directions_walk',
      'directions_bus', 'flight', 'hotel', 'restaurant',
      'local_cafe', 'terrain', 'satellite', 'layers',
      'public', 'explore', 'pin_drop', 'add_location',
    ],
  },
  {
    name: 'Navigation',
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
    name: 'Notification',
    icons: [
      'notifications', 'notifications_active', 'notifications_none', 'notifications_off',
      'sync', 'sync_disabled', 'wifi', 'wifi_off', 'bluetooth', 'bluetooth_disabled',
    ],
  },
  {
    name: 'Social',
    icons: [
      'group', 'group_add', 'groups', 'person', 'person_add', 'person_remove',
      'people', 'public', 'share', 'mood', 'mood_bad', 'sentiment_satisfied', 
      'sentiment_dissatisfied', 'sentiment_neutral', 'cake', 'domain', 'school', 'poll',
    ],
  },
  {
    name: 'Toggle',
    icons: [
      'check_box', 'check_box_outline_blank', 'radio_button_checked',
      'radio_button_unchecked', 'star', 'star_border', 'star_half', 'toggle_off', 'toggle_on',
    ],
  },
  {
    name: 'Security & Identity',
    icons: [
      'security', 'shield', 'verified_user', 'admin_panel_settings', 'policy',
      'lock', 'key', 'vpn_key', 'fingerprint', 'badge', 'supervised_user_circle', 'edit',
    ],
  },
];

/**
 * Format icon name to display title (matching DaaS format-title behavior)
 */
const formatTitle = (str: string): string => {
  return str.replace(/[_-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

/** Prop surface shared by every Tabler icon we map to. */
export interface MappedIconProps {
  size?: number | string;
  stroke?: number | string;
  style?: React.CSSProperties;
  'aria-hidden'?: boolean;
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

export interface IconDisplayProps {
  /** Material Design icon name as stored on the entity (e.g. `role.icon`, `policy.icon`). */
  icon?: string | null;
  /** Icon size in px. Default: 20. */
  size?: number;
  /** Tabler icon component rendered when the name is unknown/empty. Default: `IconUsersGroup`. */
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
  fallback: Fallback = IconUsersGroup,
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
  /** Whether the field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Width of the component */
  width?: string | number;
  /** Test ID for the component */
  'data-testid'?: string;
}

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
  onChange,
  label,
  placeholder = 'Search for an icon...',
  disabled = false,
  required = false,
  error,
  width,
  'data-testid': testId,
}: SelectIconProps) {
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

  // Render icon component
  const renderIcon = useCallback((iconName: string, size = 20) => {
    const IconComponent = ICON_MAP[iconName];
    
    if (IconComponent) {
      return <IconComponent size={size} />;
    }
    
    // Fallback to question mark for unmapped icons
    return <IconQuestionMark size={size} />;
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
              disabled={disabled}
              data-testid="select-icon-trigger"
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
                    {renderIcon(value, 18)}
                    <Text size="sm">{formatTitle(value)}</Text>
                  </>
                ) : (
                  <Text size="sm" c="dimmed">
                    {placeholder}
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
              placeholder="Search icons..."
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
                            {category.name}
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
                  No icons found for &quot;{searchValue}&quot;
                </Text>
              )}
            </ScrollArea.Autosize>

            {/* Footer with count */}
            {filteredCategories.length > 0 && (
              <Text size="xs" c="dimmed" ta="right" mt="sm">
                {totalFilteredIcons} icon{totalFilteredIcons !== 1 ? 's' : ''}
                {searchValue && ' found'}
              </Text>
            )}
          </Box>
        </Menu.Dropdown>
      </Menu>

        {/* Clear button - outside the Menu to avoid button nesting */}
        {value && !disabled && (
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={handleClear}
            title="Clear selection"
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
