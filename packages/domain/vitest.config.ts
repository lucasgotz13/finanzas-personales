import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { fs: { allow: ['../../'] } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
