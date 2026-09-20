// Sales Territories Edge Function
// Handles sales territory management and lead assignment rules
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import { buildTerritoryIndex, territoryCoverage } from '../_shared/territory.ts';
import { territoryMembership } from '../../../shared/territory-membership.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'sales-territories');
    const territoryId = parts[0];

    // ─── GET /coverage (COP-B09) ─────────────────────────────────────
    //
    // BRANCHES BEFORE territoryId IS USED, or /coverage is looked up as a
    // territory whose id is the string "coverage" and 404s - the SUPA-024
    // shape, where a real endpoint dies inside a generic :id branch.
    //
    // A territory model that silently drops the accounts it does not cover
    // gives a manager a roll-up that looks complete and is not. This is the
    // admin's worklist: what resolved, what names a territory nobody defined,
    // and what names nothing at all - the last two being different problems
    // with different fixes.
    if (territoryId === 'coverage' && req.method === 'GET') {
      const [territories, accounts] = await Promise.all([
        fetchAllRows<Record<string, any>>(() =>
          admin
            .from('sales_territories')
            .select('id, territory_name, territory_code, is_active')
            .eq('tenant_id', tenantId),
        ),
        fetchAllRows<Record<string, any>>(() =>
          admin.from('business_records').select('id, territory').eq('tenant_id', tenantId),
        ),
      ]);

      const index = buildTerritoryIndex((territories ?? []).filter((t) => t.is_active !== false));
      const coverage = territoryCoverage(accounts ?? [], index);

      return createCorsResponse(
        {
          ...coverage,
          territoriesDefined: (territories ?? []).length,
          unbacked: [
            'Territory is resolved from the free-text business_records.territory column by matching a territory name or code. Nothing rewrites that column, so an account naming an undefined territory shows above rather than being reassigned.',
          ],
        },
        200,
        req,
      );
    }

    /**
     * THE WHOLE CRUD SURFACE WAS BUILT AGAINST A TABLE THAT DOES NOT EXIST
     * (COP-B03's regression sweep). `sales_territories` has territory_name,
     * territory_code, territory_type, description, geographic_rules,
     * account_rules, is_active, priority, owner_id and manager_id. This
     * function named `name`, `region`, `states`, `zip_codes`, `rules`,
     * `assigned_rep_id` and `created_by` - seven columns, every one absent,
     * every branch a guaranteed 42703.
     *
     * It survived because nothing called the function: it sat in
     * docs/unreferenced-edge-fns-baseline.json and its phantom columns sat in
     * docs/phantom-columns-baseline.json, and the two entries were true at the
     * same time for the same reason. COP-B09 wired a page to it, which turned
     * seven baselined references into seven live 500s, and
     * server/tests/unit/phantom-cols-reachable-zero.test.ts is what said so.
     * That test is the point: a phantom column is tolerable only while nobody
     * can reach it, so wiring a caller is what makes it a defect.
     */
    const TERRITORY_COLUMNS =
      // COP-B09 AC5: monthly_quota is a real column that nothing could set and
      // nothing read - a number somebody can store and never see is AUDIT-028's
      // shape from the other end. The forecast's territory roll-up reports
      // attainment against it.
      // COP-B09 AC3: `team_members` was absent from this list, so a
      // territory's additional reps were invisible to every reader and
      // "whose territory is this" could only ever answer the primary owner.
      'id, tenant_id, territory_name, territory_code, territory_type, description, geographic_rules, account_rules, is_active, priority, owner_id, manager_id, team_members, monthly_quota, created_at, updated_at';

    // GET /sales-territories - List territories
    if (req.method === 'GET' && !territoryId) {
      const { data: territories, error } = await admin
        .from('sales_territories')
        .select(TERRITORY_COLUMNS)
        .eq('tenant_id', tenantId)
        .order('territory_name', { ascending: true });

      if (error) {
        console.error('Error fetching territories:', error);
        return createCorsResponse({ error: 'Failed to fetch territories' }, 500, req);
      }

      return createCorsResponse(territories || [], 200, req);
    }

    /**
     * GET /sales-territories/mine - COP-B09 AC3.
     *
     * "Reps see their territory by default" needs an answer to which
     * territory is theirs, and this table carries three relationships that
     * look like one from a distance: `owner_id` is the primary rep,
     * `team_members` the others working it, and `manager_id` the person it
     * REPORTS TO. Only the first two are somebody's book -
     * `shared/territory-membership.ts` has the reasoning and the tests.
     *
     * Matched before the `/:id` branch, or `territoryId` reads "mine" as a
     * uuid and answers 404 (SUPA-024).
     */
    if (req.method === 'GET' && territoryId === 'mine') {
      const { data: rows, error } = await admin
        .from('sales_territories')
        .select(TERRITORY_COLUMNS)
        .eq('tenant_id', tenantId)
        .order('territory_name', { ascending: true });

      if (error) {
        console.error('Error resolving territory membership:', error);
        return createCorsResponse({ error: 'Failed to resolve territories' }, 500, req);
      }

      const all = (rows ?? []) as Array<Record<string, unknown>>;
      const membership = territoryMembership(
        all.map((t) => ({
          id: String(t.id),
          ownerId: (t.owner_id as string) ?? null,
          teamMembers: (t.team_members as string[]) ?? null,
          managerId: (t.manager_id as string) ?? null,
          isActive: t.is_active as boolean,
        })),
        user.id,
      );

      const byId = new Map(all.map((t) => [String(t.id), t]));
      return createCorsResponse(
        {
          ...membership,
          // The switcher needs names, not ids. Only the territories this
          // person has some relationship with - the full list is the other
          // endpoint, and a manager rolling up uses ?territory=all.
          territories: membership.allTerritoryIds.map((id) => byId.get(id)).filter(Boolean),
        },
        200,
        req,
      );
    }

    // GET /sales-territories/:id - Get single territory
    if (req.method === 'GET' && territoryId) {
      const { data: territory, error } = await admin
        .from('sales_territories')
        .select(TERRITORY_COLUMNS)
        .eq('id', territoryId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Territory not found' }, 404, req);
      }

      return createCorsResponse(territory, 200, req);
    }

    // POST /sales-territories - Create territory
    if (req.method === 'POST' && !territoryId) {
      const body = await req.json().catch(() => ({}));
      const territoryName = body.territoryName ?? body.territory_name ?? body.name;
      if (!territoryName) {
        // territory_name is NOT NULL. Saying so beats a 500 from the database.
        return createCorsResponse({ error: 'A territory name is required' }, 400, req);
      }

      const { data: territory, error } = await admin
        .from('sales_territories')
        .insert({
          tenant_id: tenantId,
          territory_name: String(territoryName),
          territory_code: body.territoryCode ?? body.territory_code ?? null,
          // NOT NULL with no database default, so the create has to carry one.
          territory_type: body.territoryType ?? body.territory_type ?? 'geographic',
          description: body.description ?? null,
          geographic_rules: body.geographicRules ?? body.geographic_rules ?? null,
          account_rules: body.accountRules ?? body.account_rules ?? null,
          is_active: body.isActive ?? body.is_active ?? true,
          owner_id: body.ownerId ?? body.owner_id ?? null,
          manager_id: body.managerId ?? body.manager_id ?? null,
          // Null, not zero: a territory with no quota set has not been given a
          // target of nothing, and attainment against zero is undefined.
          monthly_quota: body.monthlyQuota ?? body.monthly_quota ?? null,
        })
        .select(TERRITORY_COLUMNS)
        .single();

      if (error) {
        console.error('Error creating territory:', error);
        return createCorsResponse({ error: 'Failed to create territory' }, 500, req);
      }

      return createCorsResponse(territory, 201, req);
    }

    // PUT /sales-territories/:id - Update territory
    if (req.method === 'PUT' && territoryId) {
      const body = await req.json().catch(() => ({}));
      // Only the fields the caller actually sent. A blanket object would write
      // null over every column a partial form left out.
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const set = (column: string, ...candidates: unknown[]) => {
        const value = candidates.find((v) => v !== undefined);
        if (value !== undefined) patch[column] = value;
      };
      set('territory_name', body.territoryName, body.territory_name, body.name);
      set('territory_code', body.territoryCode, body.territory_code);
      set('territory_type', body.territoryType, body.territory_type);
      set('description', body.description);
      set('geographic_rules', body.geographicRules, body.geographic_rules);
      set('account_rules', body.accountRules, body.account_rules);
      set('is_active', body.isActive, body.is_active);
      set('owner_id', body.ownerId, body.owner_id);
      set('manager_id', body.managerId, body.manager_id);
      set('monthly_quota', body.monthlyQuota, body.monthly_quota);

      const { data: territory, error } = await admin
        .from('sales_territories')
        .update(patch)
        .eq('id', territoryId)
        .eq('tenant_id', tenantId)
        .select(TERRITORY_COLUMNS)
        .single();

      if (error) {
        console.error('Error updating territory:', error);
        return createCorsResponse({ error: 'Failed to update territory' }, 500, req);
      }

      return createCorsResponse(territory, 200, req);
    }

    // DELETE /sales-territories/:id - Delete territory
    if (req.method === 'DELETE' && territoryId) {
      const { error } = await admin
        .from('sales_territories')
        .delete()
        .eq('id', territoryId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete territory' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Territory deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in sales-territories function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
