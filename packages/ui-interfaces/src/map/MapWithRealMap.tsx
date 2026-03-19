/**
 * MapWithRealMap Interface Component
 * Full-featured map interface using MapLibre GL JS
 * 
 * Based on DaaS map interface
 * Uses MapLibre GL JS for rendering and MapboxDraw for geometry editing
 * 
 * Peer dependencies required:
 * - maplibre-gl
 * - @mapbox/mapbox-gl-draw
 */

"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Container, Group, Text, Alert, Select, Button, Stack, Badge } from '@mantine/core';
import { IconMap, IconMapPin, IconLine, IconSquare, IconTrash } from '@tabler/icons-react';
import maplibregl from 'maplibre-gl';
import type { Map as MaplibreMap, LngLatLike } from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

// GeoJSON types for geometry handling
interface GeoJSONGeometry {
  type: string;
  coordinates: number[] | number[][] | number[][][];
}

interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONGeometry;
  properties: Record<string, unknown>;
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

// Re-export types from Map component to avoid duplication
// These are the same types used in the base Map component
import type { GeometryType, GeometryFormat, BasemapSource, DefaultView } from './Map';
export type { GeometryType, GeometryFormat, BasemapSource, DefaultView };

/**
 * Props for the Map interface component
 * Based on DaaS map interface configuration
 */
export interface MapWithRealMapProps {
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

// Default basemap sources matching DaaS
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

// Custom control for fit bounds
class FitBoundsControl {
  private map: maplibregl.Map | undefined;
  private container: HTMLDivElement | undefined;

  onAdd(map: maplibregl.Map) {
    this.map = map;
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    
    const button = document.createElement('button');
    button.type = 'button';
    button.title = 'Fit to bounds';
    button.innerHTML = '⌄';
    button.style.fontSize = '18px';
    button.style.fontWeight = 'bold';
    
    button.addEventListener('click', this.fitBounds.bind(this));
    this.container.appendChild(button);
    
    return this.container;
  }

  onRemove() {
    if (this.container?.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.map = undefined;
  }

  private fitBounds() {
    // This will be connected to the parent component's fit bounds logic
    const event = new CustomEvent('fit-bounds');
    window.dispatchEvent(event);
  }
}

// Get map style for basemap
function getMapStyle(basemap: BasemapSource): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: [basemap.url.replace('{s}', 'a'), basemap.url.replace('{s}', 'b'), basemap.url.replace('{s}', 'c')],
        tileSize: basemap.tileSize || 256,
        attribution: basemap.attribution || '',
      },
    },
    layers: [
      {
        id: 'osm-tiles',
        type: 'raster',
        source: 'osm-tiles',
        minzoom: 0,
        maxzoom: basemap.maxzoom || 22,
      },
    ],
  };
}

// Get draw options for specific geometry type
function getDrawOptions(geometryType?: GeometryType): any {
  const options: any = {
    displayControlsDefault: false,
    controls: {},
    userProperties: true,
  };

  if (!geometryType) {
    // Allow all geometry types
    options.controls = {
      point: true,
      line_string: true,
      polygon: true,
      trash: true,
    };
  } else {
    // Restrict to specific geometry type
    const typeMap: Record<string, string> = {
      'Point': 'point',
      'LineString': 'line_string', 
      'Polygon': 'polygon',
      'MultiPoint': 'point',
      'MultiLineString': 'line_string',
      'MultiPolygon': 'polygon',
    };
    
    const drawType = typeMap[geometryType];
    if (drawType) {
      options.controls[drawType] = true;
      options.controls.trash = true;
    }
  }

  return options;
}

/**
 * MapWithRealMap Interface Component
 * 
 * A map interface that exactly matches the DaaS map interface functionality.
 * Includes real MapLibre GL JS map rendering with interactive drawing tools.
 * 
 * Features:
 * - Interactive map with zoom, pan, and drawing controls
 * - Multiple geometry type support
 * - Real-time geometry editing and validation
 * - Basemap switching
 * - Geolocation support
 * - Fit bounds functionality
 * - Full compatibility with DaaS map interface
 */
export const MapWithRealMap: React.FC<MapWithRealMapProps> = ({
  value,
  disabled = false,
  readOnly = false,
  required = false,
  label,
  description,
  error,
  geometryType,
  geometryFormat = 'geometry',
  defaultView = { center: [0, 0], zoom: 1 },
  basemaps = DEFAULT_BASEMAPS,
  basemap: selectedBasemap,
  height = 500,
  showBasemapSelector = true,
  showNavigation = true,
  showGeolocation = true,
  showFitBounds = true,
  onChange,
  onBasemapChange,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [currentBasemap, setCurrentBasemap] = useState(selectedBasemap || basemaps[0]?.name);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selection, setSelection] = useState<any[]>([]);

  // Handle geometry updates from drawing
  const handleDrawUpdate = useCallback(() => {
    if (!draw.current) {
      return;
    }

    const data = draw.current.getAll();
    setValidationError(null);

    if (data.features.length === 0) {
      onChange?.(null);
      return;
    }

    try {
      let geometry;
      
      if (data.features.length === 1) {
        geometry = data.features[0].geometry;
      } else if (geometryType?.startsWith('Multi')) {
        // Handle multi-geometry types - cast to any for MapboxDraw compatibility
        const coordinates = (data.features as any[]).map((f) => {
          return f.geometry?.coordinates;
        });
        geometry = {
          type: geometryType,
          coordinates
        };
      } else {
        // Take the last drawn feature
        geometry = data.features[data.features.length - 1].geometry;
      }

      // Validate geometry type if specified
      if (geometryType && geometry.type !== geometryType) {
        if (!geometryType.startsWith('Multi') || !geometry.type.startsWith(geometryType.replace('Multi', ''))) {
          setValidationError(`Expected ${geometryType} but got ${geometry.type}`);
          return;
        }
      }

      // Convert to required format
      let output;
      const geom = geometry as GeoJSONGeometry;
      switch (geometryFormat) {
        case 'csv':
          if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
            const coords = geom.coordinates as number[];
            output = `${coords[1]},${coords[0]}`;
          } else {
            output = JSON.stringify(geometry);
          }
          break;
        case 'string':
        case 'text':
          output = JSON.stringify(geometry);
          break;
        default:
          output = geometry;
      }

      onChange?.(output);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Invalid geometry');
    }
  }, [geometryType, geometryFormat, onChange]);

  // Handle selection changes
  const handleSelectionChange = useCallback((e: any) => {
    setSelection(e.features || []);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) {
      return;
    }

    const selectedBasemapSource = basemaps.find(b => b.name === currentBasemap) || basemaps[0];
    
    // Create map instance
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: getMapStyle(selectedBasemapSource),
      center: defaultView.center || [0, 0],
      zoom: defaultView.zoom || 1,
      attributionControl: false,
      pitch: 0,
      maxPitch: 0,
    });
    
    // Disable rotation controls (cast to any for handler access)
    (map.current as any).dragRotate?.disable();
    (map.current as any).touchZoomRotate?.disableRotation();

    // Add controls
    if (showNavigation) {
      map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    }

    if (showGeolocation) {
      map.current.addControl(new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showUserLocation: false,
      }), 'top-left');
    }

    if (showFitBounds) {
      map.current.addControl(new FitBoundsControl(), 'top-left');
    }

    // Add attribution
    map.current.addControl(new maplibregl.AttributionControl(), 'bottom-left');

    // Add drawing controls
    draw.current = new MapboxDraw(getDrawOptions(geometryType));
    map.current.addControl(draw.current as any, 'top-left');

    // Map event listeners
    map.current.on('load', () => {
      setMapLoading(false);
      
      // Load initial value if present
      if (value && draw.current) {
        try {
          const geometry = typeof value === 'string' ? JSON.parse(value) : value;
          if (geometry && geometry.type) {
            // Cast to any for MapboxDraw compatibility
            draw.current.add({
              type: 'Feature',
              geometry,
              properties: {}
            } as any);
          }
        } catch {
          // Failed to load initial geometry
        }
      }
    });

    // Drawing event listeners
    if (draw.current) {
      map.current.on('draw.create', handleDrawUpdate);
      map.current.on('draw.update', handleDrawUpdate);
      map.current.on('draw.delete', handleDrawUpdate);
      map.current.on('draw.selectionchange', handleSelectionChange);
    }

    // Fit bounds event listener
    const handleFitBounds = () => {
      if (draw.current && map.current) {
        const data = draw.current.getAll();
        if (data.features.length > 0) {
          const bounds = new maplibregl.LngLatBounds();
          data.features.forEach((feature: any) => {
            if (feature.geometry.type === 'Point') {
              bounds.extend(feature.geometry.coordinates as [number, number]);
            } else if (feature.geometry.type === 'LineString') {
              feature.geometry.coordinates.forEach((coord: any) => bounds.extend(coord as [number, number]));
            } else if (feature.geometry.type === 'Polygon') {
              feature.geometry.coordinates[0].forEach((coord: any) => bounds.extend(coord as [number, number]));
            }
          });
          map.current!.fitBounds(bounds, { padding: 50 });
        }
      }
    };

    window.addEventListener('fit-bounds', handleFitBounds);

    // Cleanup
    return () => {
      window.removeEventListener('fit-bounds', handleFitBounds);
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Handle basemap changes
  useEffect(() => {
    if (map.current && currentBasemap) {
      const selectedBasemapSource = basemaps.find(b => b.name === currentBasemap) || basemaps[0];
      map.current.setStyle(getMapStyle(selectedBasemapSource));
      
      // Re-add draw control after style change
      setTimeout(() => {
        if (map.current && draw.current) {
          map.current.addControl(draw.current as any, 'top-left');
        }
      }, 100);
    }
  }, [currentBasemap, basemaps]);

  // Handle basemap change
  const handleBasemapChange = useCallback((newBasemap: string | null) => {
    if (newBasemap) {
      setCurrentBasemap(newBasemap);
      onBasemapChange?.(newBasemap);
    }
  }, [onBasemapChange]);

  // Clear all geometries
  const clearGeometry = useCallback(() => {
    if (draw.current) {
      draw.current.deleteAll();
      onChange?.(null);
      setValidationError(null);
    }
  }, [onChange]);

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
        {/* Map container */}
        <div
          style={{
            position: 'relative',
            height: typeof height === 'number' ? `${height}px` : height,
            border: `1px solid ${error ? 'var(--mantine-color-error)' : 'var(--mantine-color-gray-3)'}`,
            borderRadius: 'var(--mantine-radius-xs)',
            overflow: 'hidden',
          }}
        >
          <div 
            ref={mapContainer} 
            style={{ 
              width: '100%', 
              height: '100%',
              opacity: mapLoading ? 0.5 : 1,
              transition: 'opacity 0.3s'
            }} 
          />
          
          {/* Basemap selector */}
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
              borderRadius: 'var(--mantine-radius-sm)',
              boxShadow: 'var(--ds-shadow, 0 2px 4px rgba(25, 22, 18, 0.05))',
              border: '1px solid var(--mantine-color-gray-3)',
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

          {/* Loading overlay */}
          {mapLoading && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'var(--mantine-color-white, rgba(255, 255, 255, 0.8))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
            >
              <Text>Loading map...</Text>
            </div>
          )}
        </div>

        {/* Geometry info and controls */}
        {(geometryType || geometryFormat !== 'geometry' || selection.length > 0) && (
          <Group justify="space-between" align="center">
            <Group gap="xs">
              {geometryType && (
                <Badge variant="light" leftSection={getGeometryIcon(geometryType)}>
                  {geometryType}
                </Badge>
              )}
              <Badge variant="light" color="accent">
                {geometryFormat.toUpperCase()}
              </Badge>
              {selection.length > 0 && (
                <Badge variant="light" color="green">
                  {selection.length} selected
                </Badge>
              )}
            </Group>
            
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={clearGeometry}
              disabled={disabled || readOnly}
            >
              Clear
            </Button>
          </Group>
        )}

        {/* Validation errors */}
        {validationError && (
          <Alert color="red" title="Invalid Geometry">
            {validationError}
          </Alert>
        )}
      </Stack>

      {error && (
        <Text size="xs" c="red" mt="xs">
          {error}
        </Text>
      )}
    </Container>
  );
};

export default MapWithRealMap;
