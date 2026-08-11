import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Inject the real stylesheet so computed styles (display:none hidden-tab
    // pattern, responsive swaps) behave in RTL queries.
    css: true,
  },
});
