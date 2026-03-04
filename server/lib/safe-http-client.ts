/**
 * Safe HTTP Client
 *
 * A fetch wrapper that enforces SSRF protection by:
 * 1. Validating the URL against the SSRF filter before making requests
 * 2. Performing DNS resolution and checking resolved IPs against private ranges
 * 3. Enforcing request timeouts (default 10s)
 * 4. Validating redirect targets to prevent redirect-based SSRF bypasses
 */

import { createModuleLogger } from '../lib/logger';
import { validateUrl, isPrivateIP } from '../middleware/ssrf-protection';
import * as dns from 'dns';
import { promisify } from 'util';

const log = createModuleLogger('safe-http-client');

const dnsResolve4 = promisify(dns.resolve4);
const dnsResolve6 = promisify(dns.resolve6);

/** Default request timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 10_000;

/** Maximum number of redirects to follow */
const MAX_REDIRECTS = 5;

export class SSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SSRFError';
  }
}

/**
 * Resolve a hostname and verify that none of the resolved IPs are private/reserved.
 * Throws SSRFError if any resolved address is private.
 */
async function validateDnsResolution(hostname: string): Promise<void> {
  // Skip DNS check for raw IPs — already checked by validateUrl
  const ipMatch = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  if (ipMatch) {
    return;
  }

  const resolvedIPs: string[] = [];

  try {
    const ipv4s = await dnsResolve4(hostname);
    resolvedIPs.push(...ipv4s);
  } catch {
    // No A records - that's fine, might only have AAAA
  }

  try {
    const ipv6s = await dnsResolve6(hostname);
    resolvedIPs.push(...ipv6s);
  } catch {
    // No AAAA records
  }

  if (resolvedIPs.length === 0) {
    throw new SSRFError(`DNS resolution failed for hostname: ${hostname}`);
  }

  for (const ip of resolvedIPs) {
    if (isPrivateIP(ip)) {
      log.warn({ hostname, ip }, 'DNS resolution returned private IP — SSRF blocked');
      throw new SSRFError(
        `Hostname ${hostname} resolves to private/reserved IP: ${ip}`
      );
    }
  }

  log.debug({ hostname, resolvedIPs }, 'DNS resolution passed SSRF check');
}

export interface SafeFetchOptions extends RequestInit {
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
  /** Maximum redirects to follow (default: 5). Set to 0 to disable redirect following. */
  maxRedirects?: number;
}

/**
 * A safe fetch wrapper that validates URLs against SSRF before making requests.
 *
 * - Validates the URL scheme, hostname, and IP against the SSRF blocklist
 * - Performs DNS resolution and checks resolved IPs for private ranges
 * - Enforces a request timeout (default 10s)
 * - Follows redirects but validates each redirect target
 *
 * @throws {SSRFError} if the URL fails SSRF validation
 * @throws {Error} if the request times out or fails
 */
export async function safeFetch(
  url: string,
  options?: SafeFetchOptions
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options?.maxRedirects ?? MAX_REDIRECTS;

  // Step 1: Static URL validation
  const validation = validateUrl(url);
  if (!validation.valid) {
    log.warn({ url, reason: validation.reason }, 'SSRF validation blocked request');
    throw new SSRFError(`SSRF protection blocked request to ${url}: ${validation.reason}`);
  }

  // Step 2: DNS resolution check
  const parsed = new URL(url);
  await validateDnsResolution(parsed.hostname);

  // Step 3: Make the request with timeout and manual redirect handling
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Strip our custom options before passing to fetch
  const { timeoutMs: _t, maxRedirects: _m, ...fetchOptions } = options ?? {};

  try {
    let currentUrl = url;
    let redirectCount = 0;

    while (true) {
      log.debug({ url: currentUrl, redirectCount }, 'Making safe HTTP request');

      const response = await fetch(currentUrl, {
        ...fetchOptions,
        signal: controller.signal,
        redirect: 'manual', // Handle redirects ourselves to validate targets
      });

      // Check if this is a redirect
      const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
      if (!isRedirect) {
        return response;
      }

      // Handle redirect
      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new Error(`Too many redirects (max ${maxRedirects})`);
      }

      const location = response.headers.get('location');
      if (!location) {
        throw new Error('Redirect response missing Location header');
      }

      // Resolve relative redirect URLs
      const redirectUrl = new URL(location, currentUrl).toString();

      // Validate the redirect target
      const redirectValidation = validateUrl(redirectUrl);
      if (!redirectValidation.valid) {
        log.warn(
          { originalUrl: url, redirectUrl, reason: redirectValidation.reason },
          'SSRF validation blocked redirect target'
        );
        throw new SSRFError(
          `SSRF protection blocked redirect to ${redirectUrl}: ${redirectValidation.reason}`
        );
      }

      // DNS check on redirect target
      const redirectParsed = new URL(redirectUrl);
      await validateDnsResolution(redirectParsed.hostname);

      currentUrl = redirectUrl;
    }
  } catch (error) {
    if (error instanceof SSRFError) {
      throw error;
    }
    if ((error as Error).name === 'AbortError') {
      log.warn({ url, timeoutMs }, 'Safe HTTP request timed out');
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
