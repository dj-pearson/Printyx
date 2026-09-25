/**
 * Round 163: recording a service visit analysis works on some host.
 *
 * It worked on none. The page posts to /api/service-tickets/:id/analysis, which
 * no edge branch served and whose Express handler never ran (the prefix is
 * proxied); the service-analysis edge function used the phantom
 * `service_analyses`; and the page's form required three ids it never set, so
 * Save failed validation and said nothing.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { serviceCallAnalysis } from '@shared/service-analysis-schema';
import {
  ANALYSIS_TYPES,
  SERVICE_OUTCOMES,
  buildAnalysisRow,
  ticketStatusForOutcome,
} from '../../../supabase/functions/_shared/service-call-analysis';
import { SERVICE_TICKET_STATUSES } from '../../../shared/service-ticket-vocabulary';

const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
const ctx = { tenantId: 't-1', ticketId: 'tk-1', userId: 'u-1' };
const valid = {
  analysisType: 'repair',
  outcome: 'resolved',
  callStartTime: '2026-09-23T10:00',
  problemDescription: 'Paper jam',
};

describe('buildAnalysisRow', () => {
  it('writes only real columns, and every NOT NULL without a default is supplied', () => {
    const cfg = getTableConfig(serviceCallAnalysis);
    const columns = new Set(cfg.columns.map((c) => c.name));
    const { row, invalid } = buildAnalysisRow(
      { ...valid, onSiteTime: 45, laborHours: 2 },
      ctx,
      'create',
    );
    expect(invalid).toEqual([]);
    for (const key of Object.keys(row)) expect(columns.has(key), key).toBe(true);
    for (const c of cfg.columns) {
      if (c.notNull && !c.hasDefault) expect(row[c.name], c.name).not.toBeUndefined();
    }
  });

  it('takes tenant, ticket and technician from the server, never the body', () => {
    const { row } = buildAnalysisRow(
      { ...valid, tenantId: 'evil', serviceTicketId: 'other', technicianId: 'someone' },
      ctx,
      'create',
    );
    expect(row.tenant_id).toBe('t-1');
    expect(row.service_ticket_id).toBe('tk-1');
    expect(row.technician_id).toBe('u-1');
  });

  it('names missing NOT NULLs and values outside the enums', () => {
    expect(buildAnalysisRow({}, ctx, 'create').invalid.sort()).toEqual(
      ['analysisType', 'callStartTime', 'outcome', 'problemDescription'].sort(),
    );
    expect(buildAnalysisRow({ ...valid, outcome: 'fixed-ish' }, ctx, 'create').invalid).toEqual([
      'outcome',
    ]);
  });

  it('reports keys that are not columns rather than dropping them silently', () => {
    expect(buildAnalysisRow({ ...valid, mood: 'good' }, ctx, 'create').ignoredFields).toEqual([
      'mood',
    ]);
  });

  it('an update touches only what was sent', () => {
    const { row } = buildAnalysisRow({ rootCause: 'worn roller' }, ctx, 'update');
    expect(row).toEqual({ root_cause: 'worn roller' });
  });

  it('carries the enum vocabularies from migration 0000', () => {
    const sql = readFileSync('drizzle/migrations/0000_fuzzy_blizzard.sql', 'utf8');
    for (const v of [...ANALYSIS_TYPES, ...SERVICE_OUTCOMES]) expect(sql).toContain(`'${v}'`);
  });
});

describe('ticketStatusForOutcome', () => {
  it('only ever answers a status the ticket CHECK constraint accepts', () => {
    for (const outcome of SERVICE_OUTCOMES) {
      const status = ticketStatusForOutcome(outcome);
      if (status !== null) expect(SERVICE_TICKET_STATUSES).toContain(status);
    }
    expect(ticketStatusForOutcome('resolved')).toBe('completed');
    expect(ticketStatusForOutcome('requires_parts')).toBe('on_hold');
    expect(ticketStatusForOutcome('partial_fix')).toBeNull();
  });
});

describe('wiring', () => {
  it('service-tickets serves GET and POST /:id/analysis, scope-checked', () => {
    const fn = stripComments(readFileSync('supabase/functions/service-tickets/index.ts', 'utf8'));
    const at = fn.indexOf("subResource === 'analysis'");
    expect(at).toBeGreaterThan(-1);
    const branch = fn.slice(
      at,
      fn.indexOf(
        'return createCorsResponse(\n',
        fn.indexOf('ignoredFields: plan.ignoredFields', at),
      ),
    );
    expect(branch).toMatch(/denyIfTicketOutOfScope\(ticketId\)/);
    expect(branch).toMatch(/from\('service_call_analysis'\)/);
    expect(branch).toMatch(
      /buildAnalysisRow\(body, \{ tenantId, ticketId, userId: user\.id \}, 'create'\)/,
    );
    // It sits above the unknown-sub-resource 404, or it would never be reached.
    expect(at).toBeLessThan(fn.indexOf('Unknown service ticket sub-resource'));
  });

  it('service-analysis uses no phantom table', () => {
    const fn = stripComments(readFileSync('supabase/functions/service-analysis/index.ts', 'utf8'));
    expect(fn).not.toMatch(/from\('service_analyses'\)/);
    expect(fn).not.toMatch(/from\('service_analysis_parts'\)/);
  });

  it('the page form no longer requires the ids the server supplies', () => {
    const page = readFileSync('client/src/components/service/ServiceTicketAnalysis.tsx', 'utf8');
    expect(page).toMatch(
      /\.omit\(\{ tenantId: true, serviceTicketId: true, technicianId: true \}\)/,
    );
    expect(page).toMatch(/onError:/);
  });
});
