/**
 * Dictionary type — derived from en.json so every other locale file must
 * carry the same keys (a missing key is a type error in dictionaries.ts).
 *
 * @buildpad/origin: lib/i18n/types
 * @buildpad/version: 1.0.0
 */

import type en from "./dictionaries/en.json";

export type Dictionary = typeof en;

/** Dotted key path into the `app` namespace, e.g. "app.login.submit". */
export type DictionaryPath = string;
