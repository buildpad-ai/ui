import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// jsdom implements neither TextEncoder/TextDecoder nor URL.createObjectURL,
// but maplibre-gl (pulled in by the package barrel via MapWithRealMap) touches
// both at module load (it builds its worker from a Blob URL). Without these,
// any test importing '@buildpad/ui-interfaces' fails to load. Tests that care
// about object URLs still override createObjectURL with their own jest.fn().
if (typeof globalThis.TextDecoder === 'undefined') {
  Object.assign(globalThis, { TextDecoder, TextEncoder });
}
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = jest.fn(() => 'blob:mock');
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = jest.fn();
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// jsdom does not implement scrollIntoView, but Mantine's combobox calls it
// on every highlight move — without this, any test that arrow-keys through
// a dropdown throws, which makes keyboard interaction untestable across the
// whole Select* family.
Element.prototype.scrollIntoView = jest.fn();

// Mock getComputedStyle for Mantine: blank out --mantine-* custom properties.
// Patch getPropertyValue on the real CSSStyleDeclaration rather than spreading
// it into a plain object — the named properties (display, visibility,
// opacity, ...) are prototype accessors, so a spread dropped them and every
// element looked `display: undefined`, which made jest-dom's toBeVisible()
// report hidden elements (e.g. a closed Mantine Collapse) as visible.
const originalGetComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = (element: Element, pseudoElt?: string | null) => {
  const style = originalGetComputedStyle(element, pseudoElt);
  const getPropertyValue = style.getPropertyValue.bind(style);
  style.getPropertyValue = (prop: string) => {
    if (prop.startsWith('--mantine')) {
      return '';
    }
    return getPropertyValue(prop);
  };
  return style;
};
