/**
 * The agent ingest path has one implementation (AUDIT-037).
 *
 * supabase/functions/client-metrics/ was a second one, marked DEPRECATED in its
 * own header and kept "for backwards compatibility with anything that may still
 * call it directly". Nothing could: it read the API key from an `x-api-key`
 * header the agent never sends, and compared that raw value against
 * monitoring_clients.api_key, which stores a SHA-256 hash. So every request
 * 401'd at the gate and nothing behind it had ever run.
 *
 * What sat behind the gate is why the directory went rather than getting a
 * matching auth fix: all four write paths discarded their PostgREST error and
 * answered 200. /submit and /alerts named ten columns device_metrics and
 * device_alerts do not have, /devices queried `discovered_devices` (the table
 * is client_discovered_devices), and /heartbeat had the same key twice in one
 * object literal - a timestamp then an object - so the second won and wrote an
 * object into a timestamp column. An agent would have been told
 * `{ success: true, received: 12, processed: 0 }`.
 *
 * These assert outcomes: the Express handler is the one implementation, and it
 * still hashes. Neither goes stale.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

describe('client-metrics ingest', () => {
  it('the deprecated edge function is gone', () => {
    expect(existsSync(join(repo, 'supabase/functions/client-metrics'))).toBe(false);
  });

  it('Express still serves the prefix', () => {
    expect(read('server/routes-registry.ts')).toContain("app.use('/api/client-metrics'");
  });

  it('the live handler hashes the key before comparing it', () => {
    const src = read('server/routes-client-monitoring.ts');
    expect(src).toMatch(/createHash\(\s*['"]sha256['"]\s*\)/);
    // A plaintext comparison against the column would silently authenticate
    // nobody, which is exactly how the deleted function failed.
    expect(src).toMatch(/eq\(\s*monitoringClients\.apiKey,\s*hashedApiKey\s*\)/);
  });

  it('the agent sends a Bearer header, which is what the live handler reads', () => {
    expect(read('printyx-client/src/api/printyx-client.ts')).toMatch(/Bearer \$\{/);
    expect(read('server/routes-client-monitoring.ts')).toMatch(
      /headers\['authorization'\]\?\.replace\('Bearer '/,
    );
  });

  it('monitoring_clients.last_heartbeat is a timestamp, not a status object', () => {
    const schema = read('shared/client-monitor-schema.ts');
    expect(schema).toMatch(/lastHeartbeat:\s*timestamp\('last_heartbeat'\)/);
  });
});
