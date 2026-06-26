// Signature analytics — read-only aggregate over signature_requests.
//
// Path (dispatcher stripped /signatures + resolved the `analytics` resource):
//   GET  /            → tenant-scoped aggregate
//
// Replaces the frontend's /api/signature-analytics call, which had NO backend
// on either Express or the edge function before EDGE-005e. The shape mirrors
// exactly what ESignatureIntegration.tsx consumes:
//   { totalRequests, pendingRequests, completedRequests, completionRate,
//     averageSigningTime, totalContractValue,
//     signingSpeedAnalysis: { within24Hours, within48Hours, within1Week, moreThan1Week },
//     byDocumentType: [{ type, count, completed }] }
//
// All numbers are derived from real columns on signature_requests. Two fields
// have no backing column and are reported honestly:
//   - totalContractValue: signature_requests has no contract-value column → 0.
//   - byDocumentType groups by `provider` (the only categorical column); there
//     is no document_type column on the table.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

const TERMINAL = ['completed', 'declined', 'expired', 'voided'];
const DAY_MS = 86400000;

interface RequestRow {
  status: string | null;
  provider: string | null;
  created_at: string | null;
  sent_at: string | null;
  completed_at: string | null;
}

export async function handleAnalytics(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;

  // Only the collection root: GET /
  if (method !== 'GET' || pathParts[0]) return null;

  const { data, error } = await db
    .from('signature_requests')
    .select('status, provider, created_at, sent_at, completed_at')
    .eq('tenant_id', auth.tenantId)
    .limit(5000);
  if (error) {
    return errorResponse(500, 'Failed to compute signature analytics', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }

  const rows: RequestRow[] = data ?? [];
  const totalRequests = rows.length;
  const completed = rows.filter((r) => r.status === 'completed');
  const completedRequests = completed.length;
  const pendingRequests = rows.filter((r) => !TERMINAL.includes(r.status ?? '')).length;
  const completionRate = totalRequests ? (completedRequests / totalRequests) * 100 : 0;

  // Signing duration: from when the request started (sent_at, falling back to
  // created_at) to completed_at. Used for both the average and the speed buckets.
  const durationsDays: number[] = [];
  const speed = { within24Hours: 0, within48Hours: 0, within1Week: 0, moreThan1Week: 0 };
  for (const r of completed) {
    const start = r.sent_at ?? r.created_at;
    if (!start || !r.completed_at) continue;
    const ms = new Date(r.completed_at).getTime() - new Date(start).getTime();
    if (!Number.isFinite(ms) || ms < 0) continue;
    durationsDays.push(ms / DAY_MS);
    if (ms <= DAY_MS) speed.within24Hours += 1;
    else if (ms <= 2 * DAY_MS) speed.within48Hours += 1;
    else if (ms <= 7 * DAY_MS) speed.within1Week += 1;
    else speed.moreThan1Week += 1;
  }
  const averageSigningTime = durationsDays.length
    ? Number((durationsDays.reduce((a, b) => a + b, 0) / durationsDays.length).toFixed(1))
    : 0;

  // Group by provider (closest categorical column to "document type").
  const byTypeMap = new Map<string, { type: string; count: number; completed: number }>();
  for (const r of rows) {
    const type = r.provider ?? 'unknown';
    const entry = byTypeMap.get(type) ?? { type, count: 0, completed: 0 };
    entry.count += 1;
    if (r.status === 'completed') entry.completed += 1;
    byTypeMap.set(type, entry);
  }

  return jsonResponse(
    {
      totalRequests,
      pendingRequests,
      completedRequests,
      completionRate: Number(completionRate.toFixed(1)),
      averageSigningTime,
      totalContractValue: 0,
      signingSpeedAnalysis: speed,
      byDocumentType: Array.from(byTypeMap.values()),
    },
    200,
    req,
    requestId,
  );
}
