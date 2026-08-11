import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
// The real stylesheet makes the CSS hidden-tab pattern (display:none) and the
// responsive tab/bottom-bar swap visible to RTL's accessibility queries.
import '../index.css';

// RTL auto-cleanup requires globals; register it explicitly instead.
afterEach(() => {
  cleanup();
});
