import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL auto-cleanup requires globals; register it explicitly instead.
afterEach(() => {
  cleanup();
});
