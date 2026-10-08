/**
 * Shared probe leaf for the FormField / FormFieldInterface prop-forwarding
 * tests.
 *
 * `@buildpad/ui-interfaces` has no jest moduleNameMapper entry, so these tests
 * mock the whole module down to a single fake leaf and assert on the props the
 * container hands it. Both test files previously carried their own copy of this
 * harness; keeping one copy means a new assertion (onChange suppression,
 * required, autofocus) is added in one place.
 *
 * Usage — the jest.mock factory may not close over out-of-scope variables, so
 * pull the factory in through require():
 *
 *   jest.mock('@buildpad/ui-interfaces', () =>
 *     require('./helpers/leafProbe').makeInterfacesMock());
 *   import { received, resetProbe } from './helpers/leafProbe';
 */

export interface ProbeRecord {
    /** The value the container resolved for this field. */
    value: unknown;
    /** The accessible name the container passed (leaves have no visible label). */
    ariaLabel: unknown;
    /** The E2E hook the container passed (e.g. "field-password"). */
    dataTestId: unknown;
    /** The record's key, under the one name the container passes it by. */
    primaryKey: unknown;
    collection: unknown;
    disabled: unknown;
    readOnly: unknown;
    required: unknown;
    autofocus: unknown;
    /** True when the container passed a live onChange (i.e. writes are allowed). */
    hasOnChange: boolean;
    /** Calls the leaf made — populated by tests that fire an edit. */
    onChange?: (value: unknown) => void;
}

export const received: ProbeRecord[] = [];

export function resetProbe(): void {
    received.length = 0;
}

/** Props the last render handed the leaf. */
export function lastProps(): ProbeRecord | undefined {
    return received.at(-1);
}

/** The disabled/readOnly pair alone — the S2.6 assertion most tests care about. */
export function lastLockState(): { disabled: unknown; readOnly: unknown } | undefined {
    const p = received.at(-1);
    return p && { disabled: p.disabled, readOnly: p.readOnly };
}

export function makeInterfacesMock() {
    const Probe = ({ value, disabled, readOnly, required, autofocus, onChange, ...rest }: any) => {
        received.push({
            value,
            ariaLabel: rest['aria-label'],
            dataTestId: rest['data-testid'],
            primaryKey: rest.primaryKey,
            collection: rest.collection,
            disabled,
            readOnly,
            required,
            autofocus,
            hasOnChange: typeof onChange === 'function',
            onChange,
        });
        return (
            <input
                data-testid="probe"
                disabled={disabled}
                readOnly={readOnly}
                required={required}
                onChange={(e) => onChange?.(e.currentTarget.value)}
            />
        );
    };

    // Every interface name FormFieldInterface can resolve to maps onto the same
    // probe, so a test can change field type without touching the mock.
    //
    // A plain object, not a Proxy: FormFieldInterface uses `import * as` and
    // TypeScript's interop COPIES the module's own enumerable keys, so a
    // Proxy's `get` trap never fires for anything its `ownKeys` does not list.
    // Only `Input` used to resolve; every other leaf silently came back
    // undefined and rendered the "component not found" alert instead.
    const leaves: Record<string, typeof Probe> = {};
    for (const name of INTERFACE_COMPONENT_NAMES) leaves[name] = Probe;
    return leaves;
}

/**
 * Component names in FormFieldInterface's `interfaceComponentMap`. Keep in
 * sync with that map — a missing name renders the not-found alert rather than
 * the probe, which reads as an assertion failure with no obvious cause.
 */
const INTERFACE_COMPONENT_NAMES = [
    'AutocompleteAPI','Boolean','CollectionItemDropdown','Color','DateTime','Divider','File','FileImage','Files','GroupAccordion','GroupDetail','GroupRaw','Input','InputBlockEditor','InputCode','InputHash','Map','Notice','RichTextHTML','RichTextMarkdown','SelectDropdown','SelectIcon','SelectMultipleCheckbox','SelectMultipleCheckboxTree','SelectMultipleDropdown','SelectRadio','Slider','SystemPermissions','SystemToken','Tags','Textarea','Toggle','WorkflowButton',
] as const;
