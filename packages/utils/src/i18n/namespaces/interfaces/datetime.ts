/** DateTime interface (placeholders; the calendar itself is Mantine + dayjs locale data). */
export interface DateTimeTranslations {
  pickDateTime: string;
  pickDate: string;
  pickTime: string;
  /** "{label} *" — label of a required picker (marker position is locale-specific) */
  requiredLabel: string;
  /**
   * dayjs display formats handed to Mantine's `valueFormat` (month names and
   * AM/PM come from the dayjs locale; the token ORDER is what a locale changes).
   * Not the data formats parsed back from the picker.
   */
  displayFormat: {
    dateTime24: string;
    dateTime24WithSeconds: string;
    dateTime12: string;
    dateTime12WithSeconds: string;
    date: string;
    time24: string;
    time24WithSeconds: string;
    time12: string;
    time12WithSeconds: string;
  };
}

export const datetimeDefaults: DateTimeTranslations = {
  pickDateTime: 'Pick date and time',
  pickDate: 'Pick date',
  pickTime: 'Pick time',
  requiredLabel: '{label} *',
  displayFormat: {
    dateTime24: 'DD MMM YYYY HH:mm',
    dateTime24WithSeconds: 'DD MMM YYYY HH:mm:ss',
    dateTime12: 'DD MMM YYYY hh:mm A',
    dateTime12WithSeconds: 'DD MMM YYYY hh:mm:ss A',
    date: 'DD MMM YYYY',
    time24: 'HH:mm',
    time24WithSeconds: 'HH:mm:ss',
    time12: 'hh:mm A',
    time12WithSeconds: 'hh:mm:ss A',
  },
};

export const datetimeId: DateTimeTranslations = {
  pickDateTime: 'Pilih tanggal dan waktu',
  pickDate: 'Pilih tanggal',
  pickTime: 'Pilih waktu',
  requiredLabel: '{label} *',
  // Indonesian writes day-month-year like the English default; the tokens are
  // dayjs format codes, the month names come from the `id` dayjs locale.
  displayFormat: {
    dateTime24: 'DD MMM YYYY HH:mm',
    dateTime24WithSeconds: 'DD MMM YYYY HH:mm:ss',
    dateTime12: 'DD MMM YYYY hh:mm A',
    dateTime12WithSeconds: 'DD MMM YYYY hh:mm:ss A',
    date: 'DD MMM YYYY',
    time24: 'HH:mm',
    time24WithSeconds: 'HH:mm:ss',
    time12: 'hh:mm A',
    time12WithSeconds: 'hh:mm:ss A',
  },
};
