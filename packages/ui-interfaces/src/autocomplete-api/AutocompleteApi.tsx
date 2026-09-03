import React, { useState, useEffect, useRef, forwardRef, useCallback } from 'react';
import { Autocomplete, ComboboxItem, Loader, Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import axios from 'axios';
import { useBuildpadTranslations } from '@buildpad/services';
import type { DeepPartial, InterfacesTranslations } from '@buildpad/utils';

/**
 * Font family type for the autocomplete input
 * Matches DaaS font options
 */
type FontFamily = 'sans-serif' | 'serif' | 'monospace';

/**
 * AutocompleteAPI Props Interface
 * Based on DaaS input-autocomplete-api interface
 * @see https://github.com/daas/daas/blob/main/app/src/interfaces/input-autocomplete-api
 */
export interface AutocompleteAPIProps {
    /** Current value */
    value?: string | number | null;
    /** Change handler */
    onChange?: (value: string) => void;
    /** API URL with {{value}} template placeholder for search term */
    url?: string;
    /** Path to results array in API response (e.g., "data.items") */
    resultsPath?: string;
    /** Path to display text in each result item */
    textPath?: string;
    /** Path to value in each result item */
    valuePath?: string;
    /** Trigger type: debounce waits for pause, throttle fires at intervals */
    trigger?: 'debounce' | 'throttle';
    /** Rate limit in milliseconds */
    rate?: number;
    /** Placeholder text */
    placeholder?: string;
    /** Whether input is disabled */
    disabled?: boolean;
    /** Whether field is required */
    required?: boolean;
    /** Field label */
    label?: string;
    /** Error message */
    error?: string;
    /** Maximum number of results to show */
    limit?: number;
    /** Maximum dropdown height */
    maxDropdownHeight?: number;
    /** Whether to show clear button */
    clearable?: boolean;
    /** Aria label for accessibility */
    'aria-label'?: string;
    /** Focus event handler */
    onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
    /** Blur event handler */
    onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
    /** Font family for the input */
    font?: FontFamily;
    /** Icon to show on the left side (icon name) */
    iconLeft?: string;
    /** Icon to show on the right side (icon name) */
    iconRight?: string;
    /** Text direction (ltr or rtl) */
    direction?: 'ltr' | 'rtl';
    /** Description/helper text */
    description?: string;
    /** Read-only state */
    readOnly?: boolean;
    /** Per-instance overrides of the dictionary strings (`interfaces.autocompleteApi`) */
    translations?: DeepPartial<InterfacesTranslations['autocompleteApi']>;
}

/**
 * Get font family CSS value based on font type
 */
const getFontFamily = (font: FontFamily): string => {
    switch (font) {
        case 'monospace':
            return 'var(--mantine-font-family-monospace, monospace)';
        case 'serif':
            return 'Georgia, serif';
        case 'sans-serif':
        default:
            return 'var(--mantine-font-family, sans-serif)';
    }
};

/**
 * Template rendering function (simplified version of micromustache)
 * Replaces {{key}} placeholders with values from data object
 */
const renderTemplate = (template: string, data: Record<string, string | number>): string => {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const value = data[key];
        return value !== undefined ? String(value) : match;
    });
};

/**
 * Get nested property value (simplified version of lodash get)
 * Supports dot notation: "data.items.0.name"
 */
const getValue = (obj: unknown, path: string): unknown => {
    return path.split('.').reduce((current: unknown, key: string) => {
        if (current && typeof current === 'object' && key in current) {
            return (current as Record<string, unknown>)[key];
        }
        return undefined;
    }, obj);
};

/**
 * AutocompleteAPI Component
 * 
 * A DaaS-compatible autocomplete input that fetches suggestions from an external API.
 * Supports debounce/throttle, custom result mapping, font styling, and icons.
 * 
 * Features:
 * - Fetches results from external or internal APIs
 * - Supports {{value}} template in URL for search term
 * - Configurable debounce/throttle with custom rate
 * - Custom result path mapping (resultsPath, textPath, valuePath)
 * - Font family support (sans-serif, serif, monospace)
 * - Loading state indicator
 * - RTL direction support
 * 
 * @example
 * ```tsx
 * <AutocompleteAPI
 *   url="https://api.example.com/search?q={{value}}"
 *   resultsPath="data.results"
 *   textPath="name"
 *   valuePath="id"
 *   trigger="debounce"
 *   rate={300}
 *   placeholder="Search..."
 *   font="monospace"
 * />
 * ```
 */
export const AutocompleteAPI = forwardRef<HTMLInputElement, AutocompleteAPIProps>(({
    value = '',
    onChange,
    url,
    resultsPath,
    textPath,
    valuePath,
    trigger = 'throttle',
    rate = 500,
    placeholder,
    disabled,
    required,
    label,
    error,
    limit = 10,
    maxDropdownHeight = 200,
    clearable = false,
    'aria-label': ariaLabel,
    onFocus,
    onBlur,
    font = 'sans-serif',
    iconLeft,
    iconRight,
    direction,
    description,
    readOnly,
    translations,
}, ref) => {
    const t = useBuildpadTranslations((d) => d.interfaces.autocompleteApi, translations);
    // Convert value to string for internal state
    const normalizedValue = value != null ? String(value) : '';
    
    const [inputValue, setInputValue] = useState<string>(normalizedValue);
    const [data, setData] = useState<ComboboxItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [debouncedInputValue] = useDebouncedValue(inputValue, trigger === 'debounce' ? rate : 0);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    /**
     * Fetch results from the API
     * Handles both internal (/api/...) and external URLs
     */
    const fetchResults = useCallback(async (searchValue: string) => {
        if (!searchValue || !url) {
            setData([]);
            return;
        }

        // Cancel any pending request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setLoading(true);
        try {
            // Replace {{value}} template with search value
            const searchUrl = renderTemplate(url, { value: searchValue });
            
            // Use axios for both internal and external URLs
            // DaaS checks if URL starts with '/' for internal API
            const response = await axios.get(searchUrl, {
                signal: abortControllerRef.current.signal,
            });
            
            // Extract results array using resultsPath if provided
            const resultsArray = resultsPath 
                ? getValue(response.data, resultsPath) 
                : response.data;

            if (!Array.isArray(resultsArray)) {
                console.warn(`[AutocompleteAPI] Expected results type of array, "${typeof resultsArray}" received`);
                setData([]);
                return;
            }

            // Map results to ComboboxItem format
            const mappedResults: ComboboxItem[] = resultsArray
                .slice(0, limit)
                .map((result: unknown) => {
                    if (textPath && valuePath) {
                        return {
                            label: String(getValue(result, textPath) ?? ''),
                            value: String(getValue(result, valuePath) ?? '')
                        };
                    } 
                    if (valuePath) {
                        const val = String(getValue(result, valuePath) ?? '');
                        return {
                            label: val,
                            value: val
                        };
                    } 
                    return {
                        label: String(result),
                        value: String(result)
                    };
                })
                // Filter out items with empty values to prevent duplicates
                .filter((item) => item.value !== '');

            // Deduplicate results by value
            const uniqueResults = mappedResults.filter(
                (item, index, self) => 
                    index === self.findIndex((t) => t.value === item.value)
            );

            setData(uniqueResults);
        } catch (err) {
            // Ignore abort errors
            if (axios.isCancel(err)) {
                return;
            }
            console.warn('[AutocompleteAPI] Error fetching results:', err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [url, resultsPath, textPath, valuePath, limit]);

    // Handle throttle trigger
    useEffect(() => {
        if (trigger === 'throttle' && inputValue) {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                fetchResults(inputValue);
            }, rate);
        }
        
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [inputValue, trigger, rate, fetchResults]);

    // Handle debounce trigger
    useEffect(() => {
        if (trigger === 'debounce' && debouncedInputValue) {
            fetchResults(debouncedInputValue);
        }
    }, [debouncedInputValue, trigger, fetchResults]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    // Sync external value changes
    useEffect(() => {
        const newValue = value != null ? String(value) : '';
        setInputValue(newValue);
    }, [value]);

    const handleChange = useCallback((newValue: string) => {
        setInputValue(newValue);
        onChange?.(newValue);
    }, [onChange]);

    const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
        onFocus?.(event);
    }, [onFocus]);

    const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
        onBlur?.(event);
    }, [onBlur]);

    // Show warning if URL is not configured
    if (!url) {
        return (
            <div data-testid="autocomplete-api-missing-url">
                <Autocomplete
                    ref={ref}
                    label={label}
                    placeholder={t.missingUrl.placeholder}
                    disabled
                    error={t.missingUrl.error}
                    data={[]}
                    description={description}
                />
                <Text size="xs" c="orange" mt={4}>
                    {t.missingUrl.hint}
                </Text>
            </div>
        );
    }

    // Compute styles based on font
    const inputStyles = {
        input: {
            fontFamily: getFontFamily(font),
            direction: direction as React.CSSProperties['direction'],
        },
    };

    // Determine left section (icon or loading)
    const leftSection = loading ? (
        <Loader size="xs" data-testid="autocomplete-loading" />
    ) : iconLeft ? (
        <IconSearch size={16} data-testid="autocomplete-icon-left" />
    ) : undefined;

    // Determine right section (icon)
    const rightSection = iconRight ? (
        <IconSearch size={16} data-testid="autocomplete-icon-right" />
    ) : undefined;

    return (
        <Autocomplete
            ref={ref}
            data-testid="autocomplete-api"
            label={label}
            placeholder={placeholder}
            value={inputValue}
            onChange={handleChange}
            data={data}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            error={error}
            limit={limit}
            maxDropdownHeight={maxDropdownHeight}
            clearable={clearable}
            aria-label={ariaLabel}
            onFocus={handleFocus}
            onBlur={handleBlur}
            description={description}
            leftSection={leftSection}
            rightSection={rightSection}
            styles={inputStyles}
            comboboxProps={{
                shadow: 'var(--mantine-shadow-md)',
                transitionProps: { transition: 'fade', duration: 150 }
            }}
        />
    );
});

AutocompleteAPI.displayName = 'AutocompleteAPI';
