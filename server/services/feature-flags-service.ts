/**
 * Feature Flags Service
 * US-035: Check feature flag state with tenant overrides and rollout percentages.
 *
 * Priority: tenant override > rollout percentage > global enabled
 */

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { featureFlags, type FeatureFlag } from '@shared/feature-flags-schema';
import { createModuleLogger } from '../lib/logger';
import { config } from '../config';

const log = createModuleLogger('feature-flags-service');

// In-memory cache for feature flags
let flagsCache: FeatureFlag[] = [];
let cacheExpiry = 0;
const CACHE_TTL_MS = config.cache.defaultTtl * 1000; // Convert seconds to ms

/**
 * Load all flags from DB, with in-memory cache.
 */
async function loadFlags(): Promise<FeatureFlag[]> {
  const now = Date.now();
  if (flagsCache.length > 0 && now < cacheExpiry) {
    return flagsCache;
  }

  try {
    flagsCache = await db.select().from(featureFlags);
    cacheExpiry = now + CACHE_TTL_MS;
  } catch (error) {
    log.error('Failed to load feature flags:', error);
    // Return cached data even if expired on error
    if (flagsCache.length > 0) return flagsCache;
    return [];
  }

  return flagsCache;
}

/**
 * Check if a feature flag is enabled.
 *
 * Resolution order:
 * 1. Tenant-specific override (if tenantId provided)
 * 2. Rollout percentage (deterministic hash based on userId or tenantId)
 * 3. Global enabled/disabled
 */
export async function isEnabled(
  flagName: string,
  context?: { tenantId?: string; userId?: string },
): Promise<boolean> {
  const flags = await loadFlags();
  const flag = flags.find((f) => f.name === flagName);

  if (!flag) {
    // Unknown flag defaults to disabled
    return false;
  }

  // 1. Check tenant override
  if (context?.tenantId && flag.tenantOverrides) {
    const overrides = flag.tenantOverrides as Record<string, boolean>;
    if (context.tenantId in overrides) {
      return overrides[context.tenantId];
    }
  }

  // 2. If globally disabled, return false
  if (!flag.enabled) {
    return false;
  }

  // 3. Check rollout percentage
  if (flag.rolloutPercentage < 100) {
    const identifier = context?.userId || context?.tenantId || 'default';
    const hash = simpleHash(`${flagName}:${identifier}`);
    return hash % 100 < flag.rolloutPercentage;
  }

  return true;
}

/**
 * Get all flags with their resolved state for a given context.
 */
export async function getAllFlags(context?: {
  tenantId?: string;
  userId?: string;
}): Promise<Record<string, boolean>> {
  const flags = await loadFlags();
  const result: Record<string, boolean> = {};

  for (const flag of flags) {
    result[flag.name] = await isEnabled(flag.name, context);
  }

  return result;
}

/**
 * Get all raw flag records.
 */
export async function listFlags(): Promise<FeatureFlag[]> {
  return loadFlags();
}

/**
 * Get a single flag by name.
 */
export async function getFlag(name: string): Promise<FeatureFlag | undefined> {
  const flags = await loadFlags();
  return flags.find((f) => f.name === name);
}

/**
 * Update a flag (platform admin only).
 */
export async function updateFlag(
  name: string,
  updates: Partial<
    Pick<FeatureFlag, 'enabled' | 'description' | 'rolloutPercentage' | 'tenantOverrides'>
  >,
): Promise<FeatureFlag | null> {
  try {
    const [updated] = await db
      .update(featureFlags)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(featureFlags.name, name))
      .returning();

    if (updated) {
      // Invalidate cache
      cacheExpiry = 0;
      log.info(`Feature flag "${name}" updated:`, updates);
    }

    return updated || null;
  } catch (error) {
    log.error(`Failed to update feature flag "${name}":`, error);
    throw error;
  }
}

/**
 * Create a new flag.
 */
export async function createFlag(data: {
  name: string;
  description?: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  tenantOverrides?: Record<string, boolean>;
}): Promise<FeatureFlag> {
  const [flag] = await db
    .insert(featureFlags)
    .values({
      name: data.name,
      description: data.description || '',
      enabled: data.enabled ?? false,
      rolloutPercentage: data.rolloutPercentage ?? 100,
      tenantOverrides: data.tenantOverrides ?? {},
    })
    .returning();

  // Invalidate cache
  cacheExpiry = 0;
  log.info(`Feature flag "${data.name}" created`);
  return flag;
}

/**
 * Invalidate the flags cache (call after external updates).
 */
export function invalidateCache(): void {
  cacheExpiry = 0;
  flagsCache = [];
}

/**
 * Simple deterministic hash for rollout percentage calculation.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export default {
  isEnabled,
  getAllFlags,
  listFlags,
  getFlag,
  updateFlag,
  createFlag,
  invalidateCache,
};
