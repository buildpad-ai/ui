'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Text,
  ActionIcon,
  Popover,
  TextInput,
  Stack,
  Grid,
  Select,
  NumberInput,
  Group,
  Button,
  Slider,
  Box,
} from '@mantine/core';
import { IconColorPicker, IconPalette, IconX } from '@tabler/icons-react';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import type { DeepPartial, InterfacesTranslations } from '@buildpad/utils';

type ColorTranslations = InterfacesTranslations['color'];

/**
 * Color utilities for conversion between color formats
 * Supports HEX, RGB, HSL with optional alpha channel
 */
class ColorUtils {
  /**
   * Validates a hex color string
   * Supports 6-digit (#RRGGBB) and 8-digit (#RRGGBBAA) formats
   */
  static isValidHex(hex: string): boolean {
    if (!hex || typeof hex !== 'string') {
      return false;
    }
    
    // Match #RRGGBB or #RRGGBBAA format
    return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(hex);
  }

  /**
   * Converts hex color to RGB array [r, g, b, a]
   * Alpha defaults to 1 if not present in hex
   */
  static hexToRgb(hex: string): [number, number, number, number] {
    // Default to black with full opacity if invalid
    if (!hex || !this.isValidHex(hex)) {
      return [0, 0, 0, 1];
    }

    // Remove # prefix
    const cleanHex = hex.slice(1);
    
    // Parse RGB values
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    
    // Parse alpha if present (8-digit hex)
    const a = cleanHex.length === 8 
      ? parseInt(cleanHex.slice(6, 8), 16) / 255 
      : 1;

    return [r, g, b, a];
  }

  /**
   * Converts RGB values to hex string
   * @param r Red (0-255)
   * @param g Green (0-255)
   * @param b Blue (0-255)
   * @param a Alpha (0-1, optional)
   */
  static rgbToHex(r: number, g: number, b: number, a: number = 1): string {
    const toHex = (n: number) => {
      const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    
    // Only include alpha if not fully opaque
    if (a < 1) {
      const alphaHex = Math.round(a * 255).toString(16).padStart(2, '0');
      return `${hex}${alphaHex}`;
    }
    
    return hex;
  }

  /**
   * Converts RGB to HSL
   * @returns [h, s, l] where h is 0-360, s and l are 0-100
   */
  static rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const delta = max - min;

    // Calculate lightness
    const l = (max + min) / 2;

    // Achromatic case
    if (delta === 0) {
      return [0, 0, Math.round(l * 100)];
    }

    // Calculate saturation
    const s = l > 0.5 
      ? delta / (2 - max - min) 
      : delta / (max + min);

    // Calculate hue
    let h: number;
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) / 6;
        break;
      case gNorm:
        h = ((bNorm - rNorm) / delta + 2) / 6;
        break;
      default: // bNorm
        h = ((rNorm - gNorm) / delta + 4) / 6;
    }

    return [
      Math.round(h * 360),
      Math.round(s * 100),
      Math.round(l * 100)
    ];
  }

  /**
   * Converts HSL to RGB
   * @param h Hue (0-360)
   * @param s Saturation (0-100)
   * @param l Lightness (0-100)
   */
  static hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const hNorm = h / 360;
    const sNorm = s / 100;
    const lNorm = l / 100;

    const hue2rgb = (p: number, q: number, t: number): number => {
      let tNorm = t;
      if (tNorm < 0) tNorm += 1;
      if (tNorm > 1) tNorm -= 1;
      if (tNorm < 1/6) {
        return p + (q - p) * 6 * tNorm;
      }
      if (tNorm < 1/2) {
        return q;
      }
      if (tNorm < 2/3) {
        return p + (q - p) * (2/3 - tNorm) * 6;
      }
      return p;
    };

    let r: number, g: number, b: number;

    if (sNorm === 0) {
      r = lNorm;
      g = lNorm;
      b = lNorm; // achromatic
    } else {
      const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
      const p = 2 * lNorm - q;
      r = hue2rgb(p, q, hNorm + 1/3);
      g = hue2rgb(p, q, hNorm);
      b = hue2rgb(p, q, hNorm - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  static getContrastRatio(color1: string, color2: string): number {
    const getLuminance = (hex: string): number => {
      const [r, g, b] = this.hexToRgb(hex);
      const sRGB = [r, g, b].map(c => {
        const normalized = c / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
    };

    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    
    return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
  }
}

// Color preset type
interface ColorPreset {
  name: string;
  color: string;
}

// Default color presets matching DaaS; the tooltip names come from the
// dictionary (`interfaces.color.presetNames`).
const DEFAULT_PRESET_COLORS: Array<{ name: keyof ColorTranslations['presetNames']; color: string }> = [
  { name: 'purple', color: '#6644FF' },
  { name: 'blue', color: '#3399FF' },
  { name: 'green', color: '#2ECDA7' },
  { name: 'yellow', color: '#FFC23B' },
  { name: 'orange', color: '#FFA439' },
  { name: 'red', color: '#E35169' },
  { name: 'black', color: '#18222F' },
  { name: 'gray', color: '#A2B5CD' },
  { name: 'white', color: '#FFFFFF' },
];

// Color format types
type ColorFormat = 'RGB' | 'HSL' | 'RGBA' | 'HSLA';

export interface ColorProps {
  /** Current color value (hex string) */
  value?: string | null;
  
  /** Whether the color picker is disabled */
  disabled?: boolean;
  /**
   * Value is visible but not editable. Mantine's ColorPicker/swatches have no
   * native readOnly, so this is enforced by neutralising `onChange` for every
   * mutation path below plus pointer suppression on the picker surface.
   */
  readOnly?: boolean;
  
  /** Whether the field is required */
  required?: boolean;
  
  /** Label displayed above the color picker */
  label?: string;
  
  /** Placeholder text */
  placeholder?: string;
  
  /** Description text displayed below the label */
  description?: string;
  
  /** Error message to display */
  error?: string;
  
  /** Whether to support opacity/alpha values */
  opacity?: boolean;
  
  /** Color presets to display */
  presets?: ColorPreset[];
  
  /** Callback fired when color changes */
  onChange?: (value: string | null) => void;

  /** Per-instance overrides of the dictionary strings (`interfaces.color`) */
  translations?: DeepPartial<ColorTranslations>;
}

/**
 * Color Interface Component
 * 
 * A color picker interface that matches the DaaS color interface functionality.
 * 
 * Features:
 * - Color input with visual swatch preview
 * - Multiple color format support (RGB, HSL, with optional alpha)
 * - Native HTML color picker integration
 * - Customizable color presets
 * - Alpha/opacity support
 * - Color validation and contrast detection
 * 
 * @param props - Color interface props
 * @returns React component
 */
export const Color: React.FC<ColorProps> = ({
  value,
  disabled = false,
  readOnly = false,
  required = false,
  label,
  placeholder,
  description,
  error,
  opacity = false,
  presets: presetsProp,
  onChange: onChangeProp,
  translations,
}) => {
  // Neutralise the emitter rather than gating each of the ~8 call sites below
  // (hex, RGB/HSL sliders, eyedropper, presets, clear) — a new call site cannot
  // then bypass the guard by accident.
  const onChange = disabled || readOnly ? undefined : onChangeProp;
  const t = useBuildpadTranslations((d) => d.interfaces.color, translations);
  const { formatNumber } = useBuildpadI18n();
  const defaultPresets = useMemo<ColorPreset[]>(
    () => DEFAULT_PRESET_COLORS.map((preset) => ({ name: t.presetNames[preset.name], color: preset.color })),
    [t],
  );
  const presets = presetsProp ?? defaultPresets;
  const [opened, setOpened] = useState(false);
  const [colorFormat, setColorFormat] = useState<ColorFormat>(opacity ? 'RGBA' : 'RGB');
  const hiddenColorInput = useRef<HTMLInputElement>(null);

  // Parse current color value
  const [r, g, b, a] = ColorUtils.hexToRgb(value || '#000000');
  const [h, s, l] = ColorUtils.rgbToHsl(r, g, b);
  const alpha = Math.round(a * 100);

  // Check if current color is valid
  const isValidColor = value ? ColorUtils.isValidHex(value) : false;

  // Check contrast for low contrast detection
  const isLowContrast = useCallback((color: string): boolean => {
    if (!color || !ColorUtils.isValidHex(color)) {
      return true;
    }
    
    // Use a light background color for contrast calculation
    const backgroundColor = '#FFFFFF';
    return ColorUtils.getContrastRatio(color, backgroundColor) < 1.1;
  }, []);

  // Handle hex input change
  const handleHexChange = useCallback((newHex: string) => {
    if (!newHex || newHex === '') {
      onChange?.(null);
      return;
    }

    // Add # if missing
    const hexValue = newHex.startsWith('#') ? newHex : `#${newHex}`;
    
    if (ColorUtils.isValidHex(hexValue)) {
      onChange?.(hexValue);
    }
  }, [onChange]);

  // Handle RGB value change
  const handleRgbChange = useCallback((index: number, newValue: number | string) => {
    const numValue = typeof newValue === 'string' ? parseInt(newValue, 10) : newValue;
    if (isNaN(numValue)) {
      return;
    }

    const currentRgb = ColorUtils.hexToRgb(value || '#000000');
    const newRgb = [...currentRgb] as [number, number, number, number];
    newRgb[index] = Math.max(0, Math.min(255, numValue));
    
    const newHex = ColorUtils.rgbToHex(newRgb[0], newRgb[1], newRgb[2], newRgb[3]);
    onChange?.(newHex);
  }, [value, onChange]);

  // Handle HSL value change
  const handleHslChange = useCallback((index: number, newValue: number | string) => {
    const numValue = typeof newValue === 'string' ? parseInt(newValue, 10) : newValue;
    if (isNaN(numValue)) {
      return;
    }

    const currentHsl = ColorUtils.rgbToHsl(r, g, b);
    const newHsl = [...currentHsl] as [number, number, number];
    
    if (index === 0) {
      newHsl[index] = Math.max(0, Math.min(360, numValue));
    } else {
      newHsl[index] = Math.max(0, Math.min(100, numValue));
    }
    
    const [newR, newG, newB] = ColorUtils.hslToRgb(newHsl[0], newHsl[1], newHsl[2]);
    const newHex = ColorUtils.rgbToHex(newR, newG, newB, a);
    onChange?.(newHex);
  }, [r, g, b, a, onChange]);

  // Handle alpha change
  const handleAlphaChange = useCallback((newAlpha: number) => {
    const alphaValue = Math.max(0, Math.min(100, newAlpha)) / 100;
    const newHex = ColorUtils.rgbToHex(r, g, b, alphaValue);
    onChange?.(newHex);
  }, [r, g, b, onChange]);

  // Handle native color picker change
  const handleNativeColorChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = event.target.value;
    const currentAlpha = opacity && value && value.length === 9 ? value.slice(-2) : '';
    const newHex = opacity && currentAlpha ? `${newColor}${currentAlpha}` : newColor;
    onChange?.(newHex);
  }, [opacity, value, onChange]);

  // Handle preset selection
  const handlePresetClick = useCallback((preset: ColorPreset) => {
    onChange?.(preset.color);
  }, [onChange]);

  // Clear color
  const handleClear = useCallback(() => {
    onChange?.(null);
  }, [onChange]);

  // Open native color picker
  const openNativeColorPicker = useCallback(() => {
    hiddenColorInput.current?.click();
  }, []);

  const colorFormats = opacity ? ['RGBA', 'HSLA'] : ['RGB', 'HSL'];

  return (
    <div>
      {label && (
        <Text fw={500} size="sm" mb="xs" data-variant="label">
          {label}
          {required && <Text component="span" c="red" ml={4}>*</Text>}
        </Text>
      )}
      
      {description && (
        <Text size="xs" c="dimmed" mb="sm">
          {description}
        </Text>
      )}

      <Popover 
        opened={opened} 
        onClose={() => setOpened(false)}
        disabled={disabled}
        width={300}
        position="bottom-start"
        withArrow
        shadow="var(--mantine-shadow-md)"
      >
        <Popover.Target>
          <TextInput
            value={value || ''}
            onChange={(event) => handleHexChange(event.currentTarget.value)}
            placeholder={placeholder || '#000000'}
            disabled={disabled}
            readOnly={readOnly}
            maxLength={opacity ? 9 : 7}
            pattern={opacity ? '#([a-fA-F0-9]{6}|[a-fA-F0-9]{8})' : '#[a-fA-F0-9]{6}'}
            onFocus={() => setOpened(true)}
            leftSection={
              <Group gap={4}>
                {/* Hidden native color input */}
                <input
                  ref={hiddenColorInput}
                  type="color"
                  value={value ? value.slice(0, 7) : '#000000'}
                  onChange={handleNativeColorChange}
                  style={{ 
                    width: 0, 
                    height: 0, 
                    opacity: 0, 
                    position: 'absolute',
                    pointerEvents: 'none'
                  }}
                />
                
                {/* Color swatch button */}
                <ActionIcon
                  variant="light"
                  size="sm"
                  onClick={openNativeColorPicker}
                  style={{
                    backgroundColor: isValidColor && value ? value : 'transparent',
                    border: isLowContrast(value || '') ? '1px solid var(--mantine-color-gray-4)' : 'none',
                  }}
                >
                  {!isValidColor && <IconColorPicker size={14} />}
                </ActionIcon>
              </Group>
            }
            rightSection={
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={isValidColor ? handleClear : openNativeColorPicker}
              >
                {isValidColor ? <IconX size={14} /> : <IconPalette size={14} />}
              </ActionIcon>
            }
          />
        </Popover.Target>

        <Popover.Dropdown p="md">
          <Stack gap="md">
            {/* Color format selector and inputs */}
            <Grid>
              <Grid.Col span={opacity ? 12 : 6}>
                <Select
                  data={colorFormats.map(format => ({ value: format, label: format }))}
                  value={colorFormat}
                  onChange={(value) => setColorFormat(value as ColorFormat)}
                  size="xs"
                />
              </Grid.Col>
              
              {/* RGB/RGBA inputs */}
              {(colorFormat === 'RGB' || colorFormat === 'RGBA') && (
                <>
                  <Grid.Col span={opacity ? 3 : 2}>
                    <NumberInput
                      value={r}
                      onChange={(value) => handleRgbChange(0, value || 0)}
                      min={0}
                      max={255}
                      size="xs"
                      hideControls
                    />
                  </Grid.Col>
                  <Grid.Col span={opacity ? 3 : 2}>
                    <NumberInput
                      value={g}
                      onChange={(value) => handleRgbChange(1, value || 0)}
                      min={0}
                      max={255}
                      size="xs"
                      hideControls
                    />
                  </Grid.Col>
                  <Grid.Col span={opacity ? 3 : 2}>
                    <NumberInput
                      value={b}
                      onChange={(value) => handleRgbChange(2, value || 0)}
                      min={0}
                      max={255}
                      size="xs"
                      hideControls
                    />
                  </Grid.Col>
                  {opacity && (
                    <Grid.Col span={3}>
                      <NumberInput
                        value={alpha}
                        onChange={(value) => handleAlphaChange(typeof value === 'number' ? value : 0)}
                        min={0}
                        max={100}
                        size="xs"
                        hideControls
                      />
                    </Grid.Col>
                  )}
                </>
              )}
              
              {/* HSL/HSLA inputs */}
              {(colorFormat === 'HSL' || colorFormat === 'HSLA') && (
                <>
                  <Grid.Col span={opacity ? 3 : 2}>
                    <NumberInput
                      value={h}
                      onChange={(value) => handleHslChange(0, value || 0)}
                      min={0}
                      max={360}
                      size="xs"
                      hideControls
                    />
                  </Grid.Col>
                  <Grid.Col span={opacity ? 3 : 2}>
                    <NumberInput
                      value={s}
                      onChange={(value) => handleHslChange(1, value || 0)}
                      min={0}
                      max={100}
                      size="xs"
                      hideControls
                    />
                  </Grid.Col>
                  <Grid.Col span={opacity ? 3 : 2}>
                    <NumberInput
                      value={l}
                      onChange={(value) => handleHslChange(2, value || 0)}
                      min={0}
                      max={100}
                      size="xs"
                      hideControls
                    />
                  </Grid.Col>
                  {opacity && (
                    <Grid.Col span={3}>
                      <NumberInput
                        value={alpha}
                        onChange={(value) => handleAlphaChange(typeof value === 'number' ? value : 0)}
                        min={0}
                        max={100}
                        size="xs"
                        hideControls
                      />
                    </Grid.Col>
                  )}
                </>
              )}
            </Grid>

            {/* Alpha slider for opacity mode */}
            {opacity && (
              <Box>
                <Text size="xs" c="dimmed" mb="xs">{t.opacity}</Text>
                <Slider
                  value={alpha}
                  onChange={handleAlphaChange}
                  min={0}
                  max={100}
                  step={1}
                  marks={[
                    { value: 0, label: formatNumber(0, { style: 'percent' }) },
                    { value: 100, label: formatNumber(1, { style: 'percent' }) },
                  ]}
                  size="sm"
                  style={{
                    background: `linear-gradient(to right, transparent, ${value ? value.slice(0, 7) : '#000000'}), 
                                 url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==")`,
                  }}
                />
              </Box>
            )}

            {/* Color presets */}
            {presets && presets.length > 0 && (
              <Box>
                <Text size="xs" c="dimmed" mb="xs">{t.presets}</Text>
                <Group gap="xs">
                  {presets.map((preset, index) => (
                    <Button
                      key={index}
                      size="xs"
                      variant="outline"
                      radius="sm"
                      title={preset.name}
                      onClick={() => handlePresetClick(preset)}
                      style={{
                        backgroundColor: preset.color,
                        borderColor: isLowContrast(preset.color) ? 'var(--mantine-color-gray-4)' : preset.color,
                        minWidth: 24,
                        width: 24,
                        height: 24,
                        padding: 0,
                      }}
                    />
                  ))}
                </Group>
              </Box>
            )}
          </Stack>
        </Popover.Dropdown>
      </Popover>

      {error && (
        <Text size="xs" c="red" mt="xs">
          {error}
        </Text>
      )}
    </div>
  );
};

export default Color;
