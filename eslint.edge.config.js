// Undefined and unused identifiers in the Deno edge tree (COP-B04).
//
// WHY THIS EXISTS. `supabase/functions/**` is ignored by eslint.config.js, whose
// comment says it is "checked by `deno check` / check:edge-paths, not ESLint".
// Neither does this job: there is no deno.json anywhere and no deno step in CI,
// and check:edge-paths only checks path normalization. So nothing in this repo
// has ever told anyone that an edge function names an identifier that does not
// exist - and Deno is outside the tsc project, so it is a ReferenceError the
// first time the code path runs rather than a compile error.
//
// That is not hypothetical. `opportunity-radar`'s runScan resolved its settings,
// computed its thresholds, and returned `{ detected: drafts.length, created:
// inserted, machinesScanned: equipment.length }` - three identifiers never
// declared in the function. It fetched nothing and never called the detector it
// imported. Both entry points threw, the nightly sweep's per-tenant catch
// recorded the failure and stepped over it, and the radar detected nothing from
// the day it shipped while looking finished from every angle. `no-unused-vars`
// would have flagged the assigned-and-never-read `thresholds` that gave it away;
// `no-undef` would have named the three directly.
//
// SCOPE IS DELIBERATELY TWO RULES. The edge tree has thousands of pre-existing
// style and `any` findings (CLAUDE.md records that `deno lint`'s no-explicit-any
// is unenforced here and the whole tree uses `any` on untyped supabase rows), so
// loading anything broader drowns the signal and the gate stops being run. This
// config REPLACES the default one and is passed explicitly, the same shape
// eslint.security.config.js uses for the same reason.
//
// Usage:  npm run check:edge-undef
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: false } },
      globals: {
        // Deno's runtime surface, as used across this tree. Declared rather
        // than pulled from a shared globals package so the list is reviewable:
        // a name that is not here is one nothing in the tree should be calling.
        Deno: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        FormData: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        ReadableStream: 'readonly',
        WritableStream: 'readonly',
        TransformStream: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        crypto: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        queueMicrotask: 'readonly',
        structuredClone: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        performance: 'readonly',
        globalThis: 'readonly',
        process: 'readonly',
        // TypeScript lib types used in annotations. `no-undef` cannot tell a
        // type position from a value one, so a type name absent here is
        // reported as undefined - a false positive, not a finding.
        CryptoKey: 'readonly',
        RequestInit: 'readonly',
        ResponseInit: 'readonly',
        BodyInit: 'readonly',
        HeadersInit: 'readonly',
        BufferSource: 'readonly',
        BlobPart: 'readonly',
        ArrayBufferLike: 'readonly',
        RequestInfo: 'readonly',
        EventSource: 'readonly',
        WebSocket: 'readonly',
        NodeJS: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      // The COP-B04 tell. A variable computed and never read is usually a body
      // that was removed or never written; args and caught errors are noise
      // here, so only locals count.
      'no-unused-vars': [
        'error',
        {
          vars: 'local',
          args: 'none',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
];
