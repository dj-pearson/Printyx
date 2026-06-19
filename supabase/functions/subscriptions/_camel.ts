// Deep snake_case -> camelCase converter for subscription edge-function responses.
//
// WHY: the legacy Express routes (server/routes-subscriptions.ts) returned Drizzle
// rows, which are camelCase (billingCycle, trialEndDate, isFree, isTrialing, ...).
// The frontend hooks (client/src/hooks/useSubscription.ts) read those fields by
// camelCase name. supabase-js returns raw snake_case columns, so any edge response
// that mirrors an Express shape MUST be camelized or the React reads return
// undefined (same lesson as accounts-payable / signatures in CLAUDE.md).

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

/**
 * Recursively converts object keys from snake_case to camelCase. Arrays are mapped
 * element-wise; primitives (including ISO date strings) pass through untouched.
 * jsonb values (e.g. `features` string arrays, `metadata`) are recursed too, which
 * is harmless for the read paths here (the frontend never reads nested jsonb keys).
 */
export function toCamel<T = unknown>(input: unknown): T {
  if (Array.isArray(input)) {
    return input.map((v) => toCamel(v)) as unknown as T;
  }
  if (input !== null && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[snakeToCamel(k)] = toCamel(v);
    }
    return out as T;
  }
  return input as T;
}
