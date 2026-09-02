/**
 * WF-L-01: the equipment-lifecycle edge function must actually LOAD.
 *
 * It imported canTransition, getAvailableTransitions and getValidationRequirements
 * from ../_shared/equipment-lifecycle-transitions.ts and re-declared all three as
 * local functions in the same module. That is a JavaScript SyntaxError -
 * "Identifier 'canTransition' has already been declared" - so the file never
 * parsed. supabase/functions/server.ts loads each function inside a try/catch and
 * omits the ones that throw, so /api/equipment-lifecycle/* answered 404 "Function
 * not found" for the life of the file. The prefix is not proxied, so dev was served
 * by Express and never exercised it, and PA-052 recorded two of its endpoints as
 * done.
 *
 * WHY THE EXISTING TEST COULD NOT SEE IT: lifecycle-transitions-parity.test.ts
 * compares the shared module against the Node state machine by READING BOTH AS TEXT.
 * It never imports index.ts, so an unparseable index.ts is invisible to it. The first
 * test here imports the module and invokes its default export, which is what
 * distinguishes "the handler is correct" from "the handler exists".
 *
 * WHAT THIS RUNNER CANNOT REPRODUCE, stated so a green tick is not read as proof the
 * function boots: vitest transforms with esbuild, which TOLERATES the duplicate
 * declaration - running the first test against the pre-fix file still passes, because
 * the local copies were byte-identical to the shared ones. V8 does not tolerate it
 * (an ES module may not lexically declare a name its import already bound), and Deno
 * hands the module to V8. So the second test asserts the shape directly, and
 * scripts/check-edge-boot-load.mjs (WF-G-01) models the V8 rule across the whole tree;
 * both fail on the pre-fix file, and the first test alone does not.
 */

import { describe, it, expect, vi } from 'vitest';

// _shared/supabase.ts imports supabase-js from an https:// URL vitest cannot resolve
// and reads Deno.env at module scope, so it is replaced wholesale. The handler
// constructs the service client before dispatching on the path, so it is stubbed
// rather than omitted - but GET /stages is pure and queries nothing, which is what
// `from` throwing asserts.
vi.mock('../../../supabase/functions/_shared/supabase.ts', () => ({
  createSupabaseClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: 'user-1', app_metadata: { tenant_id: 'tenant-1' } } },
        error: null,
      }),
    },
  }),
  createSupabaseServiceClient: () => ({
    from: () => {
      throw new Error('GET /stages must not touch the database');
    },
  }),
}));

// cors.ts reads Deno.env inside its functions.
(globalThis as { Deno?: unknown }).Deno = { env: { get: () => undefined } };

describe('WF-L-01: equipment-lifecycle imports cleanly and answers', () => {
  it('GET /stages returns 200 with the stage list and its transitions', async () => {
    // The import itself is the assertion that matters: before the fix this threw
    // at parse time and the dispatcher silently dropped the function.
    const mod = await import('../../../supabase/functions/equipment-lifecycle/index.ts');
    expect(typeof mod.default).toBe('function');

    // server.ts strips the function-name segment before invoking the handler, so
    // the handler sees /stages.
    const res = await mod.default(
      new Request('https://functions.printyx.net/stages', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-jwt' },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const ordered = body.data.find((s: { value: string }) => s.value === 'ordered');
    expect(ordered).toBeDefined();
    expect(ordered.name).toBe('Ordered');
    // Sourced from the shared module, which is the point of the fix.
    expect(ordered.availableTransitions).toEqual(['received', 'retired']);

    const disposed = body.data.find((s: { value: string }) => s.value === 'disposed');
    expect(disposed.availableTransitions).toEqual([]);
  });

  it('declares the lifecycle helpers exactly once, from the shared module', async () => {
    const { readFileSync } = await import('fs');
    const src = readFileSync('supabase/functions/equipment-lifecycle/index.ts', 'utf8');

    // Absence assertions are run against comment-stripped source: the header above
    // and the ones in the file name these identifiers, and a check that matched its
    // own explanation would report the explanation as the defect.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

    for (const name of ['canTransition', 'getAvailableTransitions', 'getValidationRequirements']) {
      expect(code).not.toMatch(new RegExp(`function\\s+${name}\\s*\\(`));
    }
    // The transition graph and its requirement lists live in one place.
    expect(code).not.toMatch(/const\s+VALID_TRANSITIONS/);
    expect(code).not.toMatch(/const\s+VALIDATIONS/);
    expect(code).not.toMatch(/const\s+LIFECYCLE_STAGES/);
    expect(code).toMatch(/from\s+'\.\.\/_shared\/equipment-lifecycle-transitions\.ts'/);
  });
});
