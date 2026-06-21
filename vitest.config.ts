import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./server/tests/setup.ts'],
    // Vitest owns the server unit/integration suites only. Playwright e2e specs
    // (tests/**) and the standalone mobile/ and printyx-client/ packages have
    // their own runners and must not be collected here.
    include: ['server/tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', 'tests/**', 'mobile/**', 'printyx-client/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'server/tests/**', '**/*.test.ts', '**/*.spec.ts'],
      thresholds: {
        // Enforce 50% coverage for newly added files
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
        // Only apply thresholds to new test helper files (not legacy code)
        perFile: false,
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
});
