import { useMemo } from 'react';
import { Target, TrendingUp, TrendingDown } from 'lucide-react';

interface QuotaGaugeProps {
  current: number;
  target: number;
  percent: number;
}

export default function QuotaGauge({ current, target, percent }: QuotaGaugeProps) {
  // Calculate arc parameters
  const { strokeDasharray, strokeDashoffset, color, status } = useMemo(() => {
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const arcLength = (270 / 360) * circumference; // 270 degree arc

    // Clamp percent between 0 and 150 for display
    const displayPercent = Math.min(Math.max(percent, 0), 150);
    const filledLength = (displayPercent / 100) * arcLength;
    const offset = arcLength - filledLength;

    // Determine color based on attainment
    let color = '';
    let status = '';

    if (percent >= 100) {
      color = '#22c55e'; // green-500
      status = 'On Target';
    } else if (percent >= 80) {
      color = '#eab308'; // yellow-500
      status = 'Close';
    } else if (percent >= 50) {
      color = '#f97316'; // orange-500
      status = 'Below Target';
    } else {
      color = '#ef4444'; // red-500
      status = 'Critical';
    }

    return {
      strokeDasharray: `${arcLength} ${circumference}`,
      strokeDashoffset: offset,
      color,
      status,
    };
  }, [percent]);

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const gap = target - current;
  const isOnTarget = percent >= 100;

  return (
    <div className="flex flex-col items-center justify-center h-[300px]">
      {/* SVG Gauge */}
      <div className="relative">
        <svg width="200" height="150" viewBox="0 0 200 150" className="overflow-visible">
          {/* Background arc */}
          <path
            d="M 25 125 A 80 80 0 1 1 175 125"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="16"
            strokeLinecap="round"
          />

          {/* Progress arc */}
          <path
            d="M 25 125 A 80 80 0 1 1 175 125"
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
            style={{
              transform: 'rotate(-225deg)',
              transformOrigin: '100px 125px',
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-bold" style={{ color }}>
            {percent.toFixed(0)}%
          </div>
          <div className="text-xs text-muted-foreground mt-1 font-medium">
            {status}
          </div>
        </div>

        {/* Target icon */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2">
          <div className="bg-background border-2 rounded-full p-1.5" style={{ borderColor: color }}>
            <Target className="h-4 w-4" style={{ color }} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 w-full max-w-sm space-y-3">
        {/* Current vs Target */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Current</span>
          <span className="font-semibold">{formatCurrency(current)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Target</span>
          <span className="font-semibold">{formatCurrency(target)}</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
          <div
            className="h-full transition-all duration-1000 ease-out rounded-full"
            style={{
              width: `${Math.min(percent, 100)}%`,
              backgroundColor: color,
            }}
          />
        </div>

        {/* Gap */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2 text-sm">
            {isOnTarget ? (
              <>
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-green-600 font-medium">Over Target</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-4 w-4 text-orange-600" />
                <span className="text-orange-600 font-medium">Gap to Target</span>
              </>
            )}
          </div>
          <span className={`font-bold ${isOnTarget ? 'text-green-600' : 'text-orange-600'}`}>
            {formatCurrency(Math.abs(gap))}
          </span>
        </div>

        {/* Achievement badges */}
        <div className="flex items-center justify-center gap-2 pt-3">
          {percent >= 25 && (
            <div className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
              25%
            </div>
          )}
          {percent >= 50 && (
            <div className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
              50%
            </div>
          )}
          {percent >= 75 && (
            <div className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
              75%
            </div>
          )}
          {percent >= 100 && (
            <div className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
              ✓ 100%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
