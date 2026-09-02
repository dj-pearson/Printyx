/**
 * The field-service GPS and geofence handlers write columns that exist
 * (AUDIT-037).
 *
 * geofence_alerts stores is_acknowledged, is_resolved and is_escalated. The
 * handler used the names without the prefix, so acknowledging, resolving and
 * escalating an alert each 42703'd, and the two stats counts read null and
 * rendered as 0 through `?? 0` - a dashboard reporting no unacknowledged alerts
 * because the query failed, not because there were none.
 *
 * location_history is a bare GPS trail. Two separate inserts wrote ticket_id,
 * customer_id, device_id and activity_type onto it. The one that matters is in
 * the real-time PUT path, which discarded its error entirely, so every ping
 * returned 200 and stored nothing and the trail has always been empty.
 *
 * NO COLUMN WAS ADDED FOR THE TICKET LINK, because it already exists:
 * location_history.session_id references mobile_service_sessions, whose
 * service_ticket_id is NOT NULL. The activity timeline resolves ticket ->
 * sessions -> history, which cannot drift from the session's own ticket the way
 * a copied column would.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (src: string) =>
  src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('geofence_alerts', () => {
  const declared = read('shared/geofence-alerts-schema.ts');
  const handler = read('supabase/functions/field-service/handlers/geofence-alerts.ts');

  it('declares the prefixed booleans and no bare ones', () => {
    for (const col of ['is_acknowledged', 'is_resolved', 'is_escalated']) {
      expect(declared).toContain(`boolean('${col}')`);
    }
    for (const col of ['acknowledged', 'resolved', 'escalated']) {
      expect(declared).not.toContain(`boolean('${col}')`);
    }
  });

  it('the handler uses the declared names', () => {
    const code = stripComments(handler);
    for (const col of ['is_acknowledged', 'is_resolved', 'is_escalated']) {
      expect(code).toContain(col);
    }
    // Scoped to the two places a COLUMN name appears here - a filter and an
    // update key. A whole-file ban was too broad: the stats block has a local
    // variable called `resolved` holding a count, and reporting that as the
    // defect is the over-broad-assertion mistake this repo has made before.
    for (const col of ['acknowledged', 'resolved', 'escalated']) {
      expect(code).not.toMatch(new RegExp(`\\.eq\\(\\s*'${col}'`));
      expect(code).not.toMatch(new RegExp(`update\\.${col}\\s*=`));
    }
  });
});

describe('location_history is a GPS trail', () => {
  const declared = read('shared/mobile-service-schema.ts');
  const handler = read('supabase/functions/field-service/handlers/locations.ts');

  it('has session_id and none of the four context columns', () => {
    const at = declared.indexOf("pgTable('location_history'");
    expect(at).toBeGreaterThan(-1);
    const body = declared.slice(at, declared.indexOf('});', at));
    expect(body).toContain("uuid('session_id')");
    for (const col of ['ticket_id', 'customer_id', 'device_id', 'activity_type']) {
      expect(body).not.toContain(`'${col}'`);
    }
  });

  it('neither insert writes them', () => {
    const code = stripComments(handler);
    // Both location_history inserts, isolated from the technician_locations
    // one, which legitimately carries current_ticket_id and device_id.
    for (const m of code.matchAll(/from\('location_history'\)\s*\.insert\(\{([\s\S]*?)\}\)/g)) {
      for (const col of ['ticket_id:', 'customer_id:', 'device_id:', 'activity_type:']) {
        expect(m[1]).not.toContain(col);
      }
    }
  });

  it('the real-time append surfaces its error instead of discarding it', () => {
    expect(stripComments(handler)).toMatch(
      /const \{ error: historyError \} = await db\.from\('location_history'\)\.insert/,
    );
    expect(handler).toContain('[field-service] location_history append failed');
  });

  it('the timeline resolves the ticket through the session', () => {
    const code = stripComments(handler);
    expect(code).toContain("from('mobile_service_sessions')");
    expect(code).toContain("eq('service_ticket_id', ticketId)");
    expect(code).toContain("in('session_id', sessionIds)");
  });

  it('mobile_service_sessions carries the ticket the timeline needs', () => {
    expect(declared).toContain("varchar('service_ticket_id').notNull()");
  });
});
