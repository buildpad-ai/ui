/**
 * `chat` namespace — ui-chat: the AI chat panel and widget (header, recent
 * chats, the thread, the composer with its image attachments), the header
 * button and the screenshot tools (region selector and annotator).
 *
 * Keep the defaults and the Indonesian catalog in step — the parity test
 * enforces it. Every `PluralForms` entry has `{count}` available; the
 * Indonesian catalog only needs `other` (one plural category).
 *
 * The English wording is the Buildpad Platform's "Ask Buildpad" panel, which
 * this module was ported from, made product-neutral: "Ask Buildpad" becomes
 * the `title` prop (default "Assistant"), and "Check the docs" becomes "Check
 * anything important". The annotator's labels are the get-feedback widget's.
 */
import type { PluralForms } from '../primitives';

export interface ChatTranslations {
  /** Header title when the app passes none */
  title: string;
  /** Accessible name of the panel and the widget window */
  panelLabel: string;
  header: {
    newChat: string;
    recentChats: string;
    /** Close button tooltip (with an Esc hint beside it) */
    close: string;
    /** Close button's accessible name */
    closeLabel: string;
    /** The Escape key, as printed on the keyboard hint beside "Close" */
    escapeKey: string;
  };
  recent: {
    empty: string;
    removeFromList: string;
    /** Remove button's accessible name — "{title}" is the chat's first question */
    removeLabel: string;
    /** Under the list: removing doesn't delete the chat from the agent's logs */
    note: string;
    justNow: string;
    minutesAgo: PluralForms;
    hoursAgo: PluralForms;
    yesterday: string;
    daysAgo: PluralForms;
  };
  empty: {
    /** Heading when the app passes no `greeting` */
    greeting: string;
    historyGone: string;
    historyFailed: string;
  };
  /** One word, picked at random, while the agent searches, reads and thinks */
  working: {
    thinking: string;
    pondering: string;
    investigating: string;
    researching: string;
    crossChecking: string;
    connectingTheDots: string;
  };
  message: {
    copyAnswer: string;
    copied: string;
    copyCode: string;
    sources: string;
    document: string;
    file: string;
    /** After an external link's icon, for screen readers */
    opensInNewTab: string;
    attachedImage: string;
    imageUnavailable: string;
    /** Accessible name of an image's enlarge button — "{name}" */
    enlarge: string;
    image: string;
    openInNewTab: string;
  };
  error: {
    title: string;
    generic: string;
    tryAgain: string;
  };
  jumpToLatest: string;
  composer: {
    placeholder: string;
    placeholderWithImage: string;
    inputLabel: string;
    send: string;
    stop: string;
    stopLabel: string;
    attachImages: string;
    takeScreenshot: string;
    attachedImages: string;
    annotate: string;
    /** "{name}" is the image's file name */
    annotateLabel: string;
    /** "{name}" is the image's file name */
    removeImageLabel: string;
    dropImages: string;
    disclaimer: string;
    imagesNote: string;
    overLimit: PluralForms;
  };
  attachment: {
    onlyImages: string;
    tooMany: PluralForms;
    /** "{name}" is the file name in each of these */
    notImage: string;
    tooLarge: string;
    unreadable: string;
    couldNotAttach: string;
    prepareFailed: string;
    screenshotFailed: string;
    annotateFailed: string;
    pastedImage: string;
    /** File name of a screenshot — "{stamp}" is the local date and time */
    screenshotName: string;
  };
  button: {
    label: string;
    open: string;
    close: string;
  };
  widget: {
    open: string;
    close: string;
  };
  regionSelector: {
    label: string;
    help: string;
  };
  annotator: {
    label: string;
    select: string;
    pen: string;
    line: string;
    rectangle: string;
    arrow: string;
    text: string;
    /** A colour swatch's accessible name — "{color}" is its hex value */
    color: string;
    undo: string;
    undoTitle: string;
    clear: string;
    clearTitle: string;
    cancel: string;
    cancelTitle: string;
    done: string;
    doneTitle: string;
  };
}

export const chatDefaults: ChatTranslations = {
  title: 'Assistant',
  panelLabel: 'AI assistant',
  header: {
    newChat: 'New chat',
    recentChats: 'Recent chats',
    close: 'Close',
    closeLabel: 'Close assistant',
    escapeKey: 'Esc',
  },
  recent: {
    empty: 'Your conversations will show up here.',
    removeFromList: 'Remove from list',
    removeLabel: 'Remove "{title}" from recent chats',
    note: "Removing hides a chat from this list. It isn't deleted from the assistant's logs.",
    justNow: 'just now',
    minutesAgo: { one: '{count} min ago', other: '{count} min ago' },
    hoursAgo: { one: '{count} h ago', other: '{count} h ago' },
    yesterday: 'yesterday',
    daysAgo: { one: '{count} day ago', other: '{count} days ago' },
  },
  empty: {
    greeting: 'How can I help?',
    historyGone: 'That conversation is no longer available.',
    historyFailed: "Couldn't load this conversation.",
  },
  working: {
    thinking: 'Thinking',
    pondering: 'Pondering',
    investigating: 'Investigating',
    researching: 'Researching',
    crossChecking: 'Cross-checking',
    connectingTheDots: 'Connecting the dots',
  },
  message: {
    copyAnswer: 'Copy answer',
    copied: 'Copied',
    copyCode: 'Copy code',
    sources: 'Sources',
    document: 'Document',
    file: 'File',
    opensInNewTab: '(opens in a new tab)',
    attachedImage: 'Attached image',
    imageUnavailable: 'Image no longer available',
    enlarge: 'Enlarge {name}',
    image: 'Image',
    openInNewTab: 'Open in new tab',
  },
  error: {
    title: 'No answer this time',
    generic: 'Something went wrong while answering. Try again in a moment.',
    tryAgain: 'Try again',
  },
  jumpToLatest: 'Jump to latest message',
  composer: {
    placeholder: 'Ask a question…',
    placeholderWithImage: 'Ask about the image…',
    inputLabel: 'Ask the assistant a question',
    send: 'Send question',
    stop: 'Stop',
    stopLabel: 'Stop answering',
    attachImages: 'Attach images',
    takeScreenshot: 'Take a screenshot',
    attachedImages: 'Attached images',
    annotate: 'Annotate',
    annotateLabel: 'Annotate {name}',
    removeImageLabel: 'Remove {name}',
    dropImages: 'Drop images to attach',
    disclaimer: 'AI answers can be wrong. Check anything important.',
    imagesNote: 'Images are sent to the assistant and kept with this chat.',
    overLimit: { one: '{count} character over the limit', other: '{count} characters over the limit' },
  },
  attachment: {
    onlyImages: 'Only images can be attached: PNG, JPEG, WebP or GIF.',
    tooMany: {
      one: 'You can attach up to {count} image to one question.',
      other: 'You can attach up to {count} images to one question.',
    },
    notImage: "{name} isn't a PNG, JPEG, WebP or GIF image.",
    tooLarge: '{name} is too large to attach.',
    unreadable: "{name} couldn't be read as an image.",
    couldNotAttach: "{name} couldn't be attached.",
    prepareFailed: "This browser couldn't prepare the image.",
    screenshotFailed: "The screenshot couldn't be taken. Try again.",
    annotateFailed: "The image couldn't be annotated.",
    pastedImage: 'Pasted image',
    screenshotName: 'Screenshot {stamp}',
  },
  button: {
    label: 'Ask AI',
    open: 'Ask the assistant',
    close: 'Close assistant',
  },
  widget: {
    open: 'Open assistant',
    close: 'Close assistant',
  },
  regionSelector: {
    label: 'Drag to select screenshot region',
    help: 'Drag to select · ESC to cancel',
  },
  annotator: {
    label: 'Annotate screenshot',
    select: 'Select',
    pen: 'Pen',
    line: 'Line',
    rectangle: 'Rectangle',
    arrow: 'Arrow',
    text: 'Text',
    color: 'Color {color}',
    undo: 'Undo',
    undoTitle: 'Undo (Ctrl/Cmd+Z)',
    clear: 'Clear',
    clearTitle: 'Clear all',
    cancel: 'Cancel',
    cancelTitle: 'Cancel (Esc)',
    done: 'Done',
    doneTitle: 'Done (Enter)',
  },
};

export const chatId: ChatTranslations = {
  title: 'Asisten',
  panelLabel: 'Asisten AI',
  header: {
    newChat: 'Obrolan baru',
    recentChats: 'Obrolan terbaru',
    close: 'Tutup',
    closeLabel: 'Tutup asisten',
    escapeKey: 'Esc',
  },
  recent: {
    empty: 'Percakapan Anda akan muncul di sini.',
    removeFromList: 'Hapus dari daftar',
    removeLabel: 'Hapus "{title}" dari obrolan terbaru',
    note: 'Menghapus hanya menyembunyikan obrolan dari daftar ini. Obrolan tidak dihapus dari log asisten.',
    justNow: 'baru saja',
    minutesAgo: { other: '{count} mnt lalu' },
    hoursAgo: { other: '{count} jam lalu' },
    yesterday: 'kemarin',
    daysAgo: { other: '{count} hari lalu' },
  },
  empty: {
    greeting: 'Ada yang bisa dibantu?',
    historyGone: 'Percakapan itu sudah tidak tersedia.',
    historyFailed: 'Percakapan ini tidak dapat dimuat.',
  },
  working: {
    thinking: 'Berpikir',
    pondering: 'Menimbang',
    investigating: 'Menyelidiki',
    researching: 'Meneliti',
    crossChecking: 'Memeriksa silang',
    connectingTheDots: 'Menghubungkan titik-titik',
  },
  message: {
    copyAnswer: 'Salin jawaban',
    copied: 'Tersalin',
    copyCode: 'Salin kode',
    sources: 'Sumber',
    document: 'Dokumen',
    file: 'Berkas',
    opensInNewTab: '(terbuka di tab baru)',
    attachedImage: 'Gambar terlampir',
    imageUnavailable: 'Gambar sudah tidak tersedia',
    enlarge: 'Perbesar {name}',
    image: 'Gambar',
    openInNewTab: 'Buka di tab baru',
  },
  error: {
    title: 'Belum ada jawaban',
    generic: 'Terjadi kesalahan saat menjawab. Coba lagi sebentar lagi.',
    tryAgain: 'Coba lagi',
  },
  jumpToLatest: 'Lompat ke pesan terbaru',
  composer: {
    placeholder: 'Ajukan pertanyaan…',
    placeholderWithImage: 'Tanyakan tentang gambar…',
    inputLabel: 'Ajukan pertanyaan kepada asisten',
    send: 'Kirim pertanyaan',
    stop: 'Berhenti',
    stopLabel: 'Hentikan jawaban',
    attachImages: 'Lampirkan gambar',
    takeScreenshot: 'Ambil tangkapan layar',
    attachedImages: 'Gambar terlampir',
    annotate: 'Beri anotasi',
    annotateLabel: 'Beri anotasi pada {name}',
    removeImageLabel: 'Hapus {name}',
    dropImages: 'Lepaskan gambar untuk melampirkan',
    disclaimer: 'Jawaban AI bisa salah. Periksa hal yang penting.',
    imagesNote: 'Gambar dikirim ke asisten dan disimpan bersama obrolan ini.',
    overLimit: { other: '{count} karakter melebihi batas' },
  },
  attachment: {
    onlyImages: 'Hanya gambar yang dapat dilampirkan: PNG, JPEG, WebP, atau GIF.',
    tooMany: { other: 'Anda dapat melampirkan hingga {count} gambar per pertanyaan.' },
    notImage: '{name} bukan gambar PNG, JPEG, WebP, atau GIF.',
    tooLarge: '{name} terlalu besar untuk dilampirkan.',
    unreadable: '{name} tidak dapat dibaca sebagai gambar.',
    couldNotAttach: '{name} tidak dapat dilampirkan.',
    prepareFailed: 'Browser ini tidak dapat menyiapkan gambar.',
    screenshotFailed: 'Tangkapan layar tidak dapat diambil. Coba lagi.',
    annotateFailed: 'Gambar tidak dapat diberi anotasi.',
    pastedImage: 'Gambar tempelan',
    screenshotName: 'Tangkapan layar {stamp}',
  },
  button: {
    label: 'Tanya AI',
    open: 'Tanya asisten',
    close: 'Tutup asisten',
  },
  widget: {
    open: 'Buka asisten',
    close: 'Tutup asisten',
  },
  regionSelector: {
    label: 'Seret untuk memilih area tangkapan layar',
    help: 'Seret untuk memilih · ESC untuk batal',
  },
  annotator: {
    label: 'Beri anotasi pada tangkapan layar',
    select: 'Pilih',
    pen: 'Pena',
    line: 'Garis',
    rectangle: 'Persegi panjang',
    arrow: 'Panah',
    text: 'Teks',
    color: 'Warna {color}',
    undo: 'Urungkan',
    undoTitle: 'Urungkan (Ctrl/Cmd+Z)',
    clear: 'Bersihkan',
    clearTitle: 'Bersihkan semua',
    cancel: 'Batal',
    cancelTitle: 'Batal (Esc)',
    done: 'Selesai',
    doneTitle: 'Selesai (Enter)',
  },
};
