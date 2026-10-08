import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// `findBy…` and `waitFor` give up after one second by default. The editor
// suites wait on a canvas and on dialogs that open through several renders;
// under coverage on a busy machine a second is not always enough.
configure({ asyncUtilTimeout: 5000 });

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
// (used internally by Table/Select/Menu dropdowns) and by React Flow, which
// measures its nodes with it. The stub reports each observed element once,
// which is what makes React Flow record a node's size and draw its edges.
class ResizeObserverStub {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    // Every element "measures" 1000×600: jsdom has no layout to ask
    const box = { inlineSize: 1000, blockSize: 600 };
    const entry = {
      target,
      contentRect: { x: 0, y: 0, top: 0, left: 0, width: 1000, height: 600, right: 1000, bottom: 600 },
      borderBoxSize: [box],
      contentBoxSize: [box],
      devicePixelContentBoxSize: [box],
    } as unknown as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }

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

// ---------------------------------------------------------------------------
// React Flow in jsdom (https://reactflow.dev/learn/advanced-use/testing).
// jsdom lays nothing out, so every element measures 0×0 and React Flow never
// considers a node measured. Give elements a size and the geometry classes it
// reads. This makes nodes, handles and edges render; it does not make pointer
// gestures (drag, connect, reconnect) meaningful — those are tested as the
// pure functions the canvas hands them to.
// ---------------------------------------------------------------------------

class DOMMatrixReadOnlyStub {
  m22: number;

  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([\d.]+)\)/)?.[1];
    this.m22 = scale === undefined ? 1 : Number(scale);
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).DOMMatrixReadOnly = DOMMatrixReadOnlyStub;

Object.defineProperties(globalThis.HTMLElement.prototype, {
  offsetHeight: {
    get(this: HTMLElement) {
      return Number.parseFloat(this.style.height) || 1;
    },
  },
  offsetWidth: {
    get(this: HTMLElement) {
      return Number.parseFloat(this.style.width) || 1;
    },
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis.SVGElement.prototype as any).getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });
