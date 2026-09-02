/** DateTime interface (placeholders; the calendar itself is Mantine + dayjs locale data). */
export interface DateTimeTranslations {
  pickDateTime: string;
  pickDate: string;
  pickTime: string;
}

export const datetimeDefaults: DateTimeTranslations = {
  pickDateTime: 'Pick date and time',
  pickDate: 'Pick date',
  pickTime: 'Pick time',
};

export const datetimeId: DateTimeTranslations = {
  pickDateTime: 'Pilih tanggal dan waktu',
  pickDate: 'Pilih tanggal',
  pickTime: 'Pilih waktu',
};
