import PipelineFunnel from '@/components/reports/sales/PipelineFunnel';
import { Trophy } from 'lucide-react';

interface PipelineStage {
  stage: string;
  count: number;
  totalValue: number;
  weightedValue: number;
  averageDealSize: number;
  conversionRate: number;
}

interface IndividualPipeline {
  userId: string;
  userName: string;
  pipeline: PipelineStage[];
  totalValue: number;
}

interface TeamPipelineViewProps {
  teamPipeline: PipelineStage[];
  individualPipelines: IndividualPipeline[];
  summary?: any;
  metrics?: any;
}

export default function TeamPipelineView({
  teamPipeline,
  individualPipelines,
  summary,
  metrics,
}: TeamPipelineViewProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className="space-y-6">
      {/* Team Aggregate Pipeline */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Team Pipeline (Aggregate)</h3>
        <PipelineFunnel stages={teamPipeline} />
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              Total Value
            </div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {formatCurrency(summary.totalTeamValue)}
            </div>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="text-sm font-medium text-green-900 dark:text-green-100 mb-1">
              Total Deals
            </div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {summary.totalTeamDeals}
            </div>
          </div>
          <div className="p-4 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-1">
              Avg Deal
            </div>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {formatCurrency(summary.averageDealSize)}
            </div>
          </div>
          <div className="p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
            <div className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-1">
              Conversion
            </div>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
              {summary.teamConversionRate?.toFixed(0)}%
            </div>
          </div>
        </div>
      )}

      {/* Individual Pipelines */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Individual Rep Pipelines</h3>
        <div className="space-y-4">
          {individualPipelines.slice(0, 10).map((rep, index) => (
            <div key={rep.userId} className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {index === 0 && <Trophy className="h-5 w-5 text-yellow-500" />}
                  <span className="font-semibold">{rep.userName}</span>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatCurrency(rep.totalValue)}</div>
                  <div className="text-xs text-muted-foreground">
                    {rep.pipeline.reduce((sum, s) => sum + s.count, 0)} deals
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {rep.pipeline.map((stage) => (
                  <div key={stage.stage} className="text-center">
                    <div className="text-xs text-muted-foreground">{stage.stage}</div>
                    <div className="font-semibold">{stage.count}</div>
                    <div className="text-xs">{formatCurrency(stage.totalValue)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
