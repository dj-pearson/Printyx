/**
 * Lead Score Badge
 *
 * FN-003: Visual display of lead scoring with color-coded badges.
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LeadScoreBadgeProps {
  score: number;
  trend?: 'up' | 'down' | 'stable';
  showLabel?: boolean;
}

function getScoreConfig(score: number) {
  if (score >= 80) return { label: 'Hot', color: 'bg-red-100 text-red-800', ring: 'ring-red-500' };
  if (score >= 60)
    return { label: 'Warm', color: 'bg-orange-100 text-orange-800', ring: 'ring-orange-500' };
  if (score >= 40)
    return { label: 'Nurture', color: 'bg-yellow-100 text-yellow-800', ring: 'ring-yellow-500' };
  if (score >= 20)
    return { label: 'Cool', color: 'bg-blue-100 text-blue-800', ring: 'ring-blue-500' };
  return { label: 'Cold', color: 'bg-gray-100 text-gray-800', ring: 'ring-gray-400' };
}

export function LeadScoreBadge({ score, trend, showLabel = true }: LeadScoreBadgeProps) {
  const config = getScoreConfig(score);
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div className="flex items-center gap-1.5">
      {/* Score circle */}
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-full ring-2 ${config.ring} ${config.color} text-xs font-bold`}
      >
        {score}
      </div>

      {showLabel && (
        <Badge className={`${config.color} hover:${config.color} text-xs`}>{config.label}</Badge>
      )}

      {trend && (
        <TrendIcon
          className={`h-3 w-3 ${
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-400'
          }`}
        />
      )}
    </div>
  );
}
