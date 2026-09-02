/**
 * Bahasa Indonesia — complete translation of the defaults, assembled from
 * `namespaces/*.ts`.
 *
 * Apps use it as-is (`translations={id}`) or spread it under their own
 * `buildpad` dictionary namespace. Indonesian has a single plural category, so
 * every `PluralForms` only needs `other`.
 */
import type { BuildpadTranslations } from '../types';
import { commonId } from '../namespaces/common';
import { formId } from '../namespaces/form';
import { tableId } from '../namespaces/table';
import { interfacesId } from '../namespaces/interfaces';

export const id: BuildpadTranslations = {
  common: commonId,
  form: formId,
  table: tableId,
  interfaces: interfacesId,
};

export default id;
