// Signup Edge Function
// Creates tenant, user, and sends verification email
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { buildRoleClaims, claimsPatch } from '../_shared/role-claims.ts';
import {
  DEFAULT_SIGNUP_LIMITS,
  signupBuckets,
  signupThrottleDecision,
  windowStart,
} from '../../../shared/public-throttle.ts';

interface SignupRequest {
  email: string;
  password: string;
  metadata: {
    companyName: string;
    industry?: string;
    companySize?: string;
    website?: string;
    firstName: string;
    lastName: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country: string;
    timezone: string;
    planSlug: string;
    billingCycle: 'monthly' | 'annual';
  };
}

// Password policy — mirrors server/auth-routes.ts passwordSchema so production
// self-service signup can't accept weaker passwords than the app documents
// (GoTrue's default minimum is only 6). PA-006.
function validatePasswordComplexity(password: string): string | null {
  if (password.length < 12) return 'Password must be at least 12 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character';
  return null;
}

/**
 * Abuse controls for a surface with no JWT in front of it (LAUNCH-010).
 *
 * This endpoint creates a tenant, a GoTrue user and a `users` row, and asks
 * GoTrue to email a verification link to whatever address it was handed. Until
 * the signup page was pointed at it, nothing called it and there was nothing to
 * abuse; giving it its first caller is what makes a throttle necessary rather
 * than tidy.
 *
 * DB-BACKED, NOT THE IN-MEMORY LIMITER. `_shared/rate-limit.ts` says in its own
 * header that it is per-Deno-instance and that hard multi-instance limits want a
 * database counter. A per-instance cap on account creation is worth what one
 * isolate's memory is worth, which is nothing against a caller that reconnects.
 * `public_booking_attempts` is that counter: one row per attempt, counted over a
 * window, so two invocations racing cannot lose an update the way a read-then-
 * increment counter can. The table's name says booking and its shape says
 * nothing of the sort - `bucket` plus `created_at`, no tenant, no page - and its
 * prune sweep is prefix-agnostic, so a second surface namespaces its buckets and
 * shares it rather than adding a table for four columns.
 */
// deno-lint-ignore no-explicit-any
type AttemptClient = any;

const ATTEMPTS_TABLE = 'public_booking_attempts';

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** One row per attempt. Appends cannot lose an update the way a counter can. */
async function recordAttempt(
  db: AttemptClient,
  buckets: string[],
  rejectedReason: string | null,
): Promise<void> {
  const { error } = await db
    .from(ATTEMPTS_TABLE)
    .insert(buckets.map((bucket) => ({ bucket, rejected_reason: rejectedReason })));
  // A throttle that cannot record must not refuse a real signup, but it must
  // say so - silently failing open is how a control stops existing.
  if (error) console.error('[signup] attempt record failed', error.message);
}

async function countSince(db: AttemptClient, bucket: string, since: Date): Promise<number> {
  const { count, error } = await db
    .from(ATTEMPTS_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('bucket', bucket)
    .gte('created_at', since.toISOString());
  if (error) {
    console.error('[signup] attempt count failed', error.message);
    // Counting failed, so nothing is known about this source. Allowing is the
    // deliberate choice: refusing every registration because a count query
    // broke turns a throttle into an outage on the one path that onboards
    // customers.
    return 0;
  }
  return count ?? 0;
}

// Export handler for use by the main server router
export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only allow POST
  if (req.method !== 'POST') {
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  }

  try {
    // Parse request body
    const { email, password, metadata }: SignupRequest = await req.json();

    // Validate required fields
    if (
      !email ||
      !password ||
      !metadata?.companyName ||
      !metadata?.firstName ||
      !metadata?.lastName
    ) {
      return createCorsResponse(
        { error: 'Missing required fields: email, password, companyName, firstName, lastName' },
        400,
        req,
      );
    }

    // Enforce the documented password complexity policy (PA-006).
    const passwordError = validatePasswordComplexity(password);
    if (passwordError) {
      return createCorsResponse({ error: passwordError }, 400, req);
    }

    // ── LAUNCH-010: rate limit before anything is written or emailed ──
    //
    // AFTER validation and BEFORE the first write, on purpose. A malformed body
    // costs nothing - no row, no email - so letting it through unlimited is
    // fine, while charging it against a real person's budget is not: three
    // fat-fingered passwords must not lock somebody out of registering.
    //
    // THE HONEYPOT IS DELIBERATELY NOT WIRED HERE. public-booking passes
    // `b.website` to botSignals because its form has no such field. THIS form
    // has one - the company website, on step 1 - so copying that call verbatim
    // would refuse every registration from a company that filled its website
    // in. The rate limit below is the control that is worth something anyway;
    // the module's own header says the honeypot stops commodity bots and
    // nothing else.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const now = new Date();
    const since = windowStart(now, DEFAULT_SIGNUP_LIMITS.windowSeconds);
    const buckets = await signupBuckets(req.headers.get('x-forwarded-for'), email, sha256Hex);
    const [sourceAttempts, emailAttempts, surfaceAttempts] = await Promise.all([
      countSince(supabaseAdmin, buckets.source, since),
      countSince(supabaseAdmin, buckets.email, since),
      countSince(supabaseAdmin, buckets.surface, since),
    ]);
    const bucketList = [buckets.source, buckets.email, buckets.surface];
    const decision = signupThrottleDecision(
      sourceAttempts,
      emailAttempts,
      surfaceAttempts,
      DEFAULT_SIGNUP_LIMITS,
    );
    if (!decision.allowed) {
      await recordAttempt(supabaseAdmin, bucketList, 'rate_limited');
      // One message for all three reasons. Telling a caller whether it was
      // their address, the address they named or the whole surface tells them
      // which one to vary.
      return createCorsResponse(
        {
          error: 'Too many signup attempts. Please try again later.',
          code: 'SIGNUP_RATE_LIMITED',
          retryAfterSeconds: decision.retryAfterSeconds,
        },
        429,
        req,
      );
    }
    // Recorded BEFORE the work rather than after it, so an attempt that fails
    // halfway - a duplicate email, a rolled-back tenant - still counts. A
    // throttle that only counts successes is one a failing script never trips.
    await recordAttempt(supabaseAdmin, bucketList, null);

    // Step 1: Create tenant record
    const tenantId = crypto.randomUUID();
    // COP-M01: this insert named thirteen columns `tenants` does not have —
    // industry, company_size, website, address, city, state, zip, country,
    // timezone, plan_slug, billing_cycle, status and trial_ends_at — so it
    // failed outright and NOBODY COULD SIGN UP. The real columns are name, slug,
    // is_active, plan, subscription, billing_status and a metadata jsonb.
    //
    // The company profile goes in metadata, the same way the users insert below
    // already carries phone and status (PA-001). Doing it that way needs no
    // migration, which matters because COP-M00 records migration generation as
    // currently broken.
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days
    const { error: tenantError } = await supabaseAdmin.from('tenants').insert({
      id: tenantId,
      name: metadata.companyName,
      slug: metadata.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      is_active: true,
      plan: metadata.planSlug || null,
      billing_status: 'trial',
      metadata: {
        industry: metadata.industry || null,
        companySize: metadata.companySize || null,
        website: metadata.website || null,
        address: metadata.address || null,
        city: metadata.city || null,
        state: metadata.state || null,
        zip: metadata.zip || null,
        country: metadata.country ?? null,
        timezone: metadata.timezone ?? null,
        billingCycle: metadata.billingCycle ?? null,
        trialEndsAt,
        source: 'signup',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (tenantError) {
      console.error('Tenant creation error:', tenantError);
      return createCorsResponse(
        { error: 'Failed to create organization: ' + tenantError.message },
        500,
        req,
      );
    }

    // Step 2: Resolve the tenant administrator role.
    //
    // COP-M01: this used to look for a role with tenant_id = <new tenant> and,
    // finding none, INSERT one carrying tenant_id, is_system and updated_at.
    // `roles` has none of those columns — it is a GLOBAL table (id, name, code,
    // role_type, level, permissions, is_system_role, created_at), seeded by
    // `npm run seed:rbac`. So the lookup 42703'd, the insert failed, and signup
    // rolled the tenant back.
    //
    // Roles being global is a real design decision, not a bug to route around
    // here (role-management assumes the opposite and is left for that call), so
    // this resolves the seeded COMPANY_ADMIN role rather than inventing one.
    const { data: adminRole, error: roleLookupError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('code', 'COMPANY_ADMIN')
      .limit(1)
      .maybeSingle();

    if (roleLookupError || !adminRole?.id) {
      console.error('Admin role lookup error:', roleLookupError);
      await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
      return createCorsResponse(
        {
          error:
            'The COMPANY_ADMIN role is not present in this environment, so a tenant administrator cannot be assigned. The catalogue is seeded by migration 0072_seed_role_catalogue.sql - apply the migration chain and retry.',
          code: 'MISSING_ADMIN_ROLE',
        },
        500,
        req,
      );
    }

    const roleId: string = adminRole.id;

    // WF-R-03: the level, code and permission list the edge-function gates read.
    // Without them _shared/rbac.ts's getRoleLevel() defaults to 1 and the tenant
    // administrator this signup is creating is denied its own admin surfaces.
    // A null here means the seeded row has no level, which the migration makes
    // impossible; the claims are simply omitted rather than guessed at.
    const roleClaims = await buildRoleClaims(supabaseAdmin, roleId);

    // Step 3: Create Supabase Auth user with app_metadata
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // User needs to verify email
      user_metadata: {
        first_name: metadata.firstName,
        last_name: metadata.lastName,
        full_name: `${metadata.firstName} ${metadata.lastName}`,
        phone: metadata.phone || null,
      },
      app_metadata: {
        tenantId,
        roleId,
        accessScope: 'company', // Admin gets company-wide access
        isPlatformUser: false,
        ...(roleClaims ? claimsPatch(roleClaims) : {}),
      },
    });

    if (authError) {
      console.error('Auth user creation error:', authError);
      // Cleanup: delete the tenant (no role was created — the admin role is global)
      await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
      return createCorsResponse({ error: 'Failed to create user: ' + authError.message }, 500, req);
    }

    // Step 4: Create user record in users table (synced with auth.users)
    // Map ONLY to columns that exist on `users` (shared/schema.ts). The table has
    // no full_name / status / is_tenant_admin / phone columns — those are carried
    // in the `metadata` jsonb. Writing phantom columns previously caused a silent
    // PGRST204 that left the tenant with no admin profile row (PA-001).
    if (authData.user) {
      const { error: userRecordError } = await supabaseAdmin.from('users').insert({
        id: authData.user.id,
        tenant_id: tenantId,
        email: authData.user.email,
        first_name: metadata.firstName,
        last_name: metadata.lastName,
        role: 'admin', // legacy string role, kept for backward compatibility
        role_id: roleId,
        access_scope: 'company', // tenant admin gets company-wide access
        is_platform_user: false,
        is_active: true,
        metadata: {
          phone: metadata.phone || null,
          source: 'signup',
          isTenantAdmin: true,
          status: 'pending_verification',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (userRecordError) {
        // The users row is required for downstream tenant/role resolution; a
        // signup that can't create it is a half-provisioned tenant. Roll back
        // the auth user, role, and tenant so the caller can safely retry
        // (previously this was logged and swallowed — PA-001).
        console.error('User record creation error:', userRecordError);
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
        return createCorsResponse(
          { error: 'Failed to create user profile: ' + userRecordError.message },
          500,
          req,
        );
      }
    }

    // Step 5: Send verification email
    // Supabase automatically sends verification email when user is created with email_confirm: false
    // We can also explicitly trigger it:
    const { error: emailError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      options: {
        redirectTo: `${Deno.env.get('SITE_URL') || 'https://printyx.net'}/auth/callback`,
      },
    });

    if (emailError) {
      console.warn('Email link generation warning:', emailError);
      // Don't fail - user is created, they can request new verification
    }

    // Success response
    return createCorsResponse(
      {
        success: true,
        email: authData.user?.email,
        message: 'Account created. Please check your email to verify your account.',
        tenantId,
        userId: authData.user?.id,
      },
      201,
      req,
    );
  } catch (error) {
    console.error('Signup error:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
