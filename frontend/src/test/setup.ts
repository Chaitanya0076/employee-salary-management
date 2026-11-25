import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Pages are lazy-loaded; on a cold start under parallel workers the first import can
// exceed Testing Library's 1s default. findBy*/waitFor still resolve as soon as possible.
configure({ asyncUtilTimeout: 5000 });

// jsdom gaps that Radix UI (menus, sheets) relies on.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
