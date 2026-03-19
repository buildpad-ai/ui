'use client';

import React, { useState } from 'react';
import { Box, Text, TextInput, TagsInput, Chip, Group } from '@mantine/core';
import { IconTag, IconChevronRight } from '@tabler/icons-react';

export interface TagsProps {
  /** Current array of selected tags */
  value?: string[] | null;
  /** Callback when tags change */
  onChange?: (value: string[]) => void;
  /** Field label */
  label?: string;
  /** Placeholder text when no tags are selected */
  placeholder?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Icon to display on the left */
  iconLeft?: string;
  /** Icon to display on the right */
  iconRight?: string;
  /** Text direction */
  direction?: 'ltr' | 'rtl';
  /** Preset tag options */
  presets?: string[];
  /** Whether custom (non-preset) tags are allowed */
  allowCustom?: boolean;
  /** Whether to alphabetize the tags */
  alphabetize?: boolean;
  /** Whether to lowercase all tags */
  lowercase?: boolean;
  /** Whether to uppercase all tags */
  uppercase?: boolean;
  /** Whether to capitalize the first letter of each tag */
  capitalize?: boolean;
  /** Whether to trim whitespace from tags */
  trim?: boolean;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Process tag value based on configuration options
 */
const processTag = (
  tag: string,
  options: {
    lowercase?: boolean;
    uppercase?: boolean;
    capitalize?: boolean;
    trim?: boolean;
  }
): string => {
  let processed = tag;
  
  if (options.trim) {
    processed = processed.trim();
  }
  
  if (options.lowercase) {
    processed = processed.toLowerCase();
  } else if (options.uppercase) {
    processed = processed.toUpperCase();
  } else if (options.capitalize) {
    processed = processed.charAt(0).toUpperCase() + processed.slice(1).toLowerCase();
  }
  
  return processed;
};

/**
 * Tags Interface Component
 * 
 * A tag input interface that matches the DaaS tags interface functionality.
 * Supports preset tags, custom tags, and various text transformation options.
 * 
 * Features:
 * - Preset tag chips for quick selection
 * - Custom tag input with comma or Enter to add
 * - Text transformations: lowercase, uppercase, capitalize
 * - Alphabetized output option
 * - Duplicate prevention
 * - Optional icons
 * 
 * @param props - Tags interface props
 * @returns React component
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <Tags
 *   label="Categories"
 *   value={['react', 'typescript']}
 *   onChange={(tags) => console.log(tags)}
 * />
 * 
 * // With presets
 * <Tags
 *   label="Priority"
 *   presets={['Low', 'Medium', 'High', 'Critical']}
 *   allowCustom={false}
 *   value={['Medium']}
 *   onChange={handleChange}
 * />
 * ```
 */
export function Tags({
  value = [],
  onChange,
  label,
  placeholder = 'Add a tag...',
  disabled = false,
  required = false,
  error,
  iconLeft,
  iconRight,
  direction = 'ltr',
  presets = [],
  allowCustom = true,
  alphabetize = false,
  lowercase = false,
  uppercase = false,
  capitalize = false,
  trim = true,
  'data-testid': testId,
}: TagsProps) {
  const [inputValue, setInputValue] = useState('');

  // Process tags array with configured options
  const processArray = (tags: string[]): string[] => {
    let processed = tags.map((tag) =>
      processTag(tag, { lowercase, uppercase, capitalize, trim })
    ).filter(Boolean);
    
    if (alphabetize) {
      processed = [...processed].sort();
    }
    
    // Remove duplicates
    processed = Array.from(new Set(processed));
    
    return processed;
  };

  // Initialize selectedTags with transforms applied to the initial value
  const [selectedTags, setSelectedTags] = useState<string[]>(() => 
    processArray(value || [])
  );

  // Get preset tags that are available
  const processedPresets = presets.length > 0 ? processArray(presets) : [];
  
  // Separate selected tags into presets and custom
  const selectedPresets = selectedTags.filter(tag => processedPresets.includes(tag));
  const selectedCustom = selectedTags.filter(tag => !processedPresets.includes(tag));

  const handleTagsChange = (newTags: string[]) => {
    const processed = processArray(newTags);
    
    // Filter out custom tags if not allowed
    const finalTags = allowCustom ? processed : processed.filter(tag => processedPresets.includes(tag));
    
    setSelectedTags(finalTags);
    onChange?.(finalTags);
  };

  const handlePresetToggle = (preset: string) => {
    const newTags = selectedTags.includes(preset)
      ? selectedTags.filter(tag => tag !== preset)
      : [...selectedTags, preset];
    
    handleTagsChange(newTags);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (inputValue.trim()) {
        handleTagsChange([...selectedTags, inputValue.trim()]);
        setInputValue('');
      }
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = event.target.value;
    setInputValue(inputVal);
    
    // Check for comma separator - add tag when comma is typed
    if (inputVal.endsWith(',')) {
      const newTag = inputVal.slice(0, -1).trim();
      if (newTag) {
        handleTagsChange([...selectedTags, newTag]);
        setInputValue('');
      }
    }
  };

  // Get icon component based on icon name
  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'local_offer':
        return <IconTag size={16} />;
      default:
        return iconName ? <Text size="sm">{iconName}</Text> : undefined;
    }
  };

  return (
    <Box data-testid={testId}>
      {/* Use Mantine's TagsInput when no presets are needed */}
      {processedPresets.length === 0 && allowCustom ? (
        <TagsInput
          label={label}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          error={error}
          value={selectedTags}
          onChange={handleTagsChange}
          leftSection={getIcon(iconLeft)}
          rightSection={getIcon(iconRight)}
          style={{ direction }}
          splitChars={[',', 'Enter']}
        />
      ) : (
        <>
          {/* Custom input for adding tags when custom tags are allowed and presets exist */}
          {allowCustom && (
            <TextInput
              placeholder={placeholder}
              disabled={disabled}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              leftSection={getIcon(iconLeft)}
              rightSection={getIcon(iconRight)}
              label={label}
              required={required}
              error={error}
              style={{ direction }}
            />
          )}

          {/* Tags display area */}
          {(processedPresets.length > 0 || selectedCustom.length > 0) && (
            <Box mt={allowCustom ? 'xs' : 0}>
              <Group gap="xs" align="flex-start">
                {/* Preset tags */}
                {processedPresets.length > 0 && (
                  <Group gap="xs" wrap="wrap">
                    {processedPresets.map((preset) => (
                      <Chip
                        key={preset}
                        checked={selectedPresets.includes(preset)}
                        onChange={() => handlePresetToggle(preset)}
                        disabled={disabled}
                        size="sm"
                        variant={selectedPresets.includes(preset) ? 'filled' : 'outline'}
                        styles={(theme) => ({
                          root: {
                            cursor: disabled ? 'default' : 'pointer',
                          },
                          label: {
                            fontSize: theme.fontSizes.sm,
                          },
                        })}
                      >
                        {preset}
                      </Chip>
                    ))}
                  </Group>
                )}

                {/* Separator between presets and custom tags */}
                {processedPresets.length > 0 && selectedCustom.length > 0 && (
                  <IconChevronRight size={16} style={{ marginTop: 4 }} />
                )}

                {/* Custom tags */}
                {selectedCustom.length > 0 && allowCustom && (
                  <Group gap="xs" wrap="wrap">
                    {selectedCustom.map((tag) => (
                      <Chip
                        key={tag}
                        checked
                        onChange={() => {
                          const newTags = selectedTags.filter(t => t !== tag);
                          handleTagsChange(newTags);
                        }}
                        disabled={disabled}
                        size="sm"
                        variant="filled"
                        styles={(theme) => ({
                          root: {
                            cursor: disabled ? 'default' : 'pointer',
                          },
                          label: {
                            fontSize: theme.fontSizes.sm,
                          },
                        })}
                      >
                        {tag}
                      </Chip>
                    ))}
                  </Group>
                )}
              </Group>
            </Box>
          )}

          {/* Show preset display when allowCustom is false and no label provided yet */}
          {!allowCustom && processedPresets.length > 0 && !label && (
            <Text size="sm" fw={500} mb="xs">Tags</Text>
          )}
        </>
      )}
    </Box>
  );
}

export default Tags;
