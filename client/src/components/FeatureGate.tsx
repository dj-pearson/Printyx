/**
 * FeatureGate Component
 * US-035: Conditionally render children based on feature flag state.
 *
 * @example
 * <FeatureGate flag="new_dashboard">
 *   <NewDashboard />
 * </FeatureGate>
 *
 * <FeatureGate flag="beta_feature" fallback={<LegacyView />}>
 *   <BetaView />
 * </FeatureGate>
 */

import type { ReactNode } from 'react';
import { useFeatureFlag } from '../hooks/useFeatureFlag';

interface FeatureGateProps {
  /** The feature flag name to check */
  flag: string;
  /** Content to render when the flag is enabled */
  children: ReactNode;
  /** Optional content to render when the flag is disabled */
  fallback?: ReactNode;
}

export function FeatureGate({ flag, children, fallback = null }: FeatureGateProps) {
  const { enabled, isLoading } = useFeatureFlag(flag);

  // While loading, show fallback (or nothing) to avoid flash
  if (isLoading) {
    return <>{fallback}</>;
  }

  return <>{enabled ? children : fallback}</>;
}

export default FeatureGate;
