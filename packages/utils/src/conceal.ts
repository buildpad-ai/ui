/**
 * Concealed-value contract (DaaS `hash` / `conceal` field specials).
 *
 * DaaS never returns a stored secret. On read its server-side transformer
 * replaces the value with a run of asterisks when one exists, returns `null`
 * when the column is genuinely empty, and omits write-only columns from the
 * response entirely. Three states, and the UI has to tell them apart:
 *
 *   omitted (undefined) — not fetched; assume nothing
 *   null               — no value is set
 *   asterisks          — a value is set and cannot be shown again
 *
 * The rule used to be re-derived in four places with three different spellings
 * (`/^\*+$/` twice, a truthy-length test that could not tell a mask from a real
 * password, and a hardcoded ten-character literal). It lives here now so the
 * form, the leaves and the save path all agree on what a masked value is.
 *
 * @package @buildpad/utils
 */

import type { Field } from "@buildpad/types";
import { interfaceIdsWithFlag } from "./interface-manifest";

/**
 * What the UI renders for "a value exists but cannot be shown".
 *
 * Only ever *displayed*. Never compare against it — the server chooses its own
 * width (fixtures in this repo use 10, 14 and 46 asterisks); use
 * `isConcealedValue` instead.
 */
export const CONCEALED_PLACEHOLDER = "**********";

/** True when a value is a server-concealed mask rather than a real secret. */
export function isConcealedValue(value: unknown): boolean {
  return typeof value === "string" && value.length > 0 && /^\*+$/.test(value);
}

/**
 * True when a field holds a secret — a hashed credential or a concealed one.
 *
 * Deliberately independent of which interface renders it: whether a mask is
 * *displayed* is a separate question (`concealingInterface`), and splitting the
 * two is what let the previous predicates drift apart.
 */
export function isConcealedField(field: Field): boolean {
  const special = field.meta?.special;
  const hasSpecial = (name: string) =>
    Array.isArray(special) && special.includes(name);
  return field.type === "hash" || hasSpecial("hash") || hasSpecial("conceal");
}

/**
 * Interfaces that render a concealed value as a mask (the manifest's
 * `concealing` flag: input-hash, system-token).
 *
 * The gate matters: a secret field rendered by a plain text interface must show
 * an empty control, not a literal row of asterisks the user could submit as
 * their password.
 */
const CONCEALING_INTERFACES: ReadonlySet<string> = new Set(interfaceIdsWithFlag("concealing"));

export function concealingInterface(interfaceType?: string | null): boolean {
  return !!interfaceType && CONCEALING_INTERFACES.has(interfaceType);
}
