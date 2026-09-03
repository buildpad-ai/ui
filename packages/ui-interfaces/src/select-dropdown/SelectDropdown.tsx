import React from 'react';
import { Select, SelectProps, Group, ColorSwatch, Text, ComboboxItem, ComboboxLikeRenderOptionInput } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useBuildpadTranslations } from '@buildpad/services';
import type { DeepPartial, InterfacesTranslations } from '@buildpad/utils';
import { IconDisplay } from '../select-icon/SelectIcon';

/**
 * Interface option type matching DaaS select-dropdown interface
 * Supports icon and color properties like DaaS
 */
export interface SelectOption {
  text: string;
  value: string | number | boolean;
  icon?: string | null;
  color?: string | null;
  disabled?: boolean;
  children?: SelectOption[];
}

/**
 * Props for the SelectDropdown component
 */
export interface SelectDropdownProps {
  /** Current selected value */
  value?: string | number | boolean | null;
  /** Callback fired when value changes */
  onChange?: (value: string | number | boolean | null) => void;
  /** Array of choice options */
  choices?: SelectOption[];
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Icon to display in the left section (global icon for all options) */
  icon?: string;
  /** Whether to allow clearing the selection */
  allowNone?: boolean;
  /** Whether to allow entering custom values not in the choices */
  allowOther?: boolean;
  /** Field label */
  label?: string;
  /** Field description */
  description?: string;
  /** Error message */
  error?: string | boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is read-only */
  readOnly?: boolean;
  /** Whether to enable search functionality */
  searchable?: boolean;
  /** Maximum height of the dropdown */
  maxDropdownHeight?: number;
  /** Additional Mantine Select props */
  selectProps?: Partial<SelectProps>;
  /** Accessible name for the underlying Select input, since `label` is rendered separately by FormFieldLabel */
  'aria-label'?: string;
  /** Per-instance overrides of the dictionary strings (`interfaces.selectDropdown`) */
  translations?: DeepPartial<InterfacesTranslations['selectDropdown']>;
}

/**
 * SelectDropdown component implementing DaaS select-dropdown interface
 * 
 * This component provides a dropdown selection interface compatible with DaaS
 * select-dropdown interface, built using Mantine's Select component.
 * 
 * Features:
 * - Single value selection from predefined choices
 * - Optional custom value input (allowOther)
 * - Clearable selection (allowNone)
 * - Search functionality
 * - Icon and color support (like DaaS)
 * - Validation and error states
 * - Accessibility compliant
 * 
 * @example
 * ```tsx
 * <SelectDropdown
 *   value="react"
 *   onChange={handleChange}
 *   choices={[
 *     { text: 'React', value: 'react', icon: 'code', color: '#61dafb' },
 *     { text: 'Vue', value: 'vue', icon: 'code', color: '#42b883' },
 *     { text: 'Angular', value: 'angular', icon: 'code', color: '#dd0031' }
 *   ]}
 *   label="Your favorite framework"
 *   placeholder="Choose a framework"
 *   allowNone
 *   searchable
 * />
 * ```
 */
export const SelectDropdown: React.FC<SelectDropdownProps> = ({
  value = null,
  onChange,
  choices = [],
  disabled = false,
  placeholder,
  icon,
  allowNone = false,
  allowOther = false,
  label,
  description,
  error,
  required = false,
  readOnly = false,
  searchable = false,
  maxDropdownHeight = 200,
  selectProps = {},
  'aria-label': ariaLabel,
  translations,
}) => {
  // Dictionary strings; the `placeholder` prop wins over both the
  // `translations` prop and the provider dictionary.
  const t = useBuildpadTranslations((d) => d.interfaces.selectDropdown, translations, { placeholder });

  // Check if any choice has an icon - used for global icon display logic (like DaaS)
  const applyGlobalIcon = React.useMemo(() => 
    choices?.some((choice) => choice.icon), 
    [choices]
  );

  // Apply global icon to choices that don't have one (DaaS behavior)
  const processedChoices = React.useMemo(() => {
    if (!choices || choices.length === 0) {
      return [];
    }

    if (!applyGlobalIcon) {
      return choices;
    }

    return choices.map((choice) => {
      const choiceCopy = { ...choice };
      if (!choiceCopy.icon && !choiceCopy.color) {
        choiceCopy.icon = icon ?? null;
      }
      return choiceCopy;
    });
  }, [choices, applyGlobalIcon, icon]);

  // Determine if we should show global icon (DaaS behavior)
  const showGlobalIcon = React.useMemo(() => {
    if (!icon) {
      return false;
    }
    if (!applyGlobalIcon) {
      return true;
    }
    if (value === null || value === undefined || value === '') {
      return true;
    }
    return false;
  }, [icon, applyGlobalIcon, value]);

  // Convert choices to Mantine Select format with icon/color support
  const selectData = React.useMemo(() => {
    // Mantine's <Select> requires globally-unique string `value`s in `data`
    // and throws "Duplicate options are not supported" otherwise. Choices
    // with different typed values that stringify identically (e.g. number 1
    // vs string '1') would collide here — drop the second occurrence so the
    // field renders (matching handleChange below, which already resolves
    // the *first* matching choice by stringified value, so the dropped
    // choice was never independently selectable anyway).
    const seen = new Set<string>();
    const base: { value: string; label: string; disabled: boolean; icon: string | null | undefined; color: string | null | undefined }[] = [];
    for (const choice of processedChoices) {
      const strValue = String(choice.value);
      if (seen.has(strValue)) continue;
      seen.add(strValue);
      base.push({
        value: strValue,
        label: choice.text,
        disabled: choice.disabled || false,
        // Store original choice for rendering
        icon: choice.icon,
        color: choice.color,
      });
    }

    // allowOther: a previously-committed custom value won't be in `choices`,
    // so Mantine's <Select> (which only highlights/displays values present
    // in `data`) would otherwise show it blank. Inject it as a synthetic
    // option so the current value round-trips correctly. (Runs after the
    // dedup above, so the some() check is against the values Mantine will
    // actually receive.)
    if (allowOther && value !== null && value !== undefined && value !== '') {
      const strValue = String(value);
      if (!base.some((item) => item.value === strValue)) {
        return [...base, { value: strValue, label: strValue, disabled: false, icon: null, color: null }];
      }
    }

    return base;
  }, [processedChoices, allowOther, value]);

  // allowOther: track the live search text so a typed value that matches no
  // existing choice can be committed on Enter/blur. Mantine v8's <Select>
  // has no built-in "creatable" mode, so this is done manually.
  const [otherSearchValue, setOtherSearchValue] = React.useState('');

  // Set synchronously whenever Mantine submits a dropdown option — via the
  // chained onOptionSubmit below, which fires for BOTH click and Enter
  // submissions, including re-submitting the currently-selected option
  // (which Mantine's own onChange skips) — and by cancelOtherEdit. Read by
  // the microtask-DEFERRED Enter commit: Mantine's Enter handling runs
  // after this component's onKeyDown but synchronously within the same
  // task, so by the time the deferred commit executes, this flag says
  // authoritatively whether that Enter selected an option (skip — Mantine
  // already emitted) or was free text (commit). Also consumed by same-task
  // blur commits (e.g. selectProps.autoSelectOnBlur, where Mantine clicks
  // the selected option synchronously inside its blur handler before
  // chaining to ours).
  const justSelectedRef = React.useRef(false);

  // Dedupe key for commitOtherValue, so repeated blur/Enter events with
  // unchanged text (e.g. tabbing away and back without editing) don't
  // re-fire onChange with the same value. Written by commitOtherValue and
  // handleChange, and kept in sync with the current `value` by the effect
  // below. Stored TRIMMED, because commitOtherValue compares the trimmed
  // search text against it — an untrimmed entry could never match, so a
  // stored value with surrounding whitespace would re-commit its trimmed
  // form on every focus traversal.
  const lastCommittedRef = React.useRef<string | null>(null);

  // V3-2: keep lastCommittedRef in sync with the actual current `value`
  // instead of only ever being written by commitOtherValue itself.
  // Otherwise: commit "bar" (lastCommittedRef = "bar") → select a different
  // option or have the value reset externally → type "bar" again → the
  // dedupe check still sees "bar" === lastCommittedRef and silently drops
  // the commit for the rest of the mount's lifetime, even though "bar"
  // isn't the current value anymore.
  React.useEffect(() => {
    lastCommittedRef.current =
      value !== null && value !== undefined ? String(value).trim() : null;
  }, [value]);

  // V3-3: the flag must self-expire instead of relying solely on
  // commitOtherValue to consume it. Previously it stayed `true` until the
  // *next* commitOtherValue call, however far in the future that was — so
  // click "Foo" (sets it true) → type "bar" → Enter did nothing and only
  // the *second* Enter actually committed "bar". The flag exists to bridge
  // exactly one task (the event in which Mantine synchronously submitted an
  // option); a microtask reset keeps it visible to everything else in that
  // task — the deferred Enter commit, a same-task blur commit — while
  // guaranteeing a later, unrelated keystroke or blur never sees it.
  const clearJustSelectedSoon = React.useCallback(() => {
    queueMicrotask(() => {
      justSelectedRef.current = false;
    });
  }, []);

  const commitOtherValue = React.useCallback(() => {
    // readOnly/disabled fields must never emit — Mantine only gates its own
    // keyboard logic on readOnly, not the chained onBlur/onKeyDown here, so
    // without this guard a field flipped to readOnly with uncommitted text
    // (save-in-flight, permission change) would still commit it on blur.
    if (!allowOther || !onChange || readOnly || disabled) return;
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    const trimmed = otherSearchValue.trim();
    if (!trimmed) return;
    if (trimmed === lastCommittedRef.current) return;
    // Text that names an existing choice resolves to that choice's typed
    // value instead of committing as free text — or being silently dropped:
    // with no highlighted option (Mantine resets the highlight on every
    // keystroke and selectFirstOptionOnChange is off by default), Mantine
    // declines the Enter entirely, so a silently-returning guard here made
    // typing an exact label a dead keystroke whose text the next blur then
    // wiped. Comparisons are trimmed-to-trimmed so whitespace-padded choice
    // labels can't be committed over their own values.
    const matchedChoice = choices.find(
      (choice) => choice.text.trim() === trimmed || String(choice.value).trim() === trimmed,
    );
    if (matchedChoice) {
      const matchedStr = String(matchedChoice.value).trim();
      if (matchedStr !== lastCommittedRef.current) {
        lastCommittedRef.current = matchedStr;
        onChange(matchedChoice.value);
      }
      return;
    }
    lastCommittedRef.current = trimmed;
    onChange(trimmed);
  }, [allowOther, onChange, readOnly, disabled, otherSearchValue, choices]);

  // The currently selected choice, if any — used so the closed input can
  // show *that* choice's own icon/color once something is selected (see
  // leftSection below), and by cancelOtherEdit to restore the label.
  const selectedChoice = React.useMemo(() => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const strValue = String(value);
    return choices.find((choice) => String(choice.value) === strValue) ?? null;
  }, [choices, value]);

  // Escape: restore the search text to the current committed value instead
  // of leaving typed-but-uncommitted text in place, which the subsequent
  // blur would otherwise commit. Restore the choice's LABEL when the value
  // is a real choice — restoring String(value) would display the raw stored
  // value (a numeric FK, a slug) in the input until the next blur re-syncs.
  const cancelOtherEdit = React.useCallback(() => {
    justSelectedRef.current = true; // suppress a same-task blur following Escape
    clearJustSelectedSoon();
    setOtherSearchValue(
      selectedChoice
        ? selectedChoice.text
        : value !== null && value !== undefined
          ? String(value)
          : '',
    );
  }, [value, selectedChoice, clearJustSelectedSoon]);

  // Handle value changes
  const handleChange = React.useCallback(
    (selectedValue: string | null) => {
      if (!onChange) {
        return;
      }
      justSelectedRef.current = true;
      clearJustSelectedSoon();

      if (selectedValue === null) {
        lastCommittedRef.current = null;
        onChange(null);
        return;
      }

      // Find the original choice to get the correct value type.
      //
      // The dedupe key is synced here as well as in the [value] effect:
      // for parents that never echo the value back into `value`
      // (uncontrolled usage, or a parent that rejects the commit) the
      // effect never re-fires, and a stale key from an earlier free-text
      // commit would otherwise swallow re-typing that same text forever.
      const originalChoice = choices.find((choice) => String(choice.value) === selectedValue);
      if (originalChoice) {
        lastCommittedRef.current = String(originalChoice.value).trim();
        onChange(originalChoice.value);
      } else if (allowOther) {
        // Reachable when the user clicks the synthetic "current custom
        // value" option injected into selectData above (re-selecting an
        // already-committed other-value); new free text is committed via
        // commitOtherValue (search + Enter/blur), not through this path,
        // since Mantine's onChange never fires for text with no matching
        // option.
        lastCommittedRef.current = selectedValue.trim();
        onChange(selectedValue);
      }
    },
    [onChange, choices, allowOther, clearJustSelectedSoon]
  );

  // Convert current value to string for Mantine Select
  const selectValue = React.useMemo(() => {
    if (value === null || value === undefined) {
      return null;
    }
    return String(value);
  }, [value]);

  // Determine if we should show no data message
  const showNoData = selectData.length === 0;

  // Left section icon rendering — the selected choice's own icon/color when
  // set, otherwise the global fallback; icons resolved to the actual Tabler
  // glyph via the shared ICON_MAP (select-icon's IconDisplay), never printed
  // as the raw Material icon name string.
  const leftSection = React.useMemo(() => {
    // Mirror renderOption below: show both when the choice has both, not
    // just the color (a bare ColorSwatch previously won a choice's icon
    // entirely out of the closed input whenever a color was also set).
    if (selectedChoice?.color || selectedChoice?.icon) {
      return (
        <Group gap={4} wrap="nowrap">
          {selectedChoice.color && <ColorSwatch color={selectedChoice.color} size={14} />}
          {selectedChoice.icon && <IconDisplay icon={selectedChoice.icon} size={16} />}
        </Group>
      );
    }
    if (!showGlobalIcon || !icon) {
      return undefined;
    }

    return <IconDisplay icon={icon} size={16} />;
  }, [selectedChoice, showGlobalIcon, icon]);

  // Custom render option component for icon/color support
  const renderOption = React.useCallback(
    ({ option, checked }: ComboboxLikeRenderOptionInput<ComboboxItem & { icon?: string | null; color?: string | null }>) => {
      return (
        <Group gap="sm" wrap="nowrap">
          {option.color && (
            <ColorSwatch color={option.color} size={14} />
          )}
          {option.icon && (
            <IconDisplay icon={option.icon} size={16} />
          )}
          <Text size="sm">{option.label}</Text>
          {checked && <IconCheck size={14} />}
        </Group>
      );
    },
    []
  );

  if (showNoData && !allowOther) {
    return (
      <Text c="red" size="sm" p="xs">
        {t.misconfigured}
      </Text>
    );
  }

  return (
    <Select
      data={selectData}
      value={selectValue}
      onChange={handleChange}
      label={label}
      description={description}
      placeholder={t.placeholder}
      error={error}
      disabled={disabled}
      required={required}
      readOnly={readOnly}
      clearable={allowNone}
      allowDeselect={allowNone}
      searchable={searchable || allowOther}
      leftSection={leftSection}
      maxDropdownHeight={maxDropdownHeight}
      nothingFoundMessage={allowOther ? undefined : t.nothingFound}
      renderOption={renderOption}
      aria-label={ariaLabel || (!label ? t.placeholder : undefined)}
      data-testid="select-dropdown"
      {...selectProps}
      // allowOther: Mantine v8's <Select> has no built-in "creatable" mode,
      // so free text is committed manually — track the live search text and
      // emit it as the value on Enter or on blur when it matches no choice.
      // Spread after `selectProps` and chained (not overwritten) so a
      // consumer-supplied onBlur/onKeyDown/onSearchChange doesn't silently
      // disable the commit wiring.
      {...(allowOther
        ? {
            searchValue: otherSearchValue,
            onSearchChange: (val: string) => {
              selectProps.onSearchChange?.(val);
              setOtherSearchValue(val);
            },
            // Fires for every dropdown submission (mouse click or Enter on
            // a highlighted option), INCLUDING re-submitting the
            // currently-selected option, which Mantine's own onChange skips
            // (its `nextValue !== value` guard). Two jobs: set the
            // suppression flag for the deferred Enter commit below, and
            // eagerly sync the search text to the submitted option's label.
            // Without the eager sync, a blur that arrives before the
            // controlled value echo lands (async form stores), or after a
            // no-op re-select, still holds the abandoned filter text and
            // would commit it over the user's selection.
            onOptionSubmit: (val: string) => {
              selectProps.onOptionSubmit?.(val);
              justSelectedRef.current = true;
              clearJustSelectedSoon();
              const submitted = choices.find((choice) => String(choice.value) === val);
              setOtherSearchValue(submitted ? submitted.text : val);
            },
            onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
              selectProps.onBlur?.(event);
              commitOtherValue();
            },
            onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
              selectProps.onKeyDown?.(event);
              // An Enter that confirms an IME composition is not a commit;
              // mirror Mantine's own guards (isComposing, Safari's
              // keyCode 229), which run after this handler and return
              // without calling preventDefault.
              if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
              if (event.key === 'Enter') {
                // N3-b: this handler runs BEFORE Mantine's own Enter
                // handling (the Combobox target invokes the consumer
                // handler first), so nothing Mantine is about to do —
                // preventDefault, selecting a highlighted option — is
                // observable here yet. Defer the commit one microtask:
                // Mantine's selection is synchronous within this task, so
                // by drain time justSelectedRef (set in the chained
                // onOptionSubmit above) says authoritatively whether this
                // Enter selected an option (skip — Mantine's onChange
                // already emitted the resolved value) or was free text
                // (commit). Deliberately NOT gated on event.defaultPrevented:
                // a consumer's selectProps.onKeyDown preventDefaulting Enter
                // (the standard way to stop a wrapping form from submitting,
                // since Mantine doesn't preventDefault free-text Enter) must
                // not disable the commit wiring.
                queueMicrotask(commitOtherValue);
              } else if (event.key === 'Escape') cancelOtherEdit();
            },
          }
        : {})}
    />
  );
};

export default SelectDropdown;
