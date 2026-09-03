/** `interfaces.autocompleteApi` — strings of the AutocompleteAPI interface. */
export interface AutocompleteApiTranslations {
  /** Shown when the interface is rendered without a `url` option */
  missingUrl: {
    placeholder: string;
    error: string;
    hint: string;
  };
}

export const autocompleteApiDefaults: AutocompleteApiTranslations = {
  missingUrl: {
    placeholder: 'URL configuration missing',
    error: 'URL configuration is required',
    hint: 'One or more options are missing. Please configure the URL.',
  },
};

export const autocompleteApiId: AutocompleteApiTranslations = {
  missingUrl: {
    placeholder: 'Konfigurasi URL belum diisi',
    error: 'Konfigurasi URL wajib diisi',
    hint: 'Satu atau beberapa opsi belum diisi. Silakan konfigurasikan URL.',
  },
};
