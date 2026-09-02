/**
 * The scope a list page is currently asking for (WF-R-05).
 *
 * Starts at the default for the caller's level - own for L1-2, team for L3-4, the
 * widest they hold above that - and returns a `scopeParam` to append to the query
 * key and the URL. The value is part of the QUERY KEY on purpose: two scopes are
 * two different result sets and caching them under one key shows the wrong rows
 * for a moment after switching.
 */

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { defaultTier, type ScopeTier } from '@/lib/record-scope';

export function useRecordScope(): {
  scope: ScopeTier;
  setScope: (tier: ScopeTier) => void;
  /** `scope=team`, or '' when the tier is the caller's own records. */
  scopeParam: string;
} {
  const { user } = useAuth();
  const level = user?.role?.level ?? 1;
  const [scope, setScope] = useState<ScopeTier>(() => defaultTier(level));
  return { scope, setScope, scopeParam: `scope=${scope}` };
}
