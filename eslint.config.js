// ESLint v9+ flat config (PA-048).
//
// This replaces the former no-op config that ignored every .ts/.tsx file
// ("Skip TypeScript files due to parsing issues"). Because ESLint 9 loads the
// flat config and ignores the old .eslintrc.cjs, both the `Lint` (ci.yml) and
// `Static Security Analysis` (security-scan.yml) gates were passing without
// ever inspecting TypeScript. This config migrates the .eslintrc.cjs ruleset
// (typescript-eslint + react + react-hooks + core security rules) so those
// gates are real again.
//
// The repo carries a large pre-existing lint backlog, so CI does NOT gate on a
// clean run — `npm run check:lint` (scripts/check-lint.mjs) ratchets the
// problem count against docs/lint-baseline.json, exactly like the typecheck
// ratchet. Lower the baseline as debt is burned down; never raise it.
//
// Security rules run in isolation via eslint.security.config.js so the
// --max-warnings 0 static-security job is not drowned by style warnings.
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

const browserAndNodeGlobals = {
  // Browser
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  fetch: 'readonly',
  console: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  // Node
  process: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  global: 'readonly',
};

export default [
  // ── Global ignores ─────────────────────────────────────────
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'coverage/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/*.config.cjs',
      '**/*.config.mjs',
      'start-dev.js',
      // Deno runtime — checked by `deno check` / check:edge-paths, not ESLint.
      'supabase/functions/**',
      // Non-source trees.
      'ios/**',
      'android/**',
      'attached_assets/**',
      'database-exports/**',
      'database/**',
      'documents/**',
      'drizzle/**',
    ],
  },

  // ── Plain JS/JSX (build scripts, config helpers) ───────────
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserAndNodeGlobals,
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },

  // ── TypeScript / TSX (the surface that used to be skipped) ──
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: browserAndNodeGlobals,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,

      // Accessibility (CR-035). A CURATED set, not jsx-a11y's `recommended`.
      //
      // Running recommended over client/src reports 232 problems, and the tail
      // of it is noise this codebase would learn to ignore:
      //   heading-has-content / anchor-has-content fire on the shadcn
      //     primitives in components/ui, which forward children through a
      //     {...props} spread the rule cannot see — both are false positives.
      //   no-autofocus fires 10 times, every one of them a search dialog or an
      //     inline editor where focusing the field IS the interaction.
      //   no-noninteractive-tabindex fires on FocusManager.tsx, a component
      //     whose entire job is managing tabindex.
      // Enabling those alongside the real findings is how a lint rule becomes
      // something people disable. The four below each catch a defect an
      // assistive-technology user would actually hit, and anchor-is-valid
      // already found a real one: a wouter v2 <Link><a> nesting left in
      // PlatformCustomerSuccess, which emits a nested anchor under wouter 3.
      'jsx-a11y/label-has-associated-control': [
        'error',
        {
          // The shadcn wrappers ARE the form controls in this codebase; without
          // naming them the rule cannot see the <Input> nested inside a
          // <label><span>Name</span><Input/></label> and reports 41 correctly
          // associated labels as unlabelled. depth 3 is for the same reason:
          // the text sits under a <Button asChild><span> in the CSV-upload
          // labels, one level past the default.
          controlComponents: [
            'Input',
            'InputOTP',
            'Textarea',
            'TextareaWithCounter',
            'Select',
            'SelectTrigger',
            'Checkbox',
            'Switch',
            'RadioGroup',
            'RadioGroupItem',
            'Slider',
            'Calendar',
            'DateRangePicker',
            'InlineEdit',
          ],
          depth: 3,
        },
      ],
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/anchor-is-valid': 'error',

      // Core rules that overlap with typescript-eslint are disabled in favor
      // of the TS-aware versions (recommended does this; restated for clarity).
      'no-unused-vars': 'off',
      'no-undef': 'off', // the TS compiler owns undefined-symbol checking

      // Security-relevant core rules (also enforced in eslint.security.config.js).
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Turn prettier-conflicting formatting rules off (must stay last).
      ...prettier.rules,
    },
  },
];
