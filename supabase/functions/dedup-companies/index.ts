/**
 * One-time Company Deduplication Edge Function
 *
 * Run this once to merge duplicate companies.
 * Duplicates are identified by: business_name + billing_city + billing_state (case-insensitive)
 *
 * Usage:
 *   POST /dedup-companies
 *   Body: { "dryRun": true }  - Preview what would be merged
 *   Body: { "dryRun": false } - Execute the merge
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://api.printyx.net';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Tenant ID to process
const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

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
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default to dry run for safety

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    console.log(`[DEDUP] Starting deduplication for tenant ${TENANT_ID}, dryRun=${dryRun}`);

    // 1. Fetch all companies
    const { data: allCompanies, error: fetchError } = await admin
      .from('companies')
      .select('*')
      .eq('tenant_id', TENANT_ID)
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
            .eq('tenant_id', TENANT_ID)
            .select('id');

          if (contactError) {
            console.error(`[DEDUP] Error moving contacts: ${contactError.message}`);
          }

          // Move activities
          const { data: movedActivities, error: activityError } = await admin
            .from('business_record_activities')
            .update({ company_id: group.survivorId, updated_at: new Date().toISOString() })
            .in('company_id', group.duplicateIds)
            .eq('tenant_id', TENANT_ID)
            .select('id');

          if (activityError) {
            console.error(`[DEDUP] Error moving activities: ${activityError.message}`);
          }

          // Delete duplicates
          const { error: deleteError } = await admin
            .from('companies')
            .delete()
            .in('id', group.duplicateIds)
            .eq('tenant_id', TENANT_ID);

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

    return new Response(JSON.stringify(results, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('[DEDUP] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
