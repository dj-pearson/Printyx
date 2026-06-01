/**
 * Task Workflow — Assignee Matcher
 *
 * Fuzzy-matches a raw assignee label parsed from an upload (e.g. "Austin",
 * "Tay on ITT Form", "Dan Pearson", "Accounts Receivable") against the active
 * users in a tenant. Returns a best-guess user id + a 0..1 confidence so the
 * builder UI can pre-fill the assignee and flag low-confidence / unmatched rows
 * for the creator to confirm before saving.
 *
 * Pure heuristic (no external calls): normalized exact match on full name /
 * email / first name, then a Levenshtein-similarity fallback. Labels that
 * clearly denote a role/group rather than a person (e.g. "Accounts Receivable")
 * tend to score low and surface as unmatched — by design.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '@shared/schema';

export interface CandidateUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export interface MatchResult {
  userId: string | null;
  confidence: number; // 0..1
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Load the candidate users for a tenant once, then reuse for many matches.
 */
export async function loadCandidateUsers(tenantId: string): Promise<CandidateUser[]> {
  return db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)));
}

/**
 * Match a single raw label against the candidate set. Synchronous so it can be
 * mapped over many parsed rows after one DB load.
 */
export function matchAssignee(rawLabel: string, candidates: CandidateUser[]): MatchResult {
  const label = normalize(rawLabel || '');
  if (!label) return { userId: null, confidence: 0 };

  // The label may carry trailing qualifiers ("Tay on ITT Form" -> "tay").
  const firstToken = label.split(' ')[0];

  let best: MatchResult = { userId: null, confidence: 0 };

  for (const c of candidates) {
    const fullName = normalize(`${c.firstName || ''} ${c.lastName || ''}`);
    const first = normalize(c.firstName || '');
    const emailLocal = normalize((c.email || '').split('@')[0] || '');

    let score = 0;

    // Exact, high-confidence signals
    if (fullName && (label === fullName || label.startsWith(fullName))) score = 1;
    else if (first && firstToken === first) score = Math.max(score, 0.92);
    else if (emailLocal && (label === emailLocal || firstToken === emailLocal))
      score = Math.max(score, 0.9);
    else {
      // Fuzzy fallback against full name and first name
      score = Math.max(
        similarity(label, fullName) * 0.85,
        similarity(firstToken, first) * 0.8,
        similarity(label, emailLocal) * 0.7,
      );
    }

    if (score > best.confidence) best = { userId: c.id, confidence: Number(score.toFixed(3)) };
  }

  // Below this, treat as no confident match.
  if (best.confidence < 0.55) return { userId: null, confidence: best.confidence };
  return best;
}
