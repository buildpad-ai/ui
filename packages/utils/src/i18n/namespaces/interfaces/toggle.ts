/** `interfaces.toggle` — strings of the Toggle interface. */
export interface ToggleTranslations {
  /** Default `labelOn` state label */
  on: string;
  /** Default `labelOff` state label */
  off: string;
  /** aria-label of the switch when no label is given */
  ariaLabel: string;
}

export const toggleDefaults: ToggleTranslations = {
  on: 'On',
  off: 'Off',
  ariaLabel: 'Toggle',
};

export const toggleId: ToggleTranslations = {
  on: 'Aktif',
  off: 'Nonaktif',
  ariaLabel: 'Sakelar',
};
