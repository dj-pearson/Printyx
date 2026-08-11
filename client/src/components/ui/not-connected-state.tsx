import { PlugZap } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * COP-I07: for a surface that has NO data source yet.
 *
 * The rule this enforces (from CRMX-001, and re-learned the hard way in
 * COP-B01): a screen with no backend must SAY it has no backend. Rendering
 * plausible invented numbers is strictly worse than rendering nothing, because
 * a plausible number gets quoted in a forecast, a QBR, or to a customer.
 *
 * This is distinct from EmptyState's normal use. "No deals yet" means the query
 * ran and returned nothing. This means the query does not exist.
 */
export function NotConnectedState({
  title,
  what,
  storyRef,
}: {
  /** e.g. "Predictive insights" */
  title: string;
  /** What would need to exist, in the user's terms. */
  what: string;
  /** Optional backlog reference, shown to internal users as provenance. */
  storyRef?: string;
}) {
  return (
    <EmptyState
      icon={PlugZap}
      title={`${title} are not connected yet`}
      description={`${what} This screen deliberately shows nothing rather than sample figures, so nothing here can be mistaken for your data.${
        storyRef ? ` (${storyRef})` : ''
      }`}
    />
  );
}
