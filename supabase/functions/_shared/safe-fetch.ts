// SSRF-safe fetch for edge functions.
//
// PA-052: the Deno counterpart of server/lib/safe-http-client.ts, ported so the
// social-media function can post to a tenant-supplied webhook URL without that
// being an arbitrary outbound request from inside the cluster with the
// service-role key in scope.
//
// Same four controls as the Node original, in the same order:
//   1. static URL validation (scheme, blocked hostnames, private IP literals,
//      numeric-encoding tricks)
//   2. DNS resolution, with every resolved address checked against the private
//      ranges - this is what stops a public hostname pointing at 127.0.0.1
//   3. a request timeout
//   4. manual redirect handling, re-running 1 and 2 on every hop, because
//      following redirects blindly is how the first two get bypassed
//
// Deno.resolveDns needs --allow-net, which edge functions already run with. If
// it is unavailable the resolution step FAILS CLOSED rather than skipping.
import { isPrivateIP, validateUrl } from './ssrf.ts';

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = [301, 302, 303, 307, 308];

export class SSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SSRFError';
  }
}

const IPV4_LITERAL = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

async function validateDnsResolution(hostname: string): Promise<void> {
  // A raw IPv4 literal was already checked by validateUrl.
  if (IPV4_LITERAL.test(hostname)) return;

  const resolved: string[] = [];

  for (const recordType of ['A', 'AAAA'] as const) {
    try {
      resolved.push(...(await Deno.resolveDns(hostname, recordType)));
    } catch (err) {
      // NotFound just means no records of that type. Anything else - including
      // the permission being absent - must not be read as "nothing private here".
      if (!(err instanceof Deno.errors.NotFound)) {
        if (err instanceof Deno.errors.PermissionDenied) {
          throw new SSRFError(
            `Cannot verify where ${hostname} resolves (DNS permission denied); refusing the request`,
          );
        }
      }
    }
  }

  if (resolved.length === 0) {
    throw new SSRFError(`DNS resolution failed for hostname: ${hostname}`);
  }

  for (const ip of resolved) {
    if (isPrivateIP(ip)) {
      throw new SSRFError(`Hostname ${hostname} resolves to private/reserved IP: ${ip}`);
    }
  }
}

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
  maxRedirects?: number;
}

export async function safeFetch(url: string, options?: SafeFetchOptions): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options?.maxRedirects ?? MAX_REDIRECTS;

  const validation = validateUrl(url);
  if (!validation.valid) {
    throw new SSRFError(`SSRF protection blocked request to ${url}: ${validation.reason}`);
  }

  await validateDnsResolution(new URL(url).hostname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const { timeoutMs: _t, maxRedirects: _m, ...fetchOptions } = options ?? {};

  try {
    let currentUrl = url;
    let redirectCount = 0;

    while (true) {
      const response = await fetch(currentUrl, {
        ...fetchOptions,
        signal: controller.signal,
        redirect: 'manual',
      });

      if (!REDIRECT_STATUSES.includes(response.status)) return response;

      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new Error(`Too many redirects (max ${maxRedirects})`);
      }

      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect response missing Location header');

      const redirectUrl = new URL(location, currentUrl).toString();

      const redirectValidation = validateUrl(redirectUrl);
      if (!redirectValidation.valid) {
        throw new SSRFError(
          `SSRF protection blocked redirect to ${redirectUrl}: ${redirectValidation.reason}`,
        );
      }

      await validateDnsResolution(new URL(redirectUrl).hostname);
      currentUrl = redirectUrl;
    }
  } catch (error) {
    if (error instanceof SSRFError) throw error;
    if ((error as Error).name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
