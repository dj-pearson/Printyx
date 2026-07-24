// Dedicated accessibility lint config (COMPLIANCE / WCAG).
//
// This runs eslint-plugin-jsx-a11y over the React source ONLY. It is kept
// SEPARATE from the main eslint.config.js ratchet on purpose: the main ratchet
// counts a large pre-existing backlog and must never grow, whereas this config
// is a focused, advisory a11y check that surfaces the specific keyboard/ARIA/
// label issues found in the compliance audit (WCAG 2.1.1, 3.3.2, 4.1.2) and
// prevents new ones from creeping into shared components.
//
// Run with: npm run lint:a11y
import tsParser from '@typescript-eslint/parser';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['client/src/**/*.{tsx,jsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    // react / react-hooks are registered (no rules enabled) only so that inline
    // `eslint-disable react-hooks/*` / `react/*` directives in the source resolve
    // and don't surface as "rule not found" noise in the a11y report.
    plugins: { 'jsx-a11y': jsxA11y, react: reactPlugin, 'react-hooks': reactHooks },
    linterOptions: {
      // Inline `eslint-disable` directives target the main config's rules; here
      // they're unused, so don't report them as noise in the a11y-only run.
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
];
