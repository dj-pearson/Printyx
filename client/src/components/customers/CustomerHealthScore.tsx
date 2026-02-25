/**
 * Customer Health Score
 *
 * FN-004: Visual health score indicator for customers.
 */

import { Heart, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CustomerHealthScoreProps {
  score: number; // 0-100
  factors?: {
    label: string;
    value: number; // 0-100
    weight: number; // 0-1
  }[];
  compact?: boolean;
}

function getHealthConfig(score: number) {
  if (score >= 80)
    return {
      label: 'Healthy',
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-100',
      bar: 'bg-green-500',
    };
  if (score >= 60)
    return {
      label: 'Good',
      icon: Heart,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      bar: 'bg-blue-500',
    };
  if (score >= 40)
    return {
      label: 'At Risk',
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bg: 'bg-yellow-100',
      bar: 'bg-yellow-500',
    };
  return {
    label: 'Critical',
    icon: TrendingDown,
    color: 'text-red-600',
    bg: 'bg-red-100',
    bar: 'bg-red-500',
  };
}

export function CustomerHealthScore({ score, factors, compact }: CustomerHealthScoreProps) {
  const config = getHealthConfig(score);
  const Icon = config.icon;

  if (compact) {
    return (
      <Badge className={`${config.bg} ${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {score}
      </Badge>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-full ${config.bg}`}>
            <Icon className={`h-4 w-4 ${config.color}`} />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Health Score: {score}/100</div>
            <div className={`text-xs ${config.color}`}>{config.label}</div>
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${config.bar} rounded-full transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Factors breakdown */}
      {factors && factors.length > 0 && (
        <div className="space-y-1.5">
          {factors.map((factor) => (
            <div key={factor.label} className="flex items-center gap-2 text-xs">
              <span className="text-gray-600 w-32 truncate">{factor.label}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${getHealthConfig(factor.value).bar}`}
                  style={{ width: `${factor.value}%` }}
                />
              </div>
              <span className="text-gray-500 w-8 text-right">{factor.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
