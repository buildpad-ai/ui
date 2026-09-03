/** `interfaces.systemToken` — strings of the SystemToken interface. */
export interface SystemTokenTranslations {
  /** Clipboard notification */
  copySuccess: string;
  copyFail: string;
  placeholder: {
    /** Token exists on the server (masked) */
    saved: string;
    /** No token yet and the Generate control is available */
    generateHint: string;
    /** No token and the field is disabled / read-only */
    none: string;
  };
  /** aria-labels of the input actions */
  copyToken: string;
  regenerateToken: string;
  generateToken: string;
  removeToken: string;
  /** Alert shown after a token was generated */
  backupNotice: string;
}

export const systemTokenDefaults: SystemTokenTranslations = {
  copySuccess: 'Token copied to clipboard',
  copyFail: 'Failed to copy token',
  placeholder: {
    saved: 'Value Securely Saved',
    generateHint: 'Click "Generate Token" to create a new static access token',
    none: 'No token set',
  },
  copyToken: 'Copy token',
  regenerateToken: 'Regenerate token',
  generateToken: 'Generate token',
  removeToken: 'Remove token',
  backupNotice:
    'Make sure to back up and copy the token above. For security reasons, you will not be able to view it again after saving.',
};

export const systemTokenId: SystemTokenTranslations = {
  copySuccess: 'Token disalin ke papan klip',
  copyFail: 'Gagal menyalin token',
  placeholder: {
    saved: 'Nilai Tersimpan dengan Aman',
    generateHint: 'Klik "Buat Token" untuk membuat token akses statis baru',
    none: 'Belum ada token',
  },
  copyToken: 'Salin token',
  regenerateToken: 'Buat ulang token',
  generateToken: 'Buat token',
  removeToken: 'Hapus token',
  backupNotice:
    'Pastikan untuk mencadangkan dan menyalin token di atas. Demi keamanan, Anda tidak akan dapat melihatnya lagi setelah menyimpan.',
};
