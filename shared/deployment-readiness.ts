/**
 * Deployment readiness board: the checks and the roll-up, for the
 * `deployment-readiness` edge function and the page that renders it.
 *
 * Pure and dependency-free so the Deno function and the unit tests import the
 * same code. Every check here is something the function actually looked at on
 * this request. Three rules:
 *
 * 1. A check nothing performs is not on the board. The function used to push
 *    TLS, RBAC and "Automated Backups" as `status: 'complete'` with
 *    `lastChecked: now` for every tenant - a "last checked" stamp on something
 *    no code checked. The backup scripts, in particular, had never been run
 *    when that row was written (LAUNCH-011). They are named in
 *    UNMEASURED_READINESS instead, which the page renders.
 *
 * 2. A read that failed is not a zero. A failed user count used to become
 *    "0 users configured" and a failed integrations read "0 active
 *    integrations". Both now report that the check could not run.
 *
 * 3. There is no launch estimate. The old one was today plus 7 days plus 2 per
 *    incomplete check - a number somebody picked, printed as a date.
 */

export type CheckStatus = 'complete' | 'incomplete' | 'warning' | 'in-progress';
export type Priority = 'high' | 'medium' | 'low';

export interface ReadinessCheck {
  id: string;
  category: string;
  name: string;
  description: string;
  status: CheckStatus;
  priority: Priority;
  lastChecked: string;
  details?: string;
}

export interface DeploymentMetrics {
  /** Percent of checks complete; null when there are no checks to count. */
  overallReadiness: number | null;
  criticalIssues: number;
  completedChecks: number;
  totalChecks: number;
  /** Things the board does not measure, rendered by the page. */
  unbacked: string[];
}

export const UNMEASURED_READINESS: readonly string[] = [
  'TLS certificates: nothing in this function inspects a certificate chain or its expiry.',
  'Backups: nothing here reads whether the nightly backup job ran or whether an archive restores.',
  'Access control: role enforcement is per edge function and is not probed from here.',
  'Launch date: no schedule is recorded anywhere, so no date is estimated.',
];

/** A count read that may have failed: null means the read did not succeed. */
export function countCheck(opts: {
  id: string;
  category: string;
  name: string;
  description: string;
  priority: Priority;
  count: number | null;
  noun: string;
  /** Status when the count is zero. */
  emptyStatus: CheckStatus;
  now: string;
  error?: string;
}): ReadinessCheck {
  const { count, noun } = opts;
  const base = {
    id: opts.id,
    category: opts.category,
    name: opts.name,
    description: opts.description,
    priority: opts.priority,
    lastChecked: opts.now,
  };
  if (count === null) {
    return {
      ...base,
      status: 'warning',
      details: `Could not be checked${opts.error ? `: ${opts.error}` : ''}`,
    };
  }
  return {
    ...base,
    status: count > 0 ? 'complete' : opts.emptyStatus,
    details: `${count} ${noun}${count === 1 ? '' : 's'}`,
  };
}

export function deriveReadinessMetrics(checks: ReadinessCheck[]): DeploymentMetrics {
  const totalChecks = checks.length;
  const completedChecks = checks.filter((c) => c.status === 'complete').length;
  const criticalIssues = checks.filter(
    (c) => c.priority === 'high' && c.status !== 'complete',
  ).length;
  return {
    overallReadiness: totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : null,
    criticalIssues,
    completedChecks,
    totalChecks,
    unbacked: [...UNMEASURED_READINESS],
  };
}
