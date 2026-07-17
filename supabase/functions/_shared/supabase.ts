// Shared Supabase client for Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { cachedGetUser } from './auth-cache.ts';

/**
 * AUDIT-005: 214 of the 255 function dirs call `createSupabaseClient(req)` and then
 * `auth.getUser(jwt)`, paying an HTTP round-trip to GoTrue before any real work — on
 * every single request. Rather than edit 214 call sites, the cache is installed HERE,
 * at the shared factory every one of them already goes through, so they all get it
 * with zero call-site changes and no behavioral difference on a miss.
 *
 * Only the explicit-token form `getUser(jwt)` is cached. A no-argument `getUser()`
 * resolves against the client's own session/header state, which we are not keying on,
 * so it is passed straight through uncached rather than risk returning the wrong user.
 *
 * See _shared/auth-cache.ts for the TTL/revocation tradeoff.
 */
// Generic over the concrete client type: `ReturnType<typeof createClient>` with no
// type args resolves to SupabaseClient<unknown, never, ...>, which the real client is
// NOT assignable to, so constraining to it fails to typecheck.
function withCachedGetUser<T extends { auth: unknown }>(client: T): T {
  const auth = client.auth as {
    getUser: (jwt?: string) => Promise<{ data: { user: unknown } | null; error: unknown }>;
  };
  const original = auth.getUser.bind(auth);
  auth.getUser = async (jwt?: string) => {
    if (typeof jwt !== 'string' || jwt.length === 0) return await original(jwt);
    const { data, error } = await cachedGetUser({ auth: { getUser: original } }, jwt, {
      getEnv: (k) => {
        try {
          return Deno.env.get(k);
        } catch {
          return undefined;
        }
      },
    });
    return { data, error } as { data: { user: unknown } | null; error: unknown };
  };
  return client;
}

export const createSupabaseClient = (req: Request) => {
  const client = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    },
  );
  return withCachedGetUser(client);
};

export const createSupabaseServiceClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
};
