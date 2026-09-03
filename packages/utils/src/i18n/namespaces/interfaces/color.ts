/** `interfaces.color` — strings of the Color interface. */
export interface ColorTranslations {
  opacity: string;
  presets: string;
  /** Tooltip names of the built-in preset swatches (a `presets` prop supplies its own names) */
  presetNames: {
    purple: string;
    blue: string;
    green: string;
    yellow: string;
    orange: string;
    red: string;
    black: string;
    gray: string;
    white: string;
  };
}

export const colorDefaults: ColorTranslations = {
  opacity: 'Opacity',
  presets: 'Presets',
  presetNames: {
    purple: 'Purple',
    blue: 'Blue',
    green: 'Green',
    yellow: 'Yellow',
    orange: 'Orange',
    red: 'Red',
    black: 'Black',
    gray: 'Gray',
    white: 'White',
  },
};

export const colorId: ColorTranslations = {
  opacity: 'Opasitas',
  presets: 'Preset',
  presetNames: {
    purple: 'Ungu',
    blue: 'Biru',
    green: 'Hijau',
    yellow: 'Kuning',
    orange: 'Oranye',
    red: 'Merah',
    black: 'Hitam',
    gray: 'Abu-abu',
    white: 'Putih',
  },
};
