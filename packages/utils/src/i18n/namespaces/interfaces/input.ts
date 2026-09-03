/** `interfaces.input` — strings of the Input interface (accessible names of its buttons). */
export interface InputTranslations {
  /** aria-label of the clear button */
  clear: string;
  showPassword: string;
  hidePassword: string;
}

export const inputDefaults: InputTranslations = {
  clear: 'Clear input',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
};

export const inputId: InputTranslations = {
  clear: 'Bersihkan input',
  showPassword: 'Tampilkan kata sandi',
  hidePassword: 'Sembunyikan kata sandi',
};
