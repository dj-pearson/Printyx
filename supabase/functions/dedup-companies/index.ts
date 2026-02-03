/**
 * One-time Company Deduplication Edge Function
 *
 * Run this once to merge duplicate companies.
 * Duplicates are identified by: business_name + billing_city + billing_state (case-insensitive)
 *
 * REQUIRES: Platform Admin or Service Role authentication
 *
 * Usage:
 *   POST /dedup-companies
 *   Headers: Authorization: Bearer <jwt>
 *   Body: { "dryRun": true, "tenantId": "..." }  - Preview what would be merged
 *   Body: { "dryRun": false, "tenantId": "..." } - Execute the merge
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://api.printyx.net';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface Company {
  id: string;
  tenant_id: string;
  business_name: string;
  billing_city: string | null;
  billing_state: string | null;
  phone: string | null;
  created_at: string | null;
}

interface DuplicateGroup {
  key: string;
  companies: Company[];
  survivorId: string;
  duplicateIds: string[];
}

function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

function createGroupKey(company: Company): string {
  const name = normalizeString(company.business_name);
  const city = normalizeString(company.billing_city);
  const state = normalizeString(company.billing_state);
  return `${name}|${city}|${state}`;
}

function selectSurvivor(companies: Company[]): Company {
  return companies.reduce((oldest, current) => {
    if (!oldest.created_at) return current;
    if (!current.created_at) return oldest;
    return new Date(current.created_at) < new Date(oldest.created_at) ? current : oldest;
  });
}

export default async function handler(req: Request): Promise<Response> {
  // CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  }

  try {
    // ============================================================================
    // AUTHENTICATION - Require Platform Admin or Service Role
    // ============================================================================
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!jwt) {
      return createCorsResponse({ error: 'Authorization header required' }, 401, req);
    }

    // Check if using service role key
    let isServiceRoleAuth = false;
    let isAuthorized = false;
    let tenantId: string | null = null;

    // Method 1: Check if JWT is the service role key itself
    if (jwt.trim() === SUPABASE_SERVICE_ROLE_KEY.trim()) {
      isServiceRoleAuth = true;
      isAuthorized = true;
    }

    // Method 2: Decode JWT and check for service_role claim
    if (!isServiceRoleAuth && jwt) {
      try {
        const payloadBase64 = jwt.split('.')[1];
        if (payloadBase64) {
          const payload = JSON.parse(atob(payloadBase64));
          if (payload.role === 'service_role') {
            isServiceRoleAuth = true;
            isAuthorized = true;
          }
        }
      } catch {
        // Not a valid JWT format, will check user auth below
      }
    }

    // Method 3: User JWT auth - check if platform admin
    if (!isAuthorized) {
      const supabase = createSupabaseClient(req);
      const { data: userData, error: userError } = await supabase.auth.getUser(jwt);

      if (userError || !userData.user) {
        return createCorsResponse({ error: 'Unauthorized - invalid token' }, 401, req);
      }

      const user = userData.user;
      const roleLevel = user.app_metadata?.roleLevel || user.user_metadata?.roleLevel || 0;

      // Require platform admin (level 8) for this destructive operation
      if (roleLevel < 8) {
        return createCorsResponse(
          { error: 'Forbidden - Platform Admin access required for company deduplication' },
          403,
          req,
        );
      }

      isAuthorized = true;
      tenantId =
        user.app_metadata?.tenantId ||
        user.app_metadata?.tenant_id ||
        user.user_metadata?.tenantId ||
        user.user_metadata?.tenant_id;
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default to dry run for safety

    // Get tenant ID from body if service role, otherwise use authenticated user's tenant
    if (isServiceRoleAuth) {
      tenantId = body.tenantId || body.tenant_id || req.headers.get('x-tenant-id');
    }

    if (!tenantId) {
      return createCorsResponse(
        { error: 'tenantId required in request body or x-tenant-id header' },
        400,
        req,
      );
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    console.log(`[DEDUP] Starting deduplication for tenant ${tenantId}, dryRun=${dryRun}`);

    // 1. Fetch all companies
    const { data: allCompanies, error: fetchError } = await admin
      .from('companies')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch companies: ${fetchError.message}`);
    }

    console.log(`[DEDUP] Found ${allCompanies?.length || 0} total companies`);

    // 2. Group by normalized key
    const groupMap = new Map<string, Company[]>();
    for (const company of allCompanies || []) {
      const key = createGroupKey(company);
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(company);
    }

    // 3. Find duplicate groups (count > 1)
    const duplicateGroups: DuplicateGroup[] = [];
    for (const [key, companies] of groupMap) {
      if (companies.length > 1) {
        const survivor = selectSurvivor(companies);
        duplicateGroups.push({
          key,
          companies,
          survivorId: survivor.id,
          duplicateIds: companies.filter((c) => c.id !== survivor.id).map((c) => c.id),
        });
      }
    }

    console.log(`[DEDUP] Found ${duplicateGroups.length} duplicate groups`);

    const results = {
      totalCompanies: allCompanies?.length || 0,
      duplicateGroups: duplicateGroups.length,
      totalDuplicates: duplicateGroups.reduce((sum, g) => sum + g.duplicateIds.length, 0),
      dryRun,
      groups: duplicateGroups.map((g) => ({
        name: g.key.split('|')[0],
        location: g.key.split('|').slice(1).join(', '),
        count: g.companies.length,
        survivorId: g.survivorId,
        duplicateCount: g.duplicateIds.length,
      })),
      mergeResults: [] as any[],
    };

    // 4. Execute merges if not dry run
    if (!dryRun) {
      for (const group of duplicateGroups) {
        try {
          // Move contacts
          const { data: movedContacts, error: contactError } = await admin
            .from('company_contacts')
            .update({ company_id: group.survivorId, updated_at: new Date().toISOString() })
            .in('company_id', group.duplicateIds)
            .eq('tenant_id', tenantId)
            .select('id');

          if (contactError) {
            console.error(`[DEDUP] Error moving contacts: ${contactError.message}`);
          }

          // Move activities
          const { data: movedActivities, error: activityError } = await admin
            .from('business_record_activities')
            .update({ company_id: group.survivorId, updated_at: new Date().toISOString() })
            .in('company_id', group.duplicateIds)
            .eq('tenant_id', tenantId)
            .select('id');

          if (activityError) {
            console.error(`[DEDUP] Error moving activities: ${activityError.message}`);
          }

          // Delete duplicates
          const { error: deleteError } = await admin
            .from('companies')
            .delete()
            .in('id', group.duplicateIds)
            .eq('tenant_id', tenantId);

          if (deleteError) {
            console.error(`[DEDUP] Error deleting duplicates: ${deleteError.message}`);
          }

          results.mergeResults.push({
            survivorId: group.survivorId,
            merged: group.duplicateIds.length,
            contactsMoved: movedContacts?.length || 0,
            activitiesMoved: movedActivities?.length || 0,
            success: !deleteError,
            error: deleteError?.message,
          });

          console.log(`[DEDUP] Merged ${group.duplicateIds.length} into ${group.survivorId}`);
        } catch (err: any) {
          results.mergeResults.push({
            survivorId: group.survivorId,
            merged: 0,
            success: false,
            error: err.message,
          });
        }
      }
    }

    return createCorsResponse(results, 200, req);
  } catch (error: any) {
    console.error('[DEDUP] Error:', error);
    return createCorsResponse({ error: error.message }, 500, req);
  }
}
