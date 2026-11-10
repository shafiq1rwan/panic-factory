import { defineConfig } from 'vitest/config';

// Relative base so the build can be hosted from any sub-path (Poki, itch, static hosts).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
  },
  server: { host: true, port: 5273 },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    testTimeout: 120000,
  },
});
