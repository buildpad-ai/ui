import React from 'react';
import { DateTimePicker, DateTimePickerProps, DatePickerInput, DatePickerInputProps } from '@mantine/dates';
import dayjs, { Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import { useDayjsLocale } from './dayjs-locales';

// Extend dayjs with plugins
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Props for the DateTime interface component
 * Based on DaaS datetime interface configuration
 */
export interface DateTimeProps {
  /** Current datetime value as ISO string */
  value?: string | null;
  
  /** Whether the picker is disabled */
  disabled?: boolean;
  
  /** Whether the picker is readonly */
  readOnly?: boolean;
  
  /** Whether the field is required */
  required?: boolean;
  
  /** Label displayed above the picker */
  label?: string;
  
  /** Description text displayed below the label */
  description?: string;
  
  /** Error message to display */
  error?: string;
  
  /** Placeholder text when no value is selected */
  placeholder?: string;
  
  /** Type of datetime field */
  type?: 'datetime' | 'date' | 'time' | 'timestamp';
  
  /** Whether to include seconds in time display */
  includeSeconds?: boolean;
  
  /** Whether to use 24-hour format */
  use24?: boolean;
  
  /** Whether to allow clearing the value */
  clearable?: boolean;
  
  /** Custom display format for the value */
  valueFormat?: string;
  
  /** Minimum allowed date (as string 'YYYY-MM-DD') */
  minDate?: string;
  
  /** Maximum allowed date (as string 'YYYY-MM-DD') */
  maxDate?: string;
  
  /** Callback fired when value changes */
  onChange?: (value: string | null) => void;
  
  /** Additional props to pass to the DateTimePicker component */
  pickerProps?: Omit<DateTimePickerProps, 'value' | 'onChange' | 'disabled' | 'label' | 'description' | 'error'>;
}

/**
 * DateTime Interface Component
 * 
 * A datetime picker interface that matches the DaaS datetime interface functionality.
 * Uses Mantine's DateTimePicker component for consistent styling and behavior.
 * 
 * Features:
 * - Support for datetime, date, time, and timestamp types
 * - Configurable time format (12/24 hour)
 * - Optional seconds display
 * - Custom value formatting
 * - Date range constraints
 * - Clearable selection
 * - Accessibility support
 * 
 * @param props - DateTime interface props
 * @returns React component
 */
export const DateTime: React.FC<DateTimeProps> = ({
  value,
  disabled = false,
  readOnly = false,
  required = false,
  label,
  description,
  error,
  placeholder,
  type = 'datetime',
  includeSeconds = false,
  use24 = true,
  clearable = true,
  valueFormat,
  minDate,
  maxDate,
  onChange,
  pickerProps = {},
}) => {
  // Locale from BuildpadI18nProvider (English/browser without one). The
  // calendar and the display format use dayjs locale data loaded on demand.
  const { locale, hasProvider } = useBuildpadI18n();
  const t = useBuildpadTranslations((d) => d.interfaces.datetime);
  const dayjsLocale = useDayjsLocale(hasProvider ? locale : undefined);

  // Convert string value to Mantine 8 date string format (YYYY-MM-DD or YYYY-MM-DD HH:mm:ss)
  const dateValue = React.useMemo((): string | null => {
    if (!value) {
      return null;
    }
    
    try {
      let parsedDate: Dayjs;
      
      switch (type) {
        case 'datetime':
          parsedDate = dayjs(value, 'YYYY-MM-DDTHH:mm:ss');
          break;
        case 'date':
          parsedDate = dayjs(value, 'YYYY-MM-DD');
          break;
        case 'time':
          parsedDate = dayjs(value, 'HH:mm:ss');
          break;
        case 'timestamp':
          parsedDate = dayjs(value);
          break;
        default:
          parsedDate = dayjs(value);
      }
      
      if (!parsedDate.isValid()) {
        return null;
      }
      
      // Mantine 8 uses string format: 'YYYY-MM-DD' for dates, 'YYYY-MM-DD HH:mm:ss' for datetime
      if (type === 'date') {
        return parsedDate.format('YYYY-MM-DD');
      }
      return parsedDate.format('YYYY-MM-DD HH:mm:ss');
    } catch {
      return null;
    }
  }, [value, type]);

  // Handle value changes - Mantine 8 returns string values
  const handleChange = (dateStr: string | null) => {
    if (disabled || readOnly) {
      return;
    }
    
    if (!dateStr) {
      onChange?.(null);
      return;
    }
    
    try {
      const dayjsDate = dayjs(dateStr);
      let formattedValue: string;
      
      switch (type) {
        case 'datetime':
          formattedValue = dayjsDate.format('YYYY-MM-DDTHH:mm:ss');
          break;
        case 'date':
          formattedValue = dayjsDate.format('YYYY-MM-DD');
          break;
        case 'time':
          formattedValue = dayjsDate.format('HH:mm:ss');
          break;
        case 'timestamp':
          formattedValue = dayjsDate.toISOString();
          break;
        default:
          formattedValue = dayjsDate.toISOString();
      }
      
      onChange?.(formattedValue);
    } catch {
      onChange?.(null);
    }
  };

  // Determine the display format
  const getDisplayFormat = (): string => {
    if (valueFormat) {
      return valueFormat;
    }
    
    switch (type) {
      case 'datetime':
        return includeSeconds 
          ? (use24 ? 'DD MMM YYYY HH:mm:ss' : 'DD MMM YYYY hh:mm:ss A')
          : (use24 ? 'DD MMM YYYY HH:mm' : 'DD MMM YYYY hh:mm A');
      case 'date':
        return 'DD MMM YYYY';
      case 'time':
        return includeSeconds
          ? (use24 ? 'HH:mm:ss' : 'hh:mm:ss A')
          : (use24 ? 'HH:mm' : 'hh:mm A');
      case 'timestamp':
        return includeSeconds
          ? (use24 ? 'DD MMM YYYY HH:mm:ss' : 'DD MMM YYYY hh:mm:ss A')
          : (use24 ? 'DD MMM YYYY HH:mm' : 'DD MMM YYYY hh:mm A');
      default:
        return 'DD MMM YYYY HH:mm';
    }
  };

  // Determine placeholder text
  const getPlaceholder = (): string => {
    if (placeholder) {
      return placeholder;
    }
    
    switch (type) {
      case 'date':
        return t.pickDate;
      case 'time':
        return t.pickTime;
      default:
        return t.pickDateTime;
    }
  };

  // Build the DateTimePicker props
  // Note: We extract timePickerProps separately to avoid passing it to DOM elements
  const { timePickerProps: existingTimePickerProps, ...restPickerProps } = pickerProps as DateTimePickerProps & { timePickerProps?: Record<string, unknown> };
  
  const dateTimePickerProps: DateTimePickerProps = {
    ...restPickerProps,
    value: dateValue,
    onChange: handleChange,
    disabled,
    readOnly,
    label: label ? (required ? `${label} *` : label) : undefined,
    description,
    error,
    placeholder: getPlaceholder(),
    valueFormat: getDisplayFormat(),
    clearable: clearable && !readOnly,
    withSeconds: includeSeconds,
    minDate,
    maxDate,
    ...(dayjsLocale ? { locale: dayjsLocale } : {}),
  };

  // For date-only type, use DatePickerInput instead of DateTimePicker
  if (type === 'date') {
    const { timePickerProps: _, ...restDatePickerProps } = pickerProps as DatePickerInputProps & { timePickerProps?: Record<string, unknown> };
    
    const datePickerProps: DatePickerInputProps = {
      ...restDatePickerProps,
      value: dateValue,
      onChange: handleChange,
      disabled,
      readOnly,
      label: label ? (required ? `${label} *` : label) : undefined,
      description,
      error,
      placeholder: getPlaceholder(),
      valueFormat: getDisplayFormat(),
      clearable: clearable && !readOnly,
      minDate,
      maxDate,
      ...(dayjsLocale ? { locale: dayjsLocale } : {}),
    };

    return <DatePickerInput {...datePickerProps} />;
  }

  return <DateTimePicker {...dateTimePickerProps} />;
};

export default DateTime;
