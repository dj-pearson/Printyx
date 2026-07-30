import { defineConfig } from 'vitest/config';
import path from 'path';

// Test-runner ownership (PROD-002).
//
// This repo contains THREE independent test systems, and vitest used to declare
// no include/exclude — so its default glob swept up all three and 19 files were
// permanently red for reasons that had nothing to do with the product:
//
//   - 10 Playwright specs under tests/ died with "Playwright Test did not expect
//     test() to be called here"
//   - 6 files under mobile/ and printyx-client/ are sub-packages with their own
//     runners and their own dependencies
//
// That buried the genuine failures and is why the suite was neither trusted nor
// CI-gated. The split is by EXTENSION, not directory, because tests/ legitimately
// holds both: tests/blog-e2e-smoke.test.ts is a passing vitest test that lives
// next to the Playwright specs.
//
//   *.test.ts  -> vitest   (this file)
//   *.spec.ts  -> Playwright (playwright.config.ts, testMatch pinned to *.spec.ts)
//
// Keep those two patterns mutually exclusive. Before this, Playwright's default
// testMatch also matched *.test.ts, so blog-e2e-smoke was owned by BOTH runners.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./server/tests/setup.ts'],
    include: ['server/**/*.test.ts', 'client/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Playwright owns these — running them here throws at collection.
      '**/*.spec.ts',
      // Sub-packages with their own runners, dependencies and configs.
      'mobile/**',
      'printyx-client/**',
    ],
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
