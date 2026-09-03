/** `interfaces.map` — strings of the Map and MapWithRealMap interfaces. */
import type { PluralForms } from '../../primitives';

export interface MapTranslations {
  /** Overlay shown while MapLibre initialises */
  loading: string;
  /** "{count} selected" badge for the drawn features currently selected */
  selectedCount: PluralForms;
  controls: {
    /** Title of the fit-to-bounds map control button */
    fitBounds: string;
  };
  /** Static placeholder rendered by the library-free `Map` component */
  placeholder: {
    title: string;
    installHint: string;
  };
  geometryData: {
    title: string;
    /** "Generate {geometryType}" — the GeoJSON type name is data */
    generate: string;
    clear: string;
    placeholderCsv: string;
    placeholderGeoJson: string;
    csvHint: string;
  };
  error: {
    invalidCsvCoordinates: string;
    missingType: string;
    /** "Expected {expected} but got {actual}" */
    typeMismatch: string;
    /** "Invalid geometry: {message}" */
    invalidGeometry: string;
    unknown: string;
    invalidFormat: string;
    /** Fallback when a draw error carries no message */
    invalidGeometryFallback: string;
    /** Title of the validation alert */
    invalidGeometryTitle: string;
  };
}

export const mapDefaults: MapTranslations = {
  loading: 'Loading map...',
  selectedCount: { other: '{count} selected' },
  controls: {
    fitBounds: 'Fit to bounds',
  },
  placeholder: {
    title: 'Map Visualization',
    installHint: 'Install maplibre-gl and @mapbox/mapbox-gl-draw for full map functionality',
  },
  geometryData: {
    title: 'Geometry Data',
    generate: 'Generate {geometryType}',
    clear: 'Clear',
    placeholderCsv: 'Enter coordinates as: latitude,longitude (e.g., 40.7128,-74.0060)',
    placeholderGeoJson: 'Enter GeoJSON geometry...',
    csvHint: 'CSV format: Enter coordinates as "latitude,longitude" (e.g., 40.7128,-74.0060)',
  },
  error: {
    invalidCsvCoordinates: 'Invalid CSV coordinates format',
    missingType: 'Geometry must have a type property',
    typeMismatch: 'Expected {expected} but got {actual}',
    invalidGeometry: 'Invalid geometry: {message}',
    unknown: 'Unknown error',
    invalidFormat: 'Invalid geometry format',
    invalidGeometryFallback: 'Invalid geometry',
    invalidGeometryTitle: 'Invalid Geometry',
  },
};

export const mapId: MapTranslations = {
  loading: 'Memuat peta...',
  selectedCount: { other: '{count} dipilih' },
  controls: {
    fitBounds: 'Sesuaikan ke batas',
  },
  placeholder: {
    title: 'Visualisasi Peta',
    installHint: 'Pasang maplibre-gl dan @mapbox/mapbox-gl-draw untuk fungsi peta lengkap',
  },
  geometryData: {
    title: 'Data Geometri',
    generate: 'Buat {geometryType}',
    clear: 'Bersihkan',
    placeholderCsv: 'Masukkan koordinat sebagai: lintang,bujur (mis. 40.7128,-74.0060)',
    placeholderGeoJson: 'Masukkan geometri GeoJSON...',
    csvHint: 'Format CSV: Masukkan koordinat sebagai "lintang,bujur" (mis. 40.7128,-74.0060)',
  },
  error: {
    invalidCsvCoordinates: 'Format koordinat CSV tidak valid',
    missingType: 'Geometri harus memiliki properti type',
    typeMismatch: 'Diharapkan {expected} tetapi mendapat {actual}',
    invalidGeometry: 'Geometri tidak valid: {message}',
    unknown: 'Kesalahan tidak diketahui',
    invalidFormat: 'Format geometri tidak valid',
    invalidGeometryFallback: 'Geometri tidak valid',
    invalidGeometryTitle: 'Geometri Tidak Valid',
  },
};
