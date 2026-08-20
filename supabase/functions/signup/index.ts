// Signup Edge Function
// Creates tenant, user, and sends verification email
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

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

    // Create admin client (service role for tenant creation)
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
            'The COMPANY_ADMIN role is not present in this environment, so a tenant administrator cannot be assigned. Run the RBAC seed and retry.',
          code: 'MISSING_ADMIN_ROLE',
        },
        500,
        req,
      );
    }

    const roleId: string = adminRole.id;

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
