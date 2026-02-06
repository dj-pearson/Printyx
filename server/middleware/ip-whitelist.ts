/**
 * IP Whitelist Middleware
 *
 * Provides IP-based access control for enterprise customers.
 * Supports CIDR notation, individual IPs, and IP ranges.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('ip-whitelist');

import {
  getSecuritySettings,
  updateSecuritySettings,
  getTenantAdmins,
} from '../storage/security-storage';
import * as net from 'net';

// IP Whitelist Configuration
export interface IpWhitelistConfig {
  enabled: boolean;
  mode: 'allow' | 'deny'; // Allow listed IPs only, or deny listed IPs
  addresses: string[]; // List of IPs, CIDR ranges, or IP ranges
  bypassRoles?: string[]; // Roles that bypass IP restrictions
  exemptPaths?: string[]; // Paths exempt from IP checking
  logDenied?: boolean;
  notifyOnDenied?: boolean;
}

// Default configuration
export const DEFAULT_IP_CONFIG: IpWhitelistConfig = {
  enabled: false,
  mode: 'allow',
  addresses: [],
  bypassRoles: ['platform_admin'],
  exemptPaths: ['/api/health', '/api/auth/login', '/.well-known'],
  logDenied: true,
  notifyOnDenied: false,
};

// In-memory cache for tenant IP configurations
const configCache = new Map<string, { config: IpWhitelistConfig; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Parse IP address from request
 */
export function getClientIp(req: Request): string {
  // Check various headers for proxied requests
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list; take the first one
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Fall back to connection remote address
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Parse CIDR notation to network address and mask
 */
function parseCidr(cidr: string): { network: number[]; mask: number } | null {
  const parts = cidr.split('/');
  if (parts.length !== 2) return null;

  const ip = parts[0];
  const prefix = parseInt(parts[1], 10);

  if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;

  const ipParts = ip.split('.').map(Number);
  if (ipParts.length !== 4 || ipParts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }

  return { network: ipParts, mask: prefix };
}

/**
 * Check if IP is in CIDR range
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  const parsed = parseCidr(cidr);
  if (!parsed) return false;

  const ipParts = ip.split('.').map(Number);
  if (ipParts.length !== 4 || ipParts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const { network, mask } = parsed;

  // Convert to 32-bit integers
  const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const netNum = (network[0] << 24) | (network[1] << 16) | (network[2] << 8) | network[3];
  const maskNum = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;

  return (ipNum & maskNum) === (netNum & maskNum);
}

/**
 * Parse IP range (e.g., "192.168.1.1-192.168.1.100")
 */
function parseIpRange(range: string): { start: number; end: number } | null {
  const parts = range.split('-');
  if (parts.length !== 2) return null;

  const startParts = parts[0].trim().split('.').map(Number);
  const endParts = parts[1].trim().split('.').map(Number);

  if (startParts.length !== 4 || endParts.length !== 4) return null;
  if (startParts.some((p) => isNaN(p) || p < 0 || p > 255)) return null;
  if (endParts.some((p) => isNaN(p) || p < 0 || p > 255)) return null;

  const start =
    (startParts[0] << 24) | (startParts[1] << 16) | (startParts[2] << 8) | startParts[3];
  const end = (endParts[0] << 24) | (endParts[1] << 16) | (endParts[2] << 8) | endParts[3];

  return { start: start >>> 0, end: end >>> 0 };
}

/**
 * Check if IP is in range
 */
function isIpInRange(ip: string, range: string): boolean {
  const parsed = parseIpRange(range);
  if (!parsed) return false;

  const ipParts = ip.split('.').map(Number);
  if (ipParts.length !== 4 || ipParts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const ipNum = ((ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3]) >>> 0;

  return ipNum >= parsed.start && ipNum <= parsed.end;
}

/**
 * Check if IP matches a whitelist entry
 */
export function isIpAllowed(ip: string, entries: string[]): boolean {
  // Normalize IPv4-mapped IPv6 addresses
  let normalizedIp = ip;
  if (ip.startsWith('::ffff:')) {
    normalizedIp = ip.substring(7);
  }

  for (const entry of entries) {
    // Check for exact match
    if (entry === normalizedIp) {
      return true;
    }

    // Check for CIDR notation
    if (entry.includes('/')) {
      if (isIpInCidr(normalizedIp, entry)) {
        return true;
      }
    }

    // Check for IP range
    if (entry.includes('-') && !entry.includes('/')) {
      if (isIpInRange(normalizedIp, entry)) {
        return true;
      }
    }

    // Check for localhost variations
    if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(entry)) {
      if (['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1'].includes(normalizedIp)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get IP whitelist configuration for a tenant
 */
export async function getTenantIpConfig(tenantId: string): Promise<IpWhitelistConfig> {
  // Check cache
  const cached = configCache.get(tenantId);
  if (cached && Date.now() < cached.expiry) {
    return cached.config;
  }

  try {
    // Fetch from database
    const settings = await getSecuritySettings(tenantId);

    const config: IpWhitelistConfig = {
      enabled: settings?.ipWhitelistEnabled || false,
      mode: (settings?.ipWhitelistMode as 'allow' | 'deny') || 'allow',
      addresses: settings?.ipWhitelistAddresses || [],
      bypassRoles: settings?.ipWhitelistBypassRoles || DEFAULT_IP_CONFIG.bypassRoles,
      exemptPaths: settings?.ipWhitelistExemptPaths || DEFAULT_IP_CONFIG.exemptPaths,
      logDenied: settings?.ipWhitelistLogDenied !== false,
      notifyOnDenied: settings?.ipWhitelistNotifyOnDenied || false,
    };

    // Update cache
    configCache.set(tenantId, { config, expiry: Date.now() + CACHE_TTL_MS });

    return config;
  } catch (error) {
    log.error('Failed to fetch tenant IP config:', error);
    return { ...DEFAULT_IP_CONFIG };
  }
}

/**
 * Clear IP config cache for a tenant
 */
export function clearIpConfigCache(tenantId?: string): void {
  if (tenantId) {
    configCache.delete(tenantId);
  } else {
    configCache.clear();
  }
}

/**
 * IP Whitelist enforcement middleware
 *
 * Usage:
 *   app.use(enforceIpWhitelist());
 *   app.use('/api/admin', enforceIpWhitelist({ requireWhitelist: true }));
 */
export function enforceIpWhitelist(options?: {
  requireWhitelist?: boolean; // Force whitelist check even if tenant config is disabled
  additionalWhitelist?: string[]; // Additional IPs to always allow
}) {
  const { requireWhitelist = false, additionalWhitelist = [] } = options || {};

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientIp = getClientIp(req);
      const session = req.session as any;
      const tenantId = session?.tenantId || (req.headers['x-tenant-id'] as string);

      // Get tenant configuration
      const config = tenantId ? await getTenantIpConfig(tenantId) : { ...DEFAULT_IP_CONFIG };

      // Skip if IP whitelist is not enabled and not required
      if (!config.enabled && !requireWhitelist) {
        return next();
      }

      // Check exempt paths
      if (config.exemptPaths?.some((path) => req.path.startsWith(path))) {
        return next();
      }

      // Check bypass roles (if user is authenticated)
      const user = (req as any).user || session?.user;
      if (user && config.bypassRoles?.includes(user.role)) {
        return next();
      }

      // Combine configured whitelist with additional IPs
      const allAllowedIps = [...(config.addresses || []), ...additionalWhitelist];

      // Check if IP is allowed
      const isAllowed =
        config.mode === 'allow'
          ? isIpAllowed(clientIp, allAllowedIps)
          : !isIpAllowed(clientIp, allAllowedIps);

      if (!isAllowed) {
        // Log denied access
        if (config.logDenied) {
          log.warn(
            `[IP WHITELIST] Access denied for IP: ${clientIp}, path: ${req.path}, tenant: ${tenantId || 'unknown'}`,
          );
        }

        // Notify if configured
        if (config.notifyOnDenied) {
          await notifyIpDenied(tenantId, clientIp, req.path, user?.email);
        }

        return res.status(403).json({
          error: 'Access denied',
          code: 'IP_NOT_ALLOWED',
          message: 'Your IP address is not authorized to access this resource.',
          ip: clientIp, // Only include in non-production or for debugging
        });
      }

      next();
    } catch (error) {
      log.error('IP whitelist check error:', error);
      // Fail open in case of error (configurable)
      next();
    }
  };
}

/**
 * Notify administrators about denied IP access
 */
async function notifyIpDenied(
  tenantId: string | undefined,
  ip: string,
  path: string,
  userEmail?: string,
): Promise<void> {
  try {
    // Get tenant admin emails
    const admins = tenantId ? await getTenantAdmins(tenantId) : [];

    if (admins.length === 0) {
      return;
    }

    // Send notification email
    const { emailService } = await import('../services/email-service');

    for (const admin of admins.slice(0, 5)) {
      // Limit to 5 admins
      await emailService.send({
        to: admin.email,
        subject: '[Security Alert] IP Access Denied',
        html: `
          <h2>IP Access Denied</h2>
          <p>An access attempt was blocked by your IP whitelist settings.</p>
          <table>
            <tr><td><strong>IP Address:</strong></td><td>${ip}</td></tr>
            <tr><td><strong>Path:</strong></td><td>${path}</td></tr>
            <tr><td><strong>User Email:</strong></td><td>${userEmail || 'Not authenticated'}</td></tr>
            <tr><td><strong>Time:</strong></td><td>${new Date().toISOString()}</td></tr>
          </table>
          <p>If this is unexpected, please review your security settings.</p>
        `,
        text: `IP Access Denied\n\nIP: ${ip}\nPath: ${path}\nUser: ${userEmail || 'Not authenticated'}\nTime: ${new Date().toISOString()}`,
      });
    }
  } catch (error) {
    log.error('Failed to send IP denied notification:', error);
  }
}

/**
 * Validate IP whitelist entries
 */
export function validateWhitelistEntries(entries: string[]): {
  valid: boolean;
  errors: string[];
  validEntries: string[];
} {
  const errors: string[] = [];
  const validEntries: string[] = [];

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    // Check for valid IPv4
    if (net.isIPv4(trimmed)) {
      validEntries.push(trimmed);
      continue;
    }

    // Check for valid IPv6
    if (net.isIPv6(trimmed)) {
      validEntries.push(trimmed);
      continue;
    }

    // Check for valid CIDR
    if (trimmed.includes('/')) {
      const parsed = parseCidr(trimmed);
      if (parsed) {
        validEntries.push(trimmed);
        continue;
      }
      errors.push(`Invalid CIDR notation: ${trimmed}`);
      continue;
    }

    // Check for valid IP range
    if (trimmed.includes('-')) {
      const parsed = parseIpRange(trimmed);
      if (parsed) {
        validEntries.push(trimmed);
        continue;
      }
      errors.push(`Invalid IP range: ${trimmed}`);
      continue;
    }

    // Special entries
    if (trimmed === 'localhost') {
      validEntries.push(trimmed);
      continue;
    }

    errors.push(`Invalid IP entry: ${trimmed}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    validEntries,
  };
}

/**
 * Update IP whitelist for a tenant
 */
export async function updateTenantIpWhitelist(
  tenantId: string,
  config: Partial<IpWhitelistConfig>,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate entries if provided
    if (config.addresses) {
      const validation = validateWhitelistEntries(config.addresses);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid entries: ${validation.errors.join(', ')}`,
        };
      }
      config.addresses = validation.validEntries;
    }

    // Update in database
    await updateSecuritySettings(tenantId, {
      ipWhitelistEnabled: config.enabled,
      ipWhitelistMode: config.mode,
      ipWhitelistAddresses: config.addresses,
      ipWhitelistBypassRoles: config.bypassRoles,
      ipWhitelistExemptPaths: config.exemptPaths,
      ipWhitelistLogDenied: config.logDenied,
      ipWhitelistNotifyOnDenied: config.notifyOnDenied,
    });

    // Clear cache
    clearIpConfigCache(tenantId);

    return { success: true };
  } catch (error) {
    log.error('Failed to update IP whitelist:', error);
    return {
      success: false,
      error: 'Failed to update IP whitelist settings',
    };
  }
}

export default {
  enforceIpWhitelist,
  getClientIp,
  isIpAllowed,
  getTenantIpConfig,
  clearIpConfigCache,
  validateWhitelistEntries,
  updateTenantIpWhitelist,
  DEFAULT_IP_CONFIG,
};
