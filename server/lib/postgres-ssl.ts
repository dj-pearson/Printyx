/**
 * Shared TLS settings for node-postgres (Pool).
 * Remote hosts typically require SSL; local postgres usually does not.
 * Opt out with DB_SSL=false when connecting to a remote server without TLS.
 */

function parseDatabaseUrlHost(url: string): string | null {
  try {
    const normalized = url.replace(/^postgres(ql)?:\/\//, 'http://');
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when the DB host is likely a public / routed endpoint (needs TLS), not a typical Docker service name. */
function isLikelyRemoteTlsHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return hostname !== '127.0.0.1';
  }
  // e.g. db, postgres — internal compose/k8s names, usually plaintext
  if (!hostname.includes('.')) return false;
  return true;
}

function sslModeFromUrl(url: string): string | null {
  const m = url.match(/[?&]sslmode=([^&]+)/i);
  return m?.[1]?.toLowerCase() ?? null;
}

/**
 * Whether node-pg should use TLS. Mirrors production expectations for cloud/remote Postgres.
 * @param connectionStringOverride - If set (e.g. migrate-only URL), host/sslmode are derived from this instead of DATABASE_URL.
 */
export function shouldUseSslForPostgres(connectionStringOverride?: string): boolean {
  if (process.env.DB_SSL === 'false') return false;
  if (process.env.DB_SSL === 'true') return true;
  if (process.env.NODE_ENV === 'production') return true;

  const url = connectionStringOverride?.trim() || process.env.DATABASE_URL || '';
  if (url.startsWith('postgres')) {
    const mode = sslModeFromUrl(url);
    if (mode === 'disable') return false;
    if (mode && ['require', 'verify-full', 'verify-ca', 'prefer', 'allow'].includes(mode)) {
      return true;
    }
    const host = parseDatabaseUrlHost(url);
    if (host && isLikelyRemoteTlsHost(host)) return true;
  }

  const dbHost = process.env.DB_HOST?.toLowerCase();
  if (
    dbHost &&
    !dbHost.startsWith('http://') &&
    !dbHost.startsWith('https://') &&
    isLikelyRemoteTlsHost(dbHost)
  ) {
    return true;
  }

  return false;
}

/** `pg` Pool `ssl` option: boolean or TLS options object. */
export function getPgSslConfigFromEnv(
  connectionStringOverride?: string,
): true | { rejectUnauthorized: boolean } | undefined {
  if (!shouldUseSslForPostgres(connectionStringOverride)) return undefined;
  return process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? { rejectUnauthorized: false } : true;
}
