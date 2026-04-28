import type { Field } from '@buildpad/types';

/**
 * Re-exported from field-interface-mapper so this module stays usable
 * as a standalone import while the canonical implementations live in the
 * file that gets distributed via the CLI copy list.
 */
export { getFieldDisplayName, formatFieldTitle } from './field-interface-mapper';

// Keep the Field import used by the re-exported function signatures.
export type { Field };
