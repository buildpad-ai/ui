/**
 * `comments` namespace — ui-comments: the comment thread of a record (the list, replies at any
 * depth, the composer with its formatting toolbar and emoji picker, reaction chips).
 *
 * Keep the defaults and the Indonesian catalog in step — the parity test enforces it. Every
 * `PluralForms` entry has `{count}` available; the Indonesian catalog only needs `other` (one
 * plural category).
 */
import type { PluralForms } from '../primitives';

export interface CommentsTranslations {
  /** Heading of the thread, and the accessible name of the section */
  title: string;
  /** "{count} comments" next to the heading */
  count: PluralForms;
  empty: {
    /** No comments yet, and the viewer may write one */
    canWrite: string;
    /** No comments yet, and the viewer may only read */
    readOnly: string;
  };
  composer: {
    placeholder: string;
    replyPlaceholder: string;
    /** Primary button of a new top-level comment */
    submit: string;
    /** Primary button of a reply */
    reply: string;
    save: string;
    /** Shown on the primary button while the comment is being sent */
    saving: string;
    cancel: string;
    /** Under the box: how to send from the keyboard */
    sendHint: string;
    /** Characters over the limit — "{count}" is how many */
    overLimit: PluralForms;
  };
  toolbar: {
    /** Accessible name of the formatting toolbar */
    label: string;
    bold: string;
    italic: string;
    underline: string;
    bulletList: string;
    emoji: string;
  };
  emoji: {
    pickerLabel: string;
    tabs: {
      smileys: string;
      gestures: string;
      work: string;
      other: string;
    };
    /** Accessible name of one emoji button — "{emoji}" is the emoji */
    insert: string;
  };
  message: {
    /** Name shown when the author is unknown */
    someone: string;
    justNow: string;
    minutesAgo: PluralForms;
    hoursAgo: PluralForms;
    yesterday: string;
    daysAgo: PluralForms;
    reply: string;
    /** Accessible name of a Reply button — "{name}" is the author */
    replyTo: string;
    edit: string;
    delete: string;
    deleteConfirm: string;
    copyLink: string;
    linkCopied: string;
    resolve: string;
    reopen: string;
    resolved: string;
    /** Above a reply whose parent is not shown — "{name}" is that comment's author when known */
    replyingTo: string;
    replyingToUnknown: string;
    /** Chip on a comment the viewer has not seen */
    new: string;
  };
  reactions: {
    groupLabel: string;
    add: string;
    pickerLabel: string;
    /** Accessible name of one emoji in the picker — "{emoji}" is the emoji */
    reactWith: string;
    /** Accessible name of a chip — "{emoji}" and "{count}" */
    chip: string;
    /** The same, when the viewer reacted */
    chipMine: string;
    /** After the first three names in a chip's tooltip — "{count}" is the rest */
    andMore: PluralForms;
  };
  errors: {
    empty: string;
    /** "{max}" is the limit */
    tooLong: string;
    tooManyPhotos: string;
    photosInvalid: string;
    loadFailed: string;
    saveFailed: string;
    reactFailed: string;
    deleteFailed: string;
  };
}

export const commentsDefaults: CommentsTranslations = {
  title: 'Comments',
  count: { one: '{count} comment', other: '{count} comments' },
  empty: {
    canWrite: 'No comments yet. Start the conversation.',
    readOnly: 'No comments yet.',
  },
  composer: {
    placeholder: 'Write a comment…',
    replyPlaceholder: 'Write a reply…',
    submit: 'Comment',
    reply: 'Reply',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    sendHint: 'Ctrl+Enter to send',
    overLimit: { one: '{count} character too many', other: '{count} characters too many' },
  },
  toolbar: {
    label: 'Formatting',
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    bulletList: 'Bulleted list',
    emoji: 'Add emoji',
  },
  emoji: {
    pickerLabel: 'Choose an emoji',
    tabs: { smileys: 'Smileys', gestures: 'Gestures', work: 'Work', other: 'Other' },
    insert: 'Insert {emoji}',
  },
  message: {
    someone: 'Someone',
    justNow: 'just now',
    minutesAgo: { one: '{count} min ago', other: '{count} min ago' },
    hoursAgo: { one: '{count} h ago', other: '{count} h ago' },
    yesterday: 'yesterday',
    daysAgo: { one: '{count} day ago', other: '{count} days ago' },
    reply: 'Reply',
    replyTo: 'Reply to {name}',
    edit: 'Edit',
    delete: 'Delete',
    deleteConfirm: 'Delete this comment and its replies?',
    copyLink: 'Copy link',
    linkCopied: 'Link copied',
    resolve: 'Resolve',
    reopen: 'Reopen',
    resolved: 'Resolved',
    replyingTo: 'Replying to {name}',
    replyingToUnknown: 'Replying to a comment that is not shown',
    new: 'New',
  },
  reactions: {
    groupLabel: 'Reactions',
    add: 'Add reaction',
    pickerLabel: 'Choose a reaction',
    reactWith: 'React with {emoji}',
    chip: '{emoji} {count}',
    chipMine: '{emoji} {count}, you reacted',
    andMore: { one: 'and {count} more', other: 'and {count} more' },
  },
  errors: {
    empty: 'Write a comment',
    tooLong: 'Comments can be up to {max} characters',
    tooManyPhotos: 'Attach fewer pictures',
    photosInvalid: 'Those pictures could not be attached',
    loadFailed: "Couldn't load the comments.",
    saveFailed: "Couldn't save the comment.",
    reactFailed: "Couldn't save the reaction.",
    deleteFailed: "Couldn't delete the comment.",
  },
};

export const commentsId: CommentsTranslations = {
  title: 'Komentar',
  count: { other: '{count} komentar' },
  empty: {
    canWrite: 'Belum ada komentar. Mulai percakapan.',
    readOnly: 'Belum ada komentar.',
  },
  composer: {
    placeholder: 'Tulis komentar…',
    replyPlaceholder: 'Tulis balasan…',
    submit: 'Komentari',
    reply: 'Balas',
    save: 'Simpan',
    saving: 'Menyimpan…',
    cancel: 'Batal',
    sendHint: 'Ctrl+Enter untuk mengirim',
    overLimit: { other: 'Kelebihan {count} karakter' },
  },
  toolbar: {
    label: 'Pemformatan',
    bold: 'Tebal',
    italic: 'Miring',
    underline: 'Garis bawah',
    bulletList: 'Daftar berpoin',
    emoji: 'Tambah emoji',
  },
  emoji: {
    pickerLabel: 'Pilih emoji',
    tabs: { smileys: 'Wajah', gestures: 'Isyarat', work: 'Kerja', other: 'Lainnya' },
    insert: 'Sisipkan {emoji}',
  },
  message: {
    someone: 'Seseorang',
    justNow: 'baru saja',
    minutesAgo: { other: '{count} mnt lalu' },
    hoursAgo: { other: '{count} jam lalu' },
    yesterday: 'kemarin',
    daysAgo: { other: '{count} hari lalu' },
    reply: 'Balas',
    replyTo: 'Balas {name}',
    edit: 'Ubah',
    delete: 'Hapus',
    deleteConfirm: 'Hapus komentar ini beserta balasannya?',
    copyLink: 'Salin tautan',
    linkCopied: 'Tautan disalin',
    resolve: 'Selesaikan',
    reopen: 'Buka kembali',
    resolved: 'Selesai',
    replyingTo: 'Membalas {name}',
    replyingToUnknown: 'Membalas komentar yang tidak ditampilkan',
    new: 'Baru',
  },
  reactions: {
    groupLabel: 'Reaksi',
    add: 'Tambah reaksi',
    pickerLabel: 'Pilih reaksi',
    reactWith: 'Bereaksi dengan {emoji}',
    chip: '{emoji} {count}',
    chipMine: '{emoji} {count}, Anda bereaksi',
    andMore: { other: 'dan {count} lainnya' },
  },
  errors: {
    empty: 'Tulis komentar',
    tooLong: 'Komentar maksimal {max} karakter',
    tooManyPhotos: 'Lampirkan lebih sedikit gambar',
    photosInvalid: 'Gambar tersebut tidak dapat dilampirkan',
    loadFailed: 'Komentar tidak dapat dimuat.',
    saveFailed: 'Komentar tidak dapat disimpan.',
    reactFailed: 'Reaksi tidak dapat disimpan.',
    deleteFailed: 'Komentar tidak dapat dihapus.',
  },
};
