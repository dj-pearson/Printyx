// Isolated security lint config (PA-048).
//
// The `Static Security Analysis` job in security-scan.yml runs ESLint with
// `--max-warnings 0` to fail on dynamic-code-execution sinks. Running that
// against the full eslint.config.js would drown the signal in the large
// pre-existing style/type backlog (any warning trips --max-warnings 0). This
// config is passed explicitly (`--config eslint.security.config.js`), which
// REPLACES the default config, so ONLY the security rules run — over .ts/.tsx
// as well as plain JS, since it wires in the TypeScript parser.
//
// Scope: exactly the dynamic-code-execution sinks the static-security gate has
// always enforced (no-eval / no-implied-eval / no-new-func). The repo is clean
// of these today, so the gate is green now and fails only on a NEW sink. Other
// security-relevant rules (e.g. no-script-url, which has pre-existing findings)
// live in eslint.config.js under the ratcheted `npm run check:lint`.
//
// Runs with `--no-inline-config` (see security-scan.yml) so an inline
// `// eslint-disable-next-line no-eval` comment cannot silence the gate — a
// security property, and it also means directives for rules this isolated
// config does not load never surface as "unused directive" / "definition not
// found" noise.
//
// Usage (see security-scan.yml):
//   npx eslint . --config eslint.security.config.js --no-inline-config --max-warnings 0
import tsParser from '@typescript-eslint/parser';

const securityRules = {
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
};

export default [
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'coverage/**',
      'ios/**',
      'android/**',
      'attached_assets/**',
      'database-exports/**',
      'database/**',
      'documents/**',
      'drizzle/**',
    ],
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: securityRules,
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: securityRules,
  },
];
