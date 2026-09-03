import React, { forwardRef } from 'react';
import { TextInput, NumberInput, PasswordInput, ActionIcon, Group } from '@mantine/core';
import { IconEye, IconEyeOff, IconX } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useBuildpadTranslations } from '@buildpad/services';
import type { DeepPartial, InterfacesTranslations } from '@buildpad/utils';

export interface InputProps {
  /** Input value */
  value?: string | number | null;
  /** Change handler */
  onChange?: (value: string | number | null) => void;
  /** Field label */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Input type - determines which input component to use */
  type?: 'string' | 'uuid' | 'bigInteger' | 'integer' | 'float' | 'decimal' | 'text';
  /** Whether field is required */
  required?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Whether field is readonly */
  readonly?: boolean;
  /**
   * camelCase alias for `readonly`. @buildpad/ui-form passes this casing; it
   * previously reached the Mantine control only by riding the `...props` rest
   * spread, which left the clear button below gated on the always-false
   * lowercase flag.
   */
  readOnly?: boolean;
  /** Error message */
  error?: string;
  /** Left section icon */
  iconLeft?: React.ReactNode;
  /** Right section icon */
  iconRight?: React.ReactNode;
  /** Font family */
  font?: 'sans-serif' | 'monospace' | 'serif';
  /** Soft length limit (visual indicator) */
  softLength?: number;
  /** Whether to trim whitespace */
  trim?: boolean;
  /** Whether to mask the input (password style) */
  masked?: boolean;
  /** Whether to show clear button */
  clear?: boolean;
  /** Whether to convert to slug format */
  slug?: boolean;
  /** Minimum value (for numeric types) */
  min?: number;
  /** Maximum value (for numeric types) */
  max?: number;
  /** Step interval (for numeric types) */
  step?: number;
  /** Maximum length */
  maxLength?: number;
  /** Description/help text */
  description?: string;
  // DaaS schema metadata props — destructured and discarded to prevent forwarding
  // to DOM elements (which would trigger React unknown-prop warnings).
  primaryKey?: string | number | null;
  nullable?: boolean;
  /**
   * Focus the input on mount. The form pipeline sends the lowercase spelling;
   * `autoFocus` is the React idiom a direct consumer reaches for. Both are
   * accepted, matching SelectIcon.
   */
  autofocus?: boolean;
  /** camelCase alias for {@link InputProps.autofocus}. */
  autoFocus?: boolean;
  /** Collection name — forwarded by the form container; not rendered. */
  collection?: string;
  /** Field key — forwarded by the form container; not rendered. */
  field?: string;
  defaultValue?: string | number | null;
  /** Per-instance overrides of the dictionary strings (`interfaces.input`) */
  translations?: DeepPartial<InterfacesTranslations['input']>;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  value,
  onChange,
  label,
  placeholder,
  type = 'string',
  required = false,
  disabled = false,
  readonly: readonlyProp = false,
  readOnly: readOnlyProp = false,
  error,
  iconLeft,
  iconRight,
  font = 'sans-serif',
  softLength,
  trim = false,
  masked = false,
  clear = false,
  slug = false,
  min,
  max,
  step = 1,
  maxLength,
  description,
  // Destructure DaaS schema metadata props to prevent them from being forwarded
  // to DOM elements (which causes React unknown-prop warnings).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  collection: _collection,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  field: _field,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  primaryKey: _primaryKey,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nullable: _nullable,
  autofocus,
  autoFocus: autoFocusProp,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  defaultValue: _defaultValue,
  translations,
  ...props
}, ref) => {
  // Accept either casing — @buildpad/ui-form passes camelCase `readOnly`.
  const readonly = readonlyProp || readOnlyProp;
  const t = useBuildpadTranslations((d) => d.interfaces.input, translations);
  // Strict on the lowercase spelling: `meta.options` is unvalidated admin JSON,
  // so a truthy string like "false" would otherwise turn focus on. SelectIcon
  // compares the same way, deliberately.
  const shouldAutoFocus = autoFocusProp === true || autofocus === true;
  const [showPassword, { toggle }] = useDisclosure(false);

  // Determine if this is a numeric type
  const isNumeric = ['bigInteger', 'integer', 'float', 'decimal'].includes(type);

  // Handle value changes with type-specific transformations
  const handleChange = (newValue: string | number | null | undefined) => {
    if (disabled || readonly) return;
    onChange?.((newValue ?? null) as string | number | null);
  };

  // `trim` and `slug` are applied on BLUR, never per keystroke. Rewriting the
  // value on every change ate the character the user had just typed — a
  // trimmed field could never contain "John Doe" because the space was removed
  // before the next letter arrived, and a slug field could never reach
  // "hello-w" because the separator space was consumed the same way.
  const applyTextTransforms = (raw: string): string => {
    let out = raw;
    if (trim) out = out.trim();
    if (slug) {
      out = out
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
    return out;
  };

  const handleTextBlur = () => {
    if (disabled || readonly) return;
    if (!trim && !slug) return;
    if (typeof value !== 'string') return;
    const transformed = applyTextTransforms(value);
    if (transformed !== value) onChange?.(transformed);
  };

  // Mantine hands back the raw string when a number field is emptied. Sending
  // that through would PATCH a nullable numeric column with "" instead of null.
  const handleNumericChange = (val: number | string) => {
    if (val === '' || val === null || val === undefined) {
      handleChange(null);
      return;
    }
    const parsed = typeof val === 'number' ? val : Number(val);
    handleChange(Number.isNaN(parsed) ? null : parsed);
  };

  // Never `undefined`: Mantine's useUncontrolled switches the control to
  // uncontrolled mode on undefined, after which the parent can no longer reset
  // or correct it (discard, and post-save refetch, stop working). Postgres
  // returns numeric/bigint columns as strings, so a stored value must not be
  // blanked just because it is not `typeof 'number'` — the string is passed
  // through intact so trailing zeros such as "10.50" survive.
  const numericValue: number | string =
    value === null || value === undefined || value === ''
      ? ''
      : typeof value === 'number'
        ? (Number.isNaN(value) ? '' : value)
        : Number.isFinite(Number(value))
          ? value
          : '';
  
  // Get font family style
  const getFontFamily = () => {
    switch (font) {
      case 'monospace':
        return 'var(--mantine-font-family-monospace, monospace)';
      case 'serif':
        return 'var(--mantine-font-family-headings, Georgia, serif)';
      default:
        return 'var(--mantine-font-family, sans-serif)';
    }
  };
  
  // Common props for all input types
  const commonProps = {
    label,
    placeholder,
    required,
    disabled,
    readOnly: readonly,
    error,
    description,
    style: { fontFamily: getFontFamily() },
    ...props,
    // ── Container-owned, declared AFTER the spread so they win ──
    // `props` carries admin-authored meta.options unfiltered, so declaring
    // these above it let an `autoFocus` key there silently override or erase
    // the container's decision — including its decision not to focus a field
    // the user cannot edit.
    autoFocus: shouldAutoFocus,
    // Mantine's focus trap fires from a setTimeout AFTER React's mount focus
    // and targets `[data-autofocus]`, falling back to the first tabbable node.
    // Without this marker the trap pulled focus to a modal's close button
    // immediately after we set it — the feature was dead inside the O2M/M2M
    // drawers, which is where nested create forms actually live.
    ...(shouldAutoFocus ? { 'data-autofocus': true } : {}),
  };
  
  // Clear button functionality
  const hasClearableValue = value !== null && value !== undefined && value !== '';
  const clearButton = clear && hasClearableValue ? (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="sm"
      onClick={() => handleChange(null)}
      disabled={disabled || readonly}
      aria-label={t.clear}
    >
      <IconX size={16} />
    </ActionIcon>
  ) : undefined;
  
  // Render numeric input for numeric types
  if (isNumeric) {
    const decimalScale = type === 'decimal' || type === 'float' ? 2 : 0;
    const allowDecimal = type === 'decimal' || type === 'float';
    
    return (
      <NumberInput
        {...commonProps}
        ref={ref as any}
        value={numericValue}
        onChange={handleNumericChange}
        leftSection={iconLeft}
        // NOT `iconRight || clearButton`: NumberInput renders its increment /
        // decrement controls in the right section, so overriding it removed
        // them entirely (and with them the arrow-key affordance). A numeric
        // field is cleared by emptying it, which handleNumericChange turns
        // into null.
        rightSection={iconRight}
        min={min}
        max={max}
        step={step}
        decimalScale={decimalScale}
        allowDecimal={allowDecimal}
        allowNegative
        thousandSeparator=","
        hideControls={false}
      />
    );
  }
  
  // Render password input for masked text
  if (masked) {
    const passwordRightSection = (
      <Group gap={4}>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={toggle}
          disabled={disabled || readonly}
          aria-label={showPassword ? t.hidePassword : t.showPassword}
        >
          {showPassword ? (
            <IconEyeOff size={16} />
          ) : (
            <IconEye size={16} />
          )}
        </ActionIcon>
        {clearButton}
      </Group>
    );
    
    return (
      <PasswordInput
        {...commonProps}
        ref={ref as any}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => handleChange(e.currentTarget.value)}
        onBlur={handleTextBlur}
        leftSection={iconLeft}
        rightSection={passwordRightSection}
        visible={showPassword}
        onVisibilityChange={toggle}
        maxLength={maxLength}
      />
    );
  }
  
  // Render regular text input for string types
  return (
    <TextInput
      {...commonProps}
      ref={ref}
      value={value == null ? '' : String(value)}
      onChange={(e) => handleChange(e.currentTarget.value)}
      onBlur={handleTextBlur}
      leftSection={iconLeft}
      // Compose rather than `||`: with both an icon and `clear`, the icon used
      // to swallow the clear button and it never rendered.
      rightSection={
        iconRight && clearButton ? (
          <Group gap={4} wrap="nowrap">
            {clearButton}
            {iconRight}
          </Group>
        ) : (
          iconRight || clearButton
        )
      }
      maxLength={maxLength}
      type={type === 'uuid' ? 'text' : 'text'}
    />
  );
});

Input.displayName = 'Input';

export default Input;
