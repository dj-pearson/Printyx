#!/usr/bin/env tsx
/**
 * Storage bucket visibility audit (LEGAL-006).
 *
 * Answers the question the repository cannot: is each bucket public?
 *
 * This matters because `getPublicUrl()` returns a URL string whether or not the
 * bucket is public, so reading the code tells you nothing about whether an
 * object is actually reachable without credentials. The QBR decks were served
 * that way, and a QBR carries a customer's fleet, usage and spend.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/audit-storage-buckets.ts
 *   ... --markdown        emit a table to paste into docs/storage-bucket-inventory.md
 *
 * Read-only. It lists buckets and probes one object per public bucket with an
 * unauthenticated GET, so the output states what an outsider can actually
 * fetch rather than what the config claims.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://api.printyx.net';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MARKDOWN = process.argv.includes('--markdown');

if (!SERVICE_KEY) {
  console.error(
    'SUPABASE_SERVICE_ROLE_KEY is not set. This audit needs service-role access to list buckets.',
  );
  process.exit(1);
}

/** What each bucket is expected to be, so drift is visible rather than implied. */
const EXPECTED: Record<string, { visibility: 'public' | 'private'; why: string }> = {
  'blog-assets': {
    visibility: 'public',
    why: 'Marketing images referenced by public URL from the blog. Deliberate.',
  },
  'branding-assets': {
    visibility: 'public',
    why: 'Tenant logos rendered in quotes and portals. Deliberate.',
  },
  files: { visibility: 'private', why: 'Arbitrary customer uploads.' },
  'meeting-recordings': { visibility: 'private', why: 'Recorded conversations.' },
  'qbr-artifacts': {
    visibility: 'private',
    why: 'Quarterly business reviews: customer fleet, usage and spend.',
  },
  qbr: { visibility: 'private', why: 'Legacy name for the QBR bucket. See LEGAL-006.' },
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Fetch one object without credentials to see what an outsider actually gets. */
async function probeAnonymously(bucket: string): Promise<string> {
  const { data, error } = await admin.storage.from(bucket).list('', { limit: 1 });
  if (error) return `probe skipped (${error.message})`;
  const first = (data ?? []).find((o) => (o as { id?: string }).id);
  if (!first) return 'bucket empty, nothing to probe';

  const url = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(first.name)}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.ok
      ? `REACHABLE without auth (HTTP ${res.status})`
      : `not reachable without auth (HTTP ${res.status})`;
  } catch (err) {
    return `probe failed (${(err as Error).message})`;
  }
}

async function main() {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) {
    console.error(`Could not list buckets: ${error.message}`);
    process.exit(1);
  }

  const rows: Array<{
    name: string;
    actual: string;
    expected: string;
    drift: boolean;
    probe: string;
    why: string;
  }> = [];

  for (const b of buckets ?? []) {
    const actual = b.public ? 'public' : 'private';
    const expectation = EXPECTED[b.name];
    const probe = b.public ? await probeAnonymously(b.name) : 'n/a (private)';
    rows.push({
      name: b.name,
      actual,
      expected: expectation?.visibility ?? 'UNREVIEWED',
      drift: expectation ? expectation.visibility !== actual : true,
      probe,
      why: expectation?.why ?? 'Not in the expected inventory. Review it.',
    });
  }

  if (MARKDOWN) {
    console.log('| Bucket | Actual | Expected | Anonymous fetch | Notes |');
    console.log('| --- | --- | --- | --- | --- |');
    for (const r of rows) {
      const flag = r.drift ? ' **DRIFT**' : '';
      console.log(`| \`${r.name}\` | ${r.actual}${flag} | ${r.expected} | ${r.probe} | ${r.why} |`);
    }
  } else {
    for (const r of rows) {
      console.log(`${r.drift ? 'DRIFT ' : 'ok    '} ${r.name}`);
      console.log(`         actual=${r.actual} expected=${r.expected}`);
      console.log(`         anonymous fetch: ${r.probe}`);
      console.log(`         ${r.why}`);
    }
  }

  const drifted = rows.filter((r) => r.drift);
  console.log(
    `\n${rows.length} bucket(s), ${drifted.length} needing attention${
      drifted.length ? ': ' + drifted.map((d) => d.name).join(', ') : ''
    }.`,
  );
  // Non-zero on drift so this can gate a pipeline later without changes.
  process.exit(drifted.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
