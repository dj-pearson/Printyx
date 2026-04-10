/**
 * Disposable Email Domain Service
 *
 * Maintains the platform-global blocklist of disposable/throwaway email
 * providers and answers `isDisposable(email)` for the signup flow.
 *
 * The blocklist is small (<100KB for ~10k domains) and rarely changes, so
 * we keep an in-memory Set and refresh it lazily on a short TTL. Lookups on
 * the hot signup path stay O(1) without hitting the database.
 */

import { db } from '../db';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import {
  disposableEmailDomains,
  type DisposableEmailDomain,
  type InsertDisposableEmailDomain,
} from '@shared/disposable-email-schema';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('disposable-email-service');

/** TTL for the in-memory cache of blocked domains. */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface DomainCache {
  blocked: Set<string>;
  loadedAt: number;
}

let cache: DomainCache | null = null;
let pendingLoad: Promise<DomainCache> | null = null;

/** Normalize a domain or email to a lowercase, trimmed domain. */
export function extractDomain(emailOrDomain: string): string | null {
  if (!emailOrDomain) return null;
  const normalized = emailOrDomain.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('@')) {
    const parts = normalized.split('@');
    const domain = parts[parts.length - 1];
    return domain || null;
  }
  return normalized;
}

/** Force-load the cache from the database. */
async function loadCache(): Promise<DomainCache> {
  const rows = await db
    .select({ domain: disposableEmailDomains.domain })
    .from(disposableEmailDomains)
    .where(eq(disposableEmailDomains.isBlocked, true));

  const blocked = new Set(rows.map((r) => r.domain.toLowerCase()));
  const next: DomainCache = { blocked, loadedAt: Date.now() };
  cache = next;
  log.info({ count: blocked.size }, 'Loaded disposable email blocklist cache');
  return next;
}

/** Get the cached blocklist, refreshing if expired. */
async function getCache(): Promise<DomainCache> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache;
  }
  if (pendingLoad) {
    return pendingLoad;
  }
  pendingLoad = loadCache().finally(() => {
    pendingLoad = null;
  });
  try {
    return await pendingLoad;
  } catch (err) {
    // If the DB is unreachable but we have a stale cache, keep using it
    // rather than blocking signups or letting every email through.
    if (cache) {
      log.warn({ err }, 'Failed to refresh disposable email cache, using stale copy');
      return cache;
    }
    log.error({ err }, 'Failed to load disposable email cache; allowing traffic');
    const empty: DomainCache = { blocked: new Set(), loadedAt: Date.now() };
    cache = empty;
    return empty;
  }
}

/** Invalidate the cache so the next lookup reloads from the database. */
export function invalidateDisposableEmailCache(): void {
  cache = null;
}

/**
 * Check if an email address (or domain) belongs to a blocked disposable
 * email provider. Returns `{ blocked: true, domain }` when it does.
 */
export async function isDisposableEmail(
  emailOrDomain: string,
): Promise<{ blocked: boolean; domain: string | null }> {
  const domain = extractDomain(emailOrDomain);
  if (!domain) return { blocked: false, domain: null };
  const { blocked } = await getCache();
  return { blocked: blocked.has(domain), domain };
}

/** Synchronous check that only uses the warm cache. Falls back to `false`. */
export function isDisposableEmailSync(emailOrDomain: string): boolean {
  const domain = extractDomain(emailOrDomain);
  if (!domain || !cache) return false;
  return cache.blocked.has(domain);
}

// ─── Admin operations ───────────────────────────────────────────────────────

export interface ListDomainsOptions {
  search?: string;
  blocked?: boolean;
  source?: string;
  limit?: number;
  offset?: number;
}

export interface ListDomainsResult {
  rows: DisposableEmailDomain[];
  total: number;
  blockedCount: number;
  allowedCount: number;
}

/** List domains with optional search, filter, and pagination. */
export async function listDomains(options: ListDomainsOptions = {}): Promise<ListDomainsResult> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  const offset = Math.max(options.offset ?? 0, 0);

  const filters = [];
  if (options.search) {
    filters.push(ilike(disposableEmailDomains.domain, `%${options.search.toLowerCase()}%`));
  }
  if (typeof options.blocked === 'boolean') {
    filters.push(eq(disposableEmailDomains.isBlocked, options.blocked));
  }
  if (options.source) {
    filters.push(eq(disposableEmailDomains.source, options.source));
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  const rows = whereClause
    ? await db
        .select()
        .from(disposableEmailDomains)
        .where(whereClause)
        .orderBy(asc(disposableEmailDomains.domain))
        .limit(limit)
        .offset(offset)
    : await db
        .select()
        .from(disposableEmailDomains)
        .orderBy(asc(disposableEmailDomains.domain))
        .limit(limit)
        .offset(offset);

  // Total matching the current filter
  const totalRow = whereClause
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(disposableEmailDomains)
        .where(whereClause)
    : await db.select({ count: sql<number>`count(*)::int` }).from(disposableEmailDomains);
  const total = totalRow[0]?.count ?? 0;

  // Aggregate counts across the whole table (unfiltered) for the header.
  const statsRows = await db
    .select({
      blocked: sql<number>`count(*) filter (where is_blocked = true)::int`,
      allowed: sql<number>`count(*) filter (where is_blocked = false)::int`,
    })
    .from(disposableEmailDomains);
  const blockedCount = statsRows[0]?.blocked ?? 0;
  const allowedCount = statsRows[0]?.allowed ?? 0;

  return { rows, total, blockedCount, allowedCount };
}

/** Fetch a single domain record by id. */
export async function getDomainById(id: string): Promise<DisposableEmailDomain | null> {
  const [row] = await db
    .select()
    .from(disposableEmailDomains)
    .where(eq(disposableEmailDomains.id, id))
    .limit(1);
  return row ?? null;
}

/** Add a single domain. Upserts on conflict (re-blocks if previously allowed). */
export async function addDomain(
  input: Omit<InsertDisposableEmailDomain, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<DisposableEmailDomain> {
  const domain = input.domain.trim().toLowerCase();
  const [row] = await db
    .insert(disposableEmailDomains)
    .values({
      domain,
      isBlocked: input.isBlocked ?? true,
      source: input.source ?? 'manual',
      notes: input.notes ?? null,
      addedBy: input.addedBy ?? null,
    })
    .onConflictDoUpdate({
      target: disposableEmailDomains.domain,
      set: {
        isBlocked: input.isBlocked ?? true,
        notes: input.notes ?? null,
        addedBy: input.addedBy ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  invalidateDisposableEmailCache();
  return row;
}

/** Update a domain's block status or notes. */
export async function updateDomain(
  id: string,
  patch: { isBlocked?: boolean; notes?: string | null; updatedBy?: string | null },
): Promise<DisposableEmailDomain | null> {
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof patch.isBlocked === 'boolean') update.isBlocked = patch.isBlocked;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.updatedBy) update.addedBy = patch.updatedBy;

  const [row] = await db
    .update(disposableEmailDomains)
    .set(update)
    .where(eq(disposableEmailDomains.id, id))
    .returning();

  invalidateDisposableEmailCache();
  return row ?? null;
}

/** Permanently delete a domain entry. */
export async function deleteDomain(id: string): Promise<boolean> {
  const result = await db
    .delete(disposableEmailDomains)
    .where(eq(disposableEmailDomains.id, id))
    .returning({ id: disposableEmailDomains.id });

  invalidateDisposableEmailCache();
  return result.length > 0;
}

export interface BulkAddResult {
  inserted: number;
  updated: number;
  skipped: number;
  total: number;
}

/**
 * Bulk-insert a list of domains. Upserts: existing entries are re-blocked
 * (useful for refreshing from the upstream public list).
 */
export async function bulkAddDomains(
  rawDomains: string[],
  options: {
    source?: 'seed' | 'manual' | 'import';
    notes?: string | null;
    addedBy?: string | null;
    batchSize?: number;
  } = {},
): Promise<BulkAddResult> {
  const source = options.source ?? 'import';
  const addedBy = options.addedBy ?? null;
  const notes = options.notes ?? null;
  const batchSize = options.batchSize ?? 500;

  // Deduplicate and normalize
  const normalized = Array.from(
    new Set(
      rawDomains
        .map((d) => d?.trim().toLowerCase())
        .filter((d): d is string => !!d && d.length >= 3 && d.includes('.')),
    ),
  );

  let inserted = 0;
  let updated = 0;
  const skipped = rawDomains.length - normalized.length;

  for (let i = 0; i < normalized.length; i += batchSize) {
    const batch = normalized.slice(i, i + batchSize);
    const values = batch.map((domain) => ({
      domain,
      isBlocked: true,
      source,
      notes,
      addedBy,
    }));

    const result = await db
      .insert(disposableEmailDomains)
      .values(values)
      .onConflictDoUpdate({
        target: disposableEmailDomains.domain,
        set: {
          isBlocked: true,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: disposableEmailDomains.id,
        createdAt: disposableEmailDomains.createdAt,
        updatedAt: disposableEmailDomains.updatedAt,
      });

    // A row is considered "inserted" when createdAt == updatedAt (within
    // ~5ms because PG sets them both to now() in the same statement).
    for (const row of result) {
      const created = new Date(row.createdAt).getTime();
      const touched = new Date(row.updatedAt).getTime();
      if (Math.abs(touched - created) < 10) {
        inserted++;
      } else {
        updated++;
      }
    }
  }

  invalidateDisposableEmailCache();

  return { inserted, updated, skipped, total: normalized.length };
}

/** Warm the cache at app start so the first signup doesn't pay the load cost. */
export async function warmDisposableEmailCache(): Promise<void> {
  try {
    await getCache();
  } catch (err) {
    log.warn({ err }, 'Initial disposable email cache warm failed');
  }
}
