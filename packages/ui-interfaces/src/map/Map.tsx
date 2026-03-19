"use client";

import React, { useState, useCallback } from 'react';
import { Container, Group, Text, Alert, Select, Button, Stack, Card, Textarea, Badge } from '@mantine/core';
import { IconMap, IconMapPin, IconLine, IconSquare, IconTrash } from '@tabler/icons-react';

// Geometry types supported by the map interface
export type GeometryType = 
  | 'Point' 
  | 'LineString' 
  | 'Polygon' 
  | 'MultiPoint' 
  | 'MultiLineString' 
  | 'MultiPolygon' 
  | 'GeometryCollection';

// Format types for storing geometry data
export type GeometryFormat = 'geometry' | 'json' | 'csv' | 'string' | 'text';

// Basemap configuration
export interface BasemapSource {
  name: string;
  type: 'raster' | 'vector';
  url: string;
  attribution?: string;
  maxzoom?: number;
  tileSize?: number;
}

// Default view configuration
export interface DefaultView {
  center?: [number, number];
  zoom?: number;
  bearing?: number;
  pitch?: number;
}

/**
 * Props for the Map interface component
 * Based on DaaS map interface configuration
 */
export interface MapProps {
  /** Current geometry value */
  value?: any;
  
  /** Whether the map is disabled */
  disabled?: boolean;
  
  /** Whether the map is readonly */
  readOnly?: boolean;
  
  /** Whether the field is required */
  required?: boolean;
  
  /** Label displayed above the map */
  label?: string;
  
  /** Description text displayed below the label */
  description?: string;
  
  /** Error message to display */
  error?: string;
  
  /** Type of geometry to restrict drawing to */
  geometryType?: GeometryType;
  
  /** Format for storing the geometry data */
  geometryFormat?: GeometryFormat;
  
  /** Default view configuration */
  defaultView?: DefaultView;
  
  /** Available basemap sources */
  basemaps?: BasemapSource[];
  
  /** Selected basemap */
  basemap?: string;
  
  /** Height of the map container */
  height?: number | string;
  
  /** Whether to show basemap selector */
  showBasemapSelector?: boolean;
  
  /** Whether to show navigation controls */
  showNavigation?: boolean;
  
  /** Whether to show geolocation control */
  showGeolocation?: boolean;
  
  /** Whether to show fit bounds button */
  showFitBounds?: boolean;
  
  /** Callback fired when geometry changes */
  onChange?: (value: any) => void;
  
  /** Callback fired when basemap changes */
  onBasemapChange?: (basemap: string) => void;
}

// Default basemap sources
const DEFAULT_BASEMAPS: BasemapSource[] = [
  {
    name: 'OpenStreetMap',
    type: 'raster',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxzoom: 19,
    tileSize: 256,
  },
  {
    name: 'CartoDB Positron',
    type: 'raster',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxzoom: 19,
    tileSize: 256,
  },
  {
    name: 'CartoDB Dark Matter',
    type: 'raster',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxzoom: 19,
    tileSize: 256,
  },
];

/**
 * Map Interface Component
 * 
 * A map interface that matches the DaaS map interface functionality.
 * This is a simplified implementation that provides geometry editing capabilities
 * without requiring external map libraries. For full map visualization, install:
 * - maplibre-gl
 * - @mapbox/mapbox-gl-draw
 * - @types/geojson
 * 
 * Features:
 * - Geometry text editing and validation
 * - Multiple geometry format support (GeoJSON, WKT, CSV)
 * - Geometry type enforcement
 * - Format conversion
 * - Error handling and validation
 * - Placeholder for map visualization
 * 
 * @param props - Map interface props
 * @returns React component
 */
export const Map: React.FC<MapProps> = ({
  value,
  disabled = false,
  readOnly = false,
  required = false,
  label,
  description,
  error,
  geometryType,
  geometryFormat = 'geometry',
  basemaps = DEFAULT_BASEMAPS,
  basemap: selectedBasemap,
  height = 500,
  showBasemapSelector = true,
  onChange,
  onBasemapChange,
}) => {
  const [currentBasemap, setCurrentBasemap] = useState(selectedBasemap || basemaps[0]?.name);
  const [textValue, setTextValue] = useState(() => {
    if (!value) {
      return '';
    }
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  // Convert geometry between formats
  const convertGeometry = useCallback((inputValue: string, targetFormat: GeometryFormat) => {
    if (!inputValue.trim()) {
      return null;
    }

    try {
      let geometry: any;

      // Parse input
      if (inputValue.includes(',') && !inputValue.includes('{')) {
        // CSV format: "lat,lng" or "lng,lat"
        const coords = inputValue.split(',').map(Number);
        if (coords.length >= 2 && !coords.some(isNaN)) {
          geometry = {
            type: 'Point',
            coordinates: [coords[1], coords[0]], // Assume input is lat,lng, convert to lng,lat
          };
        } else {
          throw new Error('Invalid CSV coordinates format');
        }
      } else {
        // JSON format
        geometry = JSON.parse(inputValue);
      }

      // Validate geometry structure
      if (!geometry.type) {
        throw new Error('Geometry must have a type property');
      }

      // Check geometry type restriction
      if (geometryType && geometry.type !== geometryType) {
        if (!geometryType.startsWith('Multi') || !geometry.type.startsWith(geometryType.replace('Multi', ''))) {
          throw new Error(`Expected ${geometryType} but got ${geometry.type}`);
        }
      }

      // Convert to target format
      switch (targetFormat) {
        case 'csv':
          if (geometry.type === 'Point') {
            const coords = geometry.coordinates;
            return `${coords[1]},${coords[0]}`; // Return as lat,lng
          }
          return JSON.stringify(geometry);
        case 'string':
        case 'text':
          return JSON.stringify(geometry);
        case 'json':
        case 'geometry':
        default:
          return geometry;
      }
    } catch (err) {
      throw new Error(`Invalid geometry: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [geometryType, geometryFormat]);

  // Handle text input changes
  const handleTextChange = useCallback((newText: string) => {
    setTextValue(newText);
    setValidationError(null);

    if (!newText.trim()) {
      onChange?.(null);
      return;
    }

    try {
      const converted = convertGeometry(newText, geometryFormat);
      onChange?.(converted);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Invalid geometry format');
    }
  }, [convertGeometry, geometryFormat, onChange]);

  // Handle basemap change
  const handleBasemapChange = useCallback((newBasemap: string | null) => {
    if (newBasemap) {
      setCurrentBasemap(newBasemap);
      onBasemapChange?.(newBasemap);
    }
  }, [onBasemapChange]);

  // Get geometry type icon
  const getGeometryIcon = (type?: GeometryType) => {
    switch (type) {
      case 'Point':
      case 'MultiPoint':
        return <IconMapPin size={16} />;
      case 'LineString':
      case 'MultiLineString':
        return <IconLine size={16} />;
      case 'Polygon':
      case 'MultiPolygon':
        return <IconSquare size={16} />;
      default:
        return <IconMap size={16} />;
    }
  };

  // Generate sample geometry for the current type
  const generateSample = useCallback(() => {
    let sample: any;
    
    switch (geometryType) {
      case 'Point':
        sample = { type: 'Point', coordinates: [0, 0] };
        break;
      case 'LineString':
        sample = { type: 'LineString', coordinates: [[0, 0], [1, 1]] };
        break;
      case 'Polygon':
        sample = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] };
        break;
      case 'MultiPoint':
        sample = { type: 'MultiPoint', coordinates: [[0, 0], [1, 1]] };
        break;
      case 'MultiLineString':
        sample = { type: 'MultiLineString', coordinates: [[[0, 0], [1, 1]], [[2, 2], [3, 3]]] };
        break;
      case 'MultiPolygon':
        sample = { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]] };
        break;
      default:
        sample = { type: 'Point', coordinates: [0, 0] };
    }

    const sampleText = geometryFormat === 'csv' && sample.type === 'Point' 
      ? `${sample.coordinates[1]},${sample.coordinates[0]}`
      : JSON.stringify(sample, null, 2);
    
    setTextValue(sampleText);
    handleTextChange(sampleText);
  }, [geometryType, geometryFormat, handleTextChange]);

  // Clear geometry
  const clearGeometry = useCallback(() => {
    setTextValue('');
    setValidationError(null);
    onChange?.(null);
  }, [onChange]);

  return (
    <Container fluid p={0}>
      {label && (
        <Text fw={500} size="sm" mb="xs">
          {label}
          {required && <Text component="span" c="red" ml={4}>*</Text>}
        </Text>
      )}
      
      {description && (
        <Text size="xs" c="dimmed" mb="sm">
          {description}
        </Text>
      )}

      <Stack gap="md">
        {/* Map placeholder */}
        <Card
          withBorder
          style={{
            height: typeof height === 'number' ? `${height}px` : height,
            borderColor: error ? 'var(--mantine-color-error)' : undefined,
          }}
        >
          <Stack align="center" justify="center" h="100%" gap="md">
            <IconMap size={48} color="var(--mantine-color-gray-5)" />
            <Stack align="center" gap="xs">
              <Text size="lg" fw={500} c="dimmed">
                Map Visualization
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                Install maplibre-gl and @mapbox/mapbox-gl-draw for full map functionality
              </Text>
              <Group gap="xs">
                {geometryType && (
                  <Badge variant="light" leftSection={getGeometryIcon(geometryType)}>
                    {geometryType}
                  </Badge>
                )}
                <Badge variant="light" color="accent">
                  {geometryFormat.toUpperCase()}
                </Badge>
              </Group>
            </Stack>
          </Stack>

          {showBasemapSelector && basemaps.length > 1 && (
            <Group
              gap="xs"
              align="center"
              bg="white"
              p="xs"
              style={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                borderRadius: 'var(--mantine-radius-xs)', // Tokenized border radius
                boxShadow: 'var(--mantine-shadow-sm)', // Tokenized shadow
              }}
            >
              <IconMap size={16} />
              <Select
                data={basemaps.map(b => ({ value: b.name, label: b.name }))}
                value={currentBasemap}
                onChange={handleBasemapChange}
                size="xs"
                variant="unstyled"
                w={120}
              />
            </Group>
          )}
        </Card>

        {/* Geometry editing */}
        <Card withBorder p="md">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={500}>
                Geometry Data
              </Text>
              <Group gap="xs">
                {geometryType && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={getGeometryIcon(geometryType)}
                    onClick={generateSample}
                    disabled={disabled || readOnly}
                  >
                    Generate {geometryType}
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={clearGeometry}
                  disabled={disabled || readOnly || !textValue}
                >
                  Clear
                </Button>
              </Group>
            </Group>

            <Textarea
              value={textValue}
              onChange={(event) => handleTextChange(event.currentTarget.value)}
              placeholder={
                geometryFormat === 'csv' 
                  ? 'Enter coordinates as: latitude,longitude (e.g., 40.7128,-74.0060)'
                  : 'Enter GeoJSON geometry...'
              }
              minRows={6}
              maxRows={12}
              disabled={disabled}
              readOnly={readOnly}
              error={validationError}
              autosize
            />

            {geometryFormat === 'csv' && (
              <Text size="xs" c="dimmed">
                CSV format: Enter coordinates as "latitude,longitude" (e.g., 40.7128,-74.0060)
              </Text>
            )}

            {validationError && (
              <Alert color="red">
                {validationError}
              </Alert>
            )}
          </Stack>
        </Card>
      </Stack>

      {error && (
        <Text size="xs" c="red" mt="xs">
          {error}
        </Text>
      )}
    </Container>
  );
};

export default Map;
