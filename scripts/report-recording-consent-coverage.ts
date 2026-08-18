#!/usr/bin/env tsx
/**
 * Recording consent coverage (LEGAL-009).
 *
 * Reports which stored recordings have no consent record behind them. Consent
 * capture is enforced at upload from now on, but everything recorded before that
 * has nothing on file, and the size of that backlog is a fact somebody needs
 * before deciding what to do about it.
 *
 * Deliberately does NOT delete anything. Whether an uncovered recording should
 * be deleted, or kept because the customer can evidence consent another way, is
 * a decision with legal consequences either way. This tells you the scale.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/report-recording-consent-coverage.ts
 *   ... --tenant <id>    limit to one tenant
 *   ... --csv            machine-readable output
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://api.printyx.net';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set.');
  process.exit(1);
}

const args = process.argv.slice(2);
const CSV = args.includes('--csv');
const tenantIdx = args.indexOf('--tenant');
const ONLY_TENANT = tenantIdx >= 0 ? args[tenantIdx + 1] : undefined;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  let recordingsQuery = admin
    .from('meeting_recordings')
    .select('id, tenant_id, meeting_id, recording_name, uploaded_at, uploaded_by');
  if (ONLY_TENANT) recordingsQuery = recordingsQuery.eq('tenant_id', ONLY_TENANT);

  const { data: recordings, error: recErr } = await recordingsQuery;
  if (recErr) {
    console.error(`Could not read meeting_recordings: ${recErr.message}`);
    process.exit(1);
  }

  let consentQuery = admin
    .from('consent_records')
    .select('proof_reference, status, given_at')
    .eq('consent_type', 'recording');
  if (ONLY_TENANT) consentQuery = consentQuery.eq('tenant_id', ONLY_TENANT);

  const { data: consents, error: conErr } = await consentQuery;
  if (conErr) {
    // The enum value is added by a hand-run migration. If it is missing, say so
    // rather than reporting every recording as uncovered.
    console.error(`Could not read consent_records: ${conErr.message}`);
    console.error(
      'If this mentions the consent_type enum, run drizzle/migrations/_recording_consent.sql first.',
    );
    process.exit(1);
  }

  const covered = new Map((consents ?? []).map((c) => [String(c.proof_reference), c]));
  const rows = (recordings ?? []).map((r) => {
    const c = covered.get(String(r.id));
    return {
      id: String(r.id),
      tenant: String(r.tenant_id),
      name: String(r.recording_name ?? ''),
      uploadedAt: String(r.uploaded_at ?? ''),
      state: !c ? 'NO CONSENT ON FILE' : c.status === 'given' ? 'consented' : `consent ${c.status}`,
    };
  });

  const uncovered = rows.filter((r) => r.state === 'NO CONSENT ON FILE');

  if (CSV) {
    console.log('recording_id,tenant_id,recording_name,uploaded_at,state');
    for (const r of rows) {
      console.log(`${r.id},${r.tenant},"${r.name.replace(/"/g, '""')}",${r.uploadedAt},${r.state}`);
    }
  } else {
    for (const r of uncovered.slice(0, 50)) {
      console.log(`  ${r.id}  tenant=${r.tenant}  ${r.uploadedAt}  ${r.name}`);
    }
    if (uncovered.length > 50) console.log(`  ... and ${uncovered.length - 50} more`);
  }

  console.log(
    `\n${rows.length} recording(s), ${uncovered.length} with no consent record.` +
      (uncovered.length
        ? '\nThese predate consent capture. Deciding what to do with them is a legal call, not a script call.'
        : ''),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
