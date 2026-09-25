// Round 206. Migration 0078 put a CHECK on service_tickets.status. It is NOT
// VALID, which spares old rows and still rejects every INSERT and UPDATE
// (proven on Postgres 16), so any writer using a value outside the WF-V-05
// vocabulary fails outright - and five report readers compared status to the
// retired 'in-progress', so they undercounted work in progress.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SERVICE_TICKET_STATUSES } from '../../../supabase/functions/_shared/service-ticket-vocabulary';
import { ticketBucket } from '../../../supabase/functions/reports/_ticket-buckets';

const strip = (s: string) =>
  s.replace(/(?<![:/'"`])\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}
const FILES = walk('supabase/functions');

/**
 * Known writers outside the vocabulary. Shrink-only: an entry fails when it is
 * fixed. Round 207 emptied it - predictive-failure's 'pending_review' draft is
 * gone because the ticket is created on approval (predictive-failure/_ticket.ts).
 */
const KNOWN = new Set<string>();

describe('service_tickets status writers', () => {
  it('walks the edge tree', () => {
    expect(FILES.length).toBeGreaterThan(400);
  });

  it('every literal status written to service_tickets is in the vocabulary', () => {
    const found: string[] = [];
    for (const f of FILES) {
      const s = strip(readFileSync(f, 'utf8'));
      let i = -1;
      while ((i = s.indexOf("from('service_tickets')", i + 1)) !== -1) {
        const next = s.indexOf('.from(', i + 10);
        const seg = s.slice(i, next === -1 ? i + 1500 : Math.min(next, i + 1500));
        const write = seg.match(/\.(update|insert|upsert)\(\s*\{[\s\S]*?\}\s*\)/);
        if (!write) continue;
        for (const m of write[0].matchAll(/\bstatus:\s*'([^']+)'/g)) {
          if (!(SERVICE_TICKET_STATUSES as readonly string[]).includes(m[1])) {
            found.push(`${f}:${m[1]}`);
          }
        }
      }
    }
    expect(found.filter((x) => !KNOWN.has(x))).toEqual([]);
    for (const k of KNOWN) expect(found).toContain(k);
  });

  it('no reader compares a ticket status to the retired hyphenated spelling', () => {
    const hits = FILES.filter((f) => !f.endsWith('_shared/service-ticket-vocabulary.ts'))
      .flatMap((f) =>
        strip(readFileSync(f, 'utf8'))
          .split('\n')
          .filter((l) => l.includes("'in-progress'"))
          .map((l) => `${f}: ${l.trim()}`),
      )
      // A deployment-readiness check state, not a ticket status.
      .filter((l) => !l.startsWith('supabase/functions/deployment-readiness/'));
    expect(hits).toEqual([]);
  });
});

describe('ticketBucket', () => {
  it('puts every vocabulary status in exactly one bucket and normalises aliases', () => {
    expect(ticketBucket('en_route')).toBe('inProgress');
    expect(ticketBucket('on_site')).toBe('inProgress');
    expect(ticketBucket('in-progress')).toBe('inProgress');
    expect(ticketBucket('on_hold')).toBe('open');
    expect(ticketBucket('scheduled')).toBe('open');
    expect(ticketBucket('closed')).toBe('completed');
    expect(ticketBucket('cancelled')).toBe('cancelled');
    expect(ticketBucket('gibberish')).toBe('unknown');
    for (const s of SERVICE_TICKET_STATUSES) expect(ticketBucket(s)).not.toBe('unknown');
  });
});

describe('ServiceForecastingAnalytics', () => {
  const page = strip(readFileSync('client/src/pages/ServiceForecastingAnalytics.tsx', 'utf8'));
  const stubs = strip(
    readFileSync('supabase/functions/reports/handlers/frontend-stubs.ts', 'utf8'),
  );

  it('summary cards read only keys the summary endpoint returns', () => {
    const body = stubs.slice(stubs.indexOf('async function serviceSummary('));
    const ret = body.slice(body.indexOf('return {'), body.indexOf('};', body.indexOf('return {')));
    const cards = page.slice(
      page.indexOf('const SUMMARY_CARDS'),
      page.indexOf('];', page.indexOf('const SUMMARY_CARDS')),
    );
    const keys = [...cards.matchAll(/key: '([A-Za-z]+)'/g)].map((m) => m[1]);
    expect(keys.length).toBe(4);
    for (const k of keys) expect(ret).toMatch(new RegExp(`\\b${k}\\b`));
    expect(page).not.toMatch(/predictedCalls|callsIncrease|highRiskCustomers|inventoryAlerts/);
    expect(ret).toBeTruthy();
  });

  it('reports no forecast and no blank territory, and exports technician load', () => {
    expect(stubs).toContain('forecastedUtilization: null');
    expect(stubs).toContain('territory: null');
    expect(page).not.toMatch(/tech\.forecastedUtilization/);
    expect(page).toMatch(/exportToCSV\(techCapacity, TECH_CAPACITY_EXPORT_COLUMNS,/);
  });

  it('summaryValue dashes a missing figure and keeps a real zero', async () => {
    const { summaryValue } = await import('../../../client/src/pages/ServiceForecastingAnalytics');
    expect(summaryValue(undefined, 'openTickets')).toBe('—');
    expect(summaryValue({ avgResolutionHours: null }, 'avgResolutionHours', 'h')).toBe('—');
    expect(summaryValue({ openTickets: 0 }, 'openTickets')).toBe('0');
    expect(summaryValue({ avgResolutionHours: 4 }, 'avgResolutionHours', 'h')).toBe('4 h');
  });
});
