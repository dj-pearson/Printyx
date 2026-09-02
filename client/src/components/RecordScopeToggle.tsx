/**
 * "Whose records am I looking at" for a list page (WF-R-05).
 *
 * It offers only the tiers the caller's role level entitles them to, because the
 * server clamps `?scope=` to exactly that ladder and a wider choice would just
 * silently return the same rows. Below level 3 there is only one tier to pick, so
 * the control renders NOTHING rather than a single dead button - a rep has no
 * choice to make and a disabled toggle only invites a support ticket.
 */

import { useAuth } from '@/hooks/useAuth';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { availableTiers, tierLabel, type ScopeTier } from '@/lib/record-scope';

interface RecordScopeToggleProps {
  value: ScopeTier;
  onChange: (tier: ScopeTier) => void;
  /** Announced to screen readers; name the records, e.g. "leads". */
  label: string;
  className?: string;
}

export function RecordScopeToggle({ value, onChange, label, className }: RecordScopeToggleProps) {
  const { user } = useAuth();
  const level = user?.role?.level ?? 1;
  const tiers = availableTiers(level);

  if (tiers.length < 2) return null;

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        // Radix reports '' when the active item is clicked again; keeping the
        // current tier is better than dropping the page to an empty filter.
        if (next) onChange(next as ScopeTier);
      }}
      aria-label={`Which ${label} to show`}
      className={className}
      size="sm"
      variant="outline"
    >
      {tiers.map((tier) => (
        <ToggleGroupItem key={tier} value={tier} className="min-h-[44px] px-3">
          {tierLabel(tier)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
