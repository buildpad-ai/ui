/**
 * `notifications` namespace — ui-notifications: the bell in the app header, the inbox page
 * (list of notifications, tabs, detail pane) and relative times.
 *
 * Keep the defaults and the Indonesian catalog in step — the parity test enforces it. Every
 * `PluralForms` entry has `{count}` available.
 */
import type { PluralForms } from '../primitives';

export interface NotificationsTranslations {
  /** Heading of the inbox and the bell popover */
  title: string;
  bell: {
    /** Accessible name of the bell button; "{count}" is the unread count text */
    label: string;
    labelUnread: PluralForms;
    markAllRead: string;
    seeAll: string;
    empty: string;
    loading: string;
  };
  tabs: {
    /** Accessible name of the tab list */
    label: string;
    all: string;
    unread: string;
  };
  inbox: {
    unreadCount: PluralForms;
    allCaughtUp: string;
    markAllRead: string;
    loadMore: string;
    loadingMore: string;
    loading: string;
    back: string;
    /** Accessible name of the list */
    listLabel: string;
    selectPrompt: string;
    errorTitle: string;
    retry: string;
    empty: {
      all: string;
      unread: string;
      /** Any app-added tab */
      other: string;
    };
  };
  row: {
    /** aria-label of the unread dot */
    unread: string;
  };
  detail: {
    openFullPage: string;
    markRead: string;
    markUnread: string;
    notFound: string;
  };
  time: {
    justNow: string;
    /** "{count}" minutes ago, short */
    minutes: string;
    hours: string;
    days: string;
    today: string;
    yesterday: string;
  };
  /** Labels of the built-in notification types */
  types: {
    info: string;
    mention: string;
    comment: string;
    reply: string;
    assigned: string;
    status: string;
    system: string;
  };
}

export const notificationsDefaults: NotificationsTranslations = {
  title: 'Notifications',
  bell: {
    label: 'Notifications',
    labelUnread: { one: 'Notifications, {count} unread', other: 'Notifications, {count} unread' },
    markAllRead: 'Mark all as read',
    seeAll: 'See all notifications',
    empty: 'No notifications yet.',
    loading: 'Loading notifications…',
  },
  tabs: { label: 'Filter notifications', all: 'All', unread: 'Unread' },
  inbox: {
    unreadCount: { one: '{count} unread', other: '{count} unread' },
    allCaughtUp: 'All caught up',
    markAllRead: 'Mark all as read',
    loadMore: 'Load more',
    loadingMore: 'Loading more…',
    loading: 'Loading notifications…',
    back: 'Back to notifications',
    listLabel: 'Notifications',
    selectPrompt: 'Select a notification to see it here.',
    errorTitle: 'Could not load notifications',
    retry: 'Try again',
    empty: {
      all: 'No notifications yet.',
      unread: 'You have no unread notifications.',
      other: 'Nothing here yet.',
    },
  },
  row: { unread: 'Unread' },
  detail: {
    openFullPage: 'Open full page',
    markRead: 'Mark as read',
    markUnread: 'Mark as unread',
    notFound: 'This notification could not be found.',
  },
  time: { justNow: 'just now', minutes: '{count}m', hours: '{count}h', days: '{count}d', today: 'Today', yesterday: 'Yesterday' },
  types: {
    info: 'Info',
    mention: 'Mention',
    comment: 'Comment',
    reply: 'Reply',
    assigned: 'Assigned',
    status: 'Status',
    system: 'System',
  },
};

export const notificationsId: NotificationsTranslations = {
  title: 'Notifikasi',
  bell: {
    label: 'Notifikasi',
    labelUnread: { other: 'Notifikasi, {count} belum dibaca' },
    markAllRead: 'Tandai semua sudah dibaca',
    seeAll: 'Lihat semua notifikasi',
    empty: 'Belum ada notifikasi.',
    loading: 'Memuat notifikasi…',
  },
  tabs: { label: 'Saring notifikasi', all: 'Semua', unread: 'Belum dibaca' },
  inbox: {
    unreadCount: { other: '{count} belum dibaca' },
    allCaughtUp: 'Semua sudah dibaca',
    markAllRead: 'Tandai semua sudah dibaca',
    loadMore: 'Muat lebih banyak',
    loadingMore: 'Memuat…',
    loading: 'Memuat notifikasi…',
    back: 'Kembali ke notifikasi',
    listLabel: 'Notifikasi',
    selectPrompt: 'Pilih notifikasi untuk melihatnya di sini.',
    errorTitle: 'Notifikasi tidak dapat dimuat',
    retry: 'Coba lagi',
    empty: {
      all: 'Belum ada notifikasi.',
      unread: 'Tidak ada notifikasi yang belum dibaca.',
      other: 'Belum ada apa-apa di sini.',
    },
  },
  row: { unread: 'Belum dibaca' },
  detail: {
    openFullPage: 'Buka halaman penuh',
    markRead: 'Tandai sudah dibaca',
    markUnread: 'Tandai belum dibaca',
    notFound: 'Notifikasi ini tidak ditemukan.',
  },
  time: { justNow: 'baru saja', minutes: '{count}m', hours: '{count}j', days: '{count}h', today: 'Hari ini', yesterday: 'Kemarin' },
  types: {
    info: 'Info',
    mention: 'Sebutan',
    comment: 'Komentar',
    reply: 'Balasan',
    assigned: 'Ditugaskan',
    status: 'Status',
    system: 'Sistem',
  },
};
