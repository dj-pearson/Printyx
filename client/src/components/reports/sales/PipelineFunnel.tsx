import { useMemo } from 'react';
import { TrendingDown } from 'lucide-react';

interface PipelineStage {
  stage: string;
  count: number;
  totalValue: number;
  weightedValue: number;
  averageDealSize: number;
  conversionRate: number;
}

interface PipelineFunnelProps {
  stages: PipelineStage[];
  detailed?: boolean;
}

export default function PipelineFunnel({ stages, detailed = false }: PipelineFunnelProps) {
  // Calculate max value for sizing
  const maxValue = useMemo(() => {
    return Math.max(...stages.map(s => s.totalValue), 1);
  }, [stages]);

  // Calculate width percentage for each stage
  const getWidthPercent = (value: number) => {
    return Math.max((value / maxValue) * 100, 10); // Minimum 10% width
  };

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  // Stage colors
  const stageColors: Record<string, string> = {
    'Lead': 'bg-slate-500',
    'Qualified': 'bg-blue-500',
    'Proposal': 'bg-indigo-500',
    'Negotiation': 'bg-purple-500',
    'Closed Won': 'bg-green-500',
    'default': 'bg-gray-500'
  };

  const getStageColor = (stage: string) => {
    return stageColors[stage] || stageColors['default'];
  };

  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
        <TrendingDown className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">No Pipeline Data</p>
        <p className="text-sm">Start by creating opportunities to see your pipeline</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stages.map((stage, index) => {
        const widthPercent = getWidthPercent(stage.totalValue);
        const isLastStage = index === stages.length - 1;

        return (
          <div key={stage.stage} className="relative">
            {/* Stage bar */}
            <div
              className={`relative h-16 rounded-lg ${getStageColor(stage.stage)} transition-all duration-300 hover:opacity-90`}
              style={{ width: `${widthPercent}%` }}
            >
              {/* Stage info */}
              <div className="absolute inset-0 flex items-center justify-between px-4 text-white">
                <div className="flex-1">
                  <div className="font-semibold text-sm">{stage.stage}</div>
                  <div className="text-xs opacity-90">
                    {stage.count} {stage.count === 1 ? 'deal' : 'deals'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">
                    {formatCurrency(stage.totalValue)}
                  </div>
                  {detailed && (
                    <div className="text-xs opacity-90">
                      Avg: {formatCurrency(stage.averageDealSize)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Conversion rate arrow (between stages) */}
            {!isLastStage && stage.conversionRate > 0 && (
              <div className="absolute -bottom-2 left-4 bg-background border border-border rounded px-2 py-0.5 text-xs font-medium z-10">
                <span className={stage.conversionRate >= 50 ? 'text-green-600' : stage.conversionRate >= 25 ? 'text-yellow-600' : 'text-red-600'}>
                  {stage.conversionRate.toFixed(0)}%
                </span>
                <span className="text-muted-foreground ml-1">→</span>
              </div>
            )}

            {/* Detailed view additional metrics */}
            {detailed && (
              <div className="mt-2 ml-4 grid grid-cols-3 gap-4 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium">Weighted:</span>{' '}
                  {formatCurrency(stage.weightedValue)}
                </div>
                <div>
                  <span className="font-medium">Conversion:</span>{' '}
                  <span className={stage.conversionRate >= 50 ? 'text-green-600' : stage.conversionRate >= 25 ? 'text-yellow-600' : 'text-red-600'}>
                    {stage.conversionRate > 0 ? `${stage.conversionRate.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Win Rate:</span>{' '}
                  {stage.stage === 'Closed Won' ? '100%' : `${((stage.count / stages[0].count) * 100).toFixed(1)}%`}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Summary stats */}
      <div className="pt-4 border-t mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">
              {stages.reduce((sum, s) => sum + s.count, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Total Deals</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {formatCurrency(stages.reduce((sum, s) => sum + s.totalValue, 0))}
            </div>
            <div className="text-xs text-muted-foreground">Total Value</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {formatCurrency(stages.reduce((sum, s) => sum + s.weightedValue, 0))}
            </div>
            <div className="text-xs text-muted-foreground">Weighted Value</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {formatCurrency(
                stages.reduce((sum, s) => sum + s.totalValue, 0) /
                stages.reduce((sum, s) => sum + s.count, 0)
              )}
            </div>
            <div className="text-xs text-muted-foreground">Avg Deal Size</div>
          </div>
        </div>
      </div>
    </div>
  );
}
