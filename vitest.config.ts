import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Kept separate from vite.config.ts: Vitest bundles its own copy of Vite, and
 * merging the two configs makes TypeScript see two different Plugin types.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    // jsdom for the render smoke tests; the pure-logic suites do not care.
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
    reporters: ['default'],
  },
});
