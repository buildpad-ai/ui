/**
 * Type Declarations for Untyped Packages
 * 
 * This file provides TypeScript declarations for packages that don't have
 * official type definitions. It is copied to your project by the Buildpad CLI.
 * 
 * @buildpad-origin @buildpad/cli/templates
 */

// =============================================================================
// EditorJS Core
// =============================================================================

declare module '@editorjs/editorjs' {
  export interface OutputData {
    time?: number;
    blocks: OutputBlockData[];
    version?: string;
  }

  export interface OutputBlockData {
    id?: string;
    type: string;
    data: Record<string, unknown>;
  }

  /** Nested translation table: `{ ui: { toolbar: { toolbox: { Add: '…' } } }, toolNames: { Text: '…' } }`. */
  export interface I18nDictionary {
    [key: string]: string | I18nDictionary;
  }

  export interface I18nConfig {
    messages?: I18nDictionary;
    direction?: 'ltr' | 'rtl';
  }

  export interface EditorConfig {
    holder?: string | HTMLElement;
    data?: OutputData;
    placeholder?: string;
    readOnly?: boolean;
    minHeight?: number;
    autofocus?: boolean;
    tools?: Record<string, ToolConstructable | ToolSettings>;
    /** UI / tool-name translations — the InputBlockEditor interface fills this from the Buildpad dictionary. */
    i18n?: I18nConfig;
    onChange?: (api: API, event: CustomEvent) => void;
    onReady?: () => void;
  }

  export interface API {
    blocks: BlocksAPI;
    caret: CaretAPI;
    events: EventsAPI;
    listeners: ListenersAPI;
    notifier: NotifierAPI;
    sanitizer: SanitizerAPI;
    saver: SaverAPI;
    selection: SelectionAPI;
    styles: StylesAPI;
    toolbar: ToolbarAPI;
    inlineToolbar: InlineToolbarAPI;
    tooltip: TooltipAPI;
    i18n: I18nAPI;
    readOnly: ReadOnlyAPI;
    ui: UiAPI;
  }

  export interface BlocksAPI {
    clear(): void;
    render(data: OutputData): Promise<void>;
    delete(index?: number): void;
    swap(fromIndex: number, toIndex: number): void;
    getBlockByIndex(index: number): BlockAPI | undefined;
    getCurrentBlockIndex(): number;
    getBlocksCount(): number;
    stretchBlock(index: number, status?: boolean): void;
    insert(type?: string, data?: Record<string, unknown>, config?: Record<string, unknown>, index?: number, needToFocus?: boolean, replace?: boolean): void;
    update(id: string, data: Record<string, unknown>): void;
  }

  export interface BlockAPI {
    id: string;
    name: string;
    config: Record<string, unknown>;
    holder: HTMLElement;
    isEmpty: boolean;
    selected: boolean;
    stretched: boolean;
    call(methodName: string, param?: Record<string, unknown>): void;
    save(): Promise<OutputBlockData>;
  }

  export interface CaretAPI {
    setToBlock(index: number, position?: string, offset?: number): boolean;
    setToFirstBlock(position?: string, offset?: number): boolean;
    setToLastBlock(position?: string, offset?: number): boolean;
    setToPreviousBlock(position?: string, offset?: number): boolean;
    setToNextBlock(position?: string, offset?: number): boolean;
    focus(atEnd?: boolean): boolean;
  }

  export interface EventsAPI {
    emit(eventName: string, data?: unknown): void;
    off(eventName: string, callback: () => void): void;
    on(eventName: string, callback: () => void): void;
  }

  export interface ListenersAPI {
    on(element: HTMLElement, eventType: string, handler: () => void, useCapture?: boolean): void;
    off(element: HTMLElement, eventType: string, handler: () => void, useCapture?: boolean): void;
  }

  export interface NotifierAPI {
    show(options: { message: string; style?: 'success' | 'error' | 'warning' }): void;
  }

  export interface SanitizerAPI {
    clean(taintString: string, config?: Record<string, unknown>): string;
  }

  export interface SaverAPI {
    save(): Promise<OutputData>;
  }

  export interface SelectionAPI {
    findParentTag(tagName: string, className?: string): HTMLElement | null;
    expandToTag(node: HTMLElement): void;
  }

  export interface StylesAPI {
    block: string;
    inlineToolButton: string;
    inlineToolButtonActive: string;
    input: string;
    loader: string;
    button: string;
    settingsButton: string;
    settingsButtonActive: string;
  }

  export interface ToolbarAPI {
    close(): void;
    open(): void;
  }

  export interface InlineToolbarAPI {
    close(): void;
    open(): void;
  }

  export interface TooltipAPI {
    show(element: HTMLElement, text: string, options?: { placement?: string; hidingDelay?: number }): void;
    hide(): void;
    onHover(element: HTMLElement, text: string, options?: { placement?: string; hidingDelay?: number }): void;
  }

  export interface I18nAPI {
    t(namespace: string, dictKey?: string): string;
  }

  export interface ReadOnlyAPI {
    isEnabled: boolean;
    toggle(state?: boolean): Promise<boolean>;
  }

  export interface UiAPI {
    nodes: {
      wrapper: HTMLElement;
      redactor: HTMLElement;
    };
  }

  export interface ToolConstructable {
    new (config: { api: API; config?: Record<string, unknown>; data?: Record<string, unknown> }): BlockTool | InlineTool;
    toolbox?: { title: string; icon: string };
  }

  export interface ToolSettings {
    class: ToolConstructable;
    config?: Record<string, unknown>;
    inlineToolbar?: boolean | string[];
    shortcut?: string;
  }

  export interface BlockTool {
    render(): HTMLElement;
    save(block: HTMLElement): Record<string, unknown>;
    validate?(savedData: Record<string, unknown>): boolean;
    renderSettings?(): HTMLElement;
    destroy?(): void;
  }

  export interface InlineTool {
    render(): HTMLElement;
    surround(range: Range): void;
    checkState(selection: Selection): boolean;
    clear?(): void;
  }

  class EditorJS {
    constructor(config?: EditorConfig);
    isReady: Promise<void>;
    save(): Promise<OutputData>;
    clear(): Promise<void>;
    render(data: OutputData): Promise<void>;
    destroy(): void;
    readonly readOnly: {
      isEnabled: boolean;
      toggle(state?: boolean): Promise<boolean>;
    };
  }

  export default EditorJS;
}

// =============================================================================
// EditorJS Plugins
// =============================================================================

declare module '@editorjs/header' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const Header: ToolConstructable;
  export default Header;
}

declare module '@editorjs/nested-list' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const NestedList: ToolConstructable;
  export default NestedList;
}

declare module '@editorjs/paragraph' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const Paragraph: ToolConstructable;
  export default Paragraph;
}

declare module '@editorjs/code' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const Code: ToolConstructable;
  export default Code;
}

declare module '@editorjs/quote' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const Quote: ToolConstructable;
  export default Quote;
}

declare module '@editorjs/checklist' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const Checklist: ToolConstructable;
  export default Checklist;
}

declare module '@editorjs/delimiter' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const Delimiter: ToolConstructable;
  export default Delimiter;
}

declare module '@editorjs/table' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const Table: ToolConstructable;
  export default Table;
}

declare module '@editorjs/underline' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const Underline: ToolConstructable;
  export default Underline;
}

declare module '@editorjs/inline-code' {
  import type { ToolConstructable } from '@editorjs/editorjs';
  const InlineCode: ToolConstructable;
  export default InlineCode;
}

// =============================================================================
// MapLibre GL
// =============================================================================

declare module 'maplibre-gl' {
  // StyleSpecification with index signature for compatibility
  export interface StyleSpecification {
    version: 8;
    name?: string;
    metadata?: Record<string, unknown>;
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
    light?: Record<string, unknown>;
    terrain?: Record<string, unknown>;
    fog?: Record<string, unknown>;
    sources: Record<string, unknown>;
    sprite?: string;
    glyphs?: string;
    transition?: {
      duration?: number;
      delay?: number;
    };
    layers: Array<Record<string, unknown>>;
    // Index signature for additional properties
    [key: string]: unknown;
  }

  export interface MapOptions {
    container: string | HTMLElement;
    style: string | StyleSpecification | Record<string, unknown>;
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
    bounds?: [[number, number], [number, number]];
    maxBounds?: [[number, number], [number, number]];
    interactive?: boolean;
    hash?: boolean | string;
    bearingSnap?: number;
    attributionControl?: boolean;
    logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    failIfMajorPerformanceCaveat?: boolean;
    preserveDrawingBuffer?: boolean;
    antialias?: boolean;
    refreshExpiredTiles?: boolean;
    maxTileCacheSize?: number;
    trackResize?: boolean;
    renderWorldCopies?: boolean;
    minZoom?: number;
    maxZoom?: number;
    minPitch?: number;
    maxPitch?: number;
  }

  export interface LngLatLike {
    lng: number;
    lat: number;
  }

  export class LngLat implements LngLatLike {
    constructor(lng: number, lat: number);
    lng: number;
    lat: number;
    wrap(): LngLat;
    toArray(): [number, number];
    toString(): string;
    distanceTo(lngLat: LngLat): number;
    static convert(input: [number, number] | LngLatLike): LngLat;
  }

  export class LngLatBounds {
    constructor(sw?: LngLatLike | [number, number], ne?: LngLatLike | [number, number]);
    setNorthEast(ne: LngLatLike | [number, number]): this;
    setSouthWest(sw: LngLatLike | [number, number]): this;
    extend(obj: LngLatLike | LngLatBounds | [number, number]): this;
    getCenter(): LngLat;
    getSouthWest(): LngLat;
    getNorthEast(): LngLat;
    getNorthWest(): LngLat;
    getSouthEast(): LngLat;
    getWest(): number;
    getSouth(): number;
    getEast(): number;
    getNorth(): number;
    toArray(): [[number, number], [number, number]];
    toString(): string;
    isEmpty(): boolean;
    contains(lnglat: LngLatLike | [number, number]): boolean;
    static convert(input: LngLatBounds | [LngLatLike, LngLatLike] | [number, number, number, number]): LngLatBounds;
  }

  export interface MarkerOptions {
    element?: HTMLElement;
    anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    offset?: [number, number];
    color?: string;
    scale?: number;
    draggable?: boolean;
    rotation?: number;
    rotationAlignment?: 'map' | 'viewport' | 'auto';
    pitchAlignment?: 'map' | 'viewport' | 'auto';
  }

  export class Marker {
    constructor(options?: MarkerOptions);
    addTo(map: Map): this;
    remove(): this;
    getLngLat(): LngLat;
    setLngLat(lnglat: LngLatLike | [number, number]): this;
    getElement(): HTMLElement;
    setPopup(popup?: Popup): this;
    getPopup(): Popup | null;
    togglePopup(): this;
    getOffset(): [number, number];
    setOffset(offset: [number, number]): this;
    setDraggable(shouldBeDraggable?: boolean): this;
    isDraggable(): boolean;
    getRotation(): number;
    setRotation(rotation?: number): this;
    getRotationAlignment(): string;
    setRotationAlignment(alignment?: 'map' | 'viewport' | 'auto'): this;
    getPitchAlignment(): string;
    setPitchAlignment(alignment?: 'map' | 'viewport' | 'auto'): this;
    on(type: string, listener: (e: unknown) => void): this;
    off(type: string, listener: (e: unknown) => void): this;
  }

  export interface PopupOptions {
    closeButton?: boolean;
    closeOnClick?: boolean;
    closeOnMove?: boolean;
    anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    offset?: number | [number, number];
    className?: string;
    maxWidth?: string;
    focusAfterOpen?: boolean;
  }

  export class Popup {
    constructor(options?: PopupOptions);
    addTo(map: Map): this;
    isOpen(): boolean;
    remove(): this;
    getLngLat(): LngLat | undefined;
    setLngLat(lnglat: LngLatLike | [number, number]): this;
    trackPointer(): this;
    getElement(): HTMLElement;
    setText(text: string): this;
    setHTML(html: string): this;
    setDOMContent(htmlNode: Node): this;
    getMaxWidth(): string;
    setMaxWidth(maxWidth: string): this;
    addClassName(className: string): this;
    removeClassName(className: string): this;
    setOffset(offset?: number | [number, number]): this;
    toggleClassName(className: string): boolean;
    on(type: string, listener: (e: unknown) => void): this;
    off(type: string, listener: (e: unknown) => void): this;
  }

  export interface NavigationControlOptions {
    showCompass?: boolean;
    showZoom?: boolean;
    visualizePitch?: boolean;
  }

  export class NavigationControl {
    constructor(options?: NavigationControlOptions);
  }

  export interface GeolocateControlOptions {
    positionOptions?: PositionOptions;
    fitBoundsOptions?: Record<string, unknown>;
    trackUserLocation?: boolean;
    showAccuracyCircle?: boolean;
    showUserLocation?: boolean;
  }

  export class GeolocateControl {
    constructor(options?: GeolocateControlOptions);
    trigger(): boolean;
  }

  export class ScaleControl {
    constructor(options?: { maxWidth?: number; unit?: 'imperial' | 'metric' | 'nautical' });
    setUnit(unit: 'imperial' | 'metric' | 'nautical'): void;
  }

  export class FullscreenControl {
    constructor(options?: { container?: HTMLElement });
  }

  export class AttributionControl {
    constructor(options?: { compact?: boolean; customAttribution?: string | string[] });
  }

  export class Map {
    constructor(options: MapOptions);
    addControl(control: unknown, position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'): this;
    removeControl(control: unknown): this;
    resize(): this;
    getBounds(): LngLatBounds;
    getMaxBounds(): LngLatBounds | null;
    setMaxBounds(bounds?: [[number, number], [number, number]]): this;
    setMinZoom(minZoom?: number): this;
    getMinZoom(): number;
    setMaxZoom(maxZoom?: number): this;
    getMaxZoom(): number;
    setMinPitch(minPitch?: number): this;
    getMinPitch(): number;
    setMaxPitch(maxPitch?: number): this;
    getMaxPitch(): number;
    getRenderWorldCopies(): boolean;
    setRenderWorldCopies(renderWorldCopies?: boolean): this;
    project(lnglat: LngLatLike | [number, number]): { x: number; y: number };
    unproject(point: { x: number; y: number } | [number, number]): LngLat;
    isMoving(): boolean;
    isZooming(): boolean;
    isRotating(): boolean;
    on(type: string, listener: (e: unknown) => void): this;
    on(type: string, layerId: string, listener: (e: unknown) => void): this;
    once(type: string, listener: (e: unknown) => void): this;
    off(type: string, listener: (e: unknown) => void): this;
    off(type: string, layerId: string, listener: (e: unknown) => void): this;
    addSource(id: string, source: Record<string, unknown>): this;
    getSource(id: string): unknown;
    removeSource(id: string): this;
    addLayer(layer: Record<string, unknown>, beforeId?: string): this;
    getLayer(id: string): unknown;
    removeLayer(id: string): this;
    moveLayer(id: string, beforeId?: string): this;
    setLayoutProperty(layerId: string, name: string, value: unknown): this;
    getLayoutProperty(layerId: string, name: string): unknown;
    setPaintProperty(layerId: string, name: string, value: unknown): this;
    getPaintProperty(layerId: string, name: string): unknown;
    setFilter(layerId: string, filter?: unknown[]): this;
    getFilter(layerId: string): unknown[];
    setLayerZoomRange(layerId: string, minzoom: number, maxzoom: number): this;
    getZoom(): number;
    setZoom(zoom: number): this;
    zoomTo(zoom: number, options?: unknown): this;
    zoomIn(options?: unknown): this;
    zoomOut(options?: unknown): this;
    getCenter(): LngLat;
    setCenter(center: LngLatLike | [number, number]): this;
    panTo(lnglat: LngLatLike | [number, number], options?: unknown): this;
    panBy(offset: [number, number], options?: unknown): this;
    flyTo(options: { center?: LngLatLike | [number, number]; zoom?: number; bearing?: number; pitch?: number; speed?: number; curve?: number; essential?: boolean }): this;
    easeTo(options: { center?: LngLatLike | [number, number]; zoom?: number; bearing?: number; pitch?: number; duration?: number; easing?: (t: number) => number }): this;
    fitBounds(bounds: LngLatBounds | [[number, number], [number, number]], options?: { padding?: number | { top: number; bottom: number; left: number; right: number }; offset?: [number, number]; maxZoom?: number; duration?: number }): this;
    jumpTo(options: { center?: LngLatLike | [number, number]; zoom?: number; bearing?: number; pitch?: number }): this;
    getBearing(): number;
    setBearing(bearing: number): this;
    getPitch(): number;
    setPitch(pitch: number): this;
    getStyle(): Record<string, unknown>;
    setStyle(style: string | Record<string, unknown>, options?: { diff?: boolean }): this;
    setFog(fog: Record<string, unknown> | null): this;
    getFog(): Record<string, unknown> | null;
    queryRenderedFeatures(geometry?: { x: number; y: number } | [[number, number], [number, number]], options?: { layers?: string[]; filter?: unknown[] }): unknown[];
    querySourceFeatures(sourceId: string, parameters?: { sourceLayer?: string; filter?: unknown[] }): unknown[];
    setFeatureState(feature: { source: string; sourceLayer?: string; id: string | number }, state: Record<string, unknown>): void;
    getFeatureState(feature: { source: string; sourceLayer?: string; id: string | number }): Record<string, unknown>;
    removeFeatureState(target: { source: string; sourceLayer?: string; id?: string | number }, key?: string): void;
    getContainer(): HTMLElement;
    getCanvasContainer(): HTMLElement;
    getCanvas(): HTMLCanvasElement;
    loaded(): boolean;
    remove(): void;
    triggerRepaint(): void;
    showTileBoundaries: boolean;
    showCollisionBoxes: boolean;
    repaint: boolean;
  }
}

declare module '@mapbox/mapbox-gl-draw' {
  import type { Map } from 'maplibre-gl';

  export interface DrawOptions {
    displayControlsDefault?: boolean;
    keybindings?: boolean;
    touchEnabled?: boolean;
    boxSelect?: boolean;
    clickBuffer?: number;
    touchBuffer?: number;
    controls?: {
      point?: boolean;
      line_string?: boolean;
      polygon?: boolean;
      trash?: boolean;
      combine_features?: boolean;
      uncombine_features?: boolean;
    };
    styles?: Record<string, unknown>[];
    modes?: Record<string, unknown>;
    defaultMode?: string;
    userProperties?: boolean;
  }

  export interface Feature {
    id: string;
    type: 'Feature';
    properties: Record<string, unknown>;
    geometry: {
      type: string;
      coordinates: unknown;
    };
  }

  export interface FeatureCollection {
    type: 'FeatureCollection';
    features: Feature[];
  }

  class MapboxDraw {
    constructor(options?: DrawOptions);
    add(geojson: Feature | FeatureCollection): string[];
    get(featureId: string): Feature | undefined;
    getFeatureIdsAt(point: { x: number; y: number }): string[];
    getSelectedIds(): string[];
    getSelected(): FeatureCollection;
    getSelectedPoints(): FeatureCollection;
    getAll(): FeatureCollection;
    delete(featureIds: string | string[]): this;
    deleteAll(): this;
    set(featureCollection: FeatureCollection): string[];
    trash(): this;
    combineFeatures(): this;
    uncombineFeatures(): this;
    getMode(): string;
    changeMode(mode: string, options?: Record<string, unknown>): this;
    setFeatureProperty(featureId: string, property: string, value: unknown): this;
    onAdd(map: Map): HTMLElement;
    onRemove(): void;
  }

  export default MapboxDraw;
}
