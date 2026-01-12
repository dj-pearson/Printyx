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
    const { error: tenantError } = await supabaseAdmin.from('tenants').insert({
      id: tenantId,
      name: metadata.companyName,
      slug: metadata.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      industry: metadata.industry || null,
      company_size: metadata.companySize || null,
      website: metadata.website || null,
      address: metadata.address || null,
      city: metadata.city || null,
      state: metadata.state || null,
      zip: metadata.zip || null,
      country: metadata.country,
      timezone: metadata.timezone,
      plan_slug: metadata.planSlug,
      billing_cycle: metadata.billingCycle,
      status: 'trial',
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
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

    // Step 2: Get or create default admin role for this tenant
    // First check if roles exist
    const { data: existingRole, error: roleCheckError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('name', 'Admin')
      .single();

    let roleId: string;

    if (roleCheckError || !existingRole) {
      // Create default admin role
      const newRoleId = crypto.randomUUID();
      const { error: roleError } = await supabaseAdmin.from('roles').insert({
        id: newRoleId,
        tenant_id: tenantId,
        name: 'Admin',
        description: 'Tenant administrator with full access',
        level: 7, // Admin level
        permissions: ['*'], // Full access
        is_system: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (roleError) {
        console.error('Role creation error:', roleError);
        // Cleanup: delete tenant
        await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
        return createCorsResponse(
          { error: 'Failed to create admin role: ' + roleError.message },
          500,
          req,
        );
      }
      roleId = newRoleId;
    } else {
      roleId = existingRole.id;
    }

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
      // Cleanup: delete tenant and role
      await supabaseAdmin.from('roles').delete().eq('id', roleId);
      await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
      return createCorsResponse({ error: 'Failed to create user: ' + authError.message }, 500, req);
    }

    // Step 4: Create user record in users table (synced with auth.users)
    if (authData.user) {
      const { error: userRecordError } = await supabaseAdmin.from('users').insert({
        id: authData.user.id,
        tenant_id: tenantId,
        email: authData.user.email,
        first_name: metadata.firstName,
        last_name: metadata.lastName,
        full_name: `${metadata.firstName} ${metadata.lastName}`,
        phone: metadata.phone || null,
        role_id: roleId,
        access_scope: 'company',
        status: 'pending_verification',
        is_tenant_admin: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (userRecordError) {
        console.error('User record creation error:', userRecordError);
        // Note: User is already created in auth, so we log but don't fail
        // The user can still login and the record can be synced later
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
