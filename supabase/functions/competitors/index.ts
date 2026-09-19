// Competitive knockout intelligence (COP-B10).
//
// The dealer was already capturing who they were up against -
// business_records.competitor_name, business_records.deactivation_reason =
// 'competitor_switch', and COP-M04's deals.incumbent_vendor - and surfacing it
// in no selling motion at all.
//
// Endpoints (the dispatcher strips the function-name segment first):
//   GET    /battlecards            list, admin-authored
//   POST   /battlecards            create           (manager+)
//   PUT    /battlecards/:id        update           (manager+)
//   DELETE /battlecards/:id        deactivate       (manager+)
//   GET    /for-deal/:dealId       the deal's competitive card
//   GET    /win-loss               win/loss by competitor
//   GET    /takeaway-targets       accounts lost to a competitor
//
// THE STORY'S OWN EVIDENCE LINE WAS WRONG, and check:phantom-cols caught it.
// COP-B10 cites `business_records.mainCompetitors (:1616)`. `main_competitors`
// is on `opportunities`, which carries an explicit @deprecated banner as a
// Salesforce-sync staging object (CRMX-002) - so reading it would bind new CRM
// work to a table docs/crm-canonical-model.md says not to build on, and it is
// not read here at all. What IS read is business_records.competitor_name, and
// it goes through splitCompetitorList because a free-text varchar holds
// whatever a rep typed, including 'Xerox, Ricoh'.
//
// TWO THINGS THAT DECIDE THE SHAPE OF THIS FILE.
//
// Nothing rewrites the four free-text columns. Resolution happens at read time
// through _shared/competitor.ts, so an admin creating a battlecard for 'Xerox'
// immediately claims every deal that says 'xerox', 'XEROX Corp.' or
// 'Xerox Corporation' without a migration touching a single stored string.
// The unmatched list on /win-loss is the admin's worklist.
//
// A WIN RATE OVER THREE DEALS IS AN ANECDOTE. summarizeWinLoss returns a null
// rate below MIN_DECIDED_FOR_RATE and the page says so rather than printing a
// number (AC6). Counts are always real, because counting is something three
// deals can support.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import { ROLE_LEVEL, RbacError, requireRoleLevel } from '../_shared/rbac.ts';
import type { AuthContext } from '../_shared/auth.ts';
import {
  COMPETITOR_CHURN_REASON,
  MIN_DECIDED_FOR_RATE,
  buildBattlecardIndex,
  normalizeCompetitorKey,
  resolveCompetitor,
  splitCompetitorList,
  summarizeWinLoss,
  unmatchedCompetitors,
  type BattlecardLike,
} from '../_shared/competitor.ts';

type Row = Record<string, any>;

/**
 * Authoring a battlecard is a management act; READING one is a rep's job, and
 * gating the read would defeat the point of the feature - a rep who cannot see
 * who they are up against is the status quo this story exists to end.
 *
 * A LEVEL check, not a permission code: per SEC-EDGE-002 the codes the Express
 * gates name are not the codes any seeder creates, so a copied permission gate
 * would deny everyone below platform admin.
 */
const AUTHOR_MIN_ROLE_LEVEL = ROLE_LEVEL.MANAGER;

function toCard(row: Row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    aliases: row.aliases ?? [],
    positioning: row.positioning ?? null,
    commonObjections: row.common_objections ?? [],
    whereWeWin: row.where_we_win ?? null,
    whereWeLose: row.where_we_lose ?? null,
    isActive: row.is_active !== false,
    updatedAt: row.updated_at ?? null,
  };
}

/** Validation mirrors the column widths, so a 400 beats a PostgREST error. */
function validateCard(body: Row): { values: Row } | { error: string } {
  const name = String(body.name ?? '').trim();
  if (!name) return { error: 'name is required' };
  if (name.length > 120) return { error: 'name must be 120 characters or fewer' };

  const slug = normalizeCompetitorKey(name);
  if (!slug) return { error: 'name must contain at least one letter or number' };

  const aliases = Array.isArray(body.aliases)
    ? [...new Set(body.aliases.map((a: unknown) => String(a ?? '').trim()).filter(Boolean))]
    : [];
  if (aliases.some((a: string) => a.length > 120)) {
    return { error: 'each alias must be 120 characters or fewer' };
  }

  let objections: Array<{ objection: string; response: string }> = [];
  if (body.commonObjections != null) {
    if (!Array.isArray(body.commonObjections)) {
      return { error: 'commonObjections must be an array of { objection, response }' };
    }
    objections = body.commonObjections
      .map((o: Row) => ({
        objection: String(o?.objection ?? '').trim(),
        response: String(o?.response ?? '').trim(),
      }))
      .filter((o) => o.objection || o.response);
  }

  return {
    values: {
      name,
      slug,
      aliases,
      positioning: body.positioning ? String(body.positioning) : null,
      common_objections: objections,
      where_we_win: body.whereWeWin ? String(body.whereWeWin) : null,
      where_we_lose: body.whereWeLose ? String(body.whereWeLose) : null,
      is_active: body.isActive === undefined ? true : Boolean(body.isActive),
    },
  };
}

async function loadBattlecards(admin: any, tenantId: string): Promise<BattlecardLike[]> {
  const rows = await fetchAllRows<Row>(() =>
    admin.from('competitor_battlecards').select('*').eq('tenant_id', tenantId),
  );
  return (rows ?? []).map((r) => ({ ...r, aliases: r.aliases ?? [] })) as BattlecardLike[];
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);
    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // requireRoleLevel reads the level off the JWT's app_metadata, which is
    // what every other level gate in the tree uses.
    const authCtx: AuthContext = {
      userId: user.id,
      tenantId,
      email: user.email,
      jwt: jwt ?? '',
      supabaseUser: user,
    };
    const assertCanAuthor = () => requireRoleLevel(authCtx, AUTHOR_MIN_ROLE_LEVEL);
    let canAuthor = true;
    try {
      assertCanAuthor();
    } catch {
      canAuthor = false;
    }

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'competitors');
    const resource = parts[0];
    const identifier = parts[1];

    // ─── /battlecards ────────────────────────────────────────────────
    if (resource === 'battlecards') {
      if (req.method === 'GET' && !identifier) {
        const cards = await loadBattlecards(admin, tenantId);
        return createCorsResponse(
          {
            data: cards
              .filter(
                (c) => url.searchParams.get('includeInactive') === 'true' || c.is_active !== false,
              )
              .map((c) => toCard(c as Row))
              .sort((a, b) => a.name.localeCompare(b.name)),
            canAuthor,
          },
          200,
          req,
        );
      }

      // Every write below goes through the shared gate, not through the
      // `canAuthor` flag - that flag exists to shape the UI, and a UI hint is
      // not an authorization check.
      if (req.method !== 'GET') {
        try {
          assertCanAuthor();
        } catch (err) {
          if (err instanceof RbacError) {
            return createCorsResponse(
              {
                error: 'Authoring battlecards requires a manager role',
                code: 'INSUFFICIENT_ROLE',
                details: err.details,
              },
              403,
              req,
            );
          }
          throw err;
        }
      }

      if (req.method === 'POST' && !identifier) {
        const body = (await req.json().catch(() => ({}))) as Row;
        const parsed = validateCard(body);
        if ('error' in parsed) return createCorsResponse({ error: parsed.error }, 400, req);

        const { data, error } = await admin
          .from('competitor_battlecards')
          .insert({
            tenant_id: tenantId,
            ...parsed.values,
            created_by: user.id,
            updated_by: user.id,
          })
          .select()
          .single();

        if (error) {
          // The tenant+slug unique index is the vocabulary doing its job: two
          // spellings of one competitor must not become two records.
          if (String(error.code) === '23505') {
            return createCorsResponse(
              {
                error: `A battlecard for ${parsed.values.name} already exists. Add the other spelling as an alias instead.`,
                code: 'DUPLICATE_COMPETITOR',
              },
              409,
              req,
            );
          }
          throw new Error(error.message);
        }
        return createCorsResponse(toCard(data as Row), 201, req);
      }

      if ((req.method === 'PUT' || req.method === 'PATCH') && identifier) {
        const body = (await req.json().catch(() => ({}))) as Row;
        const parsed = validateCard(body);
        if ('error' in parsed) return createCorsResponse({ error: parsed.error }, 400, req);

        const { data, error } = await admin
          .from('competitor_battlecards')
          .update({ ...parsed.values, updated_by: user.id, updated_at: new Date().toISOString() })
          .eq('id', identifier)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return createCorsResponse({ error: 'Battlecard not found' }, 404, req);
        return createCorsResponse(toCard(data as Row), 200, req);
      }

      if (req.method === 'DELETE' && identifier) {
        // Deactivate, not delete. A battlecard is the vocabulary entry that
        // resolves years of free text; removing the row would orphan every
        // deal that named this competitor.
        const { data, error } = await admin
          .from('competitor_battlecards')
          .update({ is_active: false, updated_by: user.id, updated_at: new Date().toISOString() })
          .eq('id', identifier)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return createCorsResponse({ error: 'Battlecard not found' }, 404, req);
        return createCorsResponse({ success: true, id: identifier }, 200, req);
      }

      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    // ─── /for-deal/:dealId (AC1) ─────────────────────────────────────
    //
    // The competitive card on the deal record: who this deal is against, what
    // the ACCOUNT has said about competitors before, and the battlecard when
    // one claims the name.
    if (resource === 'for-deal' && identifier && req.method === 'GET') {
      const { data: deal } = await admin
        .from('deals')
        .select('id, incumbent_vendor, customer_id, source_business_record_id, status, lost_reason')
        .eq('id', identifier)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!deal) return createCorsResponse({ error: 'Deal not found' }, 404, req);

      const cards = await loadBattlecards(admin, tenantId);
      const index = buildBattlecardIndex(cards.filter((c) => c.is_active !== false));

      const incumbent = resolveCompetitor((deal as Row).incumbent_vendor, index);

      // The account's own competitor history. Either id can carry it, because a
      // deal points at its account through customer_id and at the lead it came
      // from through source_business_record_id - the same row, after COP-B00.
      const accountId =
        (deal as Row).customer_id ?? (deal as Row).source_business_record_id ?? null;
      let accountHistory: Row | null = null;
      if (accountId) {
        const { data } = await admin
          .from('business_records')
          .select('id, company_name, competitor_name, deactivation_reason, churned_date')
          .eq('id', accountId)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        accountHistory = (data as Row) ?? null;
      }

      const priorCompetitors = accountHistory
        ? splitCompetitorList(accountHistory.competitor_name)
            .map((raw) => resolveCompetitor(raw, index))
            .filter((r): r is NonNullable<typeof r> => r !== null)
            // The incumbent is shown above; repeating it as "history" reads as
            // two separate facts about the same company.
            .filter((r) => r.key !== incumbent?.key)
        : [];

      // Deduplicate by key, keeping the first spelling seen.
      const seen = new Set<string>();
      const history = priorCompetitors.filter((r) => {
        if (seen.has(r.key)) return false;
        seen.add(r.key);
        return true;
      });

      return createCorsResponse(
        {
          dealId: (deal as Row).id,
          incumbent: incumbent
            ? {
                name: incumbent.displayName,
                raw: incumbent.raw,
                battlecard: incumbent.battlecard ? toCard(incumbent.battlecard as Row) : null,
              }
            : null,
          accountHistory: history.map((r) => ({
            name: r.displayName,
            raw: r.raw,
            battlecardId: (r.battlecard?.id as string) ?? null,
          })),
          // AC4's signal, on the record: this account has left for a competitor
          // before, which is the single most useful thing to know in the room.
          lostToCompetitorBefore: accountHistory?.deactivation_reason === COMPETITOR_CHURN_REASON,
          churnedDate: accountHistory?.churned_date ?? null,
          canAuthor,
        },
        200,
        req,
      );
    }

    // ─── /win-loss (AC3) ─────────────────────────────────────────────
    if (resource === 'win-loss' && req.method === 'GET') {
      const cards = await loadBattlecards(admin, tenantId);
      const index = buildBattlecardIndex(cards.filter((c) => c.is_active !== false));

      // Only deals that name an incumbent. PostgREST has no GROUP BY, so the
      // rows come back and the aggregation happens in memory.
      const deals = await fetchAllRows<Row>(() =>
        admin
          .from('deals')
          .select('status, incumbent_vendor, lost_reason, amount')
          .eq('tenant_id', tenantId)
          .not('incumbent_vendor', 'is', null),
      );

      const competitors = summarizeWinLoss(deals ?? [], index);
      const decided = competitors.reduce((sum, c) => sum + c.decided, 0);

      return createCorsResponse(
        {
          competitors,
          // The admin's worklist: spellings nothing claims yet.
          unmatched: unmatchedCompetitors(
            (deals ?? []).map((d) => d.incumbent_vendor),
            index,
          ),
          minDecidedForRate: MIN_DECIDED_FOR_RATE,
          totals: { dealsWithIncumbent: (deals ?? []).length, decided },
          // Said plainly rather than left for the page to infer: a deal with no
          // incumbent recorded is excluded, not counted as a win against nobody.
          unbacked:
            (deals ?? []).length === 0
              ? ['No deal records an incumbent vendor yet, so there is nothing to compare.']
              : [],
          canAuthor,
        },
        200,
        req,
      );
    }

    // ─── /takeaway-targets (AC4) ─────────────────────────────────────
    //
    // Accounts that left for a competitor. These are the COP-B04 plays: the
    // dealer knows the fleet, knows why they left, and knows who has them.
    if (resource === 'takeaway-targets' && req.method === 'GET') {
      const cards = await loadBattlecards(admin, tenantId);
      const index = buildBattlecardIndex(cards.filter((c) => c.is_active !== false));

      const rows = await fetchAllRows<Row>(() =>
        admin
          .from('business_records')
          .select(
            'id, company_name, competitor_name, churned_date, customer_until, assigned_sales_rep, phone, city, state',
          )
          .eq('tenant_id', tenantId)
          .eq('deactivation_reason', COMPETITOR_CHURN_REASON),
      );

      const targets = (rows ?? [])
        .map((r) => {
          const resolved = resolveCompetitor(splitCompetitorList(r.competitor_name)[0], index);
          return {
            accountId: r.id,
            companyName: r.company_name ?? null,
            competitor: resolved?.displayName ?? null,
            battlecardId: (resolved?.battlecard?.id as string) ?? null,
            churnedDate: r.churned_date ?? r.customer_until ?? null,
            assignedSalesRep: r.assigned_sales_rep ?? null,
            city: r.city ?? null,
            state: r.state ?? null,
          };
        })
        // Most recently lost first: a switch six months ago is a live
        // conversation, one from 2019 is archaeology.
        .sort((a, b) => String(b.churnedDate ?? '').localeCompare(String(a.churnedDate ?? '')));

      return createCorsResponse(
        {
          data: targets,
          total: targets.length,
          unmatched: unmatchedCompetitors(
            (rows ?? []).map((r) => r.competitor_name),
            index,
          ),
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    console.error('[COMPETITORS] error:', error);
    return createCorsResponse(
      { error: 'Request failed', message: (error as Error).message },
      500,
      req,
    );
  }
}
