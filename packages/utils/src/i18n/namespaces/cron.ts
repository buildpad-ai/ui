/**
 * `cron` namespace — the cron admin surfaces: the jobs list with its row
 * actions, the run history (of every job, and of one), the run log dialog,
 * and the job editor (code, settings, header actions).
 *
 * Keep the defaults and the Indonesian catalog in step — the parity test
 * enforces it. Every `PluralForms` entry has `{count}` available; the
 * Indonesian catalog only needs `other` (one plural category).
 *
 * Generic chrome (Cancel, Edit, Delete, Save, Create, Refresh, Back, Retry,
 * Error, Success, "Loading...") comes from the shared `common` namespace and
 * is not repeated here. The editor's "Unsaved Changes" badge is: the reference
 * admin UI writes it in title case, `common.unsavedChanges` in sentence case.
 *
 * Rich text: `jobDetail.codeHelp.body` carries `<code>…</code>` markers that
 * the component maps to inline elements — keep the tags, translate the text
 * between them. Three strings are samples (`jobDetail.code.placeholder`, a
 * JavaScript comment; `jobDetail.fields.schedulePlaceholder` and the
 * expression quoted in `scheduleDescription`, cron expressions); the
 * expressions are the same in every language.
 *
 * The English wording is the reference admin UI's (buildpad-daas), with four
 * kinds of exception:
 *
 *   - `jobDetail.codeHelp.body` names what both backends give a job
 *     (`context`, `services`, `console`); the original named
 *     `services.supabase`, which the Go engine refuses;
 *   - the two badges are worded once: a job's status reads "Active" /
 *     "Inactive" in the list and in the editor (the original editor showed
 *     the stored value in lower case);
 *   - the strings for states the original pages never drew — a failed load, a
 *     missing job, a refusal, a read-only form, code the caller's grant
 *     withholds, a run that was skipped because the job was already running —
 *     and labels for controls that were icons without a name;
 *   - the original's note under a job's history ("Expand a row to view
 *     (future enhancement)") is not here: a row opens the run log.
 */
import type { PluralForms } from '../primitives';

export interface CronTranslations {
  /** Marker shown in place of a missing value ("—") */
  emptyValue: string;
  /** Notification title for a client-side validation failure */
  validationErrorTitle: string;
  /** A job's status badge — list, editor header and the Status select */
  jobStatus: {
    active: string;
    inactive: string;
  };
  /** A run's status badge — the history tables, the run log, a job's Last Status */
  runStatus: {
    running: string;
    success: string;
    error: string;
    timeout: string;
  };
  /** What started a run — the "By" badge */
  trigger: {
    schedule: string;
    manual: string;
    extension: string;
  };
  /** "{count} job(s)" style counts */
  count: {
    jobs: PluralForms;
    runs: PluralForms;
    /** "{count} line(s)" — the Logs cell of a run */
    lines: PluralForms;
    /** "{count} log line(s)" — above the run log */
    logLines: PluralForms;
  };
  /** "{duration} ms" — a run's duration with its unit */
  durationMs: string;
  /** The actions a job has in the list's row menu and in the editor header */
  actions: {
    runNow: string;
    activate: string;
    deactivate: string;
    clone: string;
  };
  /** Notification titles shared by the list and the editor */
  notificationTitles: {
    activated: string;
    deactivated: string;
    cloned: string;
    deleted: string;
    /** A run that happened */
    triggered: string;
    /** A run that did not happen because the job was already running */
    runSkipped: string;
  };
  searchInput: {
    clearAriaLabel: string;
  };
  rowActions: {
    ariaLabel: string;
    /** "Actions for {name}" — the row menu of one job */
    jobAriaLabel: string;
  };
  listFooter: {
    /** "Showing {shown} of {totalCount} {itemsLabel}" — `itemsLabel` is the table's plural noun */
    showing: string;
    /** "{n} / page" — page-size option label */
    perPage: string;
    itemsPerPageAriaLabel: string;
  };
  /** Shown in place of a page or a record the caller may not read */
  accessDenied: {
    title: string;
    description: string;
  };
  jobsManager: {
    title: string;
    newJob: string;
    tabs: {
      jobs: string;
      history: string;
    };
    searchPlaceholder: string;
    /** Plural noun for the footer's "Showing N of M {itemsLabel}" */
    itemsLabel: string;
    columns: {
      name: string;
      schedule: string;
      timezone: string;
      status: string;
      lastRun: string;
      lastStatus: string;
      nextRun: string;
    };
    /** "Open cron job {name}" — the link that opens a job from its row */
    openAriaLabel: string;
    emptyState: {
      /** "Failed to load cron jobs — {error}" */
      loadError: string;
      search: string;
      pristine: string;
    };
    deleteModal: {
      title: string;
      /** 'Are you sure you want to delete the cron job "{name}"? …' */
      description: string;
    };
    notifications: {
      loadFailed: string;
      /** 'Job "{name}" deleted' */
      deleted: string;
      deleteFailed: string;
      /** 'Job "{name}" is now active' */
      activated: string;
      activateFailed: string;
      /** 'Job "{name}" is now inactive' */
      deactivated: string;
      deactivateFailed: string;
      /** 'Job "{name}" has been cloned' */
      cloned: string;
      cloneFailed: string;
      /** 'Job "{name}" started' */
      triggered: string;
      /** 'Job "{name}" is already running, so it was not started again.' */
      runSkipped: string;
      runFailed: string;
    };
  };
  /** The run history table — of every job (the list's History tab) and of one job (the editor's) */
  runsTable: {
    /** Plural noun for the footer's "Showing N of M {itemsLabel}" */
    itemsLabel: string;
    columns: {
      job: string;
      triggered: string;
      durationMs: string;
      status: string;
      triggeredBy: string;
      logs: string;
    };
    /** "View the logs of the run triggered {date}" — the control that opens a run from its row */
    viewLogsAriaLabel: string;
    emptyState: {
      /** "Failed to load run history — {error}" */
      loadError: string;
      /** No job has run yet */
      allJobs: string;
      /** This job has not run yet */
      job: string;
    };
    notifications: {
      loadFailed: string;
    };
  };
  logModal: {
    title: string;
    /** "Run logs — {job}" */
    titleWithJob: string;
    triggered: string;
    duration: string;
    error: string;
    /** Shown in place of the log of a run that printed nothing */
    empty: string;
  };
  jobDetail: {
    /** Breadcrumb back to the list */
    breadcrumbRoot: string;
    /** Breadcrumb of an unsaved job */
    breadcrumbNew: string;
    titleNew: string;
    titleEdit: string;
    /** The badge beside the title while the form holds edits that are not saved */
    unsavedChanges: string;
    tabs: {
      settings: string;
      history: string;
    };
    /** Tooltip of Run Now */
    runNowTooltip: string;
    /** Tooltip of Run Now and Activate while the form has unsaved edits */
    saveFirstTooltip: string;
    codeHelp: {
      title: string;
      /** Rich text: "… access to <code>context</code> …" */
      body: string;
    };
    code: {
      label: string;
      description: string;
      /** A JavaScript comment — shown as it is */
      placeholder: string;
    };
    /** Shown in place of the editor when the caller's grant withholds `code` */
    codeWithheld: string;
    /** Shown above a form the caller may read but not save */
    readOnlyNotice: string;
    settingsHeading: string;
    fields: {
      name: string;
      namePlaceholder: string;
      description: string;
      descriptionPlaceholder: string;
      schedule: string;
      scheduleDescription: string;
      /** A cron expression — the same in every language */
      schedulePlaceholder: string;
      timezone: string;
      timezoneDescription: string;
      timeout: string;
      timeoutDescription: string;
      memoryLimit: string;
      memoryLimitDescription: string;
      status: string;
    };
    validation: {
      nameRequired: string;
      scheduleRequired: string;
      codeRequired: string;
      timeoutNotWholeNumber: string;
      memoryLimitNotWholeNumber: string;
    };
    notFound: {
      title: string;
      description: string;
    };
    /** "Failed to load cron job — {error}" */
    loadError: string;
    notifications: {
      fetchFailed: string;
      created: string;
      saved: string;
      saveFailed: string;
      activated: string;
      activateFailed: string;
      deactivated: string;
      deactivateFailed: string;
      triggered: string;
      /** The job was already running, so Run Now started nothing */
      runSkipped: string;
      runFailed: string;
    };
  };
}

export const cronDefaults: CronTranslations = {
  emptyValue: '—',
  validationErrorTitle: 'Validation Error',
  jobStatus: {
    active: 'Active',
    inactive: 'Inactive',
  },
  runStatus: {
    running: 'Running',
    success: 'Success',
    error: 'Error',
    timeout: 'Timeout',
  },
  trigger: {
    schedule: 'schedule',
    manual: 'manual',
    extension: 'extension',
  },
  count: {
    jobs: { one: '{count} job', other: '{count} jobs' },
    runs: { one: '{count} run', other: '{count} runs' },
    lines: { one: '{count} line', other: '{count} lines' },
    logLines: { one: '{count} log line', other: '{count} log lines' },
  },
  durationMs: '{duration} ms',
  actions: {
    runNow: 'Run Now',
    activate: 'Activate',
    deactivate: 'Deactivate',
    clone: 'Clone',
  },
  notificationTitles: {
    activated: 'Activated',
    deactivated: 'Deactivated',
    cloned: 'Cloned',
    deleted: 'Deleted',
    triggered: 'Triggered',
    runSkipped: 'Already running',
  },
  searchInput: {
    clearAriaLabel: 'Clear search',
  },
  rowActions: {
    ariaLabel: 'Row actions',
    jobAriaLabel: 'Actions for {name}',
  },
  listFooter: {
    showing: 'Showing {shown} of {totalCount} {itemsLabel}',
    perPage: '{n} / page',
    itemsPerPageAriaLabel: 'Items per page',
  },
  accessDenied: {
    title: 'Access denied',
    description: 'You do not have permission to view this.',
  },
  jobsManager: {
    title: 'Cron Jobs',
    newJob: 'New Cron Job',
    tabs: {
      jobs: 'Jobs',
      history: 'History',
    },
    searchPlaceholder: 'Search by name, schedule, or description...',
    itemsLabel: 'jobs',
    columns: {
      name: 'Name',
      schedule: 'Schedule',
      timezone: 'Timezone',
      status: 'Status',
      lastRun: 'Last Run',
      lastStatus: 'Last Status',
      nextRun: 'Next Run',
    },
    openAriaLabel: 'Open cron job {name}',
    emptyState: {
      loadError: 'Failed to load cron jobs — {error}',
      search: 'No jobs match your search',
      pristine: 'No cron jobs yet. Create your first one!',
    },
    deleteModal: {
      title: 'Delete cron job',
      description: 'Are you sure you want to delete the cron job "{name}"? This cannot be undone.',
    },
    notifications: {
      loadFailed: 'Failed to fetch cron jobs',
      deleted: 'Job "{name}" deleted',
      deleteFailed: 'Failed to delete',
      activated: 'Job "{name}" is now active',
      activateFailed: 'Failed to activate',
      deactivated: 'Job "{name}" is now inactive',
      deactivateFailed: 'Failed to deactivate',
      cloned: 'Job "{name}" has been cloned',
      cloneFailed: 'Failed to clone',
      triggered: 'Job "{name}" started',
      runSkipped: 'Job "{name}" is already running, so it was not started again.',
      runFailed: 'Failed to trigger run',
    },
  },
  runsTable: {
    itemsLabel: 'runs',
    columns: {
      job: 'Job',
      triggered: 'Triggered',
      durationMs: 'Duration (ms)',
      status: 'Status',
      triggeredBy: 'By',
      logs: 'Logs',
    },
    viewLogsAriaLabel: 'View the logs of the run triggered {date}',
    emptyState: {
      loadError: 'Failed to load run history — {error}',
      allJobs: 'No execution history yet.',
      job: 'No run history yet. Use “Run Now” to test the job.',
    },
    notifications: {
      loadFailed: 'Failed to fetch history',
    },
  },
  logModal: {
    title: 'Run logs',
    titleWithJob: 'Run logs — {job}',
    triggered: 'Triggered',
    duration: 'Duration',
    error: 'Error',
    empty: 'No console output for this run.',
  },
  jobDetail: {
    breadcrumbRoot: 'Cron Jobs',
    breadcrumbNew: 'New Cron Job',
    titleNew: 'New Cron Job',
    titleEdit: 'Edit Cron Job',
    unsavedChanges: 'Unsaved Changes',
    tabs: {
      settings: 'Settings',
      history: 'History',
    },
    runNowTooltip: 'Run job immediately',
    saveFirstTooltip: 'Save changes first',
    codeHelp: {
      title: 'Cron Code',
      body: 'Your async JavaScript runs in a sandbox with access to <code>context</code> (job metadata), <code>services</code>, and <code>console</code>. Throw to mark the run as failed.',
    },
    code: {
      label: 'Job Code',
      description: 'JavaScript — async/await supported',
      placeholder: '// Your cron code here...',
    },
    codeWithheld:
      'Your access to this job does not include its code, so it is not shown and cannot be changed here.',
    readOnlyNotice: 'You can view this job, but you do not have permission to change it.',
    settingsHeading: 'Job Settings',
    fields: {
      name: 'Name',
      namePlaceholder: 'My Cron Job',
      description: 'Description',
      descriptionPlaceholder: 'What does this job do?',
      schedule: 'Schedule',
      scheduleDescription: 'Cron expression — e.g. "0 9 * * 1-5" = weekdays at 9am',
      schedulePlaceholder: '0 9 * * 1-5',
      timezone: 'Timezone',
      timezoneDescription: 'Schedule is interpreted in this timezone',
      timeout: 'Timeout (ms)',
      timeoutDescription: 'Max execution time before the job is killed',
      memoryLimit: 'Memory Limit (MB)',
      memoryLimitDescription: 'Soft memory cap for the sandbox',
      status: 'Status',
    },
    validation: {
      nameRequired: 'Name is required',
      scheduleRequired: 'Schedule expression is required',
      codeRequired: 'Code is required',
      timeoutNotWholeNumber: 'Timeout must be a whole number of milliseconds, 1 or more',
      memoryLimitNotWholeNumber: 'Memory limit must be a whole number of megabytes, 1 or more',
    },
    notFound: {
      title: 'Cron job not found',
      description: 'It may have been deleted, or you may not have access to it.',
    },
    loadError: 'Failed to load cron job — {error}',
    notifications: {
      fetchFailed: 'Failed to fetch cron job',
      created: 'Cron job created',
      saved: 'Cron job saved',
      saveFailed: 'Failed to save',
      activated: 'Cron job is now active',
      activateFailed: 'Failed to activate',
      deactivated: 'Cron job is now inactive',
      deactivateFailed: 'Failed to deactivate',
      triggered: 'Job started. Check the History tab for results.',
      runSkipped: 'This job is already running, so it was not started again.',
      runFailed: 'Failed to trigger run',
    },
  },
};

export const cronId: CronTranslations = {
  emptyValue: '—',
  validationErrorTitle: 'Kesalahan Validasi',
  jobStatus: {
    active: 'Aktif',
    inactive: 'Nonaktif',
  },
  runStatus: {
    running: 'Berjalan',
    success: 'Berhasil',
    error: 'Gagal',
    timeout: 'Waktu habis',
  },
  trigger: {
    schedule: 'jadwal',
    manual: 'manual',
    extension: 'ekstensi',
  },
  count: {
    jobs: { other: '{count} tugas' },
    runs: { other: '{count} eksekusi' },
    lines: { other: '{count} baris' },
    logLines: { other: '{count} baris log' },
  },
  durationMs: '{duration} ms',
  actions: {
    runNow: 'Jalankan Sekarang',
    activate: 'Aktifkan',
    deactivate: 'Nonaktifkan',
    clone: 'Gandakan',
  },
  notificationTitles: {
    activated: 'Diaktifkan',
    deactivated: 'Dinonaktifkan',
    cloned: 'Digandakan',
    deleted: 'Dihapus',
    triggered: 'Dijalankan',
    runSkipped: 'Sedang berjalan',
  },
  searchInput: {
    clearAriaLabel: 'Bersihkan pencarian',
  },
  rowActions: {
    ariaLabel: 'Aksi baris',
    jobAriaLabel: 'Aksi untuk {name}',
  },
  listFooter: {
    showing: 'Menampilkan {shown} dari {totalCount} {itemsLabel}',
    perPage: '{n} / halaman',
    itemsPerPageAriaLabel: 'Item per halaman',
  },
  accessDenied: {
    title: 'Akses ditolak',
    description: 'Anda tidak memiliki izin untuk melihat ini.',
  },
  jobsManager: {
    title: 'Tugas Cron',
    newJob: 'Tugas Cron Baru',
    tabs: {
      jobs: 'Tugas',
      history: 'Riwayat',
    },
    searchPlaceholder: 'Cari berdasarkan nama, jadwal, atau deskripsi...',
    itemsLabel: 'tugas',
    columns: {
      name: 'Nama',
      schedule: 'Jadwal',
      timezone: 'Zona Waktu',
      status: 'Status',
      lastRun: 'Eksekusi Terakhir',
      lastStatus: 'Status Terakhir',
      nextRun: 'Eksekusi Berikutnya',
    },
    openAriaLabel: 'Buka tugas cron {name}',
    emptyState: {
      loadError: 'Gagal memuat tugas cron — {error}',
      search: 'Tidak ada tugas yang cocok dengan pencarian Anda',
      pristine: 'Belum ada tugas cron. Buat yang pertama!',
    },
    deleteModal: {
      title: 'Hapus tugas cron',
      description: 'Yakin ingin menghapus tugas cron "{name}"? Tindakan ini tidak dapat dibatalkan.',
    },
    notifications: {
      loadFailed: 'Gagal memuat tugas cron',
      deleted: 'Tugas "{name}" dihapus',
      deleteFailed: 'Gagal menghapus',
      activated: 'Tugas "{name}" sekarang aktif',
      activateFailed: 'Gagal mengaktifkan',
      deactivated: 'Tugas "{name}" sekarang nonaktif',
      deactivateFailed: 'Gagal menonaktifkan',
      cloned: 'Tugas "{name}" telah digandakan',
      cloneFailed: 'Gagal menggandakan',
      triggered: 'Tugas "{name}" dijalankan',
      runSkipped: 'Tugas "{name}" sedang berjalan, sehingga tidak dijalankan lagi.',
      runFailed: 'Gagal menjalankan tugas',
    },
  },
  runsTable: {
    itemsLabel: 'eksekusi',
    columns: {
      job: 'Tugas',
      triggered: 'Dipicu',
      durationMs: 'Durasi (ms)',
      status: 'Status',
      triggeredBy: 'Oleh',
      logs: 'Log',
    },
    viewLogsAriaLabel: 'Lihat log eksekusi yang dipicu {date}',
    emptyState: {
      loadError: 'Gagal memuat riwayat eksekusi — {error}',
      allJobs: 'Belum ada riwayat eksekusi.',
      job: 'Belum ada riwayat eksekusi. Gunakan “Jalankan Sekarang” untuk menguji tugas.',
    },
    notifications: {
      loadFailed: 'Gagal memuat riwayat',
    },
  },
  logModal: {
    title: 'Log eksekusi',
    titleWithJob: 'Log eksekusi — {job}',
    triggered: 'Dipicu',
    duration: 'Durasi',
    error: 'Kesalahan',
    empty: 'Tidak ada keluaran konsol untuk eksekusi ini.',
  },
  jobDetail: {
    breadcrumbRoot: 'Tugas Cron',
    breadcrumbNew: 'Tugas Cron Baru',
    titleNew: 'Tugas Cron Baru',
    titleEdit: 'Ubah Tugas Cron',
    unsavedChanges: 'Perubahan Belum Disimpan',
    tabs: {
      settings: 'Pengaturan',
      history: 'Riwayat',
    },
    runNowTooltip: 'Jalankan tugas sekarang juga',
    saveFirstTooltip: 'Simpan perubahan terlebih dahulu',
    codeHelp: {
      title: 'Kode Cron',
      body: 'JavaScript async Anda berjalan di dalam sandbox dengan akses ke <code>context</code> (metadata tugas), <code>services</code>, dan <code>console</code>. Lemparkan galat (throw) untuk menandai eksekusi sebagai gagal.',
    },
    code: {
      label: 'Kode Tugas',
      description: 'JavaScript — async/await didukung',
      placeholder: '// Kode cron Anda di sini...',
    },
    codeWithheld:
      'Akses Anda ke tugas ini tidak mencakup kodenya, sehingga kode tidak ditampilkan dan tidak dapat diubah di sini.',
    readOnlyNotice: 'Anda dapat melihat tugas ini, tetapi tidak memiliki izin untuk mengubahnya.',
    settingsHeading: 'Pengaturan Tugas',
    fields: {
      name: 'Nama',
      namePlaceholder: 'Tugas Cron Saya',
      description: 'Deskripsi',
      descriptionPlaceholder: 'Apa yang dilakukan tugas ini?',
      schedule: 'Jadwal',
      scheduleDescription: 'Ekspresi cron — mis. "0 9 * * 1-5" = hari kerja pukul 9 pagi',
      schedulePlaceholder: '0 9 * * 1-5',
      timezone: 'Zona Waktu',
      timezoneDescription: 'Jadwal ditafsirkan dalam zona waktu ini',
      timeout: 'Batas Waktu (ms)',
      timeoutDescription: 'Waktu eksekusi maksimum sebelum tugas dihentikan',
      memoryLimit: 'Batas Memori (MB)',
      memoryLimitDescription: 'Batas memori lunak untuk sandbox',
      status: 'Status',
    },
    validation: {
      nameRequired: 'Nama wajib diisi',
      scheduleRequired: 'Ekspresi jadwal wajib diisi',
      codeRequired: 'Kode wajib diisi',
      timeoutNotWholeNumber: 'Batas waktu harus berupa bilangan bulat milidetik, 1 atau lebih',
      memoryLimitNotWholeNumber: 'Batas memori harus berupa bilangan bulat megabita, 1 atau lebih',
    },
    notFound: {
      title: 'Tugas cron tidak ditemukan',
      description: 'Mungkin sudah dihapus, atau Anda tidak memiliki akses ke sana.',
    },
    loadError: 'Gagal memuat tugas cron — {error}',
    notifications: {
      fetchFailed: 'Gagal memuat tugas cron',
      created: 'Tugas cron dibuat',
      saved: 'Tugas cron disimpan',
      saveFailed: 'Gagal menyimpan',
      activated: 'Tugas cron sekarang aktif',
      activateFailed: 'Gagal mengaktifkan',
      deactivated: 'Tugas cron sekarang nonaktif',
      deactivateFailed: 'Gagal menonaktifkan',
      triggered: 'Tugas dijalankan. Periksa tab Riwayat untuk melihat hasilnya.',
      runSkipped: 'Tugas ini sedang berjalan, sehingga tidak dijalankan lagi.',
      runFailed: 'Gagal menjalankan tugas',
    },
  },
};
