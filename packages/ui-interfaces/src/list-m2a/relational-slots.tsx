"use client";

/**
 * Shared pieces for the components the relational interfaces render in their
 * dialogs (CollectionForm, CollectionList, VForm), which come from the
 * relational UI context (`@buildpad/services/relational-ui-context`):
 *
 * - `useRelationalSlots` — the slots in scope (a component's own
 *   `components` prop wins over the provider), each wrapped in a LOCAL
 *   Suspense boundary (`RelationalSlotSuspense`), so a lazily loaded form or
 *   picker shows a small loader inside its dialog instead of suspending the
 *   whole field (or the page) to an outer boundary.
 * - `MissingRelationalUIAlert` — what a relational interface renders when no
 *   provider supplies a component it needs. The actions that need it are
 *   hidden by the caller.
 */

import { Suspense, useMemo, type ComponentType, type ReactNode } from "react";
import { Alert, Group, Loader, Text } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useBuildpadTranslations } from "@buildpad/services";
import { interpolate } from "@buildpad/utils";
import {
    useRelationalUI,
    type RelationalUIComponents,
    type RelationalUISlot,
} from "@buildpad/services/relational-ui-context";

/** Local Suspense boundary with a visible, translated loading state. */
export function RelationalSlotSuspense({ children }: { children?: ReactNode }) {
    const t = useBuildpadTranslations((d) => d.interfaces.relationalUI);
    return (
        <Suspense
            fallback={
                <Group justify="center" gap="xs" py="md" role="status" data-testid="relational-slot-loading">
                    <Loader size="sm" />
                    <Text size="sm" c="dimmed">
                        {t.loading}
                    </Text>
                </Group>
            }
        >
            {children}
        </Suspense>
    );
}

// One wrapper per wrapped component, so its identity is stable across renders
// and instances (a new wrapper would remount the dialog's form on every render).
const suspended = new WeakMap<object, ComponentType<never>>();

/** `Inner` rendered inside a {@link RelationalSlotSuspense} boundary. */
export function withRelationalSlotSuspense<P extends object>(Inner: ComponentType<P>): ComponentType<P> {
    const cached = suspended.get(Inner);
    if (cached) return cached as unknown as ComponentType<P>;
    const Wrapped = (props: P) => (
        <RelationalSlotSuspense>
            <Inner {...props} />
        </RelationalSlotSuspense>
    );
    Wrapped.displayName = `RelationalSlot(${Inner.displayName || Inner.name || "Component"})`;
    suspended.set(Inner, Wrapped as unknown as ComponentType<never>);
    return Wrapped;
}

/**
 * The relational components in scope — `overrides` (a component's own
 * `components` prop) > the nearest `RelationalUIProvider` — each wrapped in a
 * local Suspense boundary. A slot nobody supplies is `undefined`.
 */
export function useRelationalSlots(overrides?: RelationalUIComponents): RelationalUIComponents {
    const { CollectionForm, CollectionList, FormRenderer } = useRelationalUI(overrides);
    return useMemo(
        () => ({
            CollectionForm: CollectionForm && withRelationalSlotSuspense(CollectionForm),
            CollectionList: CollectionList && withRelationalSlotSuspense(CollectionList),
            FormRenderer: FormRenderer && withRelationalSlotSuspense(FormRenderer),
        }),
        [CollectionForm, CollectionList, FormRenderer],
    );
}

/**
 * What the alert calls each slot: the component a developer would supply.
 * `FormRenderer` is the slot VForm fills, so it is named after VForm.
 */
const SLOT_LABELS: Record<RelationalUISlot, string> = {
    CollectionForm: "CollectionForm",
    CollectionList: "CollectionList",
    FormRenderer: "VForm",
};

export interface MissingRelationalUIAlertProps {
    /** The slots no provider supplies */
    missing: readonly RelationalUISlot[];
    "data-testid"?: string;
}

/** Explains which relational components are missing and how to provide them. */
export function MissingRelationalUIAlert({ missing, "data-testid": testId }: MissingRelationalUIAlertProps) {
    const t = useBuildpadTranslations((d) => d.interfaces.relationalUI);
    if (missing.length === 0) return null;
    return (
        <Alert
            icon={<IconAlertCircle size={16} />}
            title={t.missingProvider.title}
            color="warning"
            data-testid={testId}
            data-missing={missing.join(" ")}
        >
            {interpolate(t.missingProvider.message, {
                components: missing.map((slot) => SLOT_LABELS[slot]).join(", "),
            })}
        </Alert>
    );
}
