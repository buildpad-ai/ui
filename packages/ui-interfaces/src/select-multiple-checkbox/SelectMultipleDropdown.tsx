/**
 * SelectMultipleDropdown Interface Component
 * Dropdown-based multi-select with search support
 * 
 * Based on DaaS select-multiple-dropdown interface
 * Uses Mantine MultiSelect for dropdown functionality
 */

'use client';

import React, { useMemo, useState } from 'react';
import { MultiSelect, Text, Stack, ColorSwatch } from '@mantine/core';
import { IconChevronDown, IconCheck } from '@tabler/icons-react';
import { useBuildpadTranslations } from '@buildpad/services';
import type { DeepPartial, InterfacesTranslations } from '@buildpad/utils';
import { IconDisplay } from '../select-icon/SelectIcon';

export interface DropdownChoice {
  text: string;
  value: string | number | boolean;
  disabled?: boolean;
  /** Icon name (Material Design name, resolved via the shared ICON_MAP) */
  icon?: string | null;
  /** Per-choice pill color — theme name or CSS color; overrides the global `color` prop */
  color?: string | null;
}

export interface SelectMultipleDropdownProps {
  /**
   * Registered for `types: ['json', 'csv']` — a `csv`-typed field delivers a
   * raw comma-separated string, not an array. `type` lets this component
   * normalize on read and re-serialize on write when used standalone
   * (outside the FormFieldInterface pipeline, which already normalizes this
   * for its own three multi-select leaves but can't help a direct consumer
   * of this exported component).
   */
  type?: 'csv' | 'json';
  value?: (string | number | boolean)[] | string | null;
  onChange?: (value: (string | number | boolean)[] | string | null) => void;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  choices?: DropdownChoice[];
  allowNone?: boolean;
  /** Allow committing a typed value not present in `choices` (Enter or blur) */
  allowOther?: boolean;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  maxValues?: number;
  hidePickedOptions?: boolean;
  width?: string;
  color?: string;
  /** Value is visible but not editable. Mantine's MultiSelect supports this natively. */
  readOnly?: boolean;
  'aria-label'?: string;
  /** Per-instance overrides of the dictionary strings (`interfaces.selectMultipleCheckbox`) */
  translations?: DeepPartial<InterfacesTranslations['selectMultipleCheckbox']>;
}

export function SelectMultipleDropdown({
  type,
  value = [],
  onChange,
  label,
  disabled = false,
  readOnly = false,
  required = false,
  error,
  choices = [],
  allowNone = false,
  allowOther = false,
  placeholder,
  searchable = true,
  clearable = true,
  maxValues,
  hidePickedOptions = false,
  width,
  color = 'blue',
  'aria-label': ariaLabel,
  translations,
}: SelectMultipleDropdownProps) {
  const t = useBuildpadTranslations((d) => d.interfaces.selectMultipleCheckbox, translations);
  // Normalize a raw csv-string value to an array before anything below reads
  // it. `type === 'csv'` is the documented signal, but also trust what was
  // actually observed (a string) — some backends report the underlying
  // column type instead of the abstract 'csv' interface type.
  const normalizedValue = useMemo(() => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return value ?? [];
  }, [value]);
  // Latch the csv inference: `typeof value === 'string'` is the only signal
  // when the backend reports the underlying column type instead of the
  // abstract 'csv' interface type, and it disappears the moment we emit a
  // non-string (allowNone clears to `null`). Without latching, every write
  // after a clear goes out as an array into a comma-string field.
  const sawCsvStorage = React.useRef(false);
  if (type === 'csv' || typeof value === 'string') {
    sawCsvStorage.current = true;
  }
  const isCsvStorage = sawCsvStorage.current;
  // Transform choices for Mantine MultiSelect
  const data = useMemo(() => {
    if (!choices || choices.length === 0) {
      return [];
    }

    // Mantine's <MultiSelect> requires globally-unique string `value`s in
    // `data` and throws "Duplicate options are not supported" otherwise.
    // Choices with different typed values that stringify identically (e.g.
    // number 1 vs string '1') would collide here — drop the second
    // occurrence so the field renders, same fix as SelectDropdown.
    const seen = new Set<string>();
    const result: { value: string; label: string; disabled: boolean; icon?: string | null; color?: string | null }[] = [];
    for (const choice of choices) {
      const strValue = String(choice.value);
      if (seen.has(strValue)) continue;
      seen.add(strValue);
      result.push({
        value: strValue,
        label: choice.text,
        disabled: choice.disabled || false,
        icon: choice.icon,
        color: choice.color,
      });
    }

    // allowOther: already-committed custom values (from a previous session)
    // aren't in `choices`, so Mantine's <MultiSelect> — which only
    // renders/highlights pills for values present in `data` — would show
    // them blank. Inject them as synthetic options, mirroring SelectDropdown.
    if (allowOther) {
      for (const v of normalizedValue) {
        const strValue = String(v);
        if (!seen.has(strValue)) {
          seen.add(strValue);
          result.push({ value: strValue, label: strValue, disabled: false });
        }
      }
    }

    return result;
  }, [choices, allowOther, normalizedValue]);

  // Emit an array or, for csv storage, join it back to a comma-string —
  // Mantine's MultiSelect always hands us an array regardless of how the
  // value is actually stored.
  const emit = (next: (string | number | boolean)[] | null) => {
    // Defence in depth behind MultiSelect's native readOnly: the "other" text
    // path below calls emit() directly, outside the combobox.
    if (disabled || readOnly) return;
    if (isCsvStorage && Array.isArray(next)) {
      onChange?.(next.join(','));
    } else {
      onChange?.(next);
    }
  };

  // Set synchronously by the chained onOptionSubmit below whenever Mantine
  // submits a dropdown option (mouse click or Enter on a highlighted one),
  // and read by the microtask-DEFERRED Enter commit: this component's
  // onKeyDown runs BEFORE Mantine's own Enter handling, so nothing Mantine
  // is about to do is observable there yet. Mantine's submission is
  // synchronous within the same task, so by microtask-drain time the flag
  // says authoritatively whether that Enter selected an option (skip — the
  // selection already emitted) or was free text (commit). Self-expires on a
  // microtask so a later, unrelated keystroke or blur never sees it.
  const justSelectedRef = React.useRef(false);
  const clearJustSelectedSoon = () => {
    queueMicrotask(() => {
      justSelectedRef.current = false;
    });
  };

  // Handle value changes with proper sorting
  const handleChange = (newValue: string[]) => {
    if (!newValue || newValue.length === 0) {
      // Under csv storage the empty selection is the empty STRING; emitting
      // `null` here would also erase the storage-shape signal for every
      // subsequent write (see the sawCsvStorage latch above).
      emit(allowNone && !isCsvStorage ? null : []);
      return;
    }

    // If no choices available, just pass through the values
    if (!choices || choices.length === 0) {
      emit(newValue);
      return;
    }

    // Sort values based on their position in the original choices array
    // (copy first — Array.prototype.sort mutates in place, and this is
    // Mantine's own array reference)
    const sortedValue = [...newValue].sort((a, b) => {
      const indexA = choices.findIndex(choice => String(choice.value) === a);
      const indexB = choices.findIndex(choice => String(choice.value) === b);

      // If not found in choices (custom values), put them at the end
      if (indexA === -1 && indexB === -1) {
        return 0;
      }
      if (indexA === -1) {
        return 1;
      }
      if (indexB === -1) {
        return -1;
      }

      return indexA - indexB;
    });

    // Convert back to original value types. Preserve the exact
    // previously-stored value for anything already selected instead of
    // re-resolving it through `choices.find` — this whole array gets
    // rebuilt from Mantine's stringified selection on *every* toggle, so
    // resolving fresh here would silently re-type an already-selected
    // "dropped twin" (e.g. a stored string '1' becoming number 1, since
    // dedup above only keeps the first colliding choice) whenever the user
    // toggles any unrelated item (S6.6).
    const currentByString = new Map(normalizedValue.map(v => [String(v), v] as const));
    const convertedValue = sortedValue.map(stringValue => {
      if (currentByString.has(stringValue)) {
        return currentByString.get(stringValue)!;
      }
      const originalChoice = choices.find(choice => String(choice.value) === stringValue);
      return originalChoice ? originalChoice.value : stringValue;
    });

    emit(convertedValue);
  };

  // allowOther: Mantine's <MultiSelect> has no built-in creatable mode —
  // typed text with no matching option never reaches onChange. Track the
  // live search text and commit it as an additional pill on Enter or blur,
  // mirroring SelectDropdown's manual creatable pattern (S6.2).
  const [otherSearchValue, setOtherSearchValue] = useState('');

  const commitOtherValue = () => {
    // A field that is disabled, or made read-only by turning off `searchable`,
    // must never emit: Mantine gates only its own keyboard logic on those,
    // not this chained onBlur/onKeyDown, so without this guard text left in
    // the box when the field is disabled mid-edit (the standard "disable
    // while saving" pattern) commits on the resulting blur.
    if (!allowOther || disabled || !searchable) return;
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    const trimmed = otherSearchValue.trim();
    if (!trimmed) return;
    // V3-6: text naming an existing choice RESOLVES to that choice (matched
    // case-insensitively, so "REACT" finds "React") and selects it, rather
    // than being dropped. Returning silently here made typing an option's
    // name a dead keystroke whose text the unconditional clear below then
    // destroyed.
    const lowerTrimmed = trimmed.toLowerCase();
    const matchedChoice = choices.find(
      (choice) =>
        String(choice.text).toLowerCase() === lowerTrimmed ||
        String(choice.value).toLowerCase() === lowerTrimmed,
    );
    // Custom values are compared case-SENSITIVELY: on a free-text field the
    // casing is user-authored data (tags, SKUs, unit codes), so "Ember" and
    // "ember" are two distinct entries.
    const alreadySelected = normalizedValue.some(
      (v) => String(v) === trimmed || (matchedChoice !== undefined && v === matchedChoice.value),
    );
    // maxValues also caps manual commits — the complement of Mantine's own
    // `_value.length < maxValues` rule.
    const atMax = typeof maxValues === 'number' && normalizedValue.length >= maxValues;
    if (alreadySelected) {
      setOtherSearchValue('');
      return;
    }
    // Only a successful commit clears the box; a blocked one leaves the text
    // in place so the user can see and correct it instead of watching their
    // typing silently vanish.
    if (atMax) return;
    emit([...normalizedValue, matchedChoice ? matchedChoice.value : trimmed]);
    setOtherSearchValue('');
  };

  // Show choices validation message
  if (!choices || choices.length === 0) {
    return (
      <Stack gap="xs" style={{ width }}>
        {label && (
          <Text size="sm" fw={500}>
            {label}
            {required && <Text component="span" c="red" ml={4}>*</Text>}
          </Text>
        )}
        <Text size="sm" c="orange" role="alert">
          {t.misconfigured}
        </Text>
        {error && (
          <Text size="xs" c="red" role="alert" aria-live="polite">
            {error}
          </Text>
        )}
      </Stack>
    );
  }

  // Convert value to string array for Mantine
  const stringValue = normalizedValue.map(v => String(v));

  // Normalize the global pill color the same way SelectMultipleCheckbox
  // does: a `var(--mantine-color-X-6)` wrapper resolves to its bare palette
  // name, and a raw hex/rgb/hsl color is detected so it's interpolated via
  // color-mix instead of into an (invalid) `var(--mantine-color-<hex>-light)`
  // custom property, which silently drops the pill's background (S6.3).
  const mantineColor = color.startsWith('var(--mantine-color-')
    ? color.replace('var(--mantine-color-', '').replace(')', '').replace('-6', '')
    : color;
  const isHexOrRawColor = /^#|^rgb|^hsl/.test(mantineColor);

  return (
    <Stack gap="xs" style={{ width }}>
      <MultiSelect
        label={label}
        placeholder={placeholder}
        data={data}
        value={stringValue}
        onChange={handleChange}
        disabled={disabled}
        readOnly={readOnly}
        error={error}
        required={required}
        searchable={searchable}
        clearable={clearable && !readOnly}
        maxValues={maxValues}
        hidePickedOptions={hidePickedOptions}
        withAsterisk={required}
        nothingFoundMessage={allowOther ? undefined : t.dropdown.nothingFound}
        maxDropdownHeight={300}
        comboboxProps={{
          transitionProps: { transition: 'pop', duration: 200 },
          shadow: 'var(--mantine-shadow-md)',
        }}
        rightSection={<IconChevronDown size={16} />}
        aria-label={ariaLabel || label || t.dropdown.ariaLabel}
        renderOption={({ option, checked }) => {
          const choice = data.find((d) => d.value === option.value);
          return (
            <Text component="span" size="sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Show both when a choice sets both — gating the swatch on
                  `!choice.icon` dropped the colour entirely for such
                  choices (the same fix SelectDropdown already carries). */}
              {choice?.color && <ColorSwatch color={choice.color} size={12} />}
              {choice?.icon && <IconDisplay icon={choice.icon} size={14} />}
              {option.label}
              {/* An icon, not a ' ✓' text node: Mantine already conveys the
                  state via aria-selected, so a literal check character in
                  the label made screen readers announce it twice and put
                  U+2713 inside the option's accessible name. Matches
                  SelectDropdown. */}
              {checked && <IconCheck size={14} />}
            </Text>
          );
        }}
        styles={{
          input: {
            cursor: disabled ? 'not-allowed' : 'pointer',
          },
          pill: isHexOrRawColor
            ? {
                backgroundColor: `color-mix(in srgb, ${mantineColor} 13%, transparent)`,
                color: mantineColor,
              }
            : {
                backgroundColor: `var(--mantine-color-${mantineColor}-light)`,
                color: `var(--mantine-color-${mantineColor}-filled)`,
              },
        }}
        // Pass Mantine's own already-filtered `options` through rather than
        // the full `data` memo: returning `data` here put back the entries
        // hidePickedOptions had removed (and ignored `limit`).
        filter={searchable ? undefined : ({ options }) => options}
        {...(allowOther
          ? {
              searchValue: otherSearchValue,
              onSearchChange: setOtherSearchValue,
              // Fires for every dropdown submission (click or Enter on a
              // highlighted option), including re-submitting an already
              // selected value, which Mantine's onChange skips. Flags the
              // selection for the deferred Enter commit below.
              onOptionSubmit: () => {
                justSelectedRef.current = true;
                clearJustSelectedSoon();
                // The typed text was a filter, not a pending pill; consume it
                // so a later blur can't commit the abandoned fragment.
                setOtherSearchValue('');
              },
              onBlur: commitOtherValue,
              onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
                // An Enter that confirms an IME composition is not a commit
                // (mirrors Mantine's own isComposing / keyCode-229 guards,
                // which run after this handler and without preventDefault).
                if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
                // V3-6: Enter with a highlighted dropdown option double-
                // emitted — once via the manual commit (raw search text),
                // once via Mantine's own selection. This handler runs BEFORE
                // Mantine's Enter handling, so `event.defaultPrevented` is
                // always false here and cannot be used to detect it. Defer
                // one microtask instead: Mantine's selection is synchronous
                // within this task, so by drain time justSelectedRef (set by
                // onOptionSubmit above) says whether this Enter selected an
                // option or was free text.
                if (event.key === 'Enter') queueMicrotask(commitOtherValue);
              },
            }
          : {})}
      />
    </Stack>
  );
}

export default SelectMultipleDropdown;
