// Copier sales playbooks (COP-B13).
//
// Guided discovery in front of the rep while they are on the call, with the
// answers landing in real columns rather than in free text.
//
// Endpoints (the dispatcher strips the function-name segment first):
//   GET    /                          list playbooks
//   POST   /                          create                    (manager+)
//   PUT    /:id                       update                    (manager+)
//   DELETE /:id                       deactivate                (manager+)
//   POST   /seed-starters             install the four motions  (manager+)
//   GET    /fields                    the write-back allow-list, for authoring
//   GET    /for-record/:type/:id      playbooks + runs for one record
//   POST   /runs                      save answers and write them back
//
// THE WRITE-BACK IS THE FEATURE. A playbook whose answers sit in free text is a
// notes template. _shared/playbook.ts turns answers into per-table patches
// through a fixed ALLOW-LIST of columns - which is a security boundary, not a
// convenience: `writeBackField` is authored through a UI, so an unchecked
// string would let anybody who can write a playbook write any column on deals,
// company_contacts or business_records, tenant_id and owner_id included.
//
// TWO THINGS THE WRITE PATH REFUSES TO DO. It never writes a null: a blank
// answer means "not answered", and treating it as a value would make skipping a
// question wipe whatever was already on the record. And it never writes a field
// belonging to a table the record cannot own, so a deal playbook cannot reach a
// contact row even if an admin points a question at one.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import { ROLE_LEVEL, RbacError, requireRoleLevel } from '../_shared/rbac.ts';
import type { AuthContext } from '../_shared/auth.ts';
import {
  STARTER_PLAYBOOKS,
  buildWriteBack,
  completionOf,
  writeBackFieldOptions,
  type WriteBackTable,
} from '../_shared/playbook.ts';
import type { PlaybookQuestion } from '../../../shared/playbook-schema.ts';

type Row = Record<string, any>;

/** Authoring a playbook is a management act; running one is the rep's job. */
const AUTHOR_MIN_ROLE_LEVEL = ROLE_LEVEL.MANAGER;

/**
 * Which tables a run against this record may write.
 *
 * A deal run can reach the deal and, through it, the account - a fleet walk
 * legitimately records the account's competitor. It may NOT reach a contact:
 * a deal has many, and picking one would be a guess about which person an
 * answer describes.
 */
const TABLES_FOR_PARENT: Record<string, WriteBackTable[]> = {
  deal: ['deals', 'business_records'],
  contact: ['company_contacts'],
  company: ['business_records'],
};

function toPlaybook(row: Row) {
  return {
    id: row.id,
    name: row.name,
    motion: row.motion ?? null,
    description: row.description ?? null,
    appliesTo: row.applies_to ?? 'deal',
    questions: (row.questions ?? []) as PlaybookQuestion[],
    triggerStageId: row.trigger_stage_id ?? null,
    gatesStageAdvance: row.gates_stage_advance === true,
    isActive: row.is_active !== false,
    updatedAt: row.updated_at ?? null,
  };
}

function toRun(row: Row) {
  return {
    id: row.id,
    playbookId: row.playbook_id,
    parentType: row.parent_type,
    parentId: row.parent_id,
    answers: (row.answers ?? {}) as Record<string, unknown>,
    writeBackLog: row.write_back_log ?? null,
    status: row.status,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
  };
}

/** Questions are validated on the way in, so a malformed one cannot be saved. */
function validateQuestions(raw: unknown): { questions: PlaybookQuestion[] } | { error: string } {
  if (raw == null) return { questions: [] };
  if (!Array.isArray(raw)) return { error: 'questions must be an array' };

  const seen = new Set<string>();
  const questions: PlaybookQuestion[] = [];
  for (const [i, q] of raw.entries()) {
    const prompt = String((q as Row)?.prompt ?? '').trim();
    if (!prompt) return { error: `question ${i + 1} has no prompt` };

    // The id is STABLE and caller-supplied on an edit, because answers are
    // keyed on it. Generating a fresh one here would orphan every answer
    // already recorded against the question.
    const id = String((q as Row)?.id ?? '').trim() || `q_${i + 1}_${Date.now().toString(36)}`;
    if (seen.has(id)) return { error: `two questions share the id "${id}"` };
    seen.add(id);

    questions.push({
      id,
      prompt,
      helpText: (q as Row)?.helpText ? String((q as Row).helpText) : null,
      answerType: String((q as Row)?.answerType ?? 'text') as PlaybookQuestion['answerType'],
      options: Array.isArray((q as Row)?.options)
        ? (q as Row).options.map((o: unknown) => String(o))
        : null,
      writeBackField: (q as Row)?.writeBackField ? String((q as Row).writeBackField) : null,
      required: Boolean((q as Row)?.required),
    });
  }
  return { questions };
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
    const denyAuthoring = (err: unknown) => {
      if (err instanceof RbacError) {
        return createCorsResponse(
          {
            error: 'Authoring playbooks requires a manager role',
            code: 'INSUFFICIENT_ROLE',
            details: err.details,
          },
          403,
          req,
        );
      }
      throw err;
    };

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'playbooks');
    const resource = parts[0];

    // ─── GET /fields ─────────────────────────────────────────────────
    // The allow-list, so the authoring UI offers a picker rather than a text
    // box. A free text box is how an unchecked column name gets authored.
    if (resource === 'fields' && req.method === 'GET') {
      return createCorsResponse({ fields: writeBackFieldOptions() }, 200, req);
    }

    // ─── POST /seed-starters (AC2) ───────────────────────────────────
    if (resource === 'seed-starters' && req.method === 'POST') {
      try {
        assertCanAuthor();
      } catch (err) {
        return denyAuthoring(err);
      }

      const existing = await fetchAllRows<Row>(() =>
        admin.from('sales_playbooks').select('motion').eq('tenant_id', tenantId),
      );
      const have = new Set((existing ?? []).map((p) => p.motion).filter(Boolean));
      // Idempotent by motion: running this twice does not duplicate, and a
      // starter an admin has since edited is left alone.
      const toInsert = STARTER_PLAYBOOKS.filter((s) => !have.has(s.motion)).map((s) => ({
        tenant_id: tenantId,
        name: s.name,
        motion: s.motion,
        description: s.description,
        applies_to: s.appliesTo,
        questions: s.questions,
        created_by: user.id,
        updated_by: user.id,
      }));

      if (toInsert.length === 0) {
        return createCorsResponse({ created: 0, skipped: STARTER_PLAYBOOKS.length }, 200, req);
      }
      const { data, error } = await admin.from('sales_playbooks').insert(toInsert).select();
      if (error) throw new Error(error.message);
      return createCorsResponse(
        {
          created: (data ?? []).length,
          skipped: STARTER_PLAYBOOKS.length - toInsert.length,
          data: (data ?? []).map(toPlaybook),
        },
        201,
        req,
      );
    }

    // ─── GET /for-record/:type/:id (AC1, AC4) ────────────────────────
    if (resource === 'for-record' && req.method === 'GET') {
      const parentType = parts[1];
      const parentId = parts[2];
      if (!parentType || !parentId || !TABLES_FOR_PARENT[parentType]) {
        return createCorsResponse({ error: 'Unknown record type' }, 400, req);
      }

      const [playbooks, runs] = await Promise.all([
        fetchAllRows<Row>(() =>
          admin
            .from('sales_playbooks')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('applies_to', parentType)
            .eq('is_active', true),
        ),
        fetchAllRows<Row>(() =>
          admin
            .from('sales_playbook_runs')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('parent_type', parentType)
            .eq('parent_id', parentId),
        ),
      ]);

      const runByPlaybook = new Map((runs ?? []).map((r) => [r.playbook_id, r]));

      return createCorsResponse(
        {
          data: (playbooks ?? [])
            .map((p) => {
              const run = runByPlaybook.get(p.id) ?? null;
              const answers = (run?.answers ?? {}) as Record<string, unknown>;
              return {
                playbook: toPlaybook(p),
                run: run ? toRun(run) : null,
                completion: completionOf((p.questions ?? []) as PlaybookQuestion[], answers),
              };
            })
            .sort((a, b) => a.playbook.name.localeCompare(b.playbook.name)),
          canAuthor,
        },
        200,
        req,
      );
    }

    // ─── POST /runs (AC3) ────────────────────────────────────────────
    if (resource === 'runs' && req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as Row;
      const playbookId = String(body.playbookId ?? '');
      const parentType = String(body.parentType ?? '');
      const parentId = String(body.parentId ?? '');
      const answers = (body.answers ?? {}) as Record<string, unknown>;

      if (!playbookId || !parentType || !parentId) {
        return createCorsResponse(
          { error: 'playbookId, parentType and parentId are required' },
          400,
          req,
        );
      }
      const allowedTables = TABLES_FOR_PARENT[parentType];
      if (!allowedTables) {
        return createCorsResponse({ error: 'Unknown record type' }, 400, req);
      }

      const { data: playbook } = await admin
        .from('sales_playbooks')
        .select('*')
        .eq('id', playbookId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!playbook) return createCorsResponse({ error: 'Playbook not found' }, 404, req);

      const questions = ((playbook as Row).questions ?? []) as PlaybookQuestion[];

      // The record has to exist and belong to this tenant BEFORE anything is
      // written to it. Without this check a caller could name any id and the
      // update would silently match nothing - or, worse, match another
      // tenant's row if the tenant filter below were ever dropped.
      const parentTable: WriteBackTable =
        parentType === 'deal'
          ? 'deals'
          : parentType === 'contact'
            ? 'company_contacts'
            : 'business_records';
      const { data: parent } = await admin
        .from(parentTable)
        .select('id')
        .eq('id', parentId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!parent) return createCorsResponse({ error: 'Record not found' }, 404, req);

      const plan = buildWriteBack(questions, answers, allowedTables);

      // A deal run may write the ACCOUNT, which is a different row than the
      // deal. Resolved here rather than assumed.
      let accountId: string | null = null;
      if (parentType === 'deal' && plan.patches.business_records) {
        const { data: deal } = await admin
          .from('deals')
          .select('customer_id, source_business_record_id')
          .eq('id', parentId)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        accountId = (deal as Row)?.customer_id ?? (deal as Row)?.source_business_record_id ?? null;
      }

      const writeErrors: string[] = [];
      for (const [table, patch] of Object.entries(plan.patches)) {
        const targetId =
          table === parentTable ? parentId : table === 'business_records' ? accountId : null;
        if (!targetId) {
          writeErrors.push(
            `No ${table} row is linked to this record, so those answers were kept on the playbook only.`,
          );
          continue;
        }
        const { error } = await admin
          .from(table)
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', targetId)
          // SEC-TENANT-005: the filter, not the payload, is what binds an
          // update to a tenant.
          .eq('tenant_id', tenantId);
        if (error) writeErrors.push(`${table}: ${error.message}`);
      }

      const completion = completionOf(questions, answers);
      const nowIso = new Date().toISOString();

      const { data: saved, error: runError } = await admin
        .from('sales_playbook_runs')
        .upsert(
          {
            tenant_id: tenantId,
            playbook_id: playbookId,
            parent_type: parentType,
            parent_id: parentId,
            answers,
            write_back_log: {
              written: plan.written,
              rejected: plan.rejected,
              errors: writeErrors,
              at: nowIso,
            },
            status: completion.isComplete ? 'complete' : 'in_progress',
            started_by: user.id,
            updated_at: nowIso,
            completed_at: completion.isComplete ? nowIso : null,
          },
          { onConflict: 'tenant_id,playbook_id,parent_type,parent_id' },
        )
        .select()
        .single();
      if (runError) throw new Error(runError.message);

      return createCorsResponse(
        {
          run: toRun(saved as Row),
          completion,
          // Reported, never silent: a rep should be able to see that their
          // answer reached the record instead of taking it on trust.
          written: plan.written,
          rejected: plan.rejected,
          writeErrors,
        },
        200,
        req,
      );
    }

    // ─── Playbook CRUD ───────────────────────────────────────────────
    if (req.method === 'GET' && !resource) {
      const rows = await fetchAllRows<Row>(() =>
        admin.from('sales_playbooks').select('*').eq('tenant_id', tenantId),
      );
      return createCorsResponse(
        {
          data: (rows ?? [])
            .filter(
              (p) => url.searchParams.get('includeInactive') === 'true' || p.is_active !== false,
            )
            .map(toPlaybook)
            .sort((a, b) => a.name.localeCompare(b.name)),
          canAuthor,
          starterMotions: STARTER_PLAYBOOKS.map((s) => s.motion),
        },
        200,
        req,
      );
    }

    if (req.method !== 'GET') {
      try {
        assertCanAuthor();
      } catch (err) {
        return denyAuthoring(err);
      }
    }

    if (req.method === 'POST' && !resource) {
      const body = (await req.json().catch(() => ({}))) as Row;
      const name = String(body.name ?? '').trim();
      if (!name) return createCorsResponse({ error: 'name is required' }, 400, req);
      const parsed = validateQuestions(body.questions);
      if ('error' in parsed) return createCorsResponse({ error: parsed.error }, 400, req);

      const { data, error } = await admin
        .from('sales_playbooks')
        .insert({
          tenant_id: tenantId,
          name: name.slice(0, 160),
          motion: body.motion ? String(body.motion).slice(0, 60) : null,
          description: body.description ? String(body.description) : null,
          applies_to: TABLES_FOR_PARENT[String(body.appliesTo ?? 'deal')]
            ? String(body.appliesTo ?? 'deal')
            : 'deal',
          questions: parsed.questions,
          trigger_stage_id: body.triggerStageId ? String(body.triggerStageId) : null,
          gates_stage_advance: Boolean(body.gatesStageAdvance),
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return createCorsResponse(toPlaybook(data as Row), 201, req);
    }

    if ((req.method === 'PUT' || req.method === 'PATCH') && resource) {
      const body = (await req.json().catch(() => ({}))) as Row;
      const parsed = validateQuestions(body.questions);
      if ('error' in parsed) return createCorsResponse({ error: parsed.error }, 400, req);

      const { data, error } = await admin
        .from('sales_playbooks')
        .update({
          name:
            String(body.name ?? '')
              .trim()
              .slice(0, 160) || undefined,
          motion: body.motion === undefined ? undefined : body.motion ? String(body.motion) : null,
          description: body.description === undefined ? undefined : (body.description ?? null),
          applies_to:
            body.appliesTo && TABLES_FOR_PARENT[String(body.appliesTo)]
              ? String(body.appliesTo)
              : undefined,
          questions: parsed.questions,
          trigger_stage_id:
            body.triggerStageId === undefined ? undefined : body.triggerStageId || null,
          gates_stage_advance:
            body.gatesStageAdvance === undefined ? undefined : Boolean(body.gatesStageAdvance),
          is_active: body.isActive === undefined ? undefined : Boolean(body.isActive),
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resource)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return createCorsResponse({ error: 'Playbook not found' }, 404, req);
      return createCorsResponse(toPlaybook(data as Row), 200, req);
    }

    if (req.method === 'DELETE' && resource) {
      // Deactivate. A run references the playbook's question ids, and deleting
      // the row would leave every recorded answer unreadable.
      const { data, error } = await admin
        .from('sales_playbooks')
        .update({ is_active: false, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq('id', resource)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return createCorsResponse({ error: 'Playbook not found' }, 404, req);
      return createCorsResponse({ success: true, id: resource }, 200, req);
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    console.error('[PLAYBOOKS] error:', error);
    return createCorsResponse(
      { error: 'Request failed', message: (error as Error).message },
      500,
      req,
    );
  }
}
