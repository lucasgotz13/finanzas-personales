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

// RTL auto-cleanup requires globals; register it explicitly instead.
afterEach(() => {
  cleanup();
});
