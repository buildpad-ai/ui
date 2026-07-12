import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mantine components (Modal, Menu, etc.) render into a document.body portal.
// Explicitly unmount + remove portal content after every test so assertions
// like `queryByTestId(...).not.toBeInTheDocument()` don't see a previous
// test's still-mounted modal.
afterEach(() => {
  cleanup();
});

// jsdom does not implement window.matchMedia — required by MantineProvider
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom does not implement ResizeObserver — required by Mantine's ScrollArea
// (used internally by Table/Select/Menu dropdowns).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver = ResizeObserverStub;

// jsdom does not implement scrollIntoView — Mantine's Combobox calls it on
// the active option when a Select/MultiSelect dropdown opens.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
