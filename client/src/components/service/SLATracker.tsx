/**
 * SLA Tracker
 *
 * FN-006: Shows SLA compliance tracking for service dispatch.
 */

import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SLATrackerProps {
  targetHours: number;
  elapsedHours: number;
  status: 'on_track' | 'at_risk' | 'breached';
  slaType: string;
}

export function SLATracker({ targetHours, elapsedHours, status, slaType }: SLATrackerProps) {
  const percentage = Math.min((elapsedHours / targetHours) * 100, 100);
  const remaining = Math.max(targetHours - elapsedHours, 0);

  const statusConfig = {
    on_track: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-500', label: 'On Track' },
    at_risk: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-500', label: 'At Risk' },
    breached: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-500', label: 'Breached' },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.color}`} />
          <span className="text-sm font-medium text-gray-700">{slaType}</span>
        </div>
        <Badge
          className={`${config.color} ${status === 'breached' ? 'bg-red-100' : status === 'at_risk' ? 'bg-yellow-100' : 'bg-green-100'}`}
        >
          {config.label}
        </Badge>
      </div>

      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${config.bg} rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-500">
        <span>{elapsedHours.toFixed(1)}h elapsed</span>
        <span>{remaining > 0 ? `${remaining.toFixed(1)}h remaining` : 'SLA breached'}</span>
        <span>Target: {targetHours}h</span>
      </div>
    </div>
  );
}
