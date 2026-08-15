import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
// The real stylesheet makes the CSS hidden-tab pattern (display:none) and the
// responsive tab/bottom-bar swap visible to RTL's accessibility queries.
import '../index.css';

// jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one. The
// mock reports a fixed 600×200 box on observe so charts actually render in
// tests (deterministic paths and tooltips).
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverMock {
    private callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element): void {
      this.callback(
        [{ target, contentRect: { width: 600, height: 220 } } as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverMock;
}

// jsdom has no matchMedia; the inline head theme script uses it in the
// browser, but tests drive the theme through <html data-theme> directly.
// The mock supports the standard surface so tests can flip the system
// preference and see registered listeners notified.
let systemDark = false;
const mediaListeners = new Set<(event: { matches: boolean }) => void>();

export function setSystemDark(dark: boolean): void {
  systemDark = dark;
  mediaListeners.forEach((listener) => listener({ matches: dark }));
}

if (typeof globalThis.matchMedia === 'undefined') {
  globalThis.matchMedia = ((query: string): MediaQueryList =>
    ({
      matches: systemDark,
      media: query,
      onchange: null,
      addEventListener: (type: string, listener: (event: { matches: boolean }) => void) => {
        if (type === 'change') mediaListeners.add(listener);
      },
      removeEventListener: (type: string, listener: (event: { matches: boolean }) => void) => {
        if (type === 'change') mediaListeners.delete(listener);
      },
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof globalThis.matchMedia;
}

// RTL auto-cleanup requires globals; register it explicitly instead.
afterEach(() => {
  cleanup();
  // Theme tests mutate <html data-theme> and localStorage; reset both so no
  // test leaks its theme into the next one.
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});
