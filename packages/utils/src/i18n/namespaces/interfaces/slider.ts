/** `interfaces.slider` — strings of the Slider interface. */
export interface SliderTranslations {
  /** Thumb aria-label when the value label is not always shown */
  thumbLabel: string;
  /** aria-label of the slider when no label is given */
  ariaLabel: string;
  /** "Min: {min}" */
  min: string;
  /** "Value: {value}" */
  value: string;
  /** "Max: {max}" */
  max: string;
}

export const sliderDefaults: SliderTranslations = {
  thumbLabel: 'Press to set value',
  ariaLabel: 'Slider',
  min: 'Min: {min}',
  value: 'Value: {value}',
  max: 'Max: {max}',
};

export const sliderId: SliderTranslations = {
  thumbLabel: 'Tekan untuk mengatur nilai',
  ariaLabel: 'Penggeser',
  min: 'Min: {min}',
  value: 'Nilai: {value}',
  max: 'Maks: {max}',
};
