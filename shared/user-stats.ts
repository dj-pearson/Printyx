/**
 * The four headline cards on /admin/user-management.
 *
 * Pure so the admin edge function and the tests share one definition. The
 * counts are scoped to the caller's tenant, the same way the user list beside
 * them is: the Express handler this replaces counted every user on the
 * platform, which put a platform-wide "Total Users" above a one-tenant table.
 *
 * A count whose read failed is null, and so is every rate built on it. The
 * page used to print `stat || 'Loading...'`, which turned a real 0 (no
 * suspended users - the normal case) into a loading message that never ended.
 */

export interface UserStatCounts {
  total: number | null;
  active: number | null;
  suspended: number | null;
  admins: number | null;
  newThisMonth: number | null;
}

export interface UserStats {
  totalUsers: number | null;
  userGrowth: string | null;
  activeUsers: number | null;
  activeRate: string | null;
  suspendedUsers: number | null;
  suspendedRate: string | null;
  adminUsers: number | null;
  adminPercentage: string | null;
  /** Card families whose read failed. */
  degraded: string[];
}

/** Role level at or above which a user counts as an admin (matches the admin function's own gate). */
export const ADMIN_ROLE_LEVEL = 6;

function rate(part: number | null, total: number | null, suffix: string): string | null {
  if (part === null || total === null || total === 0) return null;
  return `${((part / total) * 100).toFixed(1)}% ${suffix}`;
}

export function summariseUserStats(c: UserStatCounts): UserStats {
  const degraded = (Object.keys(c) as (keyof UserStatCounts)[]).filter((k) => c[k] === null);
  return {
    totalUsers: c.total,
    userGrowth: c.newThisMonth === null ? null : `+${c.newThisMonth} this month`,
    activeUsers: c.active,
    activeRate: rate(c.active, c.total, 'active'),
    suspendedUsers: c.suspended,
    suspendedRate: rate(c.suspended, c.total, 'of total'),
    adminUsers: c.admins,
    adminPercentage: rate(c.admins, c.total, 'of total'),
    degraded,
  };
}
